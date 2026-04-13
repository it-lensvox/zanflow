# File: apps/daily_updates/management/commands/send_event_reminders.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.daily_updates.models import Event
from apps.notification.services import notify_event_reminder

class Command(BaseCommand):
    help = 'Sends notifications for events starting in exactly 10 minutes'

    def handle(self, *args, **kwargs):
        now = timezone.now()
        
        # We look for events starting between 9 minutes 30 seconds and 10 minutes 30 seconds from now.
        # This provides a 1-minute window so the cron job catches it without sending duplicates.
        target_start_time = now + timedelta(minutes=9, seconds=30)
        target_end_time = now + timedelta(minutes=10, seconds=30)

        upcoming_events = Event.objects.filter(
            start_time__gte=target_start_time,
            start_time__lte=target_end_time
        )

        notified_count = 0
        for event in upcoming_events:
            notify_event_reminder(event)
            notified_count += 1

        self.stdout.write(self.style.SUCCESS(f'Successfully sent {notified_count} event reminders.'))