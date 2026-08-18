from django.urls import path
from . import views
from .views import ProjectAllDocumentsView, DocumentShareView, DocumentSummaryView, LabelViewSet

urlpatterns = [
    # ==========================================
    # EXPLICIT API VIEWS
    # ==========================================
    path(
        "project/<int:project_id>/all/", 
        ProjectAllDocumentsView.as_view(), 
        name="project-all-documents"
    ),
    path(
        "<uuid:document_id>/share/", 
        DocumentShareView.as_view(), 
        name="document-share"
    ),

    # ==========================================
    # FOLDERS (ViewSet Direct Mapping)
    # ==========================================
    path(
        "folders/", 
        views.FolderViewSet.as_view({
            'get': 'list',
            'post': 'create'
        }), 
        name="folder-list"
    ),
    path(
        "folders/<uuid:pk>/", 
        views.FolderViewSet.as_view({
            'get': 'retrieve',
            'put': 'update',
            'patch': 'partial_update',
            'delete': 'destroy'
        }), 
        name="folder-detail"
    ),
    path(
        "bulk-add-labels/", 
        views.DocumentViewSet.as_view({
            'post': 'bulk_add_labels'
        }), 
        name="document-bulk-add-labels"
    ),
    # ==========================================
    # DOCUMENTS (ViewSet Direct Mapping)
    # ==========================================
    # Note: detail=False actions must come BEFORE the <uuid:pk> paths
    path(
        "bulk-import/", 
        views.DocumentViewSet.as_view({
            'post': 'bulk_import'
        }), 
        name="document-bulk-import"
    ),
    path(
        "shared-with-me/", 
        views.DocumentViewSet.as_view({
            'get': 'shared_with_me'
        }), 
        name="document-shared-with-me"
    ),
    # Standard CRUD
    path(
        "", 
        views.DocumentViewSet.as_view({
            'get': 'list',
            'post': 'create'
        }), 
        name="document-list"
    ),
    path(
        "<uuid:pk>/", 
        views.DocumentViewSet.as_view({
            'get': 'retrieve',
            'put': 'update',
            'patch': 'partial_update',
            'delete': 'destroy'
        }), 
        name="document-detail"
    ),

    # Custom Document Actions
    path(
        "<uuid:pk>/upload-source/", 
        views.DocumentViewSet.as_view({
            'post': 'upload_source'
        }), 
        name="document-upload-source"
    ),
    path(
        "<uuid:pk>/submit-for-review/", 
        views.DocumentViewSet.as_view({
            'post': 'submit_review'
        }), 
        name="document-submit-review"
    ),
    path(
        "<uuid:pk>/approve/", 
        views.DocumentViewSet.as_view({
            'post': 'approve'
        }), 
        name="document-approve"
    ),
    path(
        "<uuid:pk>/activity/",  
        views.DocumentViewSet.as_view({
            'get': 'activity'  
        }), 
        name="document-activity"
    ),

    # Document Versions
    path(
        "<uuid:pk>/versions/", 
        views.DocumentViewSet.as_view({
            'get': 'versions',
            'post': 'versions'
        }), 
        name="document-versions"
    ),
    path(
        "<uuid:pk>/versions/diff/", 
        views.DocumentViewSet.as_view({
            'get': 'version_diff'
        }), 
        name="document-version-diff"
    ),
    path(
        "<uuid:pk>/versions/<str:version_id>/", 
        views.DocumentViewSet.as_view({
            'get': 'version_detail'
        }), 
        name="document-version-detail"
    ),

    # ==========================================
    # DOCUMENT COMMENTS (Nested Direct Mapping)
    # ==========================================
    path(
        "<uuid:document_pk>/comments/", 
        views.DocumentCommentViewSet.as_view({
            'get': 'list',
            'post': 'create'
        }), 
        name="document-comments-list"
    ),
    path(
        "<uuid:document_pk>/comments/<uuid:pk>/", 
        views.DocumentCommentViewSet.as_view({
            'get': 'retrieve',
            'put': 'update',
            'patch': 'partial_update',
            'delete': 'destroy'
        }), 
        name="document-comments-detail"
    ),
    path(
        "<uuid:document_pk>/comments/<uuid:pk>/resolve/", 
        views.DocumentCommentViewSet.as_view({
            'post': 'resolve'
        }), 
        name="document-comments-resolve"
    ),
    path(
        "summary/", 
        DocumentSummaryView.as_view(), 
        name="document-summary"
    ),
    
    path(
        "project/<int:project_id>/all/", 
        ProjectAllDocumentsView.as_view(), 
        name="project-all-documents"
    ),
    path(
        "labels/", 
        LabelViewSet.as_view({
            'get': 'list',
            'post': 'create'
        }), 
        name="label-list"
    ),
    path(
        "labels/<int:pk>/", 
        LabelViewSet.as_view({
            'get': 'retrieve',
            'put': 'update',
            'patch': 'partial_update',
            'delete': 'destroy'
        }), 
        name="label-detail"
    ),
]