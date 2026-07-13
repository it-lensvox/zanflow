from django.db import transaction
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import CustomDashboard, UserPreference
from .serializers import CustomDashboardSerializer, UserPreferenceSerializer


class UserPreferenceView(APIView):
    """
    GET  /api/v1/dashboard/preferences/
        Returns the authenticated user's saved preferences, merging any missing
        keys with their defaults so the response shape is always complete.

    PATCH /api/v1/dashboard/preferences/
        Merges the supplied keys into the stored preferences object.
        Unknown keys are ignored; omitted keys are left untouched.
        Returns the full updated preferences object.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_or_init(self, user):
        """Return the UserPreference row, or an unsaved stub with empty data."""
        try:
            return UserPreference.objects.get(user=user)
        except UserPreference.DoesNotExist:
            return UserPreference(user=user, data={})

    def get(self, request):
        pref = self._get_or_init(request.user)
        serializer = UserPreferenceSerializer(pref)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        pref = self._get_or_init(request.user)

        # Validate only the keys the client sent
        serializer = UserPreferenceSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # Merge validated keys into the stored JSON blob
        pref.data.update(serializer.validated_data)
        pref.save()

        # Return the full representation (defaults filled in for any missing keys)
        return Response(
            UserPreferenceSerializer(pref).data,
            status=status.HTTP_200_OK,
        )


class CustomDashboardViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CustomDashboardSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _workspace_id(self):
        return self.request.headers.get("X-Workspace-ID", "")

    def get_queryset(self):
        return CustomDashboard.objects.filter(
            user=self.request.user,
            workspace_id=self._workspace_id(),
        )

    # ------------------------------------------------------------------
    # Enforce is_default uniqueness inside a transaction
    # ------------------------------------------------------------------

    def _clear_other_defaults(self, current_dashboard):
        """Set is_default=False on every other dashboard owned by this user in this workspace."""
        CustomDashboard.objects.filter(
            user=self.request.user,
            workspace_id=self._workspace_id(),
        ).exclude(pk=current_dashboard.pk).update(is_default=False)

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            dashboard = serializer.save(
                user=request.user,
                workspace_id=self._workspace_id(),
            )
            if dashboard.is_default:
                self._clear_other_defaults(dashboard)

        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )

    # ------------------------------------------------------------------
    # Partial update (PATCH)
    # ------------------------------------------------------------------

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            dashboard = serializer.save()
            if dashboard.is_default:
                self._clear_other_defaults(dashboard)

        return Response(serializer.data, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()  # 404 if not owned by this user/workspace
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)