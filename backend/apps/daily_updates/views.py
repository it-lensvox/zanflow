from rest_framework import viewsets, permissions, status
from django.db.models import Q
from .models import DailyUpdate, Event
from .serializers import DailyUpdateSerializer, EventSerializer
from rest_framework.response import Response

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow the user who created the update to edit it.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.user == request.user

class DailyUpdateViewSet(viewsets.ModelViewSet):
    serializer_class = DailyUpdateSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        
        is_manager = user.is_staff or user.is_superuser or getattr(user, 'role', '') in ['admin', 'manager']

        if is_manager:
            # FIXED: Using user__organization instead of user__workspace
            queryset = DailyUpdate.objects.filter(user__organization=user.organization)
        else:
            queryset = DailyUpdate.objects.filter(user=user)
            
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date and end_date:
            queryset = queryset.filter(date__range=[start_date, end_date])
            
        return queryset

    def create(self, request, *args, **kwargs):
        # Automatically "Upsert": Catch if the user already has an update for this date
        date = request.data.get('date')
        if date:
            existing_update = DailyUpdate.objects.filter(user=request.user, date=date).first()
            if existing_update:
                # Update the existing record instead of trying to create a duplicate
                serializer = self.get_serializer(existing_update, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                self.perform_update(serializer)
                return Response(serializer.data, status=status.HTTP_200_OK)
        
        # Otherwise, proceed with normal creation
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        # Automatically assign the logged-in user when creating a new update
        serializer.save(user=self.request.user)

class EventViewSet(viewsets.ModelViewSet):
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        # Users can see events they organized or are invited to
        queryset = Event.objects.filter(
            Q(organizer=user) | Q(attendees=user)
        ).distinct()
            
        # Optional date filtering for the calendar view
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date and end_date:
            queryset = queryset.filter(
                start_time__date__gte=start_date,
                end_time__date__lte=end_date
            )
        elif start_date:
            queryset = queryset.filter(start_time__date__gte=start_date)
            
        return queryset

    def perform_create(self, serializer):
        # Automatically set the organizer to the logged-in user
        serializer.save(organizer=self.request.user)