"""
Serializers for chat REST API.

Provides serialization for:
- Chat rooms (list, detail, create)
- Chat messages (list, detail)
- Room membership
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
import boto3
from django.conf import settings
from .models import ChatRoom, ChatMessage, ChatRoomMembership, MessageReadStatus

User = get_user_model()


class UserMinimalSerializer(serializers.ModelSerializer):
    """
    Minimal user serializer for chat context.
    """
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'email']
        read_only_fields = fields

    def get_full_name(self, obj):
        """Get user's full name or username."""
        return obj.get_full_name() or obj.username


class ChatRoomMembershipSerializer(serializers.ModelSerializer):
    """
    Serializer for room membership details.
    """
    user = UserMinimalSerializer(read_only=True)
    
    class Meta:
        model = ChatRoomMembership
        fields = [
            'id', 'user', 'joined_at', 'last_read_at',
            'is_muted', 'room_role'
        ]
        read_only_fields = ['id', 'user', 'joined_at']


class ChatMessageSerializer(serializers.ModelSerializer):
    """
    Serializer for chat messages.
    """
    sender = UserMinimalSerializer(read_only=True)
    reply_to_preview = serializers.SerializerMethodField()
    is_own_message = serializers.SerializerMethodField()
    attachment = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatMessage
        fields = [
            'id', 'room', 'sender', 'message_type', 'content',
            'attachment', 'attachment_name', 'metadata','reply_to', 'reply_to_preview',
            'created_at', 'updated_at', 'is_deleted', 'is_own_message'
        ]
        read_only_fields = [
            'id', 'room', 'sender', 'created_at', 'updated_at', 'is_deleted'
        ]

    def get_reply_to_preview(self, obj):
        """Get preview of replied message."""
        if not obj.reply_to:
            return None
        
        reply = obj.reply_to
        return {
            'id': str(reply.id),
            'sender_username': reply.sender.username if reply.sender else 'System',
            'content_preview': (reply.content[:50] + '...') if len(reply.content) > 50 else reply.content,
        }

    def get_is_own_message(self, obj):
        """Check if message belongs to current user."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.sender_id == request.user.id
        return False
    def get_attachment(self, obj):
        """
        Generate a Presigned URL for S3 files.
        This allows secure access to private S3 objects.
        """
        if not obj.attachment:
            return None

        # Check if we are using S3
        if hasattr(settings, 'USE_S3') and settings.USE_S3:
            try:
                s3_client = boto3.client(
                    's3',
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_S3_REGION_NAME
                )
                
                # Generate the signed URL
                url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={
                        'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                        'Key': obj.attachment.name,
                        'ResponseContentDisposition': 'inline', # Helps images display in browser
                        'ResponseContentType': 'application/octet-stream' # Default fallback
                    },
                    ExpiresIn=3600  # Link expires in 1 hour
                )
                return url
            except Exception as e:
                # Log the error and fall back to the default URL if signing fails
                print(f"Error signing S3 URL: {e}")
                return obj.attachment.url

        # Fallback for local development (SQLite/Local files)
        if hasattr(obj.attachment, 'url'):
            return obj.attachment.url
            
        return None

class ChatMessageCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating new messages via REST API.
    """
    
    class Meta:
        model = ChatMessage
        fields = ['content', 'message_type', 'attachment', 'attachment_name', 'reply_to']
    
    def validate_content(self, value):
        """Validate message content."""
        if not value or not value.strip():
            raise serializers.ValidationError("Message content cannot be empty")
        return value.strip()


class ChatRoomListSerializer(serializers.ModelSerializer):
    """
    Serializer for listing chat rooms.
    Includes unread count and last message preview.
    """
    participant_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatRoom
        fields = [
            'id', 'name', 'room_type', 'slug', 'project',
            'participant_count', 'last_message', 'unread_count',
            'is_member', 'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = fields

    def get_participant_count(self, obj):
        """Get number of participants."""
        if obj.room_type == ChatRoom.RoomType.GLOBAL:
            return User.objects.filter(is_active=True).count()
        return obj.participants.count()

    def get_last_message(self, obj):
        """Get last message in room."""
        last_msg = obj.messages.filter(is_deleted=False).order_by('-created_at').first()
        if last_msg:
            return {
                'id': str(last_msg.id),
                'sender_username': last_msg.sender.username if last_msg.sender else 'System',
                'content_preview': last_msg.content[:100] if last_msg.content else '[attachment]',
                'created_at': last_msg.created_at.isoformat(),
            }
        return None

    def get_unread_count(self, obj):
        """Get unread message count for current user."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        
        if obj.room_type == ChatRoom.RoomType.GLOBAL:
            return 0  # Global chat doesn't track unread
        
        membership = ChatRoomMembership.objects.filter(
            room=obj, user=request.user
        ).first()
        
        if not membership:
            return 0
        
        return obj.messages.filter(
            is_deleted=False,
            created_at__gt=membership.last_read_at
        ).exclude(sender=request.user).count()

    def get_is_member(self, obj):
        """Check if current user is a member."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        
        if obj.room_type == ChatRoom.RoomType.GLOBAL:
            return True
        
        return obj.participants.filter(id=request.user.id).exists()


class ChatRoomDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for individual chat room.
    Includes participant list.
    """
    participants = UserMinimalSerializer(many=True, read_only=True)
    created_by = UserMinimalSerializer(read_only=True)
    memberships = ChatRoomMembershipSerializer(many=True, read_only=True)
    current_user_membership = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatRoom
        fields = [
            'id', 'name', 'room_type', 'slug', 'project',
            'participants', 'created_by', 'memberships',
            'current_user_membership', 'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = fields

    def get_current_user_membership(self, obj):
        """Get current user's membership details."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        
        membership = ChatRoomMembership.objects.filter(
            room=obj, user=request.user
        ).first()
        
        if membership:
            return ChatRoomMembershipSerializer(membership).data
        return None


class CreatePrivateRoomSerializer(serializers.Serializer):
    """
    Serializer for creating private chat rooms.
    """
    user_id = serializers.IntegerField(
        help_text="ID of the user to start private chat with"
    )
    
    def validate_user_id(self, value):
        """Validate target user exists and is not self."""
        request = self.context.get('request')
        
        if request and request.user.id == value:
            raise serializers.ValidationError("Cannot create private chat with yourself")
        
        try:
            User.objects.get(id=value, is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found or inactive")
        
        return value


class CreateProjectRoomSerializer(serializers.Serializer):
    """
    Serializer for creating project chat rooms.
    """
    project_id = serializers.UUIDField(
        help_text="ID of the project to create chat for"
    )
    
    def validate_project_id(self, value):
        """Validate project exists."""
        try:
            from apps.projects.models import Project
            Project.objects.get(id=value)
        except Exception:
            raise serializers.ValidationError("Project not found")
        
        return value


class AddParticipantSerializer(serializers.Serializer):
    """
    Serializer for adding participants to a room.
    """
    user_id = serializers.IntegerField()
    room_role = serializers.ChoiceField(
        choices=ChatRoomMembership.RoomRole.choices,
        default='member'
    )
    
    def validate_user_id(self, value):
        """Validate user exists."""
        try:
            User.objects.get(id=value, is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found or inactive")
        return value


class RoomSettingsSerializer(serializers.Serializer):
    """
    Serializer for updating room membership settings.
    """
    is_muted = serializers.BooleanField(required=False)


class MessageSearchSerializer(serializers.Serializer):
    """
    Serializer for message search parameters.
    """
    query = serializers.CharField(min_length=2, max_length=100)
    room_id = serializers.UUIDField(required=False)
    limit = serializers.IntegerField(required=False, default=20, min_value=1, max_value=100)
