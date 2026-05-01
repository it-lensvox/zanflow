# serializers.py
import re
import os
import boto3
from django.conf import settings
from rest_framework import serializers
from .models import Task, TaskAttachment, TaskComment, TaskLink
from apps.users.models import User
# Import your existing Project model here too
from apps.projects.models import Project, Label
from apps.groundtruth.models import Document
def trigger_task_attachment_conversion(document):
    """
    Convert task attachment to PDF synchronously during upload.
    User waits ~10-15 sec but file is ready to preview immediately on click.
    """
    from apps.groundtruth.services import (
        needs_pdf_conversion,
        generate_document_preview,
    )
    
    if not document.source_file:
        return
    
    if not needs_pdf_conversion(document.source_file.name):
        # File doesn't need conversion (image, PDF, video, etc.)
        document.preview_status = 'not_needed'
        document.save(update_fields=['preview_status'])
        return
    
    # Office file — convert SYNCHRONOUSLY so file is ready on first click
    try:
        generate_document_preview(document)
    except Exception as e:
        import logging
        logging.error(f"Task attachment conversion failed: {e}")
        # Don't fail the upload — user can still download original
class AssignedByUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'role']
        read_only_fields = fields
class LabelSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ['id', 'name', 'color']
class UserManagementSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role']
class TaskLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskLink
        fields = ['id', 'url', 'created_at']
# Optional: A simple serializer to show project details in the response
class ProjectSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'name']

class TaskAttachmentSerializer(serializers.ModelSerializer):
    # Map the Document fields to match what the frontend expects
    file_name = serializers.CharField(source='name', read_only=True)
    uploaded_at = serializers.DateTimeField(source='created_at', read_only=True)
    file_url = serializers.SerializerMethodField()
    preview_status = serializers.CharField(read_only=True)
    class Meta:
        model = Document  # <--- Now uses Document!
        fields = ['id', 'file_name', 'file_url', 'uploaded_at', 'preview_status']

    def get_file_url(self, obj):
        if not obj.source_file:
            return obj.source_file_url  # Fallback for external links
        
        # ============ NEW: Prefer PDF preview if conversion is ready ============
        # If this Document has been converted to PDF, return the PDF URL instead
        # so Office files (PPTX/DOCX/XLSX) preview inline as PDFs
        use_pdf_preview = (
            obj.preview_pdf 
            and obj.preview_pdf.name
            and obj.preview_status == 'ready'
        )
        
        if use_pdf_preview:
            target_key = obj.preview_pdf.name
            content_type = 'application/pdf'
        else:
            target_key = obj.source_file.name
            content_type = None
        # =========================================================================
            
        s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME
        )
        try:
            params = {
                'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 
                'Key': target_key,
                'ResponseContentDisposition': 'inline',
            }
            if content_type:
                params['ResponseContentType'] = content_type
            
            return s3_client.generate_presigned_url(
                'get_object',
                Params=params,
                ExpiresIn=3600 
            )
        except Exception as e:
            return None
class UserSimpleSerializer(serializers.ModelSerializer):
    """Helper to show user details inside a comment"""
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']

class TaskCommentSerializer(serializers.ModelSerializer):
    user_details = UserSimpleSerializer(source='user', read_only=True)

    class Meta:
        model = TaskComment
        fields = ['id', 'task', 'user', 'user_details', 'content', 'created_at']
        read_only_fields = ['id', 'created_at', 'user', 'task']

class TaskSerializer(serializers.ModelSerializer):
    assigned_to_user_details = AssignedByUserSerializer(source='assigned_to', read_only=True, many=True)
    assigned_by_user_details = AssignedByUserSerializer(source='assigned_by', read_only=True)
    status_updated_by_details = AssignedByUserSerializer(source='status_updated_by', read_only=True)
    attachments = TaskAttachmentSerializer(source='documents', many=True, read_only=True)
    
    links = TaskLinkSerializer(many=True, read_only=True)
    uploaded_links = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False
    )
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        required=False,
        allow_null=True
    )
    # This shows the project name when you GET the task
    project_details = ProjectSimpleSerializer(source='project', read_only=True)
    label_details = LabelSimpleSerializer(source='labels', many=True, read_only=True)
    comments = TaskCommentSerializer(many=True, read_only=True)
    is_pinned = serializers.SerializerMethodField()
    # WRITE ONLY: This allows uploading multiple files during creation
    uploaded_files = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False
    )
    labels = serializers.PrimaryKeyRelatedField(
        queryset=Label.objects.all(),
        many=True,
        write_only=True,
        required=False
    )
    # -------------------------------------

    class Meta:
        model = Task
        fields = [
            'id', 'heading', 'description', 'start_date', 'end_date',
            'label_details',
            'labels',
            'duration_time',
            'priority',
            'project',          # <--- Send ID (9) here when creating
            'project_details',  # <--- Receive details (Name: Marketing...) here when viewing
            'assigned_to', 
            'assigned_to_user_details', 
            'assigned_by',
            'assigned_by_user_details',
            'status',
            'status_updated_by_details',
            'attachments',    # <--- Include in output
            'uploaded_files',
            'links',
            'uploaded_links',
            'created_at',
            'updated_at',
            'comments',
            'is_pinned'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'assigned_by', 'assigned_by_user_details', 'status_updated_by_details']

    def get_is_pinned(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # Returns True if the current user is in the pinned_by list
            return obj.pinned_by.filter(id=request.user.id).exists()
        return False   
    
    def validate_uploaded_links(self, value):
        """
        Automatically adds 'https://' if the user (or Postman) 
        only provided 'www.something.com' or 'something.com'.
        """
        cleaned_links = []
        for url in value:
            # Remove any accidental leading/trailing whitespace
            url = url.strip()

            # If it starts with www, or lacks http/https, add https://
            if not (url.startswith("http://") or url.startswith("https://")):
                url = "https://" + url
            
            cleaned_links.append(url)
        
        return cleaned_links
    def create(self, validated_data):
        # 1. Pop the files out of the data so they don't break the Task creation
        uploaded_files = validated_data.pop('uploaded_files', [])
        uploaded_links = validated_data.pop('uploaded_links', [])
        
        # 2. Create the Task normally
        task = super().create(validated_data)
        
        # --- NEW LOGIC: Save files as Documents ---
        user = self.context['request'].user
        
        # Safety: Tasks must have a project to attach documents
        if uploaded_files and not task.project:
            import logging
            logging.warning(
                f"Cannot create documents for task {task.id} — task has no project"
            )
        else:
            for file in uploaded_files:
                # Clean the filename for the DB
                clean_name = re.sub(r'_[a-zA-Z0-9]{7}(\.[^.]+)$', r'\1', file.name)
                document = Document.objects.create(
                    project=task.project, # Inherits the project from the task!
                    task=task,            # Links to this specific task
                    name=clean_name,
                    source_file=file,
                    status='draft',
                    created_by=user
                )
                # Trigger PDF preview conversion in background
                trigger_task_attachment_conversion(document)
            
        for url in uploaded_links:
            TaskLink.objects.create(task=task, url=url)
        return task

    def update(self, instance, validated_data):
        # 1. Pop the new files out (so they don't break the standard Task update)
        uploaded_files = validated_data.pop('uploaded_files', [])
        uploaded_links = validated_data.pop('uploaded_links', [])
        validated_data.pop('assigned_by', None)
        instance = super().update(instance, validated_data)
        
        # Refresh to make sure project relationship is loaded after update
        instance.refresh_from_db()
        
        # --- NEW LOGIC: Save NEW files as Documents ---
        user = self.context['request'].user
        
        # Safety: Tasks must have a project to attach documents
        if uploaded_files and not instance.project:
            import logging
            logging.warning(
                f"Cannot create documents for task {instance.id} — task has no project"
            )
        else:
            for file in uploaded_files:
                clean_name = re.sub(r'_[a-zA-Z0-9]{7}(\.[^.]+)$', r'\1', file.name)
                document = Document.objects.create(
                    project=instance.project,
                    task=instance,
                    name=clean_name,
                    source_file=file,
                    status='draft',
                    created_by=user
                )
                # Trigger PDF preview conversion in background
                trigger_task_attachment_conversion(document)
            
        for url in uploaded_links:
            TaskLink.objects.create(task=instance, url=url)
        return instance

class TaskStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ['id', 'status']
        read_only_fields = ['id']
