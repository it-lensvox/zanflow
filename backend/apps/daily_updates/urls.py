from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DailyUpdateViewSet

router = DefaultRouter()
router.register(r'', DailyUpdateViewSet, basename='daily-update')

urlpatterns = [
    path('', include(router.urls)),
]