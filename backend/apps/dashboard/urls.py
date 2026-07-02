from django.urls import path
from .views import CustomDashboardViewSet

list_view = CustomDashboardViewSet.as_view({
    'get': 'list',
    'post': 'create',
})

detail_view = CustomDashboardViewSet.as_view({
    'patch': 'partial_update',
    'delete': 'destroy',
})

urlpatterns = [
    path('custom/', list_view, name='custom-dashboard-list'),
    path('custom/<int:pk>/', detail_view, name='custom-dashboard-detail'),
]