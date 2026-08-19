"""
Models for API Testing & Automation Platform.

This module defines the database models for:
- API Collections: Groups of related API endpoints
- API Endpoints: Individual API configurations with headers, body, params
- Auth Credentials: Secure storage for authentication tokens/credentials
- Execution Results: History of API test runs with full response capture
"""
import uuid
from django.conf import settings
from django.db import models
from django.core.validators import URLValidator, MinValueValidator
from django.utils import timezone
from cryptography.fernet import Fernet
from django.core.exceptions import ValidationError
import json


class TimeStampedModel(models.Model):
    """
    Abstract base model providing created_at and updated_at timestamps.
    All models in this app inherit from this for consistent auditing.
    """
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class APICollection(TimeStampedModel):
    """
    A collection of related API endpoints.
    
    Collections group APIs logically (e.g., "User Management APIs", 
    "Payment Gateway APIs") and support batch execution.
    
    Attributes:
        id: UUID primary key for security
        name: Human-readable collection name
        description: Optional detailed description
        project: Optional link to existing project (for multi-project support)
        created_by: User who created the collection
        is_active: Soft delete flag
        execution_order: Default execution order for collection runs
        environment_variables: JSON storage for collection-level variables
    """
    
    class ExecutionOrder(models.TextChoices):
        SEQUENTIAL = 'sequential', 'Sequential (One after another)'
        PARALLEL = 'parallel', 'Parallel (Concurrent execution)'
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for the collection"
    )
    name = models.CharField(
        max_length=255,
        help_text="Name of the API collection"
    )
    description = models.TextField(
        blank=True,
        default='',
        help_text="Detailed description of the collection's purpose"
    )
    project_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Optional reference to a project (UUID for decoupling)"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='api_collections',
        help_text="User who created this collection"
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether the collection is active"
    )
    execution_order = models.CharField(
        max_length=20,
        choices=ExecutionOrder.choices,
        default=ExecutionOrder.SEQUENTIAL,
        help_text="Default execution order for batch runs"
    )
    environment_variables = models.JSONField(
        default=dict,
        blank=True,
        help_text="Collection-level environment variables (key-value pairs)"
    )
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text="Tags for categorization and filtering"
    )
    
    class Meta:
        db_table = 'api_testing_collections'
        verbose_name = 'API Collection'
        verbose_name_plural = 'API Collections'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['name', 'is_active']),
            models.Index(fields=['created_by', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.api_endpoints.count()} APIs)"
    
    @property
    def api_count(self):
        """Return the count of active APIs in this collection."""
        return self.api_endpoints.filter(is_active=True).count()
    
    def get_ordered_endpoints(self):
        """Return endpoints ordered by their sort_order."""
        return self.api_endpoints.filter(is_active=True).order_by('sort_order', 'created_at')


class APIEndpoint(TimeStampedModel):
    """
    Individual API endpoint configuration.
    
    Stores all information needed to execute an API request including
    method, URL, headers, body, query parameters, and expected responses.
    
    Attributes:
        id: UUID primary key
        collection: Parent collection
        name: Human-readable API name
        description: API purpose/documentation
        http_method: GET, POST, PUT, DELETE, PATCH, etc.
        url: Full URL or URL template with variables
        headers: JSON dict of request headers
        query_params: JSON dict of query parameters
        request_body: JSON request payload
        expected_status_code: Expected HTTP status (for validation)
        expected_response_schema: JSON Schema for response validation
        timeout_seconds: Request timeout
        sort_order: Execution order within collection
        is_active: Soft delete flag
        retry_count: Number of retries on failure
        retry_delay_seconds: Delay between retries
    """
    
    class HTTPMethod(models.TextChoices):
        GET = 'GET', 'GET'
        POST = 'POST', 'POST'
        PUT = 'PUT', 'PUT'
        PATCH = 'PATCH', 'PATCH'
        DELETE = 'DELETE', 'DELETE'
        HEAD = 'HEAD', 'HEAD'
        OPTIONS = 'OPTIONS', 'OPTIONS'
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    collection = models.ForeignKey(
        APICollection,
        on_delete=models.CASCADE,
        related_name='api_endpoints',
        help_text="Parent collection"
    )
    name = models.CharField(
        max_length=255,
        help_text="Name of the API endpoint"
    )
    description = models.TextField(
        blank=True,
        default='',
        help_text="Description of what this API does"
    )
    http_method = models.CharField(
        max_length=10,
        choices=HTTPMethod.choices,
        default=HTTPMethod.GET,
        help_text="HTTP method for the request"
    )
    url = models.TextField(
        help_text="API URL (supports {{variable}} placeholders)"
    )
    headers = models.JSONField(
        default=dict,
        blank=True,
        help_text="Request headers as JSON object"
    )
    query_params = models.JSONField(
        default=dict,
        blank=True,
        help_text="Query parameters as JSON object"
    )
    request_body = models.JSONField(
        default=dict,
        blank=True,
        help_text="Request body/payload as JSON"
    )
    body_type = models.CharField(
        max_length=50,
        choices=[
            ('json', 'JSON'),
            ('form-data', 'Form Data'),
            ('x-www-form-urlencoded', 'URL Encoded'),
            ('raw', 'Raw Text'),
            ('none', 'No Body'),
        ],
        default='json',
        help_text="Type of request body"
    )
    expected_status_code = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Expected HTTP status code (e.g., 200, 201)"
    )
    expected_response_contains = models.JSONField(
        default=list,
        blank=True,
        help_text="List of keys/values expected in response"
    )
    timeout_seconds = models.PositiveIntegerField(
        default=30,
        validators=[MinValueValidator(1)],
        help_text="Request timeout in seconds"
    )
    sort_order = models.PositiveIntegerField(
        default=0,
        db_index=True,
        help_text="Execution order within collection (lower = first)"
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this endpoint is active"
    )
    retry_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of retry attempts on failure (0 = no retry)"
    )
    retry_delay_seconds = models.PositiveIntegerField(
        default=1,
        help_text="Delay between retries in seconds"
    )
    pre_request_script = models.TextField(
        blank=True,
        default='',
        help_text="Python code to run before request (advanced)"
    )
    post_response_script = models.TextField(
        blank=True,
        default='',
        help_text="Python code to run after response (advanced)"
    )
    extract_variables = models.JSONField(
        default=dict,
        blank=True,
        help_text="Variables to extract from response (key: json_path)"
    )
    depends_on = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dependents',
        help_text="API that must run successfully before this one"
    )
    
    class Meta:
        db_table = 'api_testing_endpoints'
        verbose_name = 'API Endpoint'
        verbose_name_plural = 'API Endpoints'
        ordering = ['sort_order', 'created_at']
        indexes = [
            models.Index(fields=['collection', 'is_active', 'sort_order']),
            models.Index(fields=['http_method', 'is_active']),
        ]
    
    def __str__(self):
        return f"[{self.http_method}] {self.name}"
    
    def clean(self):
        """Validate the endpoint configuration."""
        super().clean()
        
        # Validate URL format (basic check)
        if self.url and not (
            self.url.startswith('http://') or 
            self.url.startswith('https://') or
            self.url.startswith('{{')  # Variable placeholder
        ):
            raise ValidationError({
                'url': 'URL must start with http://, https://, or a variable placeholder {{}}'
            })
        
        # Validate headers is a dict
        if self.headers and not isinstance(self.headers, dict):
            raise ValidationError({
                'headers': 'Headers must be a JSON object (dictionary)'
            })
        
        # Validate query_params is a dict
        if self.query_params and not isinstance(self.query_params, dict):
            raise ValidationError({
                'query_params': 'Query params must be a JSON object (dictionary)'
            })


class AuthCredential(TimeStampedModel):
    """
    Secure storage for authentication credentials.
    
    Supports multiple authentication types with encrypted storage
    for sensitive data like passwords and tokens.
    
    SECURITY: Credentials are encrypted at rest using Fernet symmetric encryption.
    Decryption only happens during API execution.
    
    Attributes:
        id: UUID primary key
        collection: Associated collection (optional, for collection-level auth)
        name: Human-readable credential name
        auth_type: Bearer, Basic, API Key, OAuth2, Custom
        encrypted_credentials: Fernet-encrypted JSON blob
        is_active: Whether credential is active
        expires_at: Optional expiration timestamp
        auto_refresh: Whether to auto-refresh tokens
        refresh_url: URL for token refresh
        refresh_payload: Payload for refresh request
    """
    
    class AuthType(models.TextChoices):
        BEARER = 'bearer', 'Bearer Token'
        BASIC = 'basic', 'Basic Auth (Username/Password)'
        API_KEY = 'api_key', 'API Key'
        API_KEY_HEADER = 'api_key_header', 'API Key (Header)'
        API_KEY_QUERY = 'api_key_query', 'API Key (Query Param)'
        OAUTH2 = 'oauth2', 'OAuth 2.0'
        CUSTOM = 'custom', 'Custom Header'
        NONE = 'none', 'No Authentication'
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    collection = models.ForeignKey(
        APICollection,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='auth_credentials',
        help_text="Collection this credential belongs to (optional)"
    )
    name = models.CharField(
        max_length=255,
        help_text="Name for this credential set"
    )
    auth_type = models.CharField(
        max_length=20,
        choices=AuthType.choices,
        default=AuthType.BEARER,
        help_text="Type of authentication"
    )
    # Encrypted storage for sensitive data
    encrypted_credentials = models.BinaryField(
        help_text="Encrypted credentials (never logged or exposed)"
    )
    # Non-sensitive metadata
    header_name = models.CharField(
        max_length=100,
        default='Authorization',
        help_text="Header name for the auth token"
    )
    header_prefix = models.CharField(
        max_length=50,
        default='Bearer',
        blank=True,
        help_text="Prefix before token (e.g., 'Bearer', 'Token')"
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True
    )
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the credential expires"
    )
    auto_refresh = models.BooleanField(
        default=False,
        help_text="Automatically refresh token before expiration"
    )
    refresh_url = models.URLField(
        blank=True,
        default='',
        help_text="URL for token refresh"
    )
    refresh_payload = models.JSONField(
        default=dict,
        blank=True,
        help_text="Payload for refresh request"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='api_credentials'
    )
    last_used_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last time this credential was used"
    )
    
    # Class-level encryption key (loaded from settings)
    _fernet = None
    
    class Meta:
        db_table = 'api_testing_auth_credentials'
        verbose_name = 'Auth Credential'
        verbose_name_plural = 'Auth Credentials'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['collection', 'is_active']),
            models.Index(fields=['auth_type', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.get_auth_type_display()})"
    
    @classmethod
    def get_fernet(cls):
        """
        Get or create Fernet instance for encryption/decryption.
        Uses CREDENTIAL_ENCRYPTION_KEY from settings.
        """
        if cls._fernet is None:
            key = getattr(settings, 'CREDENTIAL_ENCRYPTION_KEY', None)
            if not key:
                # Generate a key for development (should be set in production)
                key = Fernet.generate_key()
            elif isinstance(key, str):
                key = key.encode()
            cls._fernet = Fernet(key)
        return cls._fernet
    
    def set_credentials(self, credentials_dict):
        """
        Encrypt and store credentials.
        
        Args:
            credentials_dict: Dictionary containing credentials
                For Bearer: {'token': '...'}
                For Basic: {'username': '...', 'password': '...'}
                For API Key: {'api_key': '...', 'key_name': '...'}
                For OAuth2: {'client_id': '...', 'client_secret': '...', 
                            'access_token': '...', 'refresh_token': '...'}
        """
        fernet = self.get_fernet()
        json_data = json.dumps(credentials_dict)
        self.encrypted_credentials = fernet.encrypt(json_data.encode())
    
    def get_credentials(self):
        """
        Decrypt and return credentials.
        
        Returns:
            dict: Decrypted credentials dictionary
        
        SECURITY: This method should only be called during API execution.
        Never log or expose the returned data.
        """
        if not self.encrypted_credentials:
            return {}
        fernet = self.get_fernet()
        decrypted_data = fernet.decrypt(bytes(self.encrypted_credentials))
        return json.loads(decrypted_data.decode())
    
    @property
    def is_expired(self):
        """Check if credential has expired."""
        if not self.expires_at:
            return False
        return timezone.now() > self.expires_at
    
    def mark_used(self):
        """Update last_used_at timestamp."""
        self.last_used_at = timezone.now()
        self.save(update_fields=['last_used_at'])


class ExecutionRun(TimeStampedModel):
    """
    A single execution run of a collection or individual API.
    
    Tracks the overall execution including timing, status, and metadata.
    Individual API results are stored in ExecutionResult.
    
    Attributes:
        id: UUID primary key
        collection: Collection being executed (optional for single API runs)
        executed_by: User who triggered the execution
        status: Overall execution status
        started_at: When execution started
        completed_at: When execution completed
        total_apis: Number of APIs in the run
        successful_count: Number of successful API calls
        failed_count: Number of failed API calls
        trigger_type: Manual, Scheduled, Webhook, etc.
        environment: Environment variables used for this run
    """
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        PARTIALLY_FAILED = 'partial_failure', 'Partially Failed'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'
    
    class TriggerType(models.TextChoices):
        MANUAL = 'manual', 'Manual Execution'
        SCHEDULED = 'scheduled', 'Scheduled Run'
        WEBHOOK = 'webhook', 'Webhook Trigger'
        CI_CD = 'ci_cd', 'CI/CD Pipeline'
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    collection = models.ForeignKey(
        APICollection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='execution_runs',
        help_text="Collection being executed"
    )
    executed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='api_execution_runs',
        help_text="User who triggered the execution"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )
    started_at = models.DateTimeField(
        null=True,
        blank=True
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True
    )
    total_apis = models.PositiveIntegerField(
        default=0,
        help_text="Total number of APIs to execute"
    )
    successful_count = models.PositiveIntegerField(
        default=0
    )
    failed_count = models.PositiveIntegerField(
        default=0
    )
    skipped_count = models.PositiveIntegerField(
        default=0
    )
    trigger_type = models.CharField(
        max_length=20,
        choices=TriggerType.choices,
        default=TriggerType.MANUAL
    )
    environment = models.JSONField(
        default=dict,
        blank=True,
        help_text="Environment variables used for this run"
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Optional notes about this run"
    )
    
    class Meta:
        db_table = 'api_testing_execution_runs'
        verbose_name = 'Execution Run'
        verbose_name_plural = 'Execution Runs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['collection', 'status', '-created_at']),
            models.Index(fields=['executed_by', '-created_at']),
            models.Index(fields=['status', '-started_at']),
        ]
    
    def __str__(self):
        collection_name = self.collection.name if self.collection else "Single API"
        return f"Run {str(self.id)[:8]} - {collection_name} ({self.status})"
    
    @property
    def duration_seconds(self):
        """Calculate execution duration in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None
    
    @property
    def success_rate(self):
        """Calculate success rate as percentage."""
        if self.total_apis == 0:
            return 0
        return round((self.successful_count / self.total_apis) * 100, 2)
    
    def mark_started(self):
        """Mark the run as started."""
        self.status = self.Status.RUNNING
        self.started_at = timezone.now()
        self.save(update_fields=['status', 'started_at', 'updated_at'])
    
    def mark_completed(self):
        """Mark the run as completed and calculate final status."""
        self.completed_at = timezone.now()
        
        if self.failed_count == 0:
            self.status = self.Status.COMPLETED
        elif self.successful_count == 0:
            self.status = self.Status.FAILED
        else:
            self.status = self.Status.PARTIALLY_FAILED
        
        self.save(update_fields=['status', 'completed_at', 'updated_at'])


class ExecutionResult(TimeStampedModel):
    """
    Individual API execution result.
    
    Stores complete details of a single API call including request/response
    data, timing, and any errors encountered.
    
    SECURITY: Response bodies are truncated to prevent storage of large
    payloads. Sensitive headers are masked.
    
    Attributes:
        id: UUID primary key
        execution_run: Parent execution run
        api_endpoint: API that was executed
        status: Success/Failure status
        request_url: Actual URL called (with variables resolved)
        request_headers: Headers sent (sensitive values masked)
        request_body: Request body sent
        response_status_code: HTTP response status
        response_headers: Response headers received
        response_body: Response body (truncated)
        execution_time_ms: Request execution time in milliseconds
        error_message: Error details if failed
        assertions_passed: Whether expected values matched
        extracted_variables: Variables extracted from response
    """
    
    class Status(models.TextChoices):
        SUCCESS = 'success', 'Success'
        FAILED = 'failed', 'Failed'
        ERROR = 'error', 'Error'
        TIMEOUT = 'timeout', 'Timeout'
        SKIPPED = 'skipped', 'Skipped'
    
    # Maximum response body size to store (10KB)
    MAX_RESPONSE_SIZE = 10 * 1024
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    execution_run = models.ForeignKey(
        ExecutionRun,
        on_delete=models.CASCADE,
        related_name='results',
        help_text="Parent execution run"
    )
    api_endpoint = models.ForeignKey(
        APIEndpoint,
        on_delete=models.SET_NULL,
        null=True,
        related_name='execution_results',
        help_text="API endpoint that was executed"
    )
    endpoint_name = models.CharField(
        max_length=255,
        default='',
        help_text="Snapshot of endpoint name (in case endpoint is deleted)"
    )
    endpoint_method = models.CharField(
        max_length=10,
        default='',
        help_text="Snapshot of HTTP method"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SUCCESS,
        db_index=True
    )
    # Request details
    request_url = models.TextField(
        help_text="Actual URL called (variables resolved)"
    )
    request_headers = models.JSONField(
        default=dict,
        blank=True,
        help_text="Headers sent (sensitive values masked)"
    )
    request_body = models.JSONField(
        default=dict,
        blank=True,
        help_text="Request body sent"
    )
    # Response details
    response_status_code = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="HTTP response status code"
    )
    response_headers = models.JSONField(
        default=dict,
        blank=True,
        help_text="Response headers received"
    )
    response_body = models.TextField(
        blank=True,
        default='',
        help_text="Response body (truncated if large)"
    )
    response_size_bytes = models.PositiveIntegerField(
        default=0,
        help_text="Original response size in bytes"
    )
    # Timing
    execution_time_ms = models.PositiveIntegerField(
        default=0,
        help_text="Request execution time in milliseconds"
    )
    # Error handling
    error_message = models.TextField(
        blank=True,
        default='',
        help_text="Error details if request failed"
    )
    error_type = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Type of error (e.g., ConnectionError, Timeout)"
    )
    # Validation
    assertions_passed = models.BooleanField(
        default=True,
        help_text="Whether all assertions/expectations passed"
    )
    assertion_details = models.JSONField(
        default=list,
        blank=True,
        help_text="Details of assertion results"
    )
    # Variable extraction
    extracted_variables = models.JSONField(
        default=dict,
        blank=True,
        help_text="Variables extracted from this response"
    )
    # Retry information
    retry_attempt = models.PositiveIntegerField(
        default=0,
        help_text="Which retry attempt this is (0 = first try)"
    )
    
    class Meta:
        db_table = 'api_testing_execution_results'
        verbose_name = 'Execution Result'
        verbose_name_plural = 'Execution Results'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['execution_run', 'status']),
            models.Index(fields=['api_endpoint', '-created_at']),
            models.Index(fields=['response_status_code']),
        ]
    
    def __str__(self):
        return f"{self.endpoint_method} {self.endpoint_name} - {self.status}"
    
    @classmethod
    def mask_sensitive_headers(cls, headers):
        """
        Mask sensitive header values for storage.
        
        Args:
            headers: Dictionary of headers
            
        Returns:
            dict: Headers with sensitive values masked
        """
        sensitive_keys = [
            'authorization', 'x-api-key', 'api-key', 'token',
            'x-auth-token', 'cookie', 'set-cookie', 'x-access-token'
        ]
        masked_headers = {}
        for key, value in headers.items():
            if key.lower() in sensitive_keys:
                masked_headers[key] = '***MASKED***'
            else:
                masked_headers[key] = value
        return masked_headers
    
    def truncate_response_body(self, body):
        """
        Truncate response body if it exceeds maximum size.
        
        Args:
            body: Response body string
            
        Returns:
            str: Truncated body with indicator if truncated
        """
        if isinstance(body, bytes):
            body = body.decode('utf-8', errors='replace')
        
        if len(body) > self.MAX_RESPONSE_SIZE:
            return body[:self.MAX_RESPONSE_SIZE] + '\n... [TRUNCATED]'
        return body


class ScheduledRun(TimeStampedModel):
    """
    Scheduled/recurring execution configuration.
    
    Allows setting up automatic API collection runs at specified intervals.
    Integrates with Celery Beat or similar task schedulers.
    
    Attributes:
        id: UUID primary key
        collection: Collection to execute
        name: Schedule name
        cron_expression: Cron-style schedule (e.g., "0 */6 * * *")
        is_active: Whether schedule is active
        last_run: Last execution timestamp
        next_run: Next scheduled execution
        created_by: User who created the schedule
        notify_on_failure: Send notification on failure
        notification_emails: Email addresses for notifications
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    collection = models.ForeignKey(
        APICollection,
        on_delete=models.CASCADE,
        related_name='scheduled_runs'
    )
    name = models.CharField(
        max_length=255,
        help_text="Name for this schedule"
    )
    cron_expression = models.CharField(
        max_length=100,
        help_text="Cron expression (e.g., '0 */6 * * *' for every 6 hours)"
    )
    timezone = models.CharField(
        max_length=50,
        default='UTC',
        help_text="Timezone for the schedule"
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True
    )
    last_run = models.DateTimeField(
        null=True,
        blank=True
    )
    next_run = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='api_schedules'
    )
    notify_on_failure = models.BooleanField(
        default=True,
        help_text="Send notification when execution fails"
    )
    notify_on_success = models.BooleanField(
        default=False,
        help_text="Send notification on successful execution"
    )
    notification_emails = models.JSONField(
        default=list,
        blank=True,
        help_text="Email addresses for notifications"
    )
    environment_overrides = models.JSONField(
        default=dict,
        blank=True,
        help_text="Environment variables to override for scheduled runs"
    )
    
    class Meta:
        db_table = 'api_testing_scheduled_runs'
        verbose_name = 'Scheduled Run'
        verbose_name_plural = 'Scheduled Runs'
        ordering = ['next_run']
        indexes = [
            models.Index(fields=['is_active', 'next_run']),
            models.Index(fields=['collection', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} - {self.collection.name}"
