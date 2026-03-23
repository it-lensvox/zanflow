from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from .models import Folder, Note, NoteAttachment

class FolderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Folder
        fields = ['id', 'name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
class NoteAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoteAttachment
        fields = ['id', 'note', 'file', 'filename', 'created_at']
        read_only_fields = ['id', 'filename', 'created_at']
class NoteSerializer(serializers.ModelSerializer):
    # This automatically fetches all attachments linked to this note
    attachments = NoteAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Note
        fields = ['id', 'folder', 'title', 'content', 'attachments', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']