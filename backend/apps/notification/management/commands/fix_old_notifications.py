from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.notification.models import Notification
from apps.notification.services import delete_expired_notifications

class Command(BaseCommand):
    help = 'Safely cleans up orphaned and expired notifications in production'

    def handle(self, *args, **options):
        self.stdout.write("Starting notification cleanup...")

        # 1. Clean up ORPHANS (Notifications whose Task/Project no longer exists)
        # We check notifications that have a content_type but no actual related object
        notifications = Notification.objects.exclude(content_type__isnull=True)
        orphan_count = 0
        
        for n in notifications:
            if not n.content_object:
                n.delete()
                orphan_count += 1
        
        self.stdout.write(self.style.SUCCESS(f"Deleted {orphan_count} orphaned notifications."))

        # 2. Clean up EXPIRED (7 days for read, 15 days for unread)
        # This calls your existing service logic
        expiry_results = delete_expired_notifications()
        
        self.stdout.write(
            self.style.SUCCESS(
                f"Expired cleanup: Deleted {expiry_results['read_deleted']} read "
                f"and {expiry_results['unread_deleted']} unread notifications."
            )
        )