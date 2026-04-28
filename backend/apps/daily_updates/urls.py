from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DailyUpdateViewSet, EventViewSet, EventInvitationViewSet, CalendarShareViewSet, CalendarShareLinkViewSet, PublicSharedCalendarView

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

    path('events/check-availability/', EventViewSet.as_view({
        'get': 'check_availability'
    }), name='event-check-availability'),

    # --- NEW RSVP INVITATION ENDPOINTS ---
    path('events/invitations/<int:pk>/accept/', EventInvitationViewSet.as_view({
        'patch': 'accept'
    }), name='invitation-accept'),
    
    path('events/invitations/<int:pk>/decline/', EventInvitationViewSet.as_view({
        'patch': 'decline'
    }), name='invitation-decline'),
    
    path('events/invitations/<int:pk>/reschedule/', EventInvitationViewSet.as_view({
        'patch': 'reschedule'
    }), name='invitation-reschedule'),
    
    path('events/<int:pk>/rsvp-status/', EventViewSet.as_view({
        'get': 'rsvp_status'
    }), name='event-rsvp-status'),
    
    path('events/suggest-slots/', EventViewSet.as_view({
        'post': 'suggest_slots'
    }), name='event-suggest-slots'),
    # -------------------------------------

    path('events/<int:pk>/', EventViewSet.as_view({
        'get': 'retrieve', 
        'put': 'update', 
        'patch': 'partial_update', 
        'delete': 'destroy'
    }), name='event-detail'),

    path('events/<int:pk>/', EventViewSet.as_view({
        'get': 'retrieve', 
        'put': 'update', 
        'patch': 'partial_update', 
        'delete': 'destroy'
    }), name='event-detail'),

    # --- CALENDAR SHARING ENDPOINTS ---
    path('calendar-shares/', CalendarShareViewSet.as_view({
        'get': 'list', 
        'post': 'create'
    }), name='calendar-share-list'),

    path('calendar-shares/<int:pk>/', CalendarShareViewSet.as_view({
        'get': 'retrieve', 
        'put': 'update', 
        'patch': 'partial_update', 
        'delete': 'destroy'
    }), name='calendar-share-detail'),

    # Endpoints for the logged-in user to manage their links
    path('calendar-links/', CalendarShareLinkViewSet.as_view({
        'get': 'list', 
        'post': 'create'
    }), name='calendar-link-list'),

    path('calendar-links/<int:pk>/', CalendarShareLinkViewSet.as_view({
        'get': 'retrieve', 
        'put': 'update', 
        'patch': 'partial_update', 
        'delete': 'destroy'
    }), name='calendar-link-detail'),

    # The actual public endpoint for the external client
    # Notice we pass the token directly in the URL path
    path('shared-calendar/<uuid:token>/', PublicSharedCalendarView.as_view(), name='public-shared-calendar'),

    # --- ICS EXPORT ENDPOINT ---
    # --- BULK EXPORT (All Events) ---
    path('events/export-all/', EventViewSet.as_view({
        'get': 'export_all_ics'
    }), name='event-export-all'),

    # --- SINGLE EXPORT (One Event) ---
    path('events/<int:pk>/export/', EventViewSet.as_view({
        'get': 'export_ics'
    }), name='event-export-ics'),

    # Your existing detail endpoint
    path('events/<int:pk>/', EventViewSet.as_view({
        'get': 'retrieve', 
        'put': 'update', 
        'patch': 'partial_update', 
        'delete': 'destroy'
    }), name='event-detail'),
]
