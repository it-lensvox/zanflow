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
    GET: List all notifications for the authenticated user.
    
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
        user = request.user
        queryset = Notification.objects.filter(recipient=user).select_related('actor')
        
        # 1. Filters (Keep your existing filter logic)
        is_read = request.query_params.get('is_read')
        if is_read is not None:
            is_read_bool = is_read.lower() in ('true', '1', 'yes')
            queryset = queryset.filter(is_read=is_read_bool)
        
        notification_type = request.query_params.get('notification_type')
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)
        
        priority = request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)
            
        # Calculate unread count before paginating
        unread_count = queryset.filter(is_read=False).count()
        
        # 2. Apply DRF Pagination
        paginator = NotificationPagination()
        paginated_queryset = paginator.paginate_queryset(queryset, request, view=self)
        
        # 3. Serialize and Return
        if paginated_queryset is not None:
            serializer = NotificationListSerializer(paginated_queryset, many=True)
            return paginator.get_paginated_response(serializer.data, unread_count=unread_count)

        # Fallback (safety catch)
        serializer = NotificationListSerializer(queryset, many=True)
        return Response({'notifications': serializer.data})


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
        
        if notification_ids:
            # Mark specific notifications as read
            updated_count = Notification.objects.filter(
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
            # Mark all as read
            updated_count = mark_all_as_read(user)
            
            return Response({
                'message': 'All notifications marked as read',
                'marked_count': updated_count
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
        queryset = Notification.objects.filter(recipient=user)
        
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
    DELETE: Delete all notifications (both read and unread) for the user.
    """
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def delete(self, request):
        # We removed `is_read=True` so it grabs ALL notifications for this user
        deleted_count, _ = Notification.objects.filter(
            recipient=request.user
        ).delete()
        
        return Response({
            'message': f'{deleted_count} notification(s) deleted',
            'deleted_count': deleted_count
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
        
        notifications = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).select_related('actor')[:limit]
        
        serializer = NotificationListSerializer(notifications, many=True)
        
        return Response({
            'message': 'Unread notifications retrieved successfully',
            'count': notifications.count() if hasattr(notifications, 'count') else len(notifications),
            'notifications': serializer.data
        }, status=status.HTTP_200_OK)