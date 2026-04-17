"""
Notification Services for ZanFlow.
Centralized notification creation logic.
All notification creation should go through these service functions.
"""
from typing import List, Optional, Union, Dict, Any
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import Model
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.users.models import User
from .models import Notification, NotificationPreference


def get_or_create_preferences(user: User) -> NotificationPreference:
    """Get or create notification preferences for a user."""
    preferences, _ = NotificationPreference.objects.get_or_create(user=user)
    return preferences


def should_notify(user: User, notification_type: str) -> bool:
    """
    Check if user should receive a notification based on their preferences.
    """
    preferences = get_or_create_preferences(user)
    
    # Map notification types to preference fields
    type_to_preference = {
        'task_created': 'task_notifications',
        'task_assigned': 'task_notifications',
        'task_status_updated': 'task_notifications',
        'task_completed': 'task_notifications',
        'task_comment': 'task_notifications',
        'project_created': 'project_notifications',
        'project_assigned': 'project_notifications',
        'project_member_added': 'project_notifications',
        'project_updated': 'project_notifications',
        'mention': 'mention_notifications',
        'system': 'system_notifications',
        'reminder': 'system_notifications',
        'new_message': 'system_notifications',
        'project_updated': 'project_notifications',
        'event_created': 'system_notifications',
        'event_reminder': 'system_notifications',
    }
    
    preference_field = type_to_preference.get(notification_type, 'system_notifications')
    return getattr(preferences, preference_field, True)

def _send_notification_signal(notification_id: int, recipient_id: int):
    """
    Sends a lightweight WebSocket signal to the user.
    Executed only after the DB transaction commits successfully.
    """
    try:
        channel_layer = get_channel_layer()
        # This group name MUST match what we set in GatewayConsumer.connect()
        group_name = f"user_{recipient_id}_global"

        # We fetch the fresh count so the Red Dot is always accurate
        unread_count = Notification.objects.filter(
            recipient_id=recipient_id, 
            is_read=False
        ).count()
        
        # Optional: Fetch basic details for the Toast (title, etc.)
        notification = Notification.objects.get(id=notification_id)

        # The Payload: A simple "Trigger" + Metadata
        payload = {
            "type": "gateway_signal",       # Calls gateway_signal() in Consumer
            "event": "NEW_NOTIFICATION",    # The Event Name
            "data": {
                "id": notification.id,
                "title": notification.title,
                "unread_count": unread_count,
                # Context for the frontend to know where to redirect (e.g., Task ID)
                "related_object": {
                    "type": notification.content_type.model,
                    "id": notification.object_id
                } if notification.content_type else None
            }
        }

        async_to_sync(channel_layer.group_send)(group_name, payload)
    except Exception as e:
        # We catch errors so a socket failure doesn't crash the whole request
        print(f"WebSocket Signal Error: {e}")

def create_notification(
    recipient: User,
    title: str,
    message: str,
    notification_type: str = Notification.NotificationType.SYSTEM,
    actor: Optional[User] = None,
    priority: str = Notification.Priority.MEDIUM,
    related_object: Optional[Model] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[Notification]:
    """
    Create a single notification for a user.
    
    Args:
        recipient: User who will receive the notification
        title: Short title for the notification
        message: Detailed message
        notification_type: Type of notification (from Notification.NotificationType)
        actor: User who triggered the notification (optional)
        priority: Priority level (from Notification.Priority)
        related_object: Django model instance related to notification (optional)
        metadata: Additional data as dictionary (optional)
    
    Returns:
        Notification instance or None if user has disabled notifications
    
    Example:
        notification = create_notification(
            recipient=user,
            title="New Task Assigned",
            message="You have been assigned to 'Design Logo'",
            notification_type=Notification.NotificationType.TASK_ASSIGNED,
            actor=manager,
            related_object=task,
            metadata={"project_name": "Marketing Campaign"}
        )
    """
    # Skip if recipient has disabled this notification type
    if not should_notify(recipient, notification_type):
        return None
    
    if actor and actor.id == recipient.id:
        return None
    
    notification_data = {
        'recipient': recipient,
        'title': title,
        'message': message,
        'notification_type': notification_type,
        'actor': actor,
        'priority': priority,
        'metadata': metadata or {},
    }
    
    if related_object:
        notification_data['content_type'] = ContentType.objects.get_for_model(related_object)
        notification_data['object_id'] = str(related_object.pk)
    
    # --- MODIFIED SECTION STARTS HERE ---
    
    # 1. Save to DB (Your existing code)
    notification = Notification.objects.create(**notification_data)

    # 2. Trigger the WebSocket Signal (The new "Wire")
    # We use a lambda to pass the IDs to the helper function
    transaction.on_commit(
        lambda: _send_notification_signal(notification.id, recipient.id)
    )
    
    return notification


def notify(
    recipients: Union[User, List[User]],
    title: str,
    message: str,
    notification_type: str = Notification.NotificationType.SYSTEM,
    actor: Optional[User] = None,
    priority: str = Notification.Priority.MEDIUM,
    related_object: Optional[Model] = None,
    metadata: Optional[Dict[str, Any]] = None,
    exclude_actor: bool = True
) -> List[Notification]:
    """
    Send notifications to one or multiple users.
    
    Args:
        recipients: Single User or list of Users
        title: Short title for the notification
        message: Detailed message
        notification_type: Type of notification
        actor: User who triggered the notification
        priority: Priority level
        related_object: Related Django model instance
        metadata: Additional data
        exclude_actor: Whether to exclude actor from recipients (default: True)
    
    Returns:
        List of created Notification instances
    
    Example:
        # Notify multiple users
        notifications = notify(
            recipients=[user1, user2, manager],
            title="Task Status Updated",
            message="Task 'Design Logo' has been marked as completed",
            notification_type=Notification.NotificationType.TASK_STATUS_UPDATED,
            actor=developer,
            related_object=task
        )
    """
    # Normalize to list
    if isinstance(recipients, User):
        recipients = [recipients]
    
    # Remove duplicates while preserving order
    seen = set()
    unique_recipients = []
    for user in recipients:
        if user.id not in seen:
            seen.add(user.id)
            unique_recipients.append(user)
    
    created_notifications = []
    
    with transaction.atomic():
        for recipient in unique_recipients:
            # Skip actor if exclude_actor is True
            if exclude_actor and actor and recipient.id == actor.id:
                continue
            
            notification = create_notification(
                recipient=recipient,
                title=title,
                message=message,
                notification_type=notification_type,
                actor=actor,
                priority=priority,
                related_object=related_object,
                metadata=metadata
            )
            
            if notification:
                created_notifications.append(notification)
    
    return created_notifications


def bulk_create_notifications(
    notifications_data: List[Dict[str, Any]]
) -> List[Notification]:
    """
    Create multiple notifications efficiently using bulk_create.
    
    Args:
        notifications_data: List of dictionaries with notification data
    
    Returns:
        List of created Notification instances
    """
    notifications = []
    
    for data in notifications_data:
        related_object = data.pop('related_object', None)
        
        notification = Notification(
            recipient=data['recipient'],
            title=data['title'],
            message=data['message'],
            notification_type=data.get('notification_type', Notification.NotificationType.SYSTEM),
            actor=data.get('actor'),
            priority=data.get('priority', Notification.Priority.MEDIUM),
            metadata=data.get('metadata', {}),
        )
        
        if related_object:
            notification.content_type = ContentType.objects.get_for_model(related_object)
            notification.object_id = str(related_object.pk)
        
        notifications.append(notification)
    
    return Notification.objects.bulk_create(notifications)


# ============================================================================
# HELPER: GET ALL INVOLVED USERS FOR A TASK
# ============================================================================

def _get_task_involved_users(task) -> List[User]:
    """
    Get ONLY the users directly involved with a specific task.
    Modified: No longer notifies all project members by default.
    """
    recipients = []
    
    # 1. Users directly assigned to this task (e.g., Ram)
    assigned_users = list(task.assigned_to.all())
    recipients.extend(assigned_users)
    
    # 2. The user who created/assigned the task (so they can track progress)
    if task.assigned_by:
        recipients.append(task.assigned_by)
    
    # 3. Removed: task.project.members.all() 
    # This prevents Shyam (who is in the project but not the task) from being notified.
    
    return recipients


def _get_project_involved_users(project) -> List[User]:
    """
    Get ALL users who are actually members of a specific project.
    This NEVER fetches all admins/managers globally.
    """
    return list(project.members.all())


# ============================================================================
# TASK-SPECIFIC NOTIFICATION FUNCTIONS
# ============================================================================

def notify_task_created(task, actor: User) -> List[Notification]:
    """
    Send notifications when a task is created.
    
    Notifies:
      - Users assigned to the task
      - Members of the task's project (if task belongs to a project)
    
    Does NOT notify random admins/managers who aren't involved.
    """
    recipients = _get_task_involved_users(task)
    
    if not recipients:
        return []
    
    project_name = task.project.name if task.project else "No Project"
    
    return notify(
        recipients=recipients,
        title="New Task Assigned",
        message=f"You have been assigned to task '{task.heading}' in project '{project_name}'",
        notification_type=Notification.NotificationType.TASK_ASSIGNED,
        actor=actor,
        priority=_get_priority_from_task(task),
        related_object=task,
        metadata={
            'task_id': task.id,
            'task_heading': task.heading,
            'project_name': project_name,
            'priority': task.priority,
        }
    )


def notify_task_status_updated(
    task,
    actor: User,
    old_status: str,
    new_status: str
) -> List[Notification]:
    """
    Send notifications when a task status is updated.
    
    Notifies ONLY involved users:
      - Users assigned to this task
      - The user who created this task (assigned_by)
      - Members of the task's project (admins/managers who are project members)
    
    Does NOT notify:
      - Admins/Managers who are NOT members of the task's project
      - Users who have no relation to this task
    """
    # Only get users who are actually involved with this task
    recipients = _get_task_involved_users(task)
    
    if not recipients:
        return []
    
    project_name = task.project.name if task.project else "No Project"
    status_display = dict(task.STATUS_CHOICES).get(new_status, new_status)
    
    # Determine notification type based on new status
    if new_status == 'completed':
        notification_type = Notification.NotificationType.TASK_COMPLETED
        title = "Task Completed"
        message = f"Task '{task.heading}' has been marked as completed"
    else:
        notification_type = Notification.NotificationType.TASK_STATUS_UPDATED
        title = "Task Status Updated"
        message = f"Task '{task.heading}' status changed from '{old_status}' to '{status_display}'"
    
    return notify(
        recipients=recipients,
        title=title,
        message=message,
        notification_type=notification_type,
        actor=actor,
        priority=_get_priority_from_task(task),
        related_object=task,
        metadata={
            'task_id': task.id,
            'task_heading': task.heading,
            'project_name': project_name,
            'old_status': old_status,
            'new_status': new_status,
        }
    )


def notify_task_comment(task, comment, actor: User) -> List[Notification]:
    """
    Send notifications when a comment is added to a task.
    
    Notifies ONLY:
      - Users assigned to this task
      - Task creator (assigned_by)
      - Members of the task's project
    """
    recipients = _get_task_involved_users(task)
    
    if not recipients:
        return []
    
    return notify(
        recipients=recipients,
        title="New Comment on Task",
        message=f"{actor.username} commented on task '{task.heading}'",
        notification_type=Notification.NotificationType.TASK_COMMENT,
        actor=actor,
        related_object=task,
        metadata={
            'task_id': task.id,
            'task_heading': task.heading,
            'comment_preview': comment.content[:100] if comment.content else '',
        }
    )


# ============================================================================
# PROJECT-SPECIFIC NOTIFICATION FUNCTIONS
# ============================================================================

def notify_project_created(project, actor: User, assigned_members: List[User] = None) -> List[Notification]:
    """
    Send notifications when a project is created.
    Notifies ONLY members of THIS project.
    """
    if assigned_members is None:
        assigned_members = _get_project_involved_users(project)
    
    if not assigned_members:
        return []
    
    return notify(
        recipients=assigned_members,
        title="Added to New Project",
        message=f"You have been added to project '{project.name}'",
        notification_type=Notification.NotificationType.PROJECT_ASSIGNED,
        actor=actor,
        related_object=project,
        metadata={
            'project_id': str(project.id),
            'project_name': project.name,
        }
    )


def notify_project_member_added(project, new_member: User, actor: User) -> Optional[Notification]:
    """
    Send notification when a member is added to a project.
    Only the new member gets notified.
    """
    return create_notification(
        recipient=new_member,
        title="Added to Project",
        message=f"You have been added to project '{project.name}'",
        notification_type=Notification.NotificationType.PROJECT_MEMBER_ADDED,
        actor=actor,
        related_object=project,
        metadata={
            'project_id': str(project.id),
            'project_name': project.name,
        }
    )


def notify_project_updated(project, actor: User, changes: Dict[str, Any]) -> List[Notification]:
    """
    Send notifications when a project is updated.
    Notifies ONLY members of THIS project.
    """
    members = _get_project_involved_users(project)
    
    if not members:
        return []
    
    return notify(
        recipients=members,
        title="Project Updated",
        message=f"Project '{project.name}' has been updated",
        notification_type=Notification.NotificationType.PROJECT_UPDATED,
        actor=actor,
        related_object=project,
        metadata={
            'project_id': str(project.id),
            'project_name': project.name,
            'changes': changes,
        }
    )


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _get_priority_from_task(task) -> str:
    """Map task priority to notification priority."""
    priority_map = {
        'low': Notification.Priority.LOW,
        'medium': Notification.Priority.MEDIUM,
        'high': Notification.Priority.HIGH,
        'critical': Notification.Priority.URGENT,
    }
    return priority_map.get(task.priority, Notification.Priority.MEDIUM)


def mark_all_as_read(user: User) -> int:
    """
    Mark all unread notifications for a user as read.
    Returns the count of notifications marked as read.
    """
    from django.utils import timezone
    
    return Notification.objects.filter(
        recipient=user,
        is_read=False
    ).update(
        is_read=True,
        read_at=timezone.now()
    )


def get_unread_count(user: User) -> int:
    """Get count of unread notifications for a user."""
    return Notification.objects.filter(
        recipient=user,
        is_read=False
    ).count()


def delete_expired_notifications() -> Dict[str, int]:
    """
    Delete notifications based on expiry rules:
    - Read notifications: Delete after 7 days
    - Unread notifications: Delete after 15 days
    """
    from django.utils import timezone
    from datetime import timedelta
    
    now = timezone.now()
    
    # 1. Delete Read notifications older than 7 days
    read_cutoff = now - timedelta(days=7)
    read_deleted, _ = Notification.objects.filter(
        is_read=True,
        read_at__lt=read_cutoff  # Using read_at is safer for read notifications
    ).delete()
    
    # 2. Delete Unread notifications older than 15 days
    unread_cutoff = now - timedelta(days=15)
    unread_deleted, _ = Notification.objects.filter(
        is_read=False,
        created_at__lt=unread_cutoff
    ).delete()
    
    return {
        'read_deleted': read_deleted,
        'unread_deleted': unread_deleted,
        'total_deleted': read_deleted + unread_deleted
    }

def notify_task_assignees_added(task, actor: User, new_assignees: List[User]) -> List[Notification]:
    """
    Send notifications specifically to users who are newly assigned to an existing task.
    """
    if not new_assignees:
        return []
    
    project_name = task.project.name if getattr(task, 'project', None) else "No Project"
    
    return notify(
        recipients=new_assignees,
        title="Assigned to Task",
        message=f"You have been assigned to task '{task.heading}' in project '{project_name}'",
        notification_type=Notification.NotificationType.TASK_ASSIGNED,
        actor=actor,
        priority=_get_priority_from_task(task),
        related_object=task,
        metadata={
            'task_id': task.id,
            'task_heading': task.heading,
            'project_name': project_name,
            'priority': task.priority,
        }
    )

# ============================================================================
# CHAT-SPECIFIC NOTIFICATION FUNCTIONS
# ============================================================================

def notify_new_chat_message(room, message, actor: User, recipients: List[User]) -> List[Notification]:
    """
    Send notifications when a new chat message is received.
    """
    if not recipients:
        return []
    
    content_preview = message.content[:100] if message.content else "Sent an attachment"
    
    return notify(
        recipients=recipients,
        title=f"New message from {actor.first_name or actor.username}",
        message=content_preview,
        notification_type='new_message',  # Hardcoded string to avoid Enum lookup errors
        actor=actor,
        priority=Notification.Priority.MEDIUM,
        related_object=None,  # <-- FIX: Set to None to prevent UUID vs Integer crashes!
        metadata={
            'room_id': str(room.id),
            'room_name': room.name,
            'message_id': str(message.id),
            'related_type': 'message'
        }
    )

# ============================================================================
# EVENT-SPECIFIC NOTIFICATION FUNCTIONS
# ============================================================================

def notify_event_created(event, actor: User, attendees: List[User], invitation=None) -> List[Notification]:
    """
    Send notifications when users are invited to a calendar event.
    Now supports interactive RSVP actions if an invitation instance is provided.
    """
    if not attendees:
        return []
    
    event_title = getattr(event, 'title', 'a new event')
    
    metadata = {
        'event_id': str(event.id),
        'event_title': event_title,
    }
    
    # NEW LOGIC: If we receive the specific EventInvitation object, 
    # we tell the frontend to render the RSVP buttons.
    if invitation:
        metadata['invitation_id'] = str(invitation.id)
        metadata['actions'] = ["ACCEPT", "DECLINE", "RESCHEDULE"]
    
    return notify(
        recipients=attendees,
        title="Event Invitation",
        message=f"You have been invited to '{event_title}'. Please RSVP.",
        notification_type=Notification.NotificationType.EVENT_CREATED,
        actor=actor,
        priority=Notification.Priority.MEDIUM,
        related_object=event,
        metadata=metadata
    )

def notify_event_reminder(event) -> List[Notification]:
    """
    Send a reminder to the organizer and all attendees that the event is starting soon.
    """
    # Combine attendees and organizer into one unique list
    recipients = list(event.attendees.all())
    if getattr(event, 'organizer', None) and event.organizer not in recipients:
        recipients.append(event.organizer)
    
    if not recipients:
        return []
    
    event_title = getattr(event, 'title', 'Upcoming event')
    
    return notify(
        recipients=recipients,
        title="Event Starting Soon",
        message=f"'{event_title}' is starting in 10 minutes!",
        notification_type=Notification.NotificationType.EVENT_REMINDER,
        actor=None, # System generated
        priority=Notification.Priority.HIGH,
        related_object=event,
        metadata={
            'event_id': str(event.id),
            'event_title': event_title,
        }
    )

def notify_organizer_rsvp(invitation, action_type):
    """
    Sends a notification back to the organizer when an assignee RSVPs.
    """
    organizer = getattr(invitation.event, 'organizer', None)
    actor = invitation.user
    
    # Don't notify if the organizer is somehow accepting their own invite
    if not organizer or organizer == actor:
        return []

    event_title = invitation.event.title
    actor_name = actor.get_full_name() or actor.username

    if action_type == 'DECLINED':
        title = "Event Declined"
        reason = invitation.decline_reason or "No reason provided."
        message = f"{actor_name} declined '{event_title}'. Reason: {reason}"
        priority = Notification.Priority.HIGH
        
    elif action_type == 'RESCHEDULE':
        title = "Reschedule Requested"
        
        # Safely handle the time whether it's a string (from request) or datetime (from DB)
        raw_time = invitation.proposed_reschedule_time
        new_time = "Unknown time"
        
        if raw_time:
            if isinstance(raw_time, str):
                from django.utils.dateparse import parse_datetime
                parsed = parse_datetime(raw_time)
                # Fallback to the raw string if parsing somehow fails
                new_time = parsed.strftime("%b %d, %Y at %I:%M %p") if parsed else raw_time
            else:
                # It's already a datetime object
                new_time = raw_time.strftime("%b %d, %Y at %I:%M %p")
                
        message = f"{actor_name} wants to reschedule '{event_title}' to {new_time}."
        priority = Notification.Priority.MEDIUM
        
    elif action_type == 'ACCEPTED':
        title = "Event Accepted"
        message = f"{actor_name} accepted your invitation to '{event_title}'."
        priority = Notification.Priority.LOW
    else:
        return []

    return notify(
        recipients=[organizer],
        title=title,
        message=message,
        notification_type=Notification.NotificationType.SYSTEM, # Or create a specific RSVP type
        actor=actor,
        priority=priority,
        related_object=invitation.event,
        metadata={
            'event_id': str(invitation.event.id),
            'invitation_id': str(invitation.id),
            'action_taken': action_type
        }
    )