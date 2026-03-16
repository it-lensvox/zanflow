from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Folder, Note
from .serializers import FolderSerializer, NoteSerializer

class FolderViewSet(viewsets.ModelViewSet):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only return folders belonging to the logged-in user
        return Folder.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Automatically attach the logged-in user to the folder
        serializer.save(user=self.request.user)

class NoteViewSet(viewsets.ModelViewSet):
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only return notes belonging to the logged-in user
        queryset = Note.objects.filter(user=self.request.user)
        
        # Optional: Allow filtering notes by folder ID (e.g., /api/v1/quicknotes/notes/?folder=1)
        folder_id = self.request.query_params.get('folder')
        if folder_id is not None:
            queryset = queryset.filter(folder_id=folder_id)
            
        return queryset

    def perform_create(self, serializer):
        # Automatically attach the logged-in user to the note
        serializer.save(user=self.request.user)