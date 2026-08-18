"""
Django Admin configuration for API Testing Platform.

Provides admin interface for managing:
- API Collections
- API Endpoints
- Auth Credentials (with security considerations)
- Execution History
- Scheduled Runs
"""
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone

from .models import (
    APICollection,
    APIEndpoint,
    AuthCredential,
    ExecutionRun,
    ExecutionResult,
    ScheduledRun,
)


class APIEndpointInline(admin.TabularInline):
    """Inline display of endpoints within a collection."""
    
    model = APIEndpoint
    extra = 0
    fields = ['name', 'http_method', 'url', 'sort_order', 'is_active']
    readonly_fields = ['created_at']
    ordering = ['sort_order']
    show_change_link = True


class AuthCredentialInline(admin.TabularInline):
    """Inline display of credentials within a collection."""
    
    model = AuthCredential
    extra = 0
    fields = ['name', 'auth_type', 'is_active', 'expires_at']
    readonly_fields = ['created_at', 'last_used_at']
    show_change_link = True


@admin.register(APICollection)
class APICollectionAdmin(admin.ModelAdmin):
    """Admin interface for API Collections."""
    
    list_display = [
        'name', 'api_count', 'created_by', 'is_active',
        'created_at', 'last_run_status'
    ]
    list_filter = ['is_active', 'execution_order', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at', 'api_count_display']
    
    fieldsets = (
        (None, {
            'fields': ('id', 'name', 'description', 'project_id')
        }),
        ('Configuration', {
            'fields': ('execution_order', 'environment_variables', 'tags')
        }),
        ('Status', {
            'fields': ('is_active', 'created_by', 'created_at', 'updated_at')
        }),
        ('Statistics', {
            'fields': ('api_count_display',),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [APIEndpointInline, AuthCredentialInline]
    
    def api_count(self, obj):
        """Display the number of active APIs."""
        return obj.api_endpoints.filter(is_active=True).count()
    api_count.short_description = 'APIs'
    
    def api_count_display(self, obj):
        """Display API count with link to filter."""
        count = obj.api_endpoints.filter(is_active=True).count()
        url = reverse('admin:api_testing_apiendpoint_changelist') + f'?collection__id__exact={obj.id}'
        return format_html('<a href="{}">{} endpoints</a>', url, count)
    api_count_display.short_description = 'Endpoints'
    
    def last_run_status(self, obj):
        """Display the status of the last execution run."""
        last_run = obj.execution_runs.order_by('-created_at').first()
        if not last_run:
            return '-'
        
        status_colors = {
            'completed': 'green',
            'failed': 'red',
            'partial_failure': 'orange',
            'running': 'blue',
            'pending': 'gray',
        }
        color = status_colors.get(last_run.status, 'gray')
        return format_html(
            '<span style="color: {};">{}</span>',
            color,
            last_run.status.replace('_', ' ').title()
        )
    last_run_status.short_description = 'Last Run'


@admin.register(APIEndpoint)
class APIEndpointAdmin(admin.ModelAdmin):
    """Admin interface for API Endpoints."""
    
    list_display = [
        'name', 'http_method_display', 'url_truncated', 'collection',
        'sort_order', 'is_active', 'last_result_status'
    ]
    list_filter = ['http_method', 'is_active', 'collection', 'body_type']
    search_fields = ['name', 'description', 'url']
    readonly_fields = ['id', 'created_at', 'updated_at']
    list_editable = ['sort_order', 'is_active']
    ordering = ['collection', 'sort_order']
    
    fieldsets = (
        (None, {
            'fields': ('id', 'collection', 'name', 'description')
        }),
        ('Request Configuration', {
            'fields': ('http_method', 'url', 'headers', 'query_params')
        }),
        ('Request Body', {
            'fields': ('body_type', 'request_body')
        }),
        ('Validation', {
            'fields': ('expected_status_code', 'expected_response_contains')
        }),
        ('Advanced Settings', {
            'fields': (
                'timeout_seconds', 'retry_count', 'retry_delay_seconds',
                'sort_order', 'depends_on', 'extract_variables'
            ),
            'classes': ('collapse',)
        }),
        ('Scripts', {
            'fields': ('pre_request_script', 'post_response_script'),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('is_active', 'created_at', 'updated_at')
        }),
    )
    
    def http_method_display(self, obj):
        """Display HTTP method with color coding."""
        colors = {
            'GET': '#61affe',
            'POST': '#49cc90',
            'PUT': '#fca130',
            'PATCH': '#50e3c2',
            'DELETE': '#f93e3e',
        }
        color = colors.get(obj.http_method, '#gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 8px; '
            'border-radius: 3px; font-weight: bold;">{}</span>',
            color,
            obj.http_method
        )
    http_method_display.short_description = 'Method'
    
    def url_truncated(self, obj):
        """Display truncated URL."""
        if len(obj.url) > 50:
            return obj.url[:50] + '...'
        return obj.url
    url_truncated.short_description = 'URL'
    
    def last_result_status(self, obj):
        """Display the status of the last execution result."""
        last_result = obj.execution_results.order_by('-created_at').first()
        if not last_result:
            return '-'
        
        status_colors = {
            'success': 'green',
            'failed': 'red',
            'error': 'orange',
            'timeout': 'purple',
            'skipped': 'gray',
        }
        color = status_colors.get(last_result.status, 'gray')
        return format_html(
            '<span style="color: {};">{}</span>',
            color,
            last_result.status.title()
        )
    last_result_status.short_description = 'Last Result'


@admin.register(AuthCredential)
class AuthCredentialAdmin(admin.ModelAdmin):
    """
    Admin interface for Auth Credentials.
    
    SECURITY: Encrypted credentials are never displayed or editable.
    """
    
    list_display = [
        'name', 'auth_type', 'collection', 'is_active',
        'is_expired_display', 'last_used_at'
    ]
    list_filter = ['auth_type', 'is_active', 'auto_refresh']
    search_fields = ['name']
    readonly_fields = [
        'id', 'encrypted_credentials', 'created_at', 'updated_at', 'last_used_at'
    ]
    
    fieldsets = (
        (None, {
            'fields': ('id', 'name', 'collection', 'auth_type')
        }),
        ('Configuration', {
            'fields': ('header_name', 'header_prefix')
        }),
        ('Token Management', {
            'fields': ('expires_at', 'auto_refresh', 'refresh_url', 'refresh_payload')
        }),
        ('Status', {
            'fields': ('is_active', 'created_by', 'last_used_at', 'created_at', 'updated_at')
        }),
        ('Security (Read-Only)', {
            'fields': ('encrypted_credentials',),
            'classes': ('collapse',),
            'description': 'Encrypted credentials cannot be viewed or edited here.'
        }),
    )
    
    def is_expired_display(self, obj):
        """Display whether credential is expired."""
        if obj.is_expired:
            return format_html('<span style="color: red;">Expired</span>')
        elif obj.expires_at:
            days_until = (obj.expires_at - timezone.now()).days
            if days_until < 7:
                return format_html(
                    '<span style="color: orange;">Expires in {} days</span>',
                    days_until
                )
            return format_html('<span style="color: green;">Valid</span>')
        return format_html('<span style="color: green;">No Expiry</span>')
    is_expired_display.short_description = 'Status'


class ExecutionResultInline(admin.TabularInline):
    """Inline display of results within an execution run."""
    
    model = ExecutionResult
    extra = 0
    fields = [
        'endpoint_name', 'endpoint_method', 'status',
        'response_status_code', 'execution_time_ms'
    ]
    readonly_fields = fields
    can_delete = False
    max_num = 0
    ordering = ['created_at']
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(ExecutionRun)
class ExecutionRunAdmin(admin.ModelAdmin):
    """Admin interface for Execution Runs."""
    
    list_display = [
        'id_short', 'collection', 'status_display', 'executed_by',
        'success_rate_display', 'duration_display', 'started_at'
    ]
    list_filter = ['status', 'trigger_type', 'collection', 'started_at']
    search_fields = ['collection__name', 'executed_by__email']
    readonly_fields = [
        'id', 'collection', 'executed_by', 'status', 'started_at',
        'completed_at', 'total_apis', 'successful_count', 'failed_count',
        'skipped_count', 'trigger_type', 'environment', 'notes',
        'created_at', 'updated_at'
    ]
    date_hierarchy = 'started_at'
    ordering = ['-started_at']
    
    inlines = [ExecutionResultInline]
    
    fieldsets = (
        (None, {
            'fields': ('id', 'collection', 'executed_by', 'trigger_type')
        }),
        ('Execution Status', {
            'fields': ('status', 'started_at', 'completed_at')
        }),
        ('Results', {
            'fields': ('total_apis', 'successful_count', 'failed_count', 'skipped_count')
        }),
        ('Context', {
            'fields': ('environment', 'notes'),
            'classes': ('collapse',)
        }),
    )
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def id_short(self, obj):
        """Display shortened ID."""
        return str(obj.id)[:8]
    id_short.short_description = 'Run ID'
    
    def status_display(self, obj):
        """Display status with color coding."""
        status_colors = {
            'completed': 'green',
            'failed': 'red',
            'partial_failure': 'orange',
            'running': 'blue',
            'pending': 'gray',
            'cancelled': 'gray',
        }
        color = status_colors.get(obj.status, 'gray')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.status.replace('_', ' ').title()
        )
    status_display.short_description = 'Status'
    
    def success_rate_display(self, obj):
        """Display success rate with progress bar."""
        rate = obj.success_rate
        color = 'green' if rate >= 80 else 'orange' if rate >= 50 else 'red'
        return format_html(
            '<div style="width: 100px; background: #eee; border-radius: 3px;">'
            '<div style="width: {}%; background: {}; height: 20px; border-radius: 3px; '
            'text-align: center; color: white; line-height: 20px;">{:.0f}%</div></div>',
            rate, color, rate
        )
    success_rate_display.short_description = 'Success Rate'
    
    def duration_display(self, obj):
        """Display execution duration."""
        duration = obj.duration_seconds
        if duration is None:
            return '-'
        if duration < 1:
            return f'{int(duration * 1000)}ms'
        return f'{duration:.2f}s'
    duration_display.short_description = 'Duration'


@admin.register(ExecutionResult)
class ExecutionResultAdmin(admin.ModelAdmin):
    """Admin interface for Execution Results."""
    
    list_display = [
        'endpoint_display', 'execution_run_short', 'status_display',
        'response_status_code', 'execution_time_display', 'created_at'
    ]
    list_filter = ['status', 'response_status_code', 'assertions_passed']
    search_fields = ['endpoint_name', 'request_url']
    readonly_fields = [
        'id', 'execution_run', 'api_endpoint', 'endpoint_name', 'endpoint_method',
        'status', 'request_url', 'request_headers', 'request_body',
        'response_status_code', 'response_headers', 'response_body',
        'response_size_bytes', 'execution_time_ms', 'error_message', 'error_type',
        'assertions_passed', 'assertion_details', 'extracted_variables',
        'retry_attempt', 'created_at'
    ]
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    
    fieldsets = (
        (None, {
            'fields': ('id', 'execution_run', 'api_endpoint', 'endpoint_name', 'endpoint_method')
        }),
        ('Request', {
            'fields': ('request_url', 'request_headers', 'request_body')
        }),
        ('Response', {
            'fields': (
                'status', 'response_status_code', 'response_headers',
                'response_body', 'response_size_bytes'
            )
        }),
        ('Performance', {
            'fields': ('execution_time_ms', 'retry_attempt')
        }),
        ('Validation', {
            'fields': ('assertions_passed', 'assertion_details', 'extracted_variables')
        }),
        ('Errors', {
            'fields': ('error_type', 'error_message'),
            'classes': ('collapse',)
        }),
    )
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def endpoint_display(self, obj):
        """Display endpoint method and name."""
        colors = {
            'GET': '#61affe',
            'POST': '#49cc90',
            'PUT': '#fca130',
            'PATCH': '#50e3c2',
            'DELETE': '#f93e3e',
        }
        color = colors.get(obj.endpoint_method, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 1px 5px; '
            'border-radius: 3px; font-size: 10px;">{}</span> {}',
            color, obj.endpoint_method, obj.endpoint_name
        )
    endpoint_display.short_description = 'Endpoint'
    
    def execution_run_short(self, obj):
        """Display shortened run ID with link."""
        url = reverse('admin:api_testing_executionrun_change', args=[obj.execution_run.id])
        return format_html('<a href="{}">{}</a>', url, str(obj.execution_run.id)[:8])
    execution_run_short.short_description = 'Run'
    
    def status_display(self, obj):
        """Display status with color."""
        status_colors = {
            'success': 'green',
            'failed': 'red',
            'error': 'orange',
            'timeout': 'purple',
            'skipped': 'gray',
        }
        color = status_colors.get(obj.status, 'gray')
        return format_html(
            '<span style="color: {};">{}</span>',
            color, obj.status.title()
        )
    status_display.short_description = 'Status'
    
    def execution_time_display(self, obj):
        """Display execution time."""
        ms = obj.execution_time_ms
        if ms < 1000:
            return f'{ms}ms'
        return f'{ms/1000:.2f}s'
    execution_time_display.short_description = 'Time'


@admin.register(ScheduledRun)
class ScheduledRunAdmin(admin.ModelAdmin):
    """Admin interface for Scheduled Runs."""
    
    list_display = [
        'name', 'collection', 'cron_expression', 'is_active',
        'last_run', 'next_run'
    ]
    list_filter = ['is_active', 'notify_on_failure', 'notify_on_success']
    search_fields = ['name', 'collection__name']
    readonly_fields = ['id', 'last_run', 'created_at', 'updated_at']
    
    fieldsets = (
        (None, {
            'fields': ('id', 'name', 'collection')
        }),
        ('Schedule', {
            'fields': ('cron_expression', 'timezone', 'is_active')
        }),
        ('Notifications', {
            'fields': ('notify_on_failure', 'notify_on_success', 'notification_emails')
        }),
        ('Overrides', {
            'fields': ('environment_overrides',),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('last_run', 'next_run', 'created_by', 'created_at', 'updated_at')
        }),
    )
