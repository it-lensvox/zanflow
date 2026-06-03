"""
Serializers for Ground Truth app.
"""
import os
from django.utils import timezone
from rest_framework import serializers
from django.utils import timezone
from apps.users.serializers import UserMinimalSerializer
from .models import Document, DocumentComment, GTVersion, Folder, Label
from apps.projects.models import Label
from django.contrib.auth import get_user_model
User = get_user_model()
def get_clean_unique_name(project_id, original_filename):
    """
    Checks if a file name exists in a project. 
    If yes, appends (1), (2), etc. until it finds a unique name.
    """
    # Split "api_10.ts" into "api_10" and ".ts"
    base_name, ext = os.path.splitext(original_filename)
    
    # 1. If the original name doesn't exist yet, just use it!
    if not Document.objects.filter(project_id=project_id, name=original_filename).exists():
        return original_filename
        
    # 2. If it DOES exist, start counting...
    count = 1
    while True:
        # Create the new name: "api_10 (1).ts"
        new_name = f"{base_name} ({count}){ext}"
        
        # Check if "api_10 (1).ts" exists
        if not Document.objects.filter(project_id=project_id, name=new_name).exists():
            return new_name # Found an empty slot!
            
        count += 1 # Try the next number
class GTVersionSerializer(serializers.ModelSerializer):
    """
    Serializer for GTVersion model.
    """
    created_by = UserMinimalSerializer(read_only=True)
    approved_by = UserMinimalSerializer(read_only=True)
    
    class Meta:
        model = GTVersion
        fields = [
            "id", "version_number", "gt_data", "change_summary",
            "changes_from_previous", "is_approved", "approved_at",
            "approved_by", "source_type", "source_reference",
            "created_by", "created_at",
        ]
        read_only_fields = [
            "id", "version_number", "is_approved", "approved_at",
            "approved_by", "created_by", "created_at",
        ]


class GTVersionCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating new GT versions.
    """
    class Meta:
        model = GTVersion
        fields = ["gt_data", "change_summary", "source_type", "source_reference"]
    
    def create(self, validated_data):
        document = self.context["document"]
        user = self.context["request"].user
        
        # Calculate changes from previous version
        previous_version = document.latest_version
        changes = {}
        if previous_version:
            old_keys = set(previous_version.gt_data.keys())
            new_keys = set(validated_data["gt_data"].keys())
            
            changes = {
                "added": list(new_keys - old_keys),
                "removed": list(old_keys - new_keys),
                "modified": [
                    k for k in old_keys & new_keys
                    if previous_version.gt_data.get(k) != validated_data["gt_data"].get(k)
                ],
            }
        
        version = GTVersion.objects.create(
            document=document,
            changes_from_previous=changes,
            created_by=user,
            **validated_data,
        )
        
        return version


class GTVersionListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for version list.
    """
    created_by = UserMinimalSerializer(read_only=True)
    fields_count = serializers.SerializerMethodField()
    
    class Meta:
        model = GTVersion
        fields = [
            "id", "version_number", "change_summary", "is_approved",
            "approved_at", "created_by", "created_at", "fields_count",
        ]
    
    def get_fields_count(self, obj):
        if isinstance(obj.gt_data, dict):
            return len(obj.gt_data)
        return 0


class DocumentCommentSerializer(serializers.ModelSerializer):
    """
    Serializer for DocumentComment.
    """
    user = serializers.SerializerMethodField()
    parent_id = serializers.PrimaryKeyRelatedField(
        source='parent', 
        queryset=DocumentComment.objects.all(), 
        required=False, 
        allow_null=True
    )
    replies_count = serializers.SerializerMethodField()
    
    mentions = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.all(),
        required=False
    )

    class Meta:
        model = DocumentComment
        fields = [
            "id", "content", "user", "created_at", "updated_at", 
            "parent_id", "replies_count", "is_resolved", "mentions"
        ]
        read_only_fields = ["id", "created_at", "updated_at", "is_resolved"]
    
    def get_user(self, obj):
        user = obj.created_by
        if not user:
            return None
        return {
            "id": user.id,
            "full_name": f"{user.first_name} {user.last_name}".strip() or user.username,
            "email": user.email,
            "avatar_color": getattr(user, 'avatar_color', "#4169FF") # Default fallback color
        }
        
    def get_replies_count(self, obj):
        return obj.replies.count()


# ============ NEW SERIALIZER ============
class LabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ["id", "project","name", "color"]

# ============ UPDATE DOCUMENT SERIALIZER ============
class DocumentSerializer(serializers.ModelSerializer):
    created_by = UserMinimalSerializer(read_only=True)
    labels = LabelSerializer(many=True, read_only=True) 

    shared_with = serializers.SerializerMethodField()
    shared_by = serializers.SerializerMethodField()
    
    # ============ NEW FIELD ============
    project_name = serializers.CharField(source='project.name', read_only=True)
    # ===================================

    class Meta:
        model = Document
        fields = [
            "id", "project", "project_name", "folder", "name", "description",  # <-- ADD project_name
            "source_file", "source_file_url", "file_type", "file_size",
            "metadata", "status", "created_by", "created_at", "updated_at",
            "labels",
            "shared_with", "shared_by"
        ]
        read_only_fields = [
            "id", "file_size", "created_by", "created_at", "updated_at", "labels",
            "shared_with", "shared_by", "project_name" # <-- ADD project_name
        ]

    # ============ BULLETPROOF AVATAR HELPER ============
    def _get_safe_avatar_string(self, user):
        """Forces the avatar to be a plain text URL string."""
        avatar_url = None
        
        # 1. Try to get the URL from the Django ImageField
        if hasattr(user, 'avatar') and getattr(user.avatar, 'name', None):
            try:
                request = self.context.get('request')
                if request:
                    avatar_url = request.build_absolute_uri(user.avatar.url)
                else:
                    avatar_url = user.avatar.url
            except Exception:
                pass
                
        # 2. Fallback to a string URL field if the ImageField failed
        if not avatar_url:
            avatar_url = getattr(user, 'avatar_url', None)
            
        # 3. Force string casting to guarantee no binary objects pass through
        return str(avatar_url) if avatar_url else None
    # ===================================================

    def get_shared_with(self, obj):
        users = []
        for share in obj.shares.all():
            if share.shared_with:
                user = share.shared_with
                users.append({
                    "id": user.id,
                    "full_name": f"{user.first_name} {user.last_name}".strip() or user.username,
                    "username": user.username,
                    "avatar": self._get_safe_avatar_string(user)
                })
        return users

    def get_shared_by(self, obj):
        shares = obj.shares.all()
        if shares:
            user = shares[0].created_by
            if user:
                return {
                    "id": user.id,
                    "full_name": f"{user.first_name} {user.last_name}".strip() or user.username,
                    "username": user.username,
                    "avatar": self._get_safe_avatar_string(user)
                }
        return None
    
class DocumentDetailSerializer(DocumentSerializer):
    """
    Detailed serializer with versions and comments.
    """
    versions = GTVersionListSerializer(many=True, read_only=True)
    comments = serializers.SerializerMethodField()
    
    class Meta(DocumentSerializer.Meta):
        fields = DocumentSerializer.Meta.fields + ["versions", "comments"]
    
    def get_comments(self, obj):
        # Get only top-level comments
        top_comments = obj.comments.filter(parent__isnull=True)
        return DocumentCommentSerializer(top_comments, many=True).data


class DocumentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = [
            "project", "folder", "name", "description", "source_file",  # <-- ADD "folder" HERE
            "source_file_url", "file_type", "metadata",
        ]
    
    def create(self, validated_data):
        user = self.context["request"].user
        source_file = validated_data.get("source_file")
        project = validated_data.get("project")
        task = validated_data.get("task")

        # ============ NEW: SMART FOLDER ROUTING ============
        # If this document belongs to a task, put it in the system Tasks folder
        if task and project and not validated_data.get("folder"):
            tasks_folder = Folder.objects.filter(
                project=project,
                name="Tasks",
                is_system_generated=True
            ).first()
            
            if tasks_folder:
                validated_data["folder"] = tasks_folder
        # ===================================================

        # Existing clean name logic
        original_name = validated_data.get("name")
        if not original_name and source_file:
            original_name = source_file.name
            
        if original_name and project:
            clean_name = get_clean_unique_name(project.id, original_name)
            validated_data["name"] = clean_name

        if source_file:
            validated_data["file_size"] = source_file.size
        
        # Create the document first
        document = Document.objects.create(created_by=user, **validated_data)
        
        # ============ NEW: Trigger PDF conversion in background ============
        if source_file:
            from .services import generate_document_preview, needs_pdf_conversion
         
            if needs_pdf_conversion(source_file.name):
                # Run conversion synchronously
                # Note: This adds 5-30 seconds to upload time
                # For better UX, switch to Celery later (see comments below)
                try:
                    generate_document_preview(document)
                except Exception as e:
                    # Don't fail the upload if conversion fails
                    # User still has access to original file
                    import logging
                    logging.error(f"Preview generation failed: {e}")
            else:
                # File type doesn't need conversion (PDF, image, video, etc.)
                document.preview_status = Document.PreviewStatus.NOT_NEEDED
                document.save(update_fields=['preview_status'])
        # ===================================================================
        document = Document.objects.create(created_by=user, **validated_data)
        return document


class DocumentBulkImportSerializer(serializers.Serializer):
    """
    Serializer for bulk document import.
    """
    documents = serializers.ListField(
        child=serializers.JSONField(),
        min_length=1,
    )
    # Expected format:
    # [{"name": "doc1", "gt_data": {...}, "metadata": {...}}, ...]


class VersionDiffSerializer(serializers.Serializer):
    """
    Serializer for version diff response.
    """
    version1 = GTVersionSerializer()
    version2 = GTVersionSerializer()
    diff = serializers.JSONField()
    # diff format:
    # {
    #     "added": {"field1": "new_value"},
    #     "removed": {"field2": "old_value"},
    #     "modified": {"field3": {"old": "x", "new": "y"}}
    # }
class DocumentShareSerializer(serializers.Serializer):
    """
    Validates the incoming request to share a document.
    """
    user_id = serializers.IntegerField(required=False, allow_null=True)
    project_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, data):
        start_time = data.get('start_time', getattr(self.instance, 'start_time', None))
        end_time = data.get('end_time', getattr(self.instance, 'end_time', None))

        # --- NEW LOGIC: Prevent events from being created in the past ---
        if start_time and start_time < timezone.now():
            raise serializers.ValidationError({
                "start_time": "Event time cannot be in the past."
            })

        # --- EXISTING LOGIC: Ensure end time is after start time ---
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError({
                "end_time": "End time must be after the start time."
            })
            
        return data
    
class FolderSerializer(serializers.ModelSerializer):
    document_count = serializers.SerializerMethodField()
    folder_count = serializers.SerializerMethodField() # <-- NEW

    class Meta:
        model = Folder
        fields = [
            'id', 'project', 'parent', 'name', 'is_system_generated', 
            'created_at', 'document_count', 'folder_count'
        ]
        read_only_fields = ['id', 'is_system_generated', 'created_at']

    def get_document_count(self, obj):
        # Grabs the direct document count from the DB annotation
        if hasattr(obj, 'annotated_doc_count'):
            return obj.annotated_doc_count
        return obj.documents.count()

    def get_folder_count(self, obj):
        # Grabs the direct subfolder count from the DB annotation
        if hasattr(obj, 'annotated_folder_count'):
            return obj.annotated_folder_count
        return obj.subfolders.count()