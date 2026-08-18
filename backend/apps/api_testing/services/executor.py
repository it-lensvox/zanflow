"""
API Execution Service for API Testing Platform.

This module provides the core execution logic for running API tests:
- Single API execution with full request/response capture
- Collection-level batch execution (one-click automation)
- Secure credential injection
- Variable substitution
- Response validation and assertions
- Error handling with retries

SECURITY: This service handles sensitive credentials.
Credentials are decrypted only at execution time and never logged.
"""
import re
import time
import json
import logging
import base64
from typing import Dict, Optional, Any, List, Tuple
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse
from dataclasses import dataclass, field

import requests
from requests.exceptions import (
    RequestException, 
    Timeout, 
    ConnectionError as RequestsConnectionError
)
from django.utils import timezone

from ..models import (
    APICollection,
    APIEndpoint,
    AuthCredential,
    ExecutionRun,
    ExecutionResult,
)


# Configure logging - NEVER log sensitive data
logger = logging.getLogger(__name__)


@dataclass
class ExecutionContext:
    """
    Context object for API execution.
    
    Stores runtime variables, credentials, and environment settings
    that are shared across API calls in a collection run.
    """
    
    # Environment variables from collection + overrides
    environment: Dict[str, Any] = field(default_factory=dict)
    
    # Variables extracted from previous API responses
    extracted_variables: Dict[str, Any] = field(default_factory=dict)
    
    # Auth credential (decrypted at execution time)
    credential: Optional[AuthCredential] = None
    
    # User who triggered the execution
    user: Optional[Any] = None
    
    # Trigger type
    trigger_type: str = 'manual'
    
    def get_variable(self, key: str) -> Optional[Any]:
        """Get a variable from extracted or environment."""
        if key in self.extracted_variables:
            return self.extracted_variables[key]
        return self.environment.get(key)
    
    def set_variable(self, key: str, value: Any):
        """Set a variable (for extraction from responses)."""
        self.extracted_variables[key] = value
    
    def merge_environment(self, env: Dict[str, Any]):
        """Merge additional environment variables."""
        self.environment.update(env)


@dataclass
class ExecutionResultData:
    """
    Data class for execution result.
    
    Holds all information about a single API execution
    before it's persisted to the database.
    """
    
    status: str = 'success'
    request_url: str = ''
    request_headers: Dict = field(default_factory=dict)
    request_body: Any = None
    response_status_code: Optional[int] = None
    response_headers: Dict = field(default_factory=dict)
    response_body: str = ''
    response_size_bytes: int = 0
    execution_time_ms: int = 0
    error_message: str = ''
    error_type: str = ''
    assertions_passed: bool = True
    assertion_details: List = field(default_factory=list)
    extracted_variables: Dict = field(default_factory=dict)
    retry_attempt: int = 0


class APIExecutionService:
    """
    Core service for executing API tests.
    
    Handles:
    - Single API execution
    - Collection batch execution
    - Credential management and injection
    - Variable substitution
    - Response validation
    - Result storage
    """
    
    # Headers that should be masked in logs/storage
    SENSITIVE_HEADERS = [
        'authorization', 'x-api-key', 'api-key', 'token',
        'x-auth-token', 'cookie', 'x-access-token', 'x-secret'
    ]
    
    # Default request timeout
    DEFAULT_TIMEOUT = 30
    
    # Maximum response size to store (10KB)
    MAX_RESPONSE_SIZE = 10 * 1024
    
    def __init__(self):
        """Initialize the execution service."""
        self._session = None
    
    @property
    def session(self) -> requests.Session:
        """Get or create a requests session."""
        if self._session is None:
            self._session = requests.Session()
            # Set default headers
            self._session.headers.update({
                'User-Agent': 'ZanFlow-API-Testing/1.0',
                'Accept': 'application/json'
            })
        return self._session
    
    def reset_session(self):
        """Reset the requests session."""
        if self._session:
            self._session.close()
        self._session = None
    
    # =========================================================================
    # Variable Substitution
    # =========================================================================
    
    def substitute_variables(
        self, 
        text: str, 
        context: ExecutionContext
    ) -> str:
        """
        Substitute {{variable}} placeholders with actual values.
        
        Args:
            text: String containing variable placeholders
            context: Execution context with variables
            
        Returns:
            String with variables substituted
        """
        if not text or not isinstance(text, str):
            return text
        
        # Pattern: {{variable_name}}
        pattern = r'\{\{(\w+)\}\}'
        
        def replace(match):
            var_name = match.group(1)
            value = context.get_variable(var_name)
            if value is not None:
                return str(value)
            logger.warning(f"Variable '{var_name}' not found in context")
            return match.group(0)  # Keep original if not found
        
        return re.sub(pattern, replace, text)
    
    def substitute_in_dict(
        self, 
        data: Dict, 
        context: ExecutionContext
    ) -> Dict:
        """
        Recursively substitute variables in a dictionary.
        
        Args:
            data: Dictionary with potential variable placeholders
            context: Execution context with variables
            
        Returns:
            Dictionary with variables substituted
        """
        if not data:
            return data
        
        result = {}
        for key, value in data.items():
            if isinstance(value, str):
                result[key] = self.substitute_variables(value, context)
            elif isinstance(value, dict):
                result[key] = self.substitute_in_dict(value, context)
            elif isinstance(value, list):
                result[key] = [
                    self.substitute_variables(v, context) if isinstance(v, str) else v
                    for v in value
                ]
            else:
                result[key] = value
        
        return result
    
    # =========================================================================
    # Authentication Handling
    # =========================================================================
    
    def build_auth_headers(
        self, 
        credential: Optional[AuthCredential]
    ) -> Dict[str, str]:
        """
        Build authentication headers from credential.
        
        SECURITY: Credentials are decrypted only when needed
        and never logged.
        
        Args:
            credential: AuthCredential instance
            
        Returns:
            Dictionary of authentication headers
        """
        if not credential:
            return {}
        
        try:
            creds = credential.get_credentials()
        except Exception as e:
            logger.error(f"Failed to decrypt credentials: {type(e).__name__}")
            return {}
        
        auth_type = credential.auth_type
        headers = {}
        
        if auth_type == AuthCredential.AuthType.BEARER:
            token = creds.get('token', '')
            prefix = credential.header_prefix or 'Bearer'
            header_name = credential.header_name or 'Authorization'
            headers[header_name] = f"{prefix} {token}".strip()
        
        elif auth_type == AuthCredential.AuthType.BASIC:
            username = creds.get('username', '')
            password = creds.get('password', '')
            credentials_string = f"{username}:{password}"
            encoded = base64.b64encode(credentials_string.encode()).decode()
            headers['Authorization'] = f"Basic {encoded}"
        
        elif auth_type in [
            AuthCredential.AuthType.API_KEY,
            AuthCredential.AuthType.API_KEY_HEADER
        ]:
            api_key = creds.get('api_key', '')
            key_name = creds.get('key_name', 'X-API-Key')
            headers[key_name] = api_key
        
        elif auth_type == AuthCredential.AuthType.OAUTH2:
            access_token = creds.get('access_token', '')
            headers['Authorization'] = f"Bearer {access_token}"
        
        elif auth_type == AuthCredential.AuthType.CUSTOM:
            token = creds.get('token', '')
            header_name = credential.header_name or 'Authorization'
            prefix = credential.header_prefix or ''
            headers[header_name] = f"{prefix} {token}".strip() if prefix else token
        
        return headers
    
    def build_auth_query_params(
        self, 
        credential: Optional[AuthCredential]
    ) -> Dict[str, str]:
        """
        Build authentication query parameters (for API key in query).
        
        Args:
            credential: AuthCredential instance
            
        Returns:
            Dictionary of query parameters
        """
        if not credential:
            return {}
        
        if credential.auth_type != AuthCredential.AuthType.API_KEY_QUERY:
            return {}
        
        try:
            creds = credential.get_credentials()
            api_key = creds.get('api_key', '')
            key_name = creds.get('key_name', 'api_key')
            return {key_name: api_key}
        except Exception as e:
            logger.error(f"Failed to decrypt credentials: {type(e).__name__}")
            return {}
    
    # =========================================================================
    # Request Building
    # =========================================================================
    
    def build_url(
        self, 
        endpoint: APIEndpoint, 
        context: ExecutionContext,
        credential: Optional[AuthCredential] = None
    ) -> str:
        """
        Build the full URL with query parameters.
        
        Args:
            endpoint: API endpoint configuration
            context: Execution context for variable substitution
            credential: Optional credential for API key query auth
            
        Returns:
            Complete URL string
        """
        # Substitute variables in URL
        url = self.substitute_variables(endpoint.url, context)
        
        # Parse existing URL
        parsed = urlparse(url)
        
        # Get existing query params
        existing_params = parse_qs(parsed.query)
        
        # Flatten existing params (parse_qs returns lists)
        params = {k: v[0] if len(v) == 1 else v for k, v in existing_params.items()}
        
        # Add endpoint query params
        if endpoint.query_params:
            endpoint_params = self.substitute_in_dict(endpoint.query_params, context)
            params.update(endpoint_params)
        
        # Add auth query params if needed
        auth_params = self.build_auth_query_params(credential)
        params.update(auth_params)
        
        # Rebuild URL
        new_query = urlencode(params, doseq=True) if params else ''
        new_url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            parsed.fragment
        ))
        
        return new_url
    
    def build_headers(
        self, 
        endpoint: APIEndpoint, 
        context: ExecutionContext,
        credential: Optional[AuthCredential] = None
    ) -> Dict[str, str]:
        """
        Build request headers.
        
        Args:
            endpoint: API endpoint configuration
            context: Execution context for variable substitution
            credential: Optional credential for auth headers
            
        Returns:
            Dictionary of headers
        """
        headers = {}
        
        # Add endpoint-specific headers
        if endpoint.headers:
            headers.update(self.substitute_in_dict(endpoint.headers, context))
        
        # Add Content-Type based on body type
        if endpoint.body_type == 'json':
            headers.setdefault('Content-Type', 'application/json')
        elif endpoint.body_type == 'form-data':
            # Let requests handle multipart
            pass
        elif endpoint.body_type == 'x-www-form-urlencoded':
            headers.setdefault('Content-Type', 'application/x-www-form-urlencoded')
        
        # Add auth headers (these override endpoint headers)
        auth_headers = self.build_auth_headers(credential)
        headers.update(auth_headers)
        
        return headers
    
    def build_body(
        self, 
        endpoint: APIEndpoint, 
        context: ExecutionContext
    ) -> Tuple[Any, Optional[Dict]]:
        """
        Build request body.
        
        Args:
            endpoint: API endpoint configuration
            context: Execution context for variable substitution
            
        Returns:
            Tuple of (body_data, files_dict or None)
        """
        if endpoint.body_type == 'none' or not endpoint.request_body:
            return None, None
        
        body = self.substitute_in_dict(endpoint.request_body, context)
        
        if endpoint.body_type == 'json':
            return json.dumps(body), None
        elif endpoint.body_type == 'form-data':
            # For multipart form data
            return None, body  # Use as files parameter
        elif endpoint.body_type == 'x-www-form-urlencoded':
            return urlencode(body), None
        elif endpoint.body_type == 'raw':
            return str(body), None
        
        return body, None
    
    # =========================================================================
    # Response Handling
    # =========================================================================
    
    def mask_headers(self, headers: Dict) -> Dict:
        """
        Mask sensitive header values for storage/logging.
        
        Args:
            headers: Dictionary of headers
            
        Returns:
            Dictionary with sensitive values masked
        """
        masked = {}
        for key, value in headers.items():
            if key.lower() in self.SENSITIVE_HEADERS:
                masked[key] = '***MASKED***'
            else:
                masked[key] = value
        return masked
    
    def truncate_response(self, body: str) -> str:
        """
        Truncate response body if too large.
        
        Args:
            body: Response body string
            
        Returns:
            Truncated body with indicator
        """
        if len(body) > self.MAX_RESPONSE_SIZE:
            return body[:self.MAX_RESPONSE_SIZE] + '\n... [TRUNCATED]'
        return body
    
    def extract_json_path(self, data: Any, path: str) -> Any:
        """
        Extract a value from JSON using dot notation path.
        
        Args:
            data: JSON data (dict or list)
            path: Dot-separated path (e.g., 'data.user.id')
            
        Returns:
            Extracted value or None
        """
        if not path or data is None:
            return None
        
        parts = path.split('.')
        current = data
        
        for part in parts:
            # Handle array index
            if '[' in part and ']' in part:
                key = part[:part.index('[')]
                index = int(part[part.index('[')+1:part.index(']')])
                
                if key and isinstance(current, dict):
                    current = current.get(key, [])
                
                if isinstance(current, list) and len(current) > index:
                    current = current[index]
                else:
                    return None
            elif isinstance(current, dict):
                current = current.get(part)
            else:
                return None
        
        return current
    
    def extract_variables_from_response(
        self, 
        endpoint: APIEndpoint, 
        response_data: Any,
        context: ExecutionContext
    ) -> Dict[str, Any]:
        """
        Extract variables from API response.
        
        Args:
            endpoint: API endpoint with extraction config
            response_data: Parsed response data
            context: Execution context to store variables
            
        Returns:
            Dictionary of extracted variables
        """
        extracted = {}
        
        if not endpoint.extract_variables:
            return extracted
        
        for var_name, json_path in endpoint.extract_variables.items():
            value = self.extract_json_path(response_data, json_path)
            if value is not None:
                extracted[var_name] = value
                context.set_variable(var_name, value)
                logger.debug(f"Extracted variable '{var_name}' from path '{json_path}'")
        
        return extracted
    
    def validate_response(
        self, 
        endpoint: APIEndpoint, 
        status_code: int,
        response_data: Any
    ) -> Tuple[bool, List[Dict]]:
        """
        Validate response against expectations.
        
        Args:
            endpoint: API endpoint with validation config
            status_code: HTTP response status code
            response_data: Parsed response data
            
        Returns:
            Tuple of (all_passed: bool, details: list)
        """
        assertions = []
        all_passed = True
        
        # Check expected status code
        if endpoint.expected_status_code:
            passed = status_code == endpoint.expected_status_code
            assertions.append({
                'type': 'status_code',
                'expected': endpoint.expected_status_code,
                'actual': status_code,
                'passed': passed
            })
            if not passed:
                all_passed = False
        
        # Check expected response contains
        if endpoint.expected_response_contains:
            for expected in endpoint.expected_response_contains:
                if isinstance(expected, dict):
                    # Check key-value pair
                    for key, value in expected.items():
                        actual_value = self.extract_json_path(response_data, key)
                        passed = actual_value == value
                        assertions.append({
                            'type': 'response_contains',
                            'path': key,
                            'expected': value,
                            'actual': actual_value,
                            'passed': passed
                        })
                        if not passed:
                            all_passed = False
                elif isinstance(expected, str):
                    # Check key exists
                    actual_value = self.extract_json_path(response_data, expected)
                    passed = actual_value is not None
                    assertions.append({
                        'type': 'key_exists',
                        'path': expected,
                        'passed': passed
                    })
                    if not passed:
                        all_passed = False
        
        return all_passed, assertions
    
    # =========================================================================
    # Single API Execution
    # =========================================================================
    
    def execute_single_api(
        self, 
        endpoint: APIEndpoint,
        context: ExecutionContext,
        credential: Optional[AuthCredential] = None,
        retry_attempt: int = 0
    ) -> ExecutionResultData:
        """
        Execute a single API endpoint.
        
        Args:
            endpoint: API endpoint to execute
            context: Execution context with variables
            credential: Optional authentication credential
            retry_attempt: Current retry attempt number
            
        Returns:
            ExecutionResultData with complete execution details
        """
        result = ExecutionResultData(retry_attempt=retry_attempt)
        
        try:
            # Build request components
            url = self.build_url(endpoint, context, credential)
            headers = self.build_headers(endpoint, context, credential)
            body, files = self.build_body(endpoint, context)
            
            # Store request details (masked)
            result.request_url = url
            result.request_headers = self.mask_headers(headers)
            result.request_body = endpoint.request_body if endpoint.request_body else {}
            
            # Execute request
            start_time = time.time()
            
            response = self.session.request(
                method=endpoint.http_method,
                url=url,
                headers=headers,
                data=body if body else None,
                files=files,
                timeout=endpoint.timeout_seconds or self.DEFAULT_TIMEOUT,
                allow_redirects=True
            )
            
            end_time = time.time()
            result.execution_time_ms = int((end_time - start_time) * 1000)
            
            # Process response
            result.response_status_code = response.status_code
            result.response_headers = dict(response.headers)
            result.response_size_bytes = len(response.content)
            
            # Get response body
            try:
                response_text = response.text
                result.response_body = self.truncate_response(response_text)
            except Exception:
                result.response_body = '[Unable to decode response]'
            
            # Parse response for validation and extraction
            response_data = None
            try:
                response_data = response.json()
            except (json.JSONDecodeError, ValueError):
                response_data = response_text
            
            # Extract variables
            if endpoint.extract_variables:
                result.extracted_variables = self.extract_variables_from_response(
                    endpoint, response_data, context
                )
            
            # Validate response
            passed, assertion_details = self.validate_response(
                endpoint, response.status_code, response_data
            )
            result.assertions_passed = passed
            result.assertion_details = assertion_details
            
            # Determine status
            if response.status_code >= 400:
                result.status = ExecutionResult.Status.FAILED
            elif not passed:
                result.status = ExecutionResult.Status.FAILED
            else:
                result.status = ExecutionResult.Status.SUCCESS
            
        except Timeout as e:
            result.status = ExecutionResult.Status.TIMEOUT
            result.error_type = 'Timeout'
            result.error_message = f"Request timed out after {endpoint.timeout_seconds}s"
            logger.warning(f"API timeout: {endpoint.name}")
        
        except RequestsConnectionError as e:
            result.status = ExecutionResult.Status.ERROR
            result.error_type = 'ConnectionError'
            result.error_message = f"Failed to connect: {str(e)}"
            logger.error(f"Connection error for {endpoint.name}: {str(e)}")
        
        except RequestException as e:
            result.status = ExecutionResult.Status.ERROR
            result.error_type = type(e).__name__
            result.error_message = str(e)
            logger.error(f"Request error for {endpoint.name}: {str(e)}")
        
        except Exception as e:
            result.status = ExecutionResult.Status.ERROR
            result.error_type = type(e).__name__
            result.error_message = f"Unexpected error: {str(e)}"
            logger.exception(f"Unexpected error executing {endpoint.name}")
        
        return result
    
    def execute_with_retry(
        self, 
        endpoint: APIEndpoint,
        context: ExecutionContext,
        credential: Optional[AuthCredential] = None
    ) -> ExecutionResultData:
        """
        Execute API with retry logic.
        
        Args:
            endpoint: API endpoint to execute
            context: Execution context
            credential: Optional authentication credential
            
        Returns:
            ExecutionResultData from the last attempt
        """
        max_retries = endpoint.retry_count or 0
        retry_delay = endpoint.retry_delay_seconds or 1
        
        for attempt in range(max_retries + 1):
            result = self.execute_single_api(
                endpoint, context, credential, attempt
            )
            
            # Don't retry on success or validation failure
            if result.status == ExecutionResult.Status.SUCCESS:
                return result
            
            # Don't retry on the last attempt
            if attempt >= max_retries:
                return result
            
            # Retry on timeout or connection errors
            if result.status in [
                ExecutionResult.Status.TIMEOUT,
                ExecutionResult.Status.ERROR
            ]:
                logger.info(
                    f"Retrying {endpoint.name} (attempt {attempt + 2}/{max_retries + 1})"
                )
                time.sleep(retry_delay)
            else:
                return result
        
        return result
    
    # =========================================================================
    # Collection Execution
    # =========================================================================
    
    def execute_collection(
        self,
        collection: APICollection,
        credential: Optional[AuthCredential] = None,
        environment_overrides: Optional[Dict] = None,
        user: Any = None,
        trigger_type: str = 'manual',
        notes: str = ''
    ) -> ExecutionRun:
        """
        Execute all APIs in a collection (one-click automation).
        
        This is the main entry point for batch API execution.
        Executes APIs sequentially, capturing results for each.
        Failure of one API does not stop others.
        
        Args:
            collection: API collection to execute
            credential: Optional authentication credential
            environment_overrides: Additional environment variables
            user: User who triggered the execution
            trigger_type: How the execution was triggered
            notes: Optional notes about the run
            
        Returns:
            ExecutionRun with all results
        """
        # Get ordered endpoints
        endpoints = list(collection.get_ordered_endpoints())
        
        if not endpoints:
            raise ValueError("Collection has no active endpoints to execute")
        
        # Create execution run
        execution_run = ExecutionRun.objects.create(
            collection=collection,
            executed_by=user,
            total_apis=len(endpoints),
            trigger_type=trigger_type,
            environment=environment_overrides or {},
            notes=notes
        )
        
        # Build execution context
        context = ExecutionContext(
            environment=collection.environment_variables.copy(),
            credential=credential,
            user=user,
            trigger_type=trigger_type
        )
        
        # Add environment overrides
        if environment_overrides:
            context.merge_environment(environment_overrides)
        
        # Try to get collection-level credential if not provided
        if not credential:
            credential = collection.auth_credentials.filter(is_active=True).first()
        
        # Mark run as started
        execution_run.mark_started()
        
        # Track success/failure counts
        successful_count = 0
        failed_count = 0
        skipped_count = 0
        
        # Track which endpoints have succeeded (for dependency checking)
        completed_endpoints = set()
        failed_endpoints = set()
        
        try:
            for endpoint in endpoints:
                # Check dependencies
                if endpoint.depends_on_id:
                    if endpoint.depends_on_id in failed_endpoints:
                        # Skip if dependency failed
                        self._save_skipped_result(
                            execution_run, endpoint,
                            "Skipped: dependency failed"
                        )
                        skipped_count += 1
                        continue
                    elif endpoint.depends_on_id not in completed_endpoints:
                        # Skip if dependency hasn't run (shouldn't happen with ordering)
                        self._save_skipped_result(
                            execution_run, endpoint,
                            "Skipped: dependency not executed"
                        )
                        skipped_count += 1
                        continue
                
                # Execute the API
                result_data = self.execute_with_retry(endpoint, context, credential)
                
                # Save result
                self._save_execution_result(execution_run, endpoint, result_data)
                
                # Update counters and tracking
                if result_data.status == ExecutionResult.Status.SUCCESS:
                    successful_count += 1
                    completed_endpoints.add(endpoint.id)
                else:
                    failed_count += 1
                    failed_endpoints.add(endpoint.id)
            
            # Update credential last used timestamp
            if credential:
                credential.mark_used()
        
        except Exception as e:
            logger.exception(f"Error during collection execution: {str(e)}")
            # Update remaining as skipped
            skipped_count = len(endpoints) - successful_count - failed_count
        
        finally:
            # Update execution run
            execution_run.successful_count = successful_count
            execution_run.failed_count = failed_count
            execution_run.skipped_count = skipped_count
            execution_run.mark_completed()
        
        return execution_run
    
    def _save_execution_result(
        self,
        execution_run: ExecutionRun,
        endpoint: APIEndpoint,
        result_data: ExecutionResultData
    ) -> ExecutionResult:
        """
        Save execution result to database.
        
        Args:
            execution_run: Parent execution run
            endpoint: API endpoint that was executed
            result_data: Execution result data
            
        Returns:
            Saved ExecutionResult instance
        """
        return ExecutionResult.objects.create(
            execution_run=execution_run,
            api_endpoint=endpoint,
            endpoint_name=endpoint.name,
            endpoint_method=endpoint.http_method,
            status=result_data.status,
            request_url=result_data.request_url,
            request_headers=result_data.request_headers,
            request_body=result_data.request_body,
            response_status_code=result_data.response_status_code,
            response_headers=result_data.response_headers,
            response_body=result_data.response_body,
            response_size_bytes=result_data.response_size_bytes,
            execution_time_ms=result_data.execution_time_ms,
            error_message=result_data.error_message,
            error_type=result_data.error_type,
            assertions_passed=result_data.assertions_passed,
            assertion_details=result_data.assertion_details,
            extracted_variables=result_data.extracted_variables,
            retry_attempt=result_data.retry_attempt
        )
    
    def _save_skipped_result(
        self,
        execution_run: ExecutionRun,
        endpoint: APIEndpoint,
        reason: str
    ) -> ExecutionResult:
        """
        Save a skipped result.
        
        Args:
            execution_run: Parent execution run
            endpoint: API endpoint that was skipped
            reason: Reason for skipping
            
        Returns:
            Saved ExecutionResult instance
        """
        return ExecutionResult.objects.create(
            execution_run=execution_run,
            api_endpoint=endpoint,
            endpoint_name=endpoint.name,
            endpoint_method=endpoint.http_method,
            status=ExecutionResult.Status.SKIPPED,
            request_url=endpoint.url,
            error_message=reason
        )


# Singleton instance for use in views
api_executor = APIExecutionService()
