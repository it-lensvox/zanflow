"""
Views for the teams app.
REST API endpoints for team and member management.
"""
from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters import rest_framework as filters

from .models import Team, TeamMember, TeamRole, TeamType
from .permissions import (
    IsTeamMember,
    IsTeamManager,
    IsTeamOwner,
    TeamPermissionMixin,
    CanManageTeamMember,
)
from .serializers import (
    TeamListSerializer,
    TeamDetailSerializer,
    TeamCreateSerializer,
    TeamUpdateSerializer,
    TeamMemberSerializer,
    TeamMemberCreateSerializer,
    TeamMemberBulkCreateSerializer,
    TeamMemberUpdateSerializer,
    UserMinimalSerializer,
)
from .services import TeamService, TeamMemberService, TeamServiceError

User = get_user_model()


class TeamFilter(filters.FilterSet):
    """Filter class for teams."""
    
    name = filters.CharFilter(lookup_expr="icontains")
    team_type = filters.ChoiceFilter(choices=TeamType.choices)
    created_after = filters.DateTimeFilter(field_name="created_at", lookup_expr="gte")
    created_before = filters.DateTimeFilter(field_name="created_at", lookup_expr="lte")
    
    class Meta:
        model = Team
        fields = ["name", "team_type"]


class TeamViewSet(TeamPermissionMixin, viewsets.ModelViewSet):
    """
    ViewSet for Team CRUD operations.
    
    Endpoints:
    - GET /teams/ - List all teams user belongs to
    - POST /teams/ - Create a new team
    - GET /teams/{id}/ - Get team details
    - PUT/PATCH /teams/{id}/ - Update team
    - DELETE /teams/{id}/ - Delete team (soft delete)
    
    Additional actions:
    - GET /teams/my-teams/ - Get only teams where user is a member
    - POST /teams/{id}/leave/ - Leave a team
    """
    
    filterset_class = TeamFilter
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at", "team_type"]
    ordering = ["-created_at"]
    
    def get_queryset(self):
        user = self.request.user
        
        member_team_ids = TeamMember.objects.filter(
            user=user,
            deleted_at__isnull=True
        ).values_list("team_id", flat=True)
        
        return Team.objects.filter(
            id__in=member_team_ids
        ).select_related("leader").prefetch_related("favorited_by", "members__user")
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        # Change 'list' and 'my_teams' to use TeamDetailSerializer instead of TeamListSerializer
        if self.action in ["list", "my_teams"]:
            return TeamDetailSerializer
        if self.action == "create":
            return TeamCreateSerializer
        if self.action in ["update", "partial_update"]:
            return TeamUpdateSerializer
        return TeamDetailSerializer
    
    def get_permissions(self):
        """Return appropriate permissions based on action."""
        if self.action == "create":
            return [IsAuthenticated()]
        if self.action in ["update", "partial_update"]:
            return [IsAuthenticated(), IsTeamManager()]
        if self.action == "destroy":
            return [IsAuthenticated(), IsTeamOwner()]
        return [IsAuthenticated()]
    
    def create(self, request, *args, **kwargs):
        """Create a new team with the current user as owner."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            team = serializer.save()
            # Return detailed response
            response_serializer = TeamDetailSerializer(
                team,
                context={"request": request}
            )
            return Response(
                response_serializer.data,
                status=status.HTTP_201_CREATED
            )
        except TeamServiceError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def destroy(self, request, *args, **kwargs):
        """
        Delete a team. 
        Only the team leader (owner) is permitted to delete.
        """
        team = self.get_object()
        
        # Check if the requesting user is the assigned team leader
        if team.leader != request.user:
            return Response(
                {"detail": "Only the team leader can delete this team."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            # Using your TeamService for consistent soft-deletion logic
            TeamService.delete_team(
                team=team,
                deleted_by=request.user,
                hard_delete=False  # Keep it False to use your soft-delete logic
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=["post"])
    def favorite(self, request, pk=None):
        """Toggle favorite status for the current user."""
        team = self.get_object()
        user = request.user
        
        if team.favorited_by.filter(id=user.id).exists():
            team.favorited_by.remove(user)
            return Response({"is_favourite": False}, status=status.HTTP_200_OK)
        else:
            team.favorited_by.add(user)
            return Response({"is_favourite": True}, status=status.HTTP_200_OK)

    # @action(detail=False, methods=["get"])
    # def favorites(self, request):
    #     """List only teams favorited by the current user."""
    #     queryset = self.get_queryset().filter(favorited_by=request.user)
    #     # Reuse your existing list logic
    #     page = self.paginate_queryset(queryset)
    #     serializer = TeamListSerializer(page or queryset, many=True, context={"request": request})
    #     return self.get_paginated_response(serializer.data) if page else Response(serializer.data)
    
    @action(detail=False, methods=["get"])
    def my_teams(self, request):
        """Get teams where current user is a member."""
        queryset = self.filter_queryset(self.get_queryset())
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = TeamListSerializer(
                page,
                many=True,
                context={"request": request}
            )
            return self.get_paginated_response(serializer.data)
        
        serializer = TeamListSerializer(
            queryset,
            many=True,
            context={"request": request}
        )
        return Response(serializer.data)
    
    @action(detail=True, methods=["post"])
    def leave(self, request, pk=None):
        """Leave a team voluntarily."""
        team = self.get_object()
        
        try:
            TeamMemberService.leave_team(team=team, user=request.user)
            return Response(
                {"detail": "Successfully left the team"},
                status=status.HTTP_200_OK
            )
        except TeamServiceError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class TeamMemberViewSet(TeamPermissionMixin, viewsets.ViewSet):
    """
    ViewSet for managing team members.
    
    Endpoints:
    - GET /teams/{team_id}/members/ - List team members
    - POST /teams/{team_id}/members/ - Add a member
    - POST /teams/{team_id}/members/bulk/ - Add multiple members
    - GET /teams/{team_id}/members/{id}/ - Get member details
    - PATCH /teams/{team_id}/members/{id}/ - Update member role
    - DELETE /teams/{team_id}/members/{id}/ - Remove member
    """
    
    permission_classes = [IsAuthenticated]
    
    def get_team(self):
        """Get the team from URL kwargs."""
        team_id = self.kwargs.get("team_id")
        return get_object_or_404(Team, id=team_id)
    
    def list(self, request, team_id=None):
        """List all members of a team."""
        team = self.get_team()
        
        # Check if user is a member
        if not team.is_member(request.user):
            return Response(
                {"detail": "You are not a member of this team"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        members = TeamMember.objects.filter(
            team=team,
            deleted_at__isnull=True
        ).select_related("user").order_by("-role", "joined_at")
        
        serializer = TeamMemberSerializer(members, many=True)
        return Response(serializer.data)
    
    def create(self, request, team_id=None):
        """Add a new member to the team."""
        team = self.get_team()
        
        # Check management permission
        if not team.can_user_manage(request.user):
            return Response(
                {"detail": "You don't have permission to add members"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = TeamMemberCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            user = User.objects.get(id=serializer.validated_data["user_id"])
            member = TeamMemberService.add_member(
                team=team,
                user=user,
                role=serializer.validated_data.get("role", TeamRole.MEMBER),
                added_by=request.user
            )
            return Response(
                TeamMemberSerializer(member).data,
                status=status.HTTP_201_CREATED
            )
        except TeamServiceError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=["post"])
    def bulk(self, request, team_id=None):
        """Add multiple members to the team."""
        team = self.get_team()
        
        if not team.can_user_manage(request.user):
            return Response(
                {"detail": "You don't have permission to add members"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = TeamMemberBulkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            members = TeamMemberService.add_members_bulk(
                team=team,
                user_ids=serializer.validated_data["user_ids"],
                role=serializer.validated_data.get("role", TeamRole.MEMBER),
                added_by=request.user
            )
            return Response(
                TeamMemberSerializer(members, many=True).data,
                status=status.HTTP_201_CREATED
            )
        except TeamServiceError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def retrieve(self, request, team_id=None, pk=None):
        """Get details of a specific team member."""
        team = self.get_team()
        
        if not team.is_member(request.user):
            return Response(
                {"detail": "You are not a member of this team"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        member = get_object_or_404(
            TeamMember,
            id=pk,
            team=team,
            deleted_at__isnull=True
        )
        
        serializer = TeamMemberSerializer(member)
        return Response(serializer.data)
    
    def partial_update(self, request, team_id=None, pk=None):
        """Update a team member's role."""
        team = self.get_team()
        
        member = get_object_or_404(
            TeamMember,
            id=pk,
            team=team,
            deleted_at__isnull=True
        )
        
        serializer = TeamMemberUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            updated_member = TeamMemberService.update_member_role(
                team=team,
                user=member.user,
                new_role=serializer.validated_data["role"],
                updated_by=request.user
            )
            return Response(TeamMemberSerializer(updated_member).data)
        except PermissionError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
        except TeamServiceError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def destroy(self, request, team_id=None, pk=None):
        """Remove a member from the team."""
        team = self.get_team()
        
        member = get_object_or_404(
            TeamMember,
            id=pk,
            team=team,
            deleted_at__isnull=True
        )
        
        try:
            TeamMemberService.remove_member(
                team=team,
                user=member.user,
                removed_by=request.user,
                hard_delete=False
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except PermissionError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
        except TeamServiceError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class TeamChoicesView(APIView):
    """
    API view to get available choices for team creation.
    Returns team types only.
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Return all available choices."""
        return Response({
            "team_types": [
                {"value": choice[0], "label": choice[1]}
                for choice in TeamType.choices
            ],
        })


class AvailableUsersView(generics.ListAPIView):
    """
    API view to get available users for adding to a team.
    Excludes users who are already members.
    """
    
    permission_classes = [IsAuthenticated]
    serializer_class = UserMinimalSerializer
    
    def get_queryset(self):
        """Get users not already in the specified team."""
        team_id = self.kwargs.get("team_id")
        
        if team_id:
            try:
                team = Team.objects.get(id=team_id)
                existing_member_ids = team.members.filter(
                    deleted_at__isnull=True
                ).values_list("user_id", flat=True)
                return User.objects.exclude(id__in=existing_member_ids)
            except Team.DoesNotExist:
                pass
        
        return User.objects.all()
    
    def get(self, request, *args, **kwargs):
        """Return available users with optional search."""
        queryset = self.get_queryset()
        
        # Apply search if provided
        search = request.query_params.get("search", "")
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )
        
        # Limit results
        queryset = queryset[:20]
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class AllUsersSearchView(generics.ListAPIView):
    """
    API view to search all users (for team creation).
    """
    
    permission_classes = [IsAuthenticated]
    serializer_class = UserMinimalSerializer
    
    def get_queryset(self):
        """Search users by email or name."""
        queryset = User.objects.all()
        
        search = self.request.query_params.get("search", "")
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )
        
        return queryset[:20]