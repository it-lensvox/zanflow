from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Folder, Note, NoteAttachment
from .serializers import FolderSerializer, NoteSerializer, NoteAttachmentSerializer
from .utils import generate_title_from_content
from django.db.models import Q
from apps.organizations.mixins import WorkspaceContextMixin


class FolderViewSet(WorkspaceContextMixin, viewsets.ModelViewSet):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Scoped by workspace (via TenantManager) AND by user
        return Folder.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class NoteViewSet(WorkspaceContextMixin, viewsets.ModelViewSet):
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # TenantManager auto-filters by workspace, then we filter by user/project
        queryset = Note.objects.filter(
            Q(user=user) | Q(project__members=user)
        ).distinct()
        folder_id = self.request.query_params.get('folder')
        if folder_id is not None:
            queryset = queryset.filter(folder_id=folder_id)
        return queryset

    def perform_create(self, serializer):
        title = serializer.validated_data.get('title', '').strip()
        content = serializer.validated_data.get('content', '').strip()

        if not title and content:
            title = generate_title_from_content(content)

        serializer.save(user=self.request.user, title=title)

    def perform_update(self, serializer):
        title = serializer.validated_data.get('title', '').strip()
        content = serializer.validated_data.get('content', '').strip()

        if 'title' in self.request.data and not title and content:
            title = generate_title_from_content(content)
            serializer.save(title=title, updated_by=self.request.user)
        else:
            serializer.save(updated_by=self.request.user)


class NoteAttachmentViewSet(WorkspaceContextMixin, viewsets.ModelViewSet):
    serializer_class = NoteAttachmentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        # Scoped through Note → workspace
        return NoteAttachment.objects.filter(note__user=self.request.user)

    def perform_create(self, serializer):
        attachment = serializer.save()

        if attachment.file:
            from .preview_service import (
                needs_pdf_conversion,
                trigger_note_preview_async,
            )

            if needs_pdf_conversion(attachment.file.name):
                trigger_note_preview_async(attachment.id)
            else:
                attachment.preview_status = 'not_needed'
                attachment.save(update_fields=['preview_status'])