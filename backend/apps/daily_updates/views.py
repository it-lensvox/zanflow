from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from django.db.models import Q
from datetime import datetime, timedelta, time
from dateutil.parser import parse
from django.utils.dateparse import parse_date
from django.utils import timezone
from .utils import find_available_slots
from .models import DailyUpdate, Event, EventInvitation
from .serializers import DailyUpdateSerializer, EventSerializer, EventInvitationSerializer
from rest_framework.decorators import action
from apps.notification.services import notify_organizer_rsvp
from dateutil.relativedelta import relativedelta
import uuid # Recommended for grouping recurring events
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
        
        # CHANGED: We now allow 'PENDING' events to be returned so they render on the calendar!
        queryset = Event.objects.filter(
            Q(organizer=user) | 
            Q(invitations__user=user, invitations__status__in=['ACCEPTED', 'PENDING'])
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

        # 2. Time Overlap Check
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
        
        # 1. STANDARD EVENT
        if not is_recurring:
            return super().create(request, *args, **kwargs)

        # 2. RECURRING EVENT SETUP
        # Patterns: DAILY, WORK_WEEK, WEEKLY, MONTHLY, YEARLY
        recurrence_pattern = request.data.get('recurrence_pattern', 'WEEKLY').upper()
        recurring_days = request.data.get('recurring_days', []) 
        recurrence_end_date_str = request.data.get('recurrence_end_date')
        
        if not recurrence_end_date_str:
            return Response(
                {"error": "recurrence_end_date is required for recurring events."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        recurrence_end_date = parse(recurrence_end_date_str).date()
        current_start_time = parse(request.data.get('start_time'))
        current_end_time = parse(request.data.get('end_time'))
        
        created_events = []
        errors = []
        
        # Optional but highly recommended: Link these events together
        recurrence_group_id = str(uuid.uuid4())

        # 3. GENERATE OCCURRENCES
        current_date = current_start_time.date()
        months_added = 0
        years_added = 0
        
        while current_date <= recurrence_end_date:
            create_this_occurrence = False
            
            # Check if an event should be created on this specific day
            if recurrence_pattern == 'DAILY':
                create_this_occurrence = True
                
            elif recurrence_pattern == 'WORK_WEEK':
                if current_date.weekday() < 5: # 0-4 are Monday-Friday
                    create_this_occurrence = True
                    
            elif recurrence_pattern == 'WEEKLY':
                if current_date.weekday() in recurring_days:
                    create_this_occurrence = True
                    
            elif recurrence_pattern in ['MONTHLY', 'YEARLY']:
                # The relativedelta math handles the date matching automatically
                create_this_occurrence = True

            # Create the event if it matches the pattern
            if create_this_occurrence:
                event_data = request.data.copy()
                event_data['start_time'] = datetime.combine(current_date, current_start_time.time())
                event_data['end_time'] = datetime.combine(current_date, current_end_time.time())
                # If you add the UUID to models.py, pass it here:
                # event_data['recurrence_group_id'] = recurrence_group_id
                
                serializer = self.get_serializer(data=event_data)
                
                if serializer.is_valid():
                    self.perform_create(serializer)
                    created_events.append(serializer.data)
                else:
                    errors.append({
                        "date": str(current_date),
                        "errors": serializer.errors
                    })
            
            # 4. SMART INCREMENTING 
            # We add to the *original* start date to prevent month-end drift
            if recurrence_pattern == 'MONTHLY':
                months_added += 1
                current_date = current_start_time.date() + relativedelta(months=months_added)
            elif recurrence_pattern == 'YEARLY':
                years_added += 1
                current_date = current_start_time.date() + relativedelta(years=years_added)
            else:
                # Daily, Work Week, and Weekly just move forward day-by-day
                current_date += timedelta(days=1)

        # 5. RETURN RESPONSE
        response_data = {
            "message": f"Successfully created {len(created_events)} events.",
            "created_events": created_events,
            "conflicts_skipped": errors
        }
        
        response_status = status.HTTP_207_MULTI_STATUS if errors else status.HTTP_201_CREATED
        return Response(response_data, status=response_status)
    
    @action(detail=True, methods=['get'], url_path='rsvp-status')
    def rsvp_status(self, request, pk=None):
        """
        Returns a detailed list of all attendees and their current RSVP status for this event.
        """
        event = self.get_object()
        
        # Security: Only the organizer or people involved in the event should see the status
        if request.user != event.organizer and not event.invitations.filter(user=request.user).exists():
            return Response(
                {"error": "You do not have permission to view this event's RSVP status."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Fetch all invitations for this specific event, optimizing the user query
        invitations = event.invitations.select_related('user').all()
        
        status_data = []
        for inv in invitations:
            status_data.append({
                "user_id": inv.user.id,
                "name": inv.user.get_full_name() or inv.user.username,
                "status": inv.status,
                "decline_reason": inv.decline_reason,
                "proposed_reschedule_time": inv.proposed_reschedule_time
            })
            
        return Response({
            "event_id": event.id,
            "organizer": event.organizer.get_full_name() or event.organizer.username,
            "attendee_status": status_data
        })
    @action(detail=False, methods=['post'], url_path='suggest-slots')
    def suggest_slots(self, request):
        """
        Calculates shared availability for a group of users on a specific date.
        """
        attendee_ids = request.data.get('attendee_ids', [])
        target_date_str = request.data.get('target_date')
        duration_minutes = int(request.data.get('duration_minutes', 30))

        if not attendee_ids or not target_date_str:
            return Response(
                {"error": "attendee_ids and target_date are required."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target_date = parse_date(target_date_str)
        except ValueError:
            return Response(
                {"error": "Invalid date format. Use YYYY-MM-DD."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Define standard working hours (e.g., 9:00 AM to 6:00 PM)
        # Using timezone.make_aware ensures we respect the server/user's timezone settings
        day_start = timezone.make_aware(datetime.combine(target_date, time(9, 0)))
        day_end = timezone.make_aware(datetime.combine(target_date, time(18, 0)))

        # 2. Fetch all events for the requested attendees on this specific date
        # We only care about events where they are the organizer, or they ACCEPTED/PENDING the invite
        events = Event.objects.filter(
            start_time__date=target_date
        ).filter(
            Q(organizer_id__in=attendee_ids) |
            Q(invitations__user_id__in=attendee_ids, invitations__status__in=['ACCEPTED', 'PENDING'])
        ).distinct()

        # 3. Extract the busy blocks
        busy_intervals = []
        for event in events:
            busy_intervals.append((event.start_time, event.end_time))

        # 4. Run the math engine
        # (Assuming you imported find_available_slots from utils.py, or pasted it above)
        available_slots = find_available_slots(
            busy_intervals, 
            day_start, 
            day_end, 
            duration_minutes
        )

        # 5. Format the output to strictly use ISO 8601 strings for the frontend
        formatted_slots = [slot.isoformat() for slot in available_slots]

        return Response({
            "target_date": target_date_str,
            "duration_minutes": duration_minutes,
            "available_slots": formatted_slots
        })
    def perform_create(self, serializer):
        # Automatically set the organizer to the logged-in user
        serializer.save(organizer=self.request.user)

class EventInvitationViewSet(viewsets.ModelViewSet):
    """
    Handles the RSVP actions for Event Invitations triggered from notifications.
    """
    queryset = EventInvitation.objects.all()
    serializer_class = EventInvitationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # Security: Users can only interact with their own invitations
        return self.queryset.filter(user=self.request.user)

    @action(detail=True, methods=['patch'])
    def accept(self, request, pk=None):
        invitation = self.get_object()
        invitation.status = 'ACCEPTED'
        invitation.save()
        
        # NEW: Notify Organizer
        notify_organizer_rsvp(invitation, 'ACCEPTED')
        
        return Response({'message': 'Event accepted successfully.'})

    @action(detail=True, methods=['patch'])
    def decline(self, request, pk=None):
        invitation = self.get_object()
        reason = request.data.get('reason', '')
        
        invitation.status = 'DECLINED'
        invitation.decline_reason = reason
        invitation.save()
        
        # NEW: Notify Organizer
        notify_organizer_rsvp(invitation, 'DECLINED')
        
        return Response({'message': 'Event declined.'})

    @action(detail=True, methods=['patch'])
    def reschedule(self, request, pk=None):
        invitation = self.get_object()
        proposed_time = request.data.get('proposed_time')
        
        if not proposed_time:
            return Response({'error': 'proposed_time is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        invitation.status = 'RESCHEDULE_REQUESTED'
        invitation.proposed_reschedule_time = proposed_time
        invitation.save()
        
        # NEW: Notify Organizer
        notify_organizer_rsvp(invitation, 'RESCHEDULE')
        
        return Response({'message': 'Reschedule request sent to organizer.'})