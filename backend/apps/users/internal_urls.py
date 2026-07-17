"""
apps/users/internal_urls.py  (PM Backend)

URL patterns for internal cross-product endpoints.
Registered under api/v1/internal/ in config/urls.py
"""

from django.urls import path
from .internal_views import InternalUserListView

urlpatterns = [
    path("users/", InternalUserListView.as_view(), name="internal-user-list"),
]