import boto3
from django.conf import settings
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from .models import Folder, Note, NoteAttachment


class FolderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Folder
        fields = ['id', 'name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class NoteAttachmentSerializer(serializers.ModelSerializer):
    """
    Serializer for note attachments with smart URL handling.
    - Accepts file uploads via the 'file' field (write)
    - Returns the file URL via the same 'file' field (read)
    - If a PDF preview is ready, returns the PDF URL instead of the original
    """
    
    class Meta:
        model = NoteAttachment
        fields = ['id', 'note', 'file', 'filename', 'created_at']
        read_only_fields = ['id', 'filename', 'created_at']
    
    def to_representation(self, instance):
        """
        Override the read representation to return PDF URL when available,
        while keeping the 'file' field as a normal FileField for uploads.
        """
        data = super().to_representation(instance)
        
        # Don't override if there's no file
        if not instance.file:
            return data
        
        # Determine which file to serve
        use_pdf = (
            instance.preview_pdf
            and instance.preview_pdf.name
            and instance.preview_status == 'ready'
        )
        
        if use_pdf:
            target_key = instance.preview_pdf.name
            content_type = 'application/pdf'
        else:
            target_key = instance.file.name
            content_type = None
        
        # Generate presigned URL if S3 is configured
        if hasattr(settings, 'USE_S3') and settings.USE_S3:
            try:
                s3_client = boto3.client(
                    's3',
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_S3_REGION_NAME
                )
                
                params = {
                    'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                    'Key': target_key,
                    'ResponseContentDisposition': 'inline',
                }
                if content_type:
                    params['ResponseContentType'] = content_type
                
                url = s3_client.generate_presigned_url(
                    'get_object',
                    Params=params,
                    ExpiresIn=3600
                )
                data['file'] = url  # Override the file URL
            except Exception as e:
                print(f"Error signing S3 URL for note attachment: {e}")
                # Keep the default URL on error
        else:
            # Local development fallback
            if use_pdf:
                data['file'] = instance.preview_pdf.url
        
        return data


class NoteSerializer(serializers.ModelSerializer):
    attachments = NoteAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Note
        fields = ['id', 'user', 'updated_by', 'folder', 'project', 'title', 'content', 'attachments', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'updated_by', 'created_at', 'updated_at']