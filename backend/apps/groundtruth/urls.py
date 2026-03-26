from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers as nested_routers

from . import views
# Import the new DocumentShareView
from .views import ProjectAllDocumentsView, DocumentShareView 

router = DefaultRouter()
router.register(r"", views.DocumentViewSet, basename="document")

documents_router = nested_routers.NestedDefaultRouter(router, r"", lookup="document")
documents_router.register(r"comments", views.DocumentCommentViewSet, basename="document-comments")

urlpatterns = [
    # Explicit custom views at the top
    path("project/<int:project_id>/all/", ProjectAllDocumentsView.as_view(), name="project-all-documents"),
    
    # --- YOUR NEW EXPLICIT ENDPOINT ---
    path("<uuid:document_id>/share/", DocumentShareView.as_view(), name="document-share"),
    
    # Default router includes at the bottom
    path("", include(router.urls)),
    path("", include(documents_router.urls)),
]