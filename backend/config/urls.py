"""
URL configuration for ZanFlow project.
"""
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    # Admin
    path("admin/", admin.site.urls),
    
    # API v1
    path("api/v1/", include([
        path("auth/", include("apps.users.urls")),
        path("projects/", include("apps.projects.urls")),
        path("tasksite/", include("apps.tasksite.urls")),
        path("documents/", include("apps.groundtruth.urls")),
        path("test-runs/", include("apps.testing.urls")),
        path("issues/", include("apps.issues.urls")),
        path("groundtruth/", include("apps.groundtruth.urls")),
        path('task-ai/', include('apps.task_ai.urls')),
        path('api-testing/', include('apps.api_testing.urls')),
        path("notification/", include("apps.notification.urls")),
        path("chat/", include("apps.chat.urls")),
        path("teams/", include("apps.teams.urls")),
        path("organizations/", include("apps.organizations.urls")),
        path("quicknotes/", include("apps.quicknotes.urls")),
        path("daily-updates/", include("apps.daily_updates.urls")),
        path("agent/", include("apps.ai_agent.urls")),
        # path("ai-ops/", include("apps.ai_ops.urls")),
    ])),
    
    # API Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
