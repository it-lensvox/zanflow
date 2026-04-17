from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from django.db.models import Q
from datetime import datetime, timedelta
from dateutil.parser import parse
from .models import DailyUpdate, Event
from .serializers import DailyUpdateSerializer, EventSerializer
from rest_framework.decorators import action
class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow the user who created the update to edit it.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.user == request.user

class IsOrganizerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow the organizer of the event to edit it.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.organizer == request.user

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
    # Apply the new permission class here
    permission_classes = [permissions.IsAuthenticated, IsOrganizerOrReadOnly]

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
    @action(detail=False, methods=['get'])
    def check_availability(self, request):
        """
        Check if a specific attendee is available for a given time slot
        before attempting to create or update an event.
        """
        attendee_id = request.query_params.get('attendee_id')
        start_time_str = request.query_params.get('start_time')
        end_time_str = request.query_params.get('end_time')
        event_id = request.query_params.get('event_id')  # Optional: Pass if updating an existing event

        # 1. Validate inputs
        if not all([attendee_id, start_time_str, end_time_str]):
            return Response(
                {"error": "attendee_id, start_time, and end_time are required parameters."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            start_time = parse(start_time_str)
            end_time = parse(end_time_str)
        except Exception:
            return Response({"error": "Invalid date/time format."}, status=status.HTTP_400_BAD_REQUEST)

        if start_time >= end_time:
            return Response({"error": "End time must be after start time."}, status=status.HTTP_400_BAD_REQUEST)

        event_date = start_time.date()
        
        # Base QuerySet
        existing_events = Event.objects.all()
        if event_id:
            # Exclude the current event if we are checking availability during an update
            existing_events = existing_events.exclude(id=event_id)

        # 2. Rule A: Maximum 5 events per day check
        daily_event_count = existing_events.filter(
            attendees__id=attendee_id,
            start_time__date=event_date
        ).count()

        if daily_event_count >= 5:
            return Response({
                "is_available": False,
                "reason": f"They have already reached the maximum limit of 5 events on {event_date}."
            })

        # 3. Rule B: Time Overlap Check
        overlapping_events = existing_events.filter(
            attendees__id=attendee_id,
            start_time__lt=end_time,
            end_time__gt=start_time
        )

        if overlapping_events.exists():
            return Response({
                "is_available": False,
                "reason": "They already have a conflicting event scheduled during this time."
            })

        # If it passes both rules
        return Response({"is_available": True})
    def create(self, request, *args, **kwargs):
        is_recurring = request.data.get('is_recurring', False)
        
        # 1. STANDARD EVENT: If it's not recurring, use the normal creation process
        if not is_recurring:
            return super().create(request, *args, **kwargs)

        # 2. RECURRING EVENT: Extract recurrence data
        recurring_days = request.data.get('recurring_days', []) # e.g., [0, 3]
        recurrence_end_date_str = request.data.get('recurrence_end_date')
        
        if not recurring_days or not recurrence_end_date_str:
            return Response(
                {"error": "recurring_days and recurrence_end_date are required for recurring events."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        recurrence_end_date = parse(recurrence_end_date_str).date()
        
        # Parse the initial start and end times
        current_start_time = parse(request.data.get('start_time'))
        current_end_time = parse(request.data.get('end_time'))
        
        # We will store all generated events to return them
        created_events = []
        errors = []

        # 3. GENERATE OCCURRENCES
        # Loop day by day until we hit the end date
        current_date = current_start_time.date()
        
        while current_date <= recurrence_end_date:
            # Check if the current day of the week is in our target days (0=Mon, 3=Thu)
            if current_date.weekday() in recurring_days:
                
                # Create a copy of the request data for this specific occurrence
                event_data = request.data.copy()
                
                # Update the times for this specific date
                event_data['start_time'] = datetime.combine(current_date, current_start_time.time())
                event_data['end_time'] = datetime.combine(current_date, current_end_time.time())
                
                # Pass data to serializer (this automatically triggers the validation rules 
                # we wrote earlier for limits and overlaps!)
                serializer = self.get_serializer(data=event_data)
                
                if serializer.is_valid():
                    # Save the event and assign the organizer
                    self.perform_create(serializer)
                    created_events.append(serializer.data)
                else:
                    # If it fails validation (e.g., overlap on a specific Thursday), record the error
                    errors.append({
                        "date": str(current_date),
                        "errors": serializer.errors
                    })
            
            # Move to the next day
            current_date += timedelta(days=1)

        # 4. RETURN RESPONSE
        # If some dates failed, we let the user know, but still return the successful ones
        response_data = {
            "message": f"Successfully created {len(created_events)} events.",
            "created_events": created_events,
            "conflicts_skipped": errors
        }
        
        # Return 207 Multi-Status if there were partial failures, otherwise 201 Created
        response_status = status.HTTP_207_MULTI_STATUS if errors else status.HTTP_201_CREATED
        
        return Response(response_data, status=response_status)

    def perform_create(self, serializer):
        # Automatically set the organizer to the logged-in user
        serializer.save(organizer=self.request.user)