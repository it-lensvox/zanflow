"""
Celery tasks for API Testing Platform.

Provides async execution capabilities for:
- Running collections in the background
- Scheduled runs
- Batch processing
- Notifications

These tasks are optional and only run if Celery is configured.
The platform works synchronously without Celery.
"""
import logging
from typing import Optional, Dict, Any
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# Try to import Celery, but make it optional
try:
    from celery import shared_task
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False
    
    # Create a dummy decorator if Celery is not installed
    def shared_task(*args, **kwargs):
        def decorator(func):
            func.delay = lambda *a, **k: func(*a, **k)  # Run synchronously
            func.apply_async = lambda *a, **k: func(*a[0], **k.get('kwargs', {}))
            return func
        return decorator


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def run_collection_async(
    self,
    collection_id: str,
    credential_id: Optional[str] = None,
    environment_overrides: Optional[Dict[str, Any]] = None,
    user_id: Optional[int] = None,
    trigger_type: str = 'manual',
    notes: str = ''
):
    """
    Run an API collection asynchronously.
    
    This task can be triggered by:
    - Manual user action (for large collections)
    - Scheduled runs
    - Webhooks
    - CI/CD pipelines
    
    Args:
        collection_id: UUID of the collection to run
        credential_id: Optional UUID of credential to use
        environment_overrides: Optional environment variable overrides
        user_id: ID of user who triggered the run
        trigger_type: How the run was triggered
        notes: Optional notes
        
    Returns:
        UUID of the execution run
    """
    from .models import APICollection, AuthCredential, ExecutionRun
    from .services import api_executor
    from django.contrib.auth import get_user_model
    
    User = get_user_model()
    
    try:
        # Get the collection
        collection = APICollection.objects.get(pk=collection_id, is_active=True)
        
        # Get credential if provided
        credential = None
        if credential_id:
            try:
                credential = AuthCredential.objects.get(
                    pk=credential_id, 
                    is_active=True
                )
            except AuthCredential.DoesNotExist:
                logger.warning(f"Credential {credential_id} not found")
        
        # Get user if provided
        user = None
        if user_id:
            try:
                user = User.objects.get(pk=user_id)
            except User.DoesNotExist:
                logger.warning(f"User {user_id} not found")
        
        # Execute the collection
        execution_run = api_executor.execute_collection(
            collection=collection,
            credential=credential,
            environment_overrides=environment_overrides or {},
            user=user,
            trigger_type=trigger_type,
            notes=notes
        )
        
        logger.info(
            f"Collection {collection.name} executed: "
            f"{execution_run.successful_count}/{execution_run.total_apis} passed"
        )
        
        # Send notifications if needed
        if execution_run.failed_count > 0:
            send_failure_notification.delay(str(execution_run.id))
        
        return str(execution_run.id)
    
    except APICollection.DoesNotExist:
        logger.error(f"Collection {collection_id} not found")
        raise
    except Exception as e:
        logger.exception(f"Error running collection {collection_id}")
        # Retry on failure
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def run_single_api_async(
    self,
    endpoint_id: str,
    credential_id: Optional[str] = None,
    environment_overrides: Optional[Dict[str, Any]] = None,
    user_id: Optional[int] = None
):
    """
    Run a single API endpoint asynchronously.
    
    Args:
        endpoint_id: UUID of the endpoint to run
        credential_id: Optional UUID of credential to use
        environment_overrides: Optional environment variable overrides
        user_id: ID of user who triggered the run
        
    Returns:
        UUID of the execution result
    """
    from .models import APIEndpoint, AuthCredential, ExecutionRun
    from .services import api_executor
    from .services.executor import ExecutionContext
    from django.contrib.auth import get_user_model
    
    User = get_user_model()
    
    try:
        # Get the endpoint
        endpoint = APIEndpoint.objects.select_related('collection').get(
            pk=endpoint_id, 
            is_active=True
        )
        
        # Get credential if provided
        credential = None
        if credential_id:
            try:
                credential = AuthCredential.objects.get(pk=credential_id, is_active=True)
            except AuthCredential.DoesNotExist:
                logger.warning(f"Credential {credential_id} not found")
        
        # Get user if provided
        user = None
        if user_id:
            try:
                user = User.objects.get(pk=user_id)
            except User.DoesNotExist:
                pass
        
        # Create execution run
        execution_run = ExecutionRun.objects.create(
            collection=endpoint.collection,
            executed_by=user,
            total_apis=1,
            trigger_type='manual'
        )
        execution_run.mark_started()
        
        # Build context
        context = ExecutionContext(
            environment=endpoint.collection.environment_variables.copy(),
            user=user
        )
        if environment_overrides:
            context.merge_environment(environment_overrides)
        
        # Execute
        result_data = api_executor.execute_with_retry(endpoint, context, credential)
        
        # Save result
        execution_result = api_executor._save_execution_result(
            execution_run, endpoint, result_data
        )
        
        # Update run
        if result_data.status == 'success':
            execution_run.successful_count = 1
        else:
            execution_run.failed_count = 1
        execution_run.mark_completed()
        
        return str(execution_result.id)
    
    except APIEndpoint.DoesNotExist:
        logger.error(f"Endpoint {endpoint_id} not found")
        raise
    except Exception as e:
        logger.exception(f"Error running endpoint {endpoint_id}")
        raise self.retry(exc=e)


@shared_task
def process_scheduled_runs():
    """
    Process all scheduled runs that are due.
    
    This task should be run periodically (e.g., every minute)
    via Celery Beat.
    """
    from .models import ScheduledRun
    
    now = timezone.now()
    
    # Find all due schedules
    due_schedules = ScheduledRun.objects.filter(
        is_active=True,
        next_run__lte=now
    ).select_related('collection')
    
    for schedule in due_schedules:
        try:
            logger.info(f"Running scheduled task: {schedule.name}")
            
            # Trigger the collection run
            run_collection_async.delay(
                collection_id=str(schedule.collection_id),
                environment_overrides=schedule.environment_overrides,
                trigger_type='scheduled',
                notes=f"Scheduled run: {schedule.name}"
            )
            
            # Update last_run and calculate next_run
            schedule.last_run = now
            # Note: next_run calculation would require a cron parser
            # For now, we just clear it (should be recalculated by a separate task)
            schedule.save(update_fields=['last_run'])
            
        except Exception as e:
            logger.exception(f"Error processing schedule {schedule.id}")


@shared_task
def send_failure_notification(execution_run_id: str):
    """
    Send notification for failed execution runs.
    
    Args:
        execution_run_id: UUID of the execution run
    """
    from .models import ExecutionRun, ScheduledRun
    
    try:
        execution_run = ExecutionRun.objects.select_related(
            'collection', 
            'executed_by'
        ).get(pk=execution_run_id)
        
        # Check if there's a schedule with notifications enabled
        schedules = ScheduledRun.objects.filter(
            collection=execution_run.collection,
            is_active=True,
            notify_on_failure=True
        )
        
        for schedule in schedules:
            emails = schedule.notification_emails
            if emails:
                # Send email notification
                # This is a placeholder - implement actual email sending
                logger.info(
                    f"Would send failure notification for {execution_run.collection.name} "
                    f"to {emails}"
                )
                
                # You could use Django's email system:
                # from django.core.mail import send_mail
                # send_mail(
                #     subject=f"API Test Failed: {execution_run.collection.name}",
                #     message=f"Execution run {execution_run.id} failed.",
                #     from_email=settings.DEFAULT_FROM_EMAIL,
                #     recipient_list=emails,
                # )
    
    except ExecutionRun.DoesNotExist:
        logger.error(f"Execution run {execution_run_id} not found")


@shared_task
def cleanup_old_results(days: int = 30):
    """
    Clean up old execution results to manage database size.
    
    Args:
        days: Number of days to keep results
    """
    from .models import ExecutionRun, ExecutionResult
    
    cutoff_date = timezone.now() - timezone.timedelta(days=days)
    
    # Delete old results
    old_results = ExecutionResult.objects.filter(created_at__lt=cutoff_date)
    result_count = old_results.count()
    old_results.delete()
    
    # Delete old runs with no results
    old_runs = ExecutionRun.objects.filter(
        created_at__lt=cutoff_date,
        results__isnull=True
    )
    run_count = old_runs.count()
    old_runs.delete()
    
    logger.info(
        f"Cleanup complete: deleted {result_count} results and {run_count} runs "
        f"older than {days} days"
    )


@shared_task
def refresh_expiring_credentials():
    """
    Refresh OAuth2 credentials that are about to expire.
    
    Runs periodically to ensure credentials stay valid.
    """
    from .models import AuthCredential
    import requests
    
    # Find credentials expiring in the next hour with auto_refresh enabled
    expiry_threshold = timezone.now() + timezone.timedelta(hours=1)
    
    expiring_credentials = AuthCredential.objects.filter(
        auth_type=AuthCredential.AuthType.OAUTH2,
        is_active=True,
        auto_refresh=True,
        expires_at__lte=expiry_threshold,
        refresh_url__isnull=False
    ).exclude(refresh_url='')
    
    for credential in expiring_credentials:
        try:
            logger.info(f"Refreshing credential: {credential.name}")
            
            # Get current credentials
            creds = credential.get_credentials()
            refresh_token = creds.get('refresh_token')
            
            if not refresh_token:
                logger.warning(f"No refresh token for credential {credential.id}")
                continue
            
            # Build refresh payload
            payload = credential.refresh_payload.copy()
            payload['refresh_token'] = refresh_token
            
            # Make refresh request
            response = requests.post(
                credential.refresh_url,
                data=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Update credentials
                creds['access_token'] = data.get('access_token', creds.get('access_token'))
                if 'refresh_token' in data:
                    creds['refresh_token'] = data['refresh_token']
                
                credential.set_credentials(creds)
                
                # Update expiry
                expires_in = data.get('expires_in', 3600)
                credential.expires_at = timezone.now() + timezone.timedelta(seconds=expires_in)
                credential.save()
                
                logger.info(f"Successfully refreshed credential {credential.name}")
            else:
                logger.error(
                    f"Failed to refresh credential {credential.id}: "
                    f"Status {response.status_code}"
                )
        
        except Exception as e:
            logger.exception(f"Error refreshing credential {credential.id}")


# Export task availability flag
__all__ = [
    'CELERY_AVAILABLE',
    'run_collection_async',
    'run_single_api_async',
    'process_scheduled_runs',
    'send_failure_notification',
    'cleanup_old_results',
    'refresh_expiring_credentials',
]
