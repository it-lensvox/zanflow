from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DailyUpdateViewSet, EventViewSet

router = DefaultRouter()
router.register(r'', DailyUpdateViewSet, basename='daily-update')

urlpatterns = [
    # Daily Update Endpoints (Prefix /api/v1/daily-updates/ is handled by main urls)
    path('', DailyUpdateViewSet.as_view({
        'get': 'list', 
        'post': 'create'
    }), name='daily-update-list'),
    
    path('<int:pk>/', DailyUpdateViewSet.as_view({
        'get': 'retrieve', 
        'put': 'update', 
        'patch': 'partial_update', 
        'delete': 'destroy'
    }), name='daily-update-detail'),

    # Event Endpoints (Will be served at /api/v1/daily-updates/events/)
    path('events/', EventViewSet.as_view({
        'get': 'list', 
        'post': 'create'
    }), name='event-list'),
    
    path('events/<int:pk>/', EventViewSet.as_view({
        'get': 'retrieve', 
        'put': 'update', 
        'patch': 'partial_update', 
        'delete': 'destroy'
    }), name='event-detail'),
]