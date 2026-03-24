"""
URL configuration for Notifications app.
All endpoints use explicit path() definitions.
"""
from django.urls import path

from . import views

app_name = 'notifications'

urlpatterns = [
    # =========================================================================
    # NOTIFICATION LIST & CRUD
    # =========================================================================
    
    # GET /notifications/ - List all notifications for authenticated user
    path(
        '',
        views.NotificationListView.as_view(),
        name='notification_list'
    ),
    
    # GET /notifications/unread/ - List only unread notifications
    path(
        'unread/',
        views.UnreadNotificationsView.as_view(),
        name='notification_unread_list'
    ),
    
    # GET /notifications/<id>/ - Get single notification detail
    # DELETE /notifications/<id>/ - Delete a notification
    path(
        '<int:notification_id>/',
        views.NotificationDetailView.as_view(),
        name='notification_detail'
    ),
    
    # =========================================================================
    # MARK AS READ/UNREAD
    # =========================================================================
    
    # POST /notifications/mark-read/ - Mark notifications as read (bulk or all)
    path(
        'mark-read/',
        views.NotificationMarkReadView.as_view(),
        name='notification_mark_read_bulk'
    ),
    
    # POST /notifications/<id>/mark-read/ - Mark single notification as read
    path(
        '<int:notification_id>/mark-read/',
        views.NotificationMarkReadView.as_view(),
        name='notification_mark_read'
    ),
    
    # POST /notifications/<id>/mark-unread/ - Mark notification as unread
    path(
        '<int:notification_id>/mark-unread/',
        views.NotificationMarkUnreadView.as_view(),
        name='notification_mark_unread'
    ),
    
    # =========================================================================
    # COUNTS
    # =========================================================================
    
    # GET /notifications/unread-count/ - Get unread notification count
    path(
        'unread-count/',
        views.NotificationUnreadCountView.as_view(),
        name='notification_unread_count'
    ),
    
    # GET /notifications/counts/ - Get detailed notification counts
    path(
        'counts/',
        views.NotificationCountView.as_view(),
        name='notification_counts'
    ),
    
    # =========================================================================
    # BULK OPERATIONS
    # =========================================================================
    
    # DELETE /notifications/delete-read/ - Delete all read notifications
    path(
        'delete-all/',
        views.NotificationDeleteAllView.as_view(),
        name='notification_delete_read'
    ),
    
    # =========================================================================
    # PREFERENCES
    # =========================================================================
    
    # GET /notifications/preferences/ - Get user preferences
    # PUT /notifications/preferences/ - Update all preferences
    # PATCH /notifications/preferences/ - Partial update preferences
    path(
        'preferences/',
        views.NotificationPreferencesView.as_view(),
        name='notification_preferences'
    ),
]