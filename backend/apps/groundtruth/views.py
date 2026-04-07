"""
Views for Ground Truth app.
"""
import os
import re
from django.shortcuts import get_object_or_404
from django.conf import settings  # Import settings for AWS URL construction
from django_filters import rest_framework as filters
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
import boto3
from rest_framework.views import APIView
from apps.tasksite.models import TaskAttachment
from apps.audit.services import get_object_history, log_action
from django.db.models import Q
from .models import Document, DocumentComment, GTVersion, DocumentShare
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth import get_user_model
from apps.notification.models import Notification
from apps.notification.serializers import NotificationSerializer
from apps.audit.services import log_action
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .serializers import DocumentShareSerializer
from apps.projects.models import Project
from django.utils import timezone
from .serializers import (
    DocumentBulkImportSerializer,
    DocumentCommentSerializer,
    DocumentCreateSerializer,
    DocumentDetailSerializer,
    DocumentSerializer,
    GTVersionCreateSerializer,
    GTVersionListSerializer,
    GTVersionSerializer,
    VersionDiffSerializer,
)
from .services import approve_gt_version, compute_gt_diff, submit_for_review


class DocumentFilter(filters.FilterSet):
    """
    Filter for documents.
    """
    # 1. Make sure this uses the custom method
    project = filters.NumberFilter(method="filter_by_project_or_share")
    status = filters.ChoiceFilter(choices=Document.Status.choices)

    # 2. Make sure this exact method exists inside the class
    def filter_by_project_or_share(self, queryset, name, value):
        return queryset.filter(
            Q(project_id=value) | Q(shares__shared_project_id=value)
        ).distinct()
    file_type = filters.ChoiceFilter(choices=Document.FileType.choices)
    created_after = filters.DateTimeFilter(field_name="created_at", lookup_expr="gte")
    created_before = filters.DateTimeFilter(field_name="created_at", lookup_expr="lte")
    
    class Meta:
        model = Document
        fields = ["project", "status", "file_type"]


class DocumentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Document CRUD operations with restricted visibility.
    """
    # 1. Add the dynamic queryset logic inside the class
    def get_queryset(self):
        user = self.request.user
        
        queryset = Document.objects.select_related(
            "project", "created_by", "current_gt_version"
        ).prefetch_related("versions", "shares") # Added "shares" for optimization

        # THE UPDATE: We added the third condition 'shares__shared_with=user'
        return queryset.filter(
            Q(project__created_by=user) | 
            Q(project__members=user) | 
            Q(shares__shared_with=user) |
            Q(shares__shared_project__members=user) |
            Q(shares__shared_project__created_by=user)
        ).distinct()

    # 2. Re-add the serializer logic to fix the AssertionError
    def get_serializer_class(self):
        if self.action == "create":
            return DocumentCreateSerializer
        return DocumentSerializer

    # --- Standard ViewSet Configurations ---
    filterset_class = DocumentFilter
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at", "updated_at", "status"]
    ordering = ["-created_at"]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    # --- MODIFIED CREATE METHOD ---
    def create(self, request, *args, **kwargs):
        """
        Overridden to handle 's3_key' from direct client uploads.
        """
        # Check if this is a Direct S3 Upload confirmation
        if "s3_key" in request.data:
            return self.create_from_s3(request)
            
        # Standard flow (fallback)
        return super().create(request, *args, **kwargs)

    def create_from_s3(self, request):
        """
        Custom handler for creating documents after S3 direct upload.
        """
        data = request.data
        project_id = data.get("project_id")
        s3_key = data.get("s3_key")
        name = data.get("name")
        file_size = data.get("file_size", 0)
        file_type = data.get("file_type", "application/pdf")

        if not project_id or not s3_key:
            return Response(
                {"detail": "project_id and s3_key are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create the document instance
        document = Document(
            project_id=project_id,
            name=name,
            file_size=file_size,
            file_type=file_type,
            created_by=request.user,
            updated_by=request.user,
            status=Document.Status.UPLOADED,
        )

        # --- THE FIX ---
        # We manually assign the S3 path to the 'source_file' field.
        # This tells Django: "The file is already at this path in the storage."
        document.source_file.name = s3_key 
        
        # Save to DB
        document.save()

        # Log the action
        log_action(document, "create", new_value={"name": document.name, "s3_key": s3_key})

        # Return the standard serialized data
        # Now the serializer will see 'source_file' is set and generate the correct S3 URL
        serializer = DocumentSerializer(document)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    # ------------------------------

    def perform_create(self, serializer):
        document = serializer.save()
        log_action(document, "create", new_value={"name": document.name})
    
    def perform_update(self, serializer):
        # 1. Grab the current document BEFORE saving to see its old status
        instance = self.get_object()
        old_status = instance.status

        # 2. Save the new changes
        # (Assuming your UserStampedModel automatically uses the updated_by field)
        updated_document = serializer.save(updated_by=self.request.user)
        
        # 3. Did the status change?
        new_status = updated_document.status
        
        if old_status != new_status:
            # 4. Create the Audit Log!
            log_action(
                updated_document,   # Passed positionally (no 'target=')
                "status_change",    # Passed positionally (no 'action=')
                old_value={"status": old_status},
                new_value={"status": new_status},
                change_summary=f"Document status changed from '{old_status}' to '{new_status}'",
                user=self.request.user,
            )
    
    @action(detail=True, methods=["post"], url_path="upload-source")
    def upload_source(self, request, pk=None):
        """
        Upload source file for a document.
        """
        document = self.get_object()
        
        if "file" not in request.FILES:
            return Response(
                {"detail": "No file provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        file = request.FILES["file"]
        document.source_file = file
        document.file_size = file.size
        document.updated_by = request.user
        document.save()
        
        log_action(document, "update", change_summary="Uploaded source file")
        
        return Response(DocumentSerializer(document).data)
    
    @action(detail=True, methods=["get", "post"])
    def versions(self, request, pk=None):
        """
        List or create GT versions.
        """
        document = self.get_object()
        
        if request.method == "GET":
            versions = document.versions.all()
            serializer = GTVersionListSerializer(versions, many=True)
            return Response(serializer.data)
        
        # POST - create new version
        serializer = GTVersionCreateSerializer(
            data=request.data,
            context={"request": request, "document": document},
        )
        serializer.is_valid(raise_exception=True)
        version = serializer.save()
        
        log_action(
            version,
            "create",
            new_value={"version_number": version.version_number},
            change_summary=f"Created version {version.version_number}",
        )
        
        return Response(
            GTVersionSerializer(version).data,
            status=status.HTTP_201_CREATED,
        )
    
    @action(detail=True, methods=["get"], url_path="versions/(?P<version_id>[^/.]+)")
    def version_detail(self, request, pk=None, version_id=None):
        """
        Get specific version details.
        """
        document = self.get_object()
        try:
            version = document.versions.get(id=version_id)
            return Response(GTVersionSerializer(version).data)
        except GTVersion.DoesNotExist:
            return Response(
                {"detail": "Version not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
    
    @action(detail=True, methods=["get"], url_path="versions/diff")
    def version_diff(self, request, pk=None):
        """
        Get diff between two versions.
        Query params: v1, v2 (version numbers or IDs)
        """
        document = self.get_object()
        
        v1_param = request.query_params.get("v1")
        v2_param = request.query_params.get("v2")
        
        if not v1_param or not v2_param:
            return Response(
                {"detail": "Both v1 and v2 parameters required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        try:
            # Try as version number first, then as ID
            try:
                v1 = document.versions.get(version_number=int(v1_param))
            except (ValueError, GTVersion.DoesNotExist):
                v1 = document.versions.get(id=v1_param)
            
            try:
                v2 = document.versions.get(version_number=int(v2_param))
            except (ValueError, GTVersion.DoesNotExist):
                v2 = document.versions.get(id=v2_param)
        except GTVersion.DoesNotExist:
            return Response(
                {"detail": "Version not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        diff = compute_gt_diff(v1.gt_data, v2.gt_data)
        
        return Response({
            "version1": GTVersionSerializer(v1).data,
            "version2": GTVersionSerializer(v2).data,
            "diff": diff,
        })
    
    @action(detail=True, methods=["post"], url_path="submit-for-review")
    def submit_review(self, request, pk=None):
        document = self.get_object()
        document.status = Document.Status.IN_REVIEW
        document.updated_by = request.user
        document.save()
        return Response(DocumentSerializer(document).data)
    
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        document = self.get_object()
        document.status = Document.Status.APPROVED
        document.updated_by = request.user
        document.save()
        return Response(DocumentSerializer(document).data)
    
    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        """
        Get audit history for document.
        """
        document = self.get_object()
        history = get_object_history(document)
        
        from apps.audit.models import AuditLog
        from rest_framework import serializers as drf_serializers
        
        class AuditSerializer(drf_serializers.ModelSerializer):
            user = drf_serializers.StringRelatedField()
            
            class Meta:
                model = AuditLog
                fields = ["id", "user", "action", "change_summary", "timestamp"]
        
        return Response(AuditSerializer(history, many=True).data)
    
    @action(detail=False, methods=["post"], url_path="bulk-import")
    def bulk_import(self, request):
        """
        Bulk import documents with GT data.
        """
        serializer = DocumentBulkImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        project_id = request.data.get("project_id")
        if not project_id:
            return Response(
                {"detail": "project_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        created_docs = []
        for doc_data in serializer.validated_data["documents"]:
            doc = Document.objects.create(
                project_id=project_id,
                name=doc_data.get("name", "Untitled"),
                metadata=doc_data.get("metadata", {}),
                created_by=request.user,
            )
            
            if "gt_data" in doc_data:
                GTVersion.objects.create(
                    document=doc,
                    gt_data=doc_data["gt_data"],
                    created_by=request.user,
                    source_type="bulk_import",
                )
            
            created_docs.append(doc)
        
        return Response(
            {"created": len(created_docs)},
            status=status.HTTP_201_CREATED,
        )


class DocumentCommentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for document comments.
    """
    serializer_class = DocumentCommentSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # 1. Start with the optimized base queryset
        queryset = Document.objects.select_related(
            "project", "created_by", "current_gt_version"
        ).prefetch_related("versions")

        # 2. Filter: Only show documents if the project was created by the user 
        # OR if the user is a member of the project.
        return queryset.filter(
            Q(project__created_by=user) | Q(project__members=user)
        ).distinct()
    
    def perform_create(self, serializer):
        document_id = self.kwargs.get("document_pk")
        serializer.save(
            document_id=document_id,
            created_by=self.request.user,
        )
    
    @action(detail=True, methods=["post"])
    def resolve(self, request, document_pk=None, pk=None):
        """
        Mark comment as resolved.
        """
        comment = self.get_object()
        comment.is_resolved = True
        comment.save()
        return Response(DocumentCommentSerializer(comment).data)
class ProjectAllDocumentsView(APIView):
    """
    Unified endpoint to fetch both Project-level Documents 
    and Task-level Attachments for a specific project.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_id):
        # 1. Initialize S3 Client ONCE for performance
        s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME
        )

        # 2. Fetch Project-Level Documents
        project_docs = Document.objects.filter(
            Q(project_id=project_id) | Q(shares__shared_project_id=project_id)
        ).distinct()
        project_data = [] 
        for doc in project_docs:
            # Fallback to doc.name if source_file doesn't exist
            filename = doc.source_file.name.split('/')[-1] if doc.source_file else doc.name
            
            file_url = None
            if doc.source_file:
                try:
                    file_url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={
                            'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                            'Key': doc.source_file.name
                        },
                        ExpiresIn=3600 
                    )
                except Exception as e:
                    print(f"S3 Error for Document {doc.id}: {e}")
            elif doc.source_file_url:
                file_url = doc.source_file_url # External URL fallback

            project_data.append({
                "id": str(doc.id), # UUID converted to string
                "file_name": doc.name, 
                "file_url": file_url, 
                "uploaded_at": doc.created_at,
                "updated_at": doc.updated_at,
                "source": "Project",
                "task_id": None,
                "task_heading": None
            })

        # 3. Fetch Task-Level Attachments
        # Uses the double underscore to filter tasks by project_id
        task_attachments = TaskAttachment.objects.filter(task__project_id=project_id)
        task_data = []
        for attachment in task_attachments:
            # Get the raw S3 filename
            raw_filename = attachment.file.name.split('/')[-1] if attachment.file else "Unknown"
            
            # --- NEW FIX: Clean the Django random string ---
            # This looks for an underscore followed by exactly 7 letters/numbers before the extension
            # Example: "api_10_qW94evv.ts" becomes "api_10.ts"
            clean_filename = re.sub(r'_[a-zA-Z0-9]{7}(\.[^.]+)$', r'\1', raw_filename)
            
            file_url = None
            if attachment.file:
                try:
                    file_url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={
                            'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                            'Key': attachment.file.name
                        },
                        ExpiresIn=3600
                    )
                except Exception as e:
                    print(f"S3 Error for TaskAttachment {attachment.id}: {e}")

            task_data.append({
                "id": str(attachment.id),
                "file_name": clean_filename,
                "file_url": file_url,
                "uploaded_at": attachment.uploaded_at, # Adjust if your field is named differently
                "updated_at": attachment.uploaded_at,
                "source": "Task",
                "task_id": attachment.task.id,
                "task_heading": attachment.task.heading
            })

        # 4. Merge and Sort (Newest first)
        all_documents = project_data + task_data
        all_documents.sort(key=lambda x: x['uploaded_at'], reverse=True)

        name_tracker = {}
        for doc in all_documents:
            original_name = doc['file_name']
            
            if original_name in name_tracker:
                # We have seen this name before! Increase the count.
                name_tracker[original_name] += 1
                
                # Split "LensVox_Theme.pdf" into "LensVox_Theme" and ".pdf"
                name_part, ext_part = os.path.splitext(original_name)
                
                # Combine it back together as "LensVox_Theme (1).pdf"
                doc['file_name'] = f"{name_part} ({name_tracker[original_name]}){ext_part}"
            else:
                # First time seeing this name, start the tracker at 0
                name_tracker[original_name] = 0

        # 5. Finally, sort by NEWEST first so the user sees the latest files at the top
        all_documents.sort(key=lambda x: x['uploaded_at'], reverse=True)

        return Response({
            "message": "All project and task documents retrieved",
            "total_files": len(all_documents),
            "documents": all_documents
        }, status=status.HTTP_200_OK)
    
class DocumentShareView(APIView):
    """
    Explicit endpoint to handle sharing a document with a user OR a project.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, document_id):
        user = request.user
        
        # 1. Fetch document and strictly verify the user has access to it
        document = get_object_or_404(
            Document.objects.filter(
                Q(project__created_by=user) | 
                Q(project__members=user) | 
                Q(shares__shared_with=user) |
                Q(shares__shared_project__members=user) |
                Q(shares__shared_project__created_by=user)
            ).distinct(),
            id=document_id
        )

        # 2. Validate request
        serializer = DocumentShareSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        target_user_id = serializer.validated_data.get("user_id")
        target_project_id = serializer.validated_data.get("project_id")
        
        User = get_user_model()
        channel_layer = get_channel_layer()

        # ==========================================
        # PATH A: SHARE WITH SPECIFIC USER
        # ==========================================
        if target_user_id:
            try:
                target_user = User.objects.get(id=target_user_id)
            except User.DoesNotExist:
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

            if target_user == user:
                return Response({"detail": "You cannot share a document with yourself."}, status=status.HTTP_400_BAD_REQUEST)

            if document.project:
                if document.project.created_by == target_user or document.project.members.filter(id=target_user.id).exists():
                    return Response(
                        {"detail": f"{target_user.username} already has access to this document through the project."}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )

            share_record, created = DocumentShare.objects.get_or_create(
                document=document, shared_with=target_user,
                defaults={'created_by': user, 'updated_by': user}
            )

            if not created:
                share_record.updated_by = user
                share_record.save(update_fields=['updated_by', 'updated_at'])

            log_action(document, "shared", change_summary=f"Document shared with {target_user.username}", user=user)

            # Update the document's timestamp so the frontend shows it was updated "just now"
            document.updated_by = user
            document.updated_at = timezone.now()
            document.save()

            notification = Notification.objects.create(
                recipient=target_user,
                actor=user,
                title="Shared Document",
                message=f"{user.first_name or user.username} shared the document '{document.name}' with you.",
                notification_type=Notification.NotificationType.DOCUMENT_SHARED,
                content_type=ContentType.objects.get_for_model(Document),
                object_id=str(document.id),
            )
            
            notification_data = NotificationSerializer(notification).data
            unread_count = Notification.objects.filter(recipient=target_user, is_read=False).count()
            notification_data['unread_count'] = unread_count

            async_to_sync(channel_layer.group_send)(
                f"user_{target_user.id}",
                {
                    "type": "gateway_signal", 
                    "event": "NEW_NOTIFICATION",
                    "data": notification_data
                }
            )
            
            return Response(
                {"detail": f"Document successfully shared with {target_user.username}."}, 
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
            )

        # ==========================================
        # PATH B: SHARE WITH ENTIRE PROJECT
        # ==========================================
        elif target_project_id:
            try:
                target_project = Project.objects.get(id=target_project_id)
            except Project.DoesNotExist:
                return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

            if document.project == target_project:
                return Response({"detail": "Document already belongs to this project."}, status=status.HTTP_400_BAD_REQUEST)

            share_record, created = DocumentShare.objects.get_or_create(
                document=document, shared_project=target_project,
                defaults={'created_by': user, 'updated_by': user}
            )

            if not created:
                share_record.updated_by = user
                share_record.save(update_fields=['updated_by', 'updated_at'])

            log_action(document, "shared", change_summary=f"Document shared with project {target_project.name}", user=user)

            # Update the document's timestamp so the frontend shows it was updated "just now"
            document.updated_by = user
            document.updated_at = timezone.now()
            document.save()

            # Get all project members + creator (excluding the user who is sending it)

            # Get all project members + creator (excluding the user who is sending it)
            target_users = list(target_project.members.exclude(id=user.id))
            if target_project.created_by != user and target_project.created_by not in target_users:
                target_users.append(target_project.created_by)

            # Broadcast to everyone in that project
            for member in target_users:
                notification = Notification.objects.create(
                    recipient=member,
                    actor=user,
                    title="Shared Document via Project",
                    message=f"{user.first_name or user.username} shared '{document.name}' with your project '{target_project.name}'.",
                    notification_type=Notification.NotificationType.DOCUMENT_SHARED,
                    content_type=ContentType.objects.get_for_model(Document),
                    object_id=str(document.id),
                )
                
                notification_data = NotificationSerializer(notification).data
                unread_count = Notification.objects.filter(recipient=member, is_read=False).count()
                notification_data['unread_count'] = unread_count
                
                async_to_sync(channel_layer.group_send)(
                    f"user_{member.id}",
                    {
                        "type": "gateway_signal", 
                        "event": "NEW_NOTIFICATION",
                        "data": notification_data
                    }
                )

            return Response(
                {"detail": f"Document successfully shared with project {target_project.name}."}, 
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
            )