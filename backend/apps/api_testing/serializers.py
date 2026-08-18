"""
Serializers for API Testing & Automation Platform.

Provides serialization/deserialization for:
- API Collections
- API Endpoints
- Auth Credentials (with secure handling)
- Execution Runs and Results
- Scheduled Runs

All serializers include comprehensive validation.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import (
    APICollection,
    APIEndpoint,
    AuthCredential,
    ExecutionRun,
    ExecutionResult,
    ScheduledRun,
)

User = get_user_model()


# ============================================================================
# User Serializers (for nested representation)
# ============================================================================

class UserMinimalSerializer(serializers.ModelSerializer):
    """Minimal user representation for nested serialization."""
    
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name']
        read_only_fields = fields
    
    def get_full_name(self, obj):
        """Get user's full name."""
        if hasattr(obj, 'get_full_name'):
            return obj.get_full_name()
        if hasattr(obj, 'first_name') and hasattr(obj, 'last_name'):
            return f"{obj.first_name} {obj.last_name}".strip()
        return str(obj.email)


# ============================================================================
# API Collection Serializers
# ============================================================================

class APICollectionListSerializer(serializers.ModelSerializer):
    """
    Serializer for listing API collections.
    
    Provides summary information including API count and creator.
    """
    
    created_by = UserMinimalSerializer(read_only=True)
    api_count = serializers.SerializerMethodField()
    last_run = serializers.SerializerMethodField()
    project_id = serializers.IntegerField(required=False, allow_null=True)
    
    class Meta:
        model = APICollection
        fields = [
            'id', 'name', 'description', 'project_id',
            'api_count', 'created_by', 'is_active',
            'execution_order', 'tags', 'created_at',
            'updated_at', 'last_run'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
    
    def get_api_count(self, obj):
        """Get the count of active APIs."""
        # Use annotated value if available, otherwise use property
        if hasattr(obj, 'active_api_count'):
            return obj.active_api_count
        return obj.api_count
    
    def get_last_run(self, obj):
        """Get the last execution run info."""
        last_run = obj.execution_runs.order_by('-created_at').first()
        if last_run:
            return {
                'id': str(last_run.id),
                'status': last_run.status,
                'executed_at': last_run.started_at,
                'success_rate': last_run.success_rate
            }
        return None


class APICollectionDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for single API collection.
    
    Includes all endpoints and environment variables.
    """
    
    created_by = UserMinimalSerializer(read_only=True)
    endpoints = serializers.SerializerMethodField()
    credentials = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()
    project_id = serializers.IntegerField(required=False, allow_null=True)

    
    class Meta:
        model = APICollection
        fields = [
            'id', 'name', 'description', 'project_id',
            'created_by', 'is_active', 'execution_order',
            'environment_variables', 'tags',
            'created_at', 'updated_at',
            'endpoints', 'credentials', 'stats'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
    
    def get_endpoints(self, obj):
        """Get ordered endpoints."""
        endpoints = obj.get_ordered_endpoints()
        return APIEndpointListSerializer(endpoints, many=True).data
    
    def get_credentials(self, obj):
        """Get credentials summary (without sensitive data)."""
        credentials = obj.auth_credentials.filter(is_active=True)
        return AuthCredentialListSerializer(credentials, many=True).data
    
    def get_stats(self, obj):
        """Get collection statistics."""
        total_runs = obj.execution_runs.count()
        successful_runs = obj.execution_runs.filter(status='completed').count()
        
        return {
            'total_apis': obj.api_count,
            'total_runs': total_runs,
            'successful_runs': successful_runs,
            'success_rate': round((successful_runs / total_runs * 100), 2) if total_runs > 0 else 0
        }


class APICollectionCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating API collections.
    """
    project_id = serializers.IntegerField(required=False, allow_null=True)
    class Meta:
        model = APICollection
        fields = [
            'id', 'name', 'description', 'project_id',
            'execution_order', 'environment_variables', 'tags',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_name(self, value):
        """Validate collection name is unique for the user."""
        user = self.context['request'].user
        if APICollection.objects.filter(name=value, created_by=user, is_active=True).exists():
            raise serializers.ValidationError(
                "You already have a collection with this name."
            )
        return value
    
    def validate_environment_variables(self, value):
        """Validate environment variables format."""
        if value and not isinstance(value, dict):
            raise serializers.ValidationError(
                "Environment variables must be a JSON object."
            )
        return value
    
    def create(self, validated_data):
        """Create collection with current user as creator."""
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class APICollectionUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating API collections.
    """
    project_id = serializers.IntegerField(required=False, allow_null=True)
    class Meta:
        model = APICollection
        fields = [
            'name', 'description', 'project_id', 'is_active',
            'execution_order', 'environment_variables', 'tags'
        ]
    
    def validate_name(self, value):
        """Validate collection name is unique (excluding current instance)."""
        user = self.context['request'].user
        instance = self.instance
        
        existing = APICollection.objects.filter(
            name=value, 
            created_by=user, 
            is_active=True
        ).exclude(pk=instance.pk if instance else None)
        
        if existing.exists():
            raise serializers.ValidationError(
                "You already have a collection with this name."
            )
        return value


# ============================================================================
# API Endpoint Serializers
# ============================================================================

class APIEndpointListSerializer(serializers.ModelSerializer):
    """
    Serializer for listing API endpoints.
    """
    
    collection_name = serializers.CharField(source='collection.name', read_only=True)
    last_result = serializers.SerializerMethodField()
    
    class Meta:
        model = APIEndpoint
        fields = [
            'id', 'collection', 'collection_name', 'name', 
            'description', 'http_method', 'url',
            'expected_status_code', 'sort_order', 'is_active',
            'timeout_seconds', 'created_at', 'updated_at',
            'last_result'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_last_result(self, obj):
        """Get the last execution result for this endpoint."""
        last_result = obj.execution_results.order_by('-created_at').first()
        if last_result:
            return {
                'status': last_result.status,
                'response_status_code': last_result.response_status_code,
                'execution_time_ms': last_result.execution_time_ms,
                'executed_at': last_result.created_at
            }
        return None


class APIEndpointDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for single API endpoint.
    
    Includes all configuration including headers, body, and params.
    """
    
    collection_name = serializers.CharField(source='collection.name', read_only=True)
    depends_on_name = serializers.CharField(
        source='depends_on.name', 
        read_only=True, 
        allow_null=True
    )
    recent_results = serializers.SerializerMethodField()
    
    class Meta:
        model = APIEndpoint
        fields = [
            'id', 'collection', 'collection_name', 'name',
            'description', 'http_method', 'url',
            'headers', 'query_params', 'request_body', 'body_type',
            'expected_status_code', 'expected_response_contains',
            'timeout_seconds', 'sort_order', 'is_active',
            'retry_count', 'retry_delay_seconds',
            'pre_request_script', 'post_response_script',
            'extract_variables', 'depends_on', 'depends_on_name',
            'created_at', 'updated_at', 'recent_results'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_recent_results(self, obj):
        """Get recent execution results (last 5)."""
        results = obj.execution_results.order_by('-created_at')[:5]
        return ExecutionResultSummarySerializer(results, many=True).data


class APIEndpointCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating API endpoints.
    """
    
    class Meta:
        model = APIEndpoint
        fields = [
            'id', 'collection', 'name', 'description', 'http_method', 'url',
            'headers', 'query_params', 'request_body', 'body_type',
            'expected_status_code', 'expected_response_contains',
            'timeout_seconds', 'sort_order', 'retry_count',
            'retry_delay_seconds', 'pre_request_script',
            'post_response_script', 'extract_variables', 'depends_on',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_url(self, value):
        """Validate URL format."""
        if not value:
            raise serializers.ValidationError("URL is required.")
        
        # Allow URLs with variable placeholders
        if value.startswith('{{'):
            return value
        
        if not (value.startswith('http://') or value.startswith('https://')):
            raise serializers.ValidationError(
                "URL must start with http://, https://, or a variable placeholder {{}}"
            )
        return value
    
    def validate_headers(self, value):
        """Validate headers format."""
        if value and not isinstance(value, dict):
            raise serializers.ValidationError("Headers must be a JSON object.")
        return value or {}
    
    def validate_query_params(self, value):
        """Validate query params format."""
        if value and not isinstance(value, dict):
            raise serializers.ValidationError("Query params must be a JSON object.")
        return value or {}
    
    def validate_timeout_seconds(self, value):
        """Validate timeout is reasonable."""
        if value < 1:
            raise serializers.ValidationError("Timeout must be at least 1 second.")
        if value > 300:
            raise serializers.ValidationError("Timeout cannot exceed 300 seconds.")
        return value
    
    def validate(self, data):
        """Cross-field validation."""
        # Validate depends_on is in same collection
        if data.get('depends_on'):
            if data['depends_on'].collection != data['collection']:
                raise serializers.ValidationError({
                    'depends_on': "Dependency must be in the same collection."
                })
        
        return data


class APIEndpointUpdateSerializer(APIEndpointCreateSerializer):
    """
    Serializer for updating API endpoints.
    
    Same validation as create, but collection is read-only.
    """
    
    class Meta(APIEndpointCreateSerializer.Meta):
        read_only_fields = ['collection']
    
    def validate(self, data):
        """Cross-field validation for update."""
        data = super().validate(data)
        
        # Use instance's collection for validation
        if data.get('depends_on') and self.instance:
            if data['depends_on'].collection != self.instance.collection:
                raise serializers.ValidationError({
                    'depends_on': "Dependency must be in the same collection."
                })
        
        return data


class APIEndpointBulkCreateSerializer(serializers.Serializer):
    """
    Serializer for bulk creating endpoints.
    """
    
    collection = serializers.UUIDField()
    endpoints = APIEndpointCreateSerializer(many=True)
    
    def validate_collection(self, value):
        """Validate collection exists and user has access."""
        try:
            collection = APICollection.objects.get(pk=value, is_active=True)
        except APICollection.DoesNotExist:
            raise serializers.ValidationError("Collection not found.")
        return collection
    
    def create(self, validated_data):
        """Bulk create endpoints."""
        collection = validated_data['collection']
        endpoints_data = validated_data['endpoints']
        
        endpoints = []
        for endpoint_data in endpoints_data:
            endpoint_data['collection'] = collection
            endpoints.append(APIEndpoint(**endpoint_data))
        
        return APIEndpoint.objects.bulk_create(endpoints)


# ============================================================================
# Auth Credential Serializers
# ============================================================================

class AuthCredentialListSerializer(serializers.ModelSerializer):
    """
    Serializer for listing auth credentials.
    
    SECURITY: Never exposes actual credentials.
    """
    
    collection_name = serializers.CharField(
        source='collection.name', 
        read_only=True, 
        allow_null=True
    )
    is_expired = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = AuthCredential
        fields = [
            'id', 'collection', 'collection_name', 'name',
            'auth_type', 'header_name', 'header_prefix',
            'is_active', 'expires_at', 'is_expired',
            'auto_refresh', 'last_used_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = fields


class AuthCredentialCreateSerializer(serializers.Serializer):
    """
    Serializer for creating auth credentials.
    
    Handles different auth types with appropriate validation.
    """
    
    collection = serializers.UUIDField(required=False, allow_null=True)
    name = serializers.CharField(max_length=255)
    auth_type = serializers.ChoiceField(choices=AuthCredential.AuthType.choices)
    
    # Credential fields (depending on auth_type)
    token = serializers.CharField(required=False, write_only=True)
    username = serializers.CharField(required=False, write_only=True)
    password = serializers.CharField(required=False, write_only=True)
    api_key = serializers.CharField(required=False, write_only=True)
    api_key_name = serializers.CharField(required=False, default='X-API-Key')
    client_id = serializers.CharField(required=False, write_only=True)
    client_secret = serializers.CharField(required=False, write_only=True)
    access_token = serializers.CharField(required=False, write_only=True)
    refresh_token = serializers.CharField(required=False, write_only=True)
    
    # Configuration fields
    header_name = serializers.CharField(max_length=100, default='Authorization')
    header_prefix = serializers.CharField(max_length=50, required=False, allow_blank=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    auto_refresh = serializers.BooleanField(default=False)
    refresh_url = serializers.URLField(required=False, allow_blank=True)
    refresh_payload = serializers.JSONField(required=False, default=dict)
    
    def validate_collection(self, value):
        """Validate collection exists."""
        if value:
            try:
                return APICollection.objects.get(pk=value, is_active=True)
            except APICollection.DoesNotExist:
                raise serializers.ValidationError("Collection not found.")
        return None
    
    def validate(self, data):
        """Validate credentials based on auth type."""
        auth_type = data.get('auth_type')
        
        if auth_type == AuthCredential.AuthType.BEARER:
            if not data.get('token'):
                raise serializers.ValidationError({
                    'token': 'Token is required for Bearer authentication.'
                })
            data['header_prefix'] = data.get('header_prefix', 'Bearer')
        
        elif auth_type == AuthCredential.AuthType.BASIC:
            if not data.get('username') or not data.get('password'):
                raise serializers.ValidationError({
                    'username': 'Username is required for Basic authentication.',
                    'password': 'Password is required for Basic authentication.'
                })
        
        elif auth_type in [
            AuthCredential.AuthType.API_KEY,
            AuthCredential.AuthType.API_KEY_HEADER,
            AuthCredential.AuthType.API_KEY_QUERY
        ]:
            if not data.get('api_key'):
                raise serializers.ValidationError({
                    'api_key': 'API key is required.'
                })
            # Set default header name for API key
            if auth_type == AuthCredential.AuthType.API_KEY_HEADER:
                data['header_name'] = data.get('api_key_name', 'X-API-Key')
        
        elif auth_type == AuthCredential.AuthType.OAUTH2:
            if not data.get('access_token'):
                raise serializers.ValidationError({
                    'access_token': 'Access token is required for OAuth2.'
                })
            if data.get('auto_refresh') and not data.get('refresh_url'):
                raise serializers.ValidationError({
                    'refresh_url': 'Refresh URL is required when auto_refresh is enabled.'
                })
        
        elif auth_type == AuthCredential.AuthType.CUSTOM:
            if not data.get('token'):
                raise serializers.ValidationError({
                    'token': 'Token/value is required for custom authentication.'
                })
        
        return data
    
    def create(self, validated_data):
        """Create auth credential with encrypted storage."""
        auth_type = validated_data['auth_type']
        
        # Build credentials dict based on auth type
        credentials = {}
        
        if auth_type == AuthCredential.AuthType.BEARER:
            credentials['token'] = validated_data.get('token')
        
        elif auth_type == AuthCredential.AuthType.BASIC:
            credentials['username'] = validated_data.get('username')
            credentials['password'] = validated_data.get('password')
        
        elif auth_type in [
            AuthCredential.AuthType.API_KEY,
            AuthCredential.AuthType.API_KEY_HEADER,
            AuthCredential.AuthType.API_KEY_QUERY
        ]:
            credentials['api_key'] = validated_data.get('api_key')
            credentials['key_name'] = validated_data.get('api_key_name', 'X-API-Key')
        
        elif auth_type == AuthCredential.AuthType.OAUTH2:
            credentials['client_id'] = validated_data.get('client_id', '')
            credentials['client_secret'] = validated_data.get('client_secret', '')
            credentials['access_token'] = validated_data.get('access_token')
            credentials['refresh_token'] = validated_data.get('refresh_token', '')
        
        elif auth_type == AuthCredential.AuthType.CUSTOM:
            credentials['token'] = validated_data.get('token')
        
        # Create the credential instance
        credential = AuthCredential(
            collection=validated_data.get('collection'),
            name=validated_data['name'],
            auth_type=auth_type,
            header_name=validated_data.get('header_name', 'Authorization'),
            header_prefix=validated_data.get('header_prefix', ''),
            expires_at=validated_data.get('expires_at'),
            auto_refresh=validated_data.get('auto_refresh', False),
            refresh_url=validated_data.get('refresh_url', ''),
            refresh_payload=validated_data.get('refresh_payload', {}),
            created_by=self.context['request'].user
        )
        
        # Encrypt and store credentials
        credential.set_credentials(credentials)
        credential.save()
        
        return credential


class AuthCredentialUpdateSerializer(serializers.Serializer):
    """
    Serializer for updating auth credentials.
    
    Allows updating credentials without requiring all fields.
    """
    
    name = serializers.CharField(max_length=255, required=False)
    token = serializers.CharField(required=False, write_only=True)
    username = serializers.CharField(required=False, write_only=True)
    password = serializers.CharField(required=False, write_only=True)
    api_key = serializers.CharField(required=False, write_only=True)
    header_name = serializers.CharField(max_length=100, required=False)
    header_prefix = serializers.CharField(max_length=50, required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    auto_refresh = serializers.BooleanField(required=False)
    refresh_url = serializers.URLField(required=False, allow_blank=True)
    refresh_payload = serializers.JSONField(required=False)
    
    def update(self, instance, validated_data):
        """Update auth credential."""
        # Update simple fields
        for field in ['name', 'header_name', 'header_prefix', 'is_active',
                      'expires_at', 'auto_refresh', 'refresh_url', 'refresh_payload']:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        
        # Update credentials if provided
        credentials = instance.get_credentials()
        credentials_updated = False
        
        if 'token' in validated_data:
            credentials['token'] = validated_data['token']
            credentials_updated = True
        
        if 'username' in validated_data:
            credentials['username'] = validated_data['username']
            credentials_updated = True
        
        if 'password' in validated_data:
            credentials['password'] = validated_data['password']
            credentials_updated = True
        
        if 'api_key' in validated_data:
            credentials['api_key'] = validated_data['api_key']
            credentials_updated = True
        
        if credentials_updated:
            instance.set_credentials(credentials)
        
        instance.save()
        return instance


# ============================================================================
# Execution Serializers
# ============================================================================

class ExecutionResultSummarySerializer(serializers.ModelSerializer):
    """
    Summary serializer for execution results.
    """
    
    class Meta:
        model = ExecutionResult
        fields = [
            'id', 'status', 'endpoint_name', 'endpoint_method',
            'response_status_code', 'execution_time_ms',
            'assertions_passed', 'created_at'
        ]


class ExecutionResultDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for execution results.
    
    Includes full request/response data.
    """
    
    api_endpoint = APIEndpointListSerializer(read_only=True)
    
    class Meta:
        model = ExecutionResult
        fields = [
            'id', 'execution_run', 'api_endpoint',
            'endpoint_name', 'endpoint_method', 'status',
            'request_url', 'request_headers', 'request_body',
            'response_status_code', 'response_headers',
            'response_body', 'response_size_bytes',
            'execution_time_ms', 'error_message', 'error_type',
            'assertions_passed', 'assertion_details',
            'extracted_variables', 'retry_attempt',
            'created_at'
        ]


class ExecutionRunListSerializer(serializers.ModelSerializer):
    """
    Serializer for listing execution runs.
    """
    
    collection_name = serializers.CharField(
        source='collection.name', 
        read_only=True, 
        allow_null=True
    )
    executed_by = UserMinimalSerializer(read_only=True)
    duration_seconds = serializers.FloatField(read_only=True)
    success_rate = serializers.FloatField(read_only=True)
    
    class Meta:
        model = ExecutionRun
        fields = [
            'id', 'collection', 'collection_name', 'executed_by',
            'status', 'started_at', 'completed_at',
            'total_apis', 'successful_count', 'failed_count',
            'skipped_count', 'trigger_type',
            'duration_seconds', 'success_rate', 'created_at'
        ]


class ExecutionRunDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for execution runs.
    
    Includes all results.
    """
    
    collection = APICollectionListSerializer(read_only=True)
    executed_by = UserMinimalSerializer(read_only=True)
    results = ExecutionResultDetailSerializer(many=True, read_only=True)
    duration_seconds = serializers.FloatField(read_only=True)
    success_rate = serializers.FloatField(read_only=True)
    
    class Meta:
        model = ExecutionRun
        fields = [
            'id', 'collection', 'executed_by',
            'status', 'started_at', 'completed_at',
            'total_apis', 'successful_count', 'failed_count',
            'skipped_count', 'trigger_type', 'environment',
            'notes', 'duration_seconds', 'success_rate',
            'created_at', 'results'
        ]


class RunCollectionSerializer(serializers.Serializer):
    """
    Serializer for triggering a collection run.
    """
    
    collection_id = serializers.UUIDField()
    credential_id = serializers.UUIDField(required=False, allow_null=True)
    environment_overrides = serializers.JSONField(required=False, default=dict)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    
    def validate_collection_id(self, value):
        """Validate collection exists and is active."""
        try:
            collection = APICollection.objects.get(pk=value, is_active=True)
            if collection.api_count == 0:
                raise serializers.ValidationError(
                    "Collection has no active APIs to execute."
                )
            return collection
        except APICollection.DoesNotExist:
            raise serializers.ValidationError("Collection not found.")
    
    def validate_credential_id(self, value):
        """Validate credential exists and is active."""
        if not value:
            return None
        try:
            credential = AuthCredential.objects.get(pk=value, is_active=True)
            if credential.is_expired:
                raise serializers.ValidationError("Credential has expired.")
            return credential
        except AuthCredential.DoesNotExist:
            raise serializers.ValidationError("Credential not found.")


class RunSingleAPISerializer(serializers.Serializer):
    """
    Serializer for running a single API.
    """
    
    endpoint_id = serializers.UUIDField()
    credential_id = serializers.UUIDField(required=False, allow_null=True)
    environment_overrides = serializers.JSONField(required=False, default=dict)
    
    def validate_endpoint_id(self, value):
        """Validate endpoint exists and is active."""
        try:
            return APIEndpoint.objects.select_related('collection').get(
                pk=value, 
                is_active=True
            )
        except APIEndpoint.DoesNotExist:
            raise serializers.ValidationError("API endpoint not found.")
    
    def validate_credential_id(self, value):
        """Validate credential exists and is active."""
        if not value:
            return None
        try:
            credential = AuthCredential.objects.get(pk=value, is_active=True)
            if credential.is_expired:
                raise serializers.ValidationError("Credential has expired.")
            return credential
        except AuthCredential.DoesNotExist:
            raise serializers.ValidationError("Credential not found.")


# ============================================================================
# Scheduled Run Serializers
# ============================================================================

class ScheduledRunSerializer(serializers.ModelSerializer):
    """
    Serializer for scheduled runs.
    """
    
    collection_name = serializers.CharField(source='collection.name', read_only=True)
    created_by = UserMinimalSerializer(read_only=True)
    
    class Meta:
        model = ScheduledRun
        fields = [
            'id', 'collection', 'collection_name', 'name',
            'cron_expression', 'timezone', 'is_active',
            'last_run', 'next_run', 'created_by',
            'notify_on_failure', 'notify_on_success',
            'notification_emails', 'environment_overrides',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'last_run', 'next_run', 'created_by', 'created_at', 'updated_at']
    
    def validate_cron_expression(self, value):
        """Validate cron expression format."""
        # Basic cron validation (5 fields)
        parts = value.split()
        if len(parts) != 5:
            raise serializers.ValidationError(
                "Cron expression must have 5 fields: minute hour day month weekday"
            )
        return value
    
    def validate_notification_emails(self, value):
        """Validate email list."""
        if value and not isinstance(value, list):
            raise serializers.ValidationError("Must be a list of email addresses.")
        return value
    
    def create(self, validated_data):
        """Create scheduled run with current user."""
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


# ============================================================================
# Import/Export Serializers
# ============================================================================

class CollectionExportSerializer(serializers.Serializer):
    """
    Serializer for exporting a collection (Postman-like format).
    """
    
    collection = APICollectionDetailSerializer()
    endpoints = APIEndpointDetailSerializer(many=True)
    version = serializers.CharField(default='1.0.0')
    exported_at = serializers.DateTimeField(default=timezone.now)


class CollectionImportSerializer(serializers.Serializer):
    """
    Serializer for importing a collection.
    """
    
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    environment_variables = serializers.JSONField(required=False, default=dict)
    endpoints = serializers.ListField(child=serializers.DictField())
    
    def validate_endpoints(self, value):
        """Validate endpoints structure."""
        required_fields = ['name', 'http_method', 'url']
        
        for i, endpoint in enumerate(value):
            for field in required_fields:
                if field not in endpoint:
                    raise serializers.ValidationError(
                        f"Endpoint {i+1} is missing required field: {field}"
                    )
        
        return value
    
    def create(self, validated_data):
        """Create collection with endpoints."""
        user = self.context['request'].user
        endpoints_data = validated_data.pop('endpoints')
        
        # Create collection
        collection = APICollection.objects.create(
            created_by=user,
            **validated_data
        )
        
        # Create endpoints
        endpoints = []
        for i, endpoint_data in enumerate(endpoints_data):
            endpoint_data['collection'] = collection
            endpoint_data['sort_order'] = i
            endpoints.append(APIEndpoint(**endpoint_data))
        
        APIEndpoint.objects.bulk_create(endpoints)
        
        return collection