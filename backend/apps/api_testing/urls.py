"""
URL configuration for API Testing Platform.

All endpoints are prefixed with /api/v1/api-testing/

Endpoints:
-----------
Collections:
    GET     /collections/                   - List all collections
    POST    /collections/                   - Create new collection
    GET     /collections/{id}/              - Get collection details
    PUT     /collections/{id}/              - Update collection
    DELETE  /collections/{id}/              - Delete collection
    POST    /collections/{id}/run/          - Run all APIs in collection
    GET     /collections/{id}/export/       - Export collection
    GET     /collections/{id}/history/      - Get execution history
    POST    /collections/import_collection/ - Import collection

Endpoints (APIs):
    GET     /endpoints/                     - List all endpoints
    POST    /endpoints/                     - Create new endpoint
    GET     /endpoints/{id}/                - Get endpoint details
    PUT     /endpoints/{id}/                - Update endpoint
    DELETE  /endpoints/{id}/                - Delete endpoint
    POST    /endpoints/{id}/run/            - Run single endpoint
    POST    /endpoints/bulk_create/         - Create multiple endpoints
    POST    /endpoints/reorder/             - Reorder endpoints

Credentials:
    GET     /credentials/                   - List all credentials
    POST    /credentials/                   - Create new credential
    GET     /credentials/{id}/              - Get credential details
    PUT     /credentials/{id}/              - Update credential
    DELETE  /credentials/{id}/              - Delete credential
    POST    /credentials/{id}/refresh/      - Refresh OAuth2 token

Execution:
    POST    /run/collection/                - Run collection (standalone)
    POST    /run/api/                       - Run single API (standalone)

History:
    GET     /runs/                          - List execution runs
    GET     /runs/{id}/                     - Get execution run details
    GET     /results/                       - List execution results
    GET     /results/{id}/                  - Get result details

Schedules:
    GET     /schedules/                     - List scheduled runs
    POST    /schedules/                     - Create schedule
    GET     /schedules/{id}/                - Get schedule details
    PUT     /schedules/{id}/                - Update schedule
    DELETE  /schedules/{id}/                - Delete schedule
    POST    /schedules/{id}/trigger/        - Trigger schedule immediately

Dashboard:
    GET     /dashboard/                     - Get statistics
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    APICollectionViewSet,
    APIEndpointViewSet,
    AuthCredentialViewSet,
    ExecutionRunViewSet,
    ExecutionResultViewSet,
    ScheduledRunViewSet,
    RunCollectionView,
    RunSingleAPIView,
    DashboardStatsView,
)

# Create router and register viewsets
router = DefaultRouter()
router.register(r'collections', APICollectionViewSet, basename='collection')
router.register(r'endpoints', APIEndpointViewSet, basename='endpoint')
router.register(r'credentials', AuthCredentialViewSet, basename='credential')
router.register(r'runs', ExecutionRunViewSet, basename='execution-run')
router.register(r'results', ExecutionResultViewSet, basename='execution-result')
router.register(r'schedules', ScheduledRunViewSet, basename='schedule')

# App name for URL namespacing
app_name = 'api_testing'

urlpatterns = [
    # Router URLs (ViewSets)
    path('', include(router.urls)),
    
    # Standalone execution endpoints
    path('run/collection/', RunCollectionView.as_view(), name='run-collection'),
    path('run/api/', RunSingleAPIView.as_view(), name='run-api'),
    
    # Dashboard
    path('dashboard/', DashboardStatsView.as_view(), name='dashboard'),
]
