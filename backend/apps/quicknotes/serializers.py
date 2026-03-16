from rest_framework import serializers
from .models import Folder, Note

class FolderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Folder
        fields = ['id', 'name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ['id', 'folder', 'title', 'content', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']