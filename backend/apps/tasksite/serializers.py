# serializers.py
import os
import boto3
from django.conf import settings
from rest_framework import serializers
from .models import Task, TaskAttachment, TaskComment, TaskLink
from apps.users.models import User
# Import your existing Project model here too
from apps.projects.models import Project, Label

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
    file_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField() # <--- NEW: The working link

    class Meta:
        model = TaskAttachment
        fields = ['id', 'file', 'file_name', 'file_url', 'uploaded_at']
        
        # OPTIONAL: Hide the broken 'file' path from the output so you don't use it by mistake
        extra_kwargs = {
            'file': {'write_only': True} 
        }

    def get_file_name(self, obj):
        return os.path.basename(obj.file.name)

    def get_file_url(self, obj):
        """
        Generates a temporary public link (Presigned URL) for the private S3 file.
        """
        if not obj.file:
            return None

        # 1. Initialize S3 Client using your Django Settings
        s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME
        )

        # 2. Generate the URL (Valid for 1 hour / 3600 seconds)
        try:
            url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                    'Key': obj.file.name
                },
                ExpiresIn=3600 
            )
            return url
        except Exception as e:
            print(f"Error generating presigned URL: {e}")
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
    attachments = TaskAttachmentSerializer(many=True, read_only=True)
    comments = TaskCommentSerializer(many=True, read_only=True)
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
            'attachments',    # <--- Include in output
            'uploaded_files',
            'links',
            'uploaded_links',
            'created_at',
            'updated_at',
            'comments'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'assigned_by', 'assigned_by_user_details']
        
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
        
        # 3. Create the Attachment objects linking them to the new Task
        for file in uploaded_files:
            TaskAttachment.objects.create(task=task, file=file)
        for url in uploaded_links:
            TaskLink.objects.create(task=task, url=url)
        return task

    def update(self, instance, validated_data):
        # 1. Pop the new files out (so they don't break the standard Task update)
        uploaded_files = validated_data.pop('uploaded_files', [])
        uploaded_links = validated_data.pop('uploaded_links', [])
        validated_data.pop('assigned_by', None)

        # 2. Update the standard Task fields (Status, Heading, etc.)
        instance = super().update(instance, validated_data)

        # 3. ADD NEW ATTACHMENTS (The Missing Logic!)
        for file in uploaded_files:
            TaskAttachment.objects.create(task=instance, file=file)
            
        for url in uploaded_links:
            TaskLink.objects.create(task=instance, url=url)

        return instance

class TaskStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ['id', 'status']
        read_only_fields = ['id']
