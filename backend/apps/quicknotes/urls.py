from django.urls import path
from .views import FolderViewSet, NoteViewSet

app_name = 'quicknotes'

# Bind the ViewSet methods to explicit actions
folder_list = FolderViewSet.as_view({
    'get': 'list',
    'post': 'create'
})

folder_detail = FolderViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy'
})

note_list = NoteViewSet.as_view({
    'get': 'list',
    'post': 'create'
})

note_detail = NoteViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy'
})

# Define the explicit paths
urlpatterns = [
    # Folder Endpoints
    path('folders/', folder_list, name='folder-list'),
    path('folders/<int:pk>/', folder_detail, name='folder-detail'),

    # Note Endpoints
    path('notes/', note_list, name='note-list'),
    path('notes/<int:pk>/', note_detail, name='note-detail'),
]