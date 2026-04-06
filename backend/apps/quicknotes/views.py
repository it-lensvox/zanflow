from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser # <-- Import parsers
from .models import Folder, Note, NoteAttachment
from .serializers import FolderSerializer, NoteSerializer, NoteAttachmentSerializer
from .utils import generate_title_from_content
from django.db.models import Q
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
        user = self.request.user
        queryset = Note.objects.filter(
            Q(user=user) | Q(project__members=user)
        ).distinct()
        folder_id = self.request.query_params.get('folder')
        if folder_id is not None:
            queryset = queryset.filter(folder_id=folder_id)
        return queryset

    def perform_create(self, serializer):
        # Extract the title and content the user sent
        title = serializer.validated_data.get('title', '').strip()
        content = serializer.validated_data.get('content', '').strip()

        # If the user left the title blank, let the AI generate it!
        if not title and content:
            title = generate_title_from_content(content)

        # Save the note with the user and the (potentially AI-generated) title
        serializer.save(user=self.request.user, title=title)

    def perform_update(self, serializer):
        # We can also do the same for updates if the user deletes the title
        title = serializer.validated_data.get('title', '').strip()
        content = serializer.validated_data.get('content', '').strip()
        
        # Check if 'title' is in the request but is empty
        if 'title' in self.request.data and not title and content:
             title = generate_title_from_content(content)
             serializer.save(title=title)
        else:
             serializer.save()

class NoteAttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = NoteAttachmentSerializer
    permission_classes = [IsAuthenticated]
    
    # Crucial: Tells DRF to accept file uploads
    parser_classes = [MultiPartParser, FormParser] 

    def get_queryset(self):
        # Security: Only let users see attachments belonging to their own notes
        return NoteAttachment.objects.filter(note__user=self.request.user)