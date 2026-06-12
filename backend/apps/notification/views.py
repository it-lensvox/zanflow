"""
Views for Notifications app.
API endpoints for fetching and managing notifications.
"""
from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
# Import your custom authentication if needed
from apps.users.auth import StaticTokenAuthentication

from .models import Notification, NotificationPreference
from .serializers import (
    NotificationSerializer,
    NotificationListSerializer,
    MarkAsReadSerializer,
    NotificationPreferenceSerializer,
    NotificationCountSerializer,
)
from .services import get_or_create_preferences, mark_all_as_read, get_unread_count
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

class NotificationPagination(PageNumberPagination):
    page_size = 50 # Default number of items per page
    page_size_query_param = 'limit' # Allows frontend to request a specific size (e.g., ?page=1&limit=20)
    max_page_size = 100 # Safety cap
    
    def get_paginated_response(self, data, unread_count=0):
        """Custom response format to maintain your existing metadata structure."""
        return Response({
            'message': 'Notifications retrieved successfully',
            'total': self.page.paginator.count,
            'unread_count': unread_count,
            'total_pages': self.page.paginator.num_pages,
            'current_page': self.page.number,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'notifications': data
        })

class NotificationListView(APIView):
    """
    GET: List notifications for the authenticated user.

    Workspace-aware behavior:
    - Current workspace notifications → returned with FULL details
    - Other workspace notifications → returned as SUMMARY only (count per workspace)
      This maintains privacy — details only visible in the correct workspace.

    Query Parameters:
        - is_read: Filter by read status (true/false)
        - notification_type: Filter by type
        - priority: Filter by priority
        - page: Page number (default: 1)
        - limit: Items per page (default: 50)
    """
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Count as DjangoCount

        user = request.user

        # Get active workspace from header
        workspace_id = request.META.get("HTTP_X_WORKSPACE_ID")
        try:
            workspace_id = int(workspace_id) if workspace_id else None
        except (ValueError, TypeError):
            workspace_id = None

        # Use original_objects to bypass TenantManager workspace filter
        # We handle workspace logic manually here
        all_notifications = Notification.original_objects.filter(
            recipient=user,
            organization=user.organization,
        ).select_related('actor', 'workspace')

        # ── Current workspace notifications (full details) ──────────────
        if workspace_id:
            current_qs = all_notifications.filter(workspace_id=workspace_id)
            other_qs = all_notifications.exclude(workspace_id=workspace_id)
        else:
            # No workspace header — show all as current
            current_qs = all_notifications
            other_qs = Notification.original_objects.none()

        # Apply filters to current workspace notifications
        is_read = request.query_params.get('is_read')
        if is_read is not None:
            is_read_bool = is_read.lower() in ('true', '1', 'yes')
            current_qs = current_qs.filter(is_read=is_read_bool)

        notification_type = request.query_params.get('notification_type')
        if notification_type:
            current_qs = current_qs.filter(notification_type=notification_type)

        priority = request.query_params.get('priority')
        if priority:
            current_qs = current_qs.filter(priority=priority)

        # ── Other workspace summaries (privacy preserved) ───────────────
        other_workspace_summaries = []
        other_workspaces_unread = 0

        if workspace_id:
            other_unread = other_qs.filter(is_read=False).values(
                'workspace_id',
                'workspace__name',
            ).annotate(unread_count=DjangoCount('id'))

            for item in other_unread:
                if item['workspace_id']:
                    count = item['unread_count']
                    ws_name = item['workspace__name'] or 'Another Workspace'
                    other_workspaces_unread += count
                    other_workspace_summaries.append({
                        'workspace_id': item['workspace_id'],
                        'workspace_name': ws_name,
                        'unread_count': count,
                        'message': f"You have {count} new notification{'s' if count != 1 else ''} in '{ws_name}'",
                    })

        # ── Paginate current workspace notifications ────────────────────
        unread_count = current_qs.filter(is_read=False).count()
        paginator = NotificationPagination()
        paginated_qs = paginator.paginate_queryset(current_qs, request, view=self)

        if paginated_qs is not None:
            serializer = NotificationListSerializer(paginated_qs, many=True)
            response = paginator.get_paginated_response(
                serializer.data,
                unread_count=unread_count,
            )
            # Append other workspace summaries to response
            response.data['other_workspaces'] = other_workspace_summaries
            response.data['other_workspaces_unread'] = other_workspaces_unread
            response.data['total_unread'] = unread_count + other_workspaces_unread
            return response

        # Fallback
        serializer = NotificationListSerializer(current_qs, many=True)
        return Response({
            'notifications': serializer.data,
            'other_workspaces': other_workspace_summaries,
            'other_workspaces_unread': other_workspaces_unread,
            'total_unread': unread_count + other_workspaces_unread,
        })


class NotificationDetailView(APIView):
    """
    GET: Retrieve a single notification.
    DELETE: Delete a notification.
    """
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, notification_id):
        notification = get_object_or_404(
            Notification,
            id=notification_id,
            recipient=request.user
        )
        
        serializer = NotificationSerializer(notification)
        return Response({
            'message': 'Notification retrieved successfully',
            'notification': serializer.data
        }, status=status.HTTP_200_OK)
    
    def delete(self, request, notification_id):
        notification = get_object_or_404(
            Notification,
            id=notification_id,
            recipient=request.user
        )
        
        notification.delete()
        return Response({
            'message': 'Notification deleted successfully'
        }, status=status.HTTP_204_NO_CONTENT)


class NotificationMarkReadView(APIView):
    """
    POST: Mark notification(s) as read.
    
    Request Body (optional):
        - notification_ids: List of notification IDs to mark as read
        
    If notification_ids is not provided, marks all notifications as read.
    """
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request, notification_id=None):
        user = request.user
        
        # If notification_id is provided in URL, mark that specific one
        if notification_id:
            notification = get_object_or_404(
                Notification,
                id=notification_id,
                recipient=user
            )
            notification.mark_as_read()
            
            return Response({
                'message': 'Notification marked as read',
                'notification_id': notification_id
            }, status=status.HTTP_200_OK)
        
        # Otherwise, check request body for IDs
        serializer = MarkAsReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        notification_ids = serializer.validated_data.get('notification_ids', [])

        # Get current workspace from header
        workspace_id = request.META.get("HTTP_X_WORKSPACE_ID")
        try:
            workspace_id = int(workspace_id) if workspace_id else None
        except (ValueError, TypeError):
            workspace_id = None

        if notification_ids:
            # Mark specific notifications as read
            updated_count = Notification.original_objects.filter(
                id__in=notification_ids,
                recipient=user,
                is_read=False
            ).update(
                is_read=True,
                read_at=timezone.now()
            )

            return Response({
                'message': f'{updated_count} notification(s) marked as read',
                'marked_count': updated_count
            }, status=status.HTTP_200_OK)
        else:
            # Mark all as read — scoped to current workspace
            qs = Notification.original_objects.filter(
                recipient=user,
                organization=user.organization,
                is_read=False,
            )
            if workspace_id:
                qs = qs.filter(workspace_id=workspace_id)

            updated_count = qs.update(
                is_read=True,
                read_at=timezone.now()
            )

            return Response({
                'message': f'All notifications marked as read',
                'marked_count': updated_count,
                'workspace_id': workspace_id,
            }, status=status.HTTP_200_OK)


class NotificationMarkUnreadView(APIView):
    """
    POST: Mark a notification as unread.
    """
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request, notification_id):
        notification = get_object_or_404(
            Notification,
            id=notification_id,
            recipient=request.user
        )
        
        notification.mark_as_unread()
        
        return Response({
            'message': 'Notification marked as unread',
            'notification_id': notification_id
        }, status=status.HTTP_200_OK)


class NotificationUnreadCountView(APIView):
    """
    GET: Get count of unread notifications.
    """
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        unread_count = get_unread_count(request.user)
        
        return Response({
            'unread_count': unread_count
        }, status=status.HTTP_200_OK)


class NotificationCountView(APIView):
    """
    GET: Get detailed notification counts (total, unread, by type).
    """
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        queryset = Notification.original_objects.filter(recipient=user, organization=user.organization)
        
        total = queryset.count()
        unread = queryset.filter(is_read=False).count()
        
        # Count by notification type
        by_type = {}
        type_counts = queryset.values('notification_type').annotate(count=Count('id'))
        for item in type_counts:
            by_type[item['notification_type']] = item['count']
        
        data = {
            'total': total,
            'unread': unread,
            'by_type': by_type
        }
        
        serializer = NotificationCountSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class NotificationDeleteAllView(APIView):
    """
    DELETE: Delete all notifications for the CURRENT workspace only.
    Uses X-Workspace-ID header to scope the deletion.
    """
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        workspace_id = request.META.get("HTTP_X_WORKSPACE_ID")
        try:
            workspace_id = int(workspace_id) if workspace_id else None
        except (ValueError, TypeError):
            workspace_id = None

        qs = Notification.original_objects.filter(
            recipient=request.user,
            organization=request.user.organization,
        )

        # Filter by current workspace if header present
        if workspace_id:
            qs = qs.filter(workspace_id=workspace_id)

        deleted_count, _ = qs.delete()

        return Response({
            'message': f'{deleted_count} notification(s) deleted',
            'deleted_count': deleted_count,
            'workspace_id': workspace_id,
        }, status=status.HTTP_200_OK)


class NotificationPreferencesView(APIView):
    """
    GET: Retrieve user's notification preferences.
    PUT/PATCH: Update user's notification preferences.
    """
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        preferences = get_or_create_preferences(request.user)
        serializer = NotificationPreferenceSerializer(preferences)
        
        return Response({
            'message': 'Preferences retrieved successfully',
            'preferences': serializer.data
        }, status=status.HTTP_200_OK)
    
    def put(self, request):
        preferences = get_or_create_preferences(request.user)
        serializer = NotificationPreferenceSerializer(
            preferences,
            data=request.data
        )
        
        if serializer.is_valid():
            serializer.save()
            return Response({
                'message': 'Preferences updated successfully',
                'preferences': serializer.data
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def patch(self, request):
        preferences = get_or_create_preferences(request.user)
        serializer = NotificationPreferenceSerializer(
            preferences,
            data=request.data,
            partial=True
        )
        
        if serializer.is_valid():
            serializer.save()
            return Response({
                'message': 'Preferences updated successfully',
                'preferences': serializer.data
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UnreadNotificationsView(APIView):
    """
    GET: List only unread notifications.
    Convenience endpoint for quickly fetching unread notifications.
    """
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        limit = int(request.query_params.get('limit', 20))
        
        notifications = Notification.original_objects.filter(
            recipient=request.user,
            organization=request.user.organization,
            is_read=False
        ).select_related('actor')[:limit]
        
        serializer = NotificationListSerializer(notifications, many=True)
        
        return Response({
            'message': 'Unread notifications retrieved successfully',
            'count': notifications.count() if hasattr(notifications, 'count') else len(notifications),
            'notifications': serializer.data
        }, status=status.HTTP_200_OK)