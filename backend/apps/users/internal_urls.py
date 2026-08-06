"""
apps/users/internal_urls.py  (PM Backend)

URL patterns for internal cross-product endpoints.
Registered under api/v1/internal/ in config/urls.py
"""

from django.urls import path
from .internal_views import InternalUserListView, UserCreatedWebhookView

urlpatterns = [
    path("users/", InternalUserListView.as_view(), name="internal-user-list"),
    # Receives user-created events from Central
    # Called when a new user is granted PM portal access
    path(
        "webhook/user-created/",
        UserCreatedWebhookView.as_view(),
        name="internal-user-created",
    ),
]