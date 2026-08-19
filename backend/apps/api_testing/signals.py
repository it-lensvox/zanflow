"""
Django signals for API Testing Platform.

Handles:
- Post-save actions
- Audit logging
- Cache invalidation
- Notifications
"""
import logging
from django.db.models.signals import post_save, pre_delete, post_delete
from django.dispatch import receiver
from django.utils import timezone

from .models import (
    APICollection,
    APIEndpoint,
    AuthCredential,
    ExecutionRun,
    ExecutionResult,
)

logger = logging.getLogger(__name__)


@receiver(post_save, sender=APICollection)
def collection_saved(sender, instance, created, **kwargs):
    """
    Handle collection save events.
    
    - Log creation/update
    - Clear any relevant caches
    """
    if created:
        logger.info(
            f"API Collection created: {instance.name} (ID: {instance.id}) "
            f"by {instance.created_by}"
        )
    else:
        logger.debug(f"API Collection updated: {instance.name}")


@receiver(post_save, sender=APIEndpoint)
def endpoint_saved(sender, instance, created, **kwargs):
    """
    Handle endpoint save events.
    
    - Log creation/update
    - Update collection's updated_at timestamp
    """
    if created:
        logger.info(
            f"API Endpoint created: [{instance.http_method}] {instance.name} "
            f"in collection {instance.collection.name}"
        )
    
    # Touch the parent collection's updated_at
    APICollection.objects.filter(pk=instance.collection_id).update(
        updated_at=timezone.now()
    )


@receiver(post_save, sender=AuthCredential)
def credential_saved(sender, instance, created, **kwargs):
    """
    Handle credential save events.
    
    SECURITY: Only log non-sensitive information.
    """
    if created:
        logger.info(
            f"Auth Credential created: {instance.name} "
            f"(Type: {instance.auth_type}) by {instance.created_by}"
        )
    else:
        logger.info(f"Auth Credential updated: {instance.name}")


@receiver(pre_delete, sender=AuthCredential)
def credential_pre_delete(sender, instance, **kwargs):
    """
    Handle credential deletion.
    
    SECURITY: Log deletion for audit purposes.
    """
    logger.warning(
        f"Auth Credential being deleted: {instance.name} (ID: {instance.id})"
    )


@receiver(post_save, sender=ExecutionRun)
def execution_run_completed(sender, instance, created, **kwargs):
    """
    Handle execution run completion.
    
    - Log completion status
    - Trigger notifications if needed
    """
    if not created and instance.status in ['completed', 'failed', 'partial_failure']:
        collection_name = instance.collection.name if instance.collection else 'Single API'
        
        logger.info(
            f"Execution run completed: {collection_name} - "
            f"Status: {instance.status}, "
            f"Success: {instance.successful_count}/{instance.total_apis}"
        )
        
        # Trigger notification task if there are failures
        if instance.failed_count > 0:
            try:
                from .tasks import send_failure_notification, CELERY_AVAILABLE
                if CELERY_AVAILABLE:
                    send_failure_notification.delay(str(instance.id))
            except ImportError:
                pass


@receiver(post_save, sender=ExecutionResult)
def execution_result_saved(sender, instance, created, **kwargs):
    """
    Handle execution result save.
    
    - Update parent run counters if needed
    - Log failures for debugging
    """
    if created and instance.status in ['failed', 'error', 'timeout']:
        logger.warning(
            f"API execution failed: {instance.endpoint_name} - "
            f"Status: {instance.status}, "
            f"Error: {instance.error_message[:100] if instance.error_message else 'N/A'}"
        )
