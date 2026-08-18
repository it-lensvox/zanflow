"""
Utility functions for API Testing Platform.

Provides helper functions for:
- Variable substitution
- JSON path extraction
- Response validation
- Encryption helpers
"""
import re
import json
import hashlib
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone


def substitute_variables(text: str, variables: Dict[str, Any]) -> str:
    """
    Substitute {{variable}} placeholders in text with actual values.
    
    Args:
        text: String containing {{variable}} placeholders
        variables: Dictionary of variable names to values
        
    Returns:
        String with placeholders replaced
        
    Example:
        >>> substitute_variables("Hello {{name}}!", {"name": "World"})
        "Hello World!"
    """
    if not text or not isinstance(text, str):
        return text
    
    pattern = r'\{\{(\w+)\}\}'
    
    def replace(match):
        var_name = match.group(1)
        value = variables.get(var_name)
        if value is not None:
            return str(value)
        return match.group(0)  # Keep original if not found
    
    return re.sub(pattern, replace, text)


def extract_json_path(data: Any, path: str) -> Any:
    """
    Extract a value from nested JSON data using dot notation.
    
    Supports:
    - Dot notation: "user.name"
    - Array indexing: "users[0].name"
    - Nested arrays: "data.items[2].values[0]"
    
    Args:
        data: JSON data (dict, list, or primitive)
        path: Dot-notation path to extract
        
    Returns:
        Extracted value or None if path doesn't exist
        
    Example:
        >>> data = {"user": {"name": "John", "emails": ["a@b.com", "c@d.com"]}}
        >>> extract_json_path(data, "user.name")
        "John"
        >>> extract_json_path(data, "user.emails[0]")
        "a@b.com"
    """
    if not path or data is None:
        return None
    
    parts = path.split('.')
    current = data
    
    for part in parts:
        # Handle array index notation: "items[0]"
        if '[' in part and ']' in part:
            key = part[:part.index('[')]
            index_str = part[part.index('[')+1:part.index(']')]
            
            try:
                index = int(index_str)
            except ValueError:
                return None
            
            # Get the array first if key exists
            if key and isinstance(current, dict):
                current = current.get(key)
            
            # Then get the index
            if isinstance(current, list) and len(current) > index:
                current = current[index]
            else:
                return None
        elif isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, list) and part.isdigit():
            index = int(part)
            if len(current) > index:
                current = current[index]
            else:
                return None
        else:
            return None
        
        if current is None:
            return None
    
    return current


def validate_json_schema(data: Any, schema: Dict) -> tuple:
    """
    Simple JSON schema validation.
    
    Args:
        data: Data to validate
        schema: Schema definition
        
    Returns:
        Tuple of (is_valid: bool, errors: list)
    """
    errors = []
    
    # Check required fields
    if 'required' in schema:
        for field in schema['required']:
            if not isinstance(data, dict) or field not in data:
                errors.append(f"Missing required field: {field}")
    
    # Check field types
    if 'properties' in schema and isinstance(data, dict):
        for field, field_schema in schema['properties'].items():
            if field in data:
                expected_type = field_schema.get('type')
                if expected_type:
                    actual_type = type(data[field]).__name__
                    type_mapping = {
                        'string': 'str',
                        'number': ('int', 'float'),
                        'integer': 'int',
                        'boolean': 'bool',
                        'array': 'list',
                        'object': 'dict',
                    }
                    expected = type_mapping.get(expected_type, expected_type)
                    if isinstance(expected, tuple):
                        if actual_type not in expected:
                            errors.append(
                                f"Field '{field}' should be {expected_type}, got {actual_type}"
                            )
                    elif actual_type != expected:
                        errors.append(
                            f"Field '{field}' should be {expected_type}, got {actual_type}"
                        )
    
    return len(errors) == 0, errors


def generate_request_hash(method: str, url: str, headers: Dict, body: Any) -> str:
    """
    Generate a hash for a request to detect duplicates.
    
    Args:
        method: HTTP method
        url: Request URL
        headers: Request headers
        body: Request body
        
    Returns:
        SHA256 hash string
    """
    content = json.dumps({
        'method': method.upper(),
        'url': url,
        'headers': headers,
        'body': body
    }, sort_keys=True)
    
    return hashlib.sha256(content.encode()).hexdigest()


def parse_duration(duration_str: str) -> Optional[timedelta]:
    """
    Parse a duration string into a timedelta.
    
    Supports formats like:
    - "30s" (seconds)
    - "5m" (minutes)
    - "2h" (hours)
    - "1d" (days)
    
    Args:
        duration_str: Duration string
        
    Returns:
        timedelta or None if parsing fails
    """
    if not duration_str:
        return None
    
    pattern = r'^(\d+)([smhd])$'
    match = re.match(pattern, duration_str.lower().strip())
    
    if not match:
        return None
    
    value = int(match.group(1))
    unit = match.group(2)
    
    if unit == 's':
        return timedelta(seconds=value)
    elif unit == 'm':
        return timedelta(minutes=value)
    elif unit == 'h':
        return timedelta(hours=value)
    elif unit == 'd':
        return timedelta(days=value)
    
    return None


def format_file_size(size_bytes: int) -> str:
    """
    Format a file size in bytes to human readable format.
    
    Args:
        size_bytes: Size in bytes
        
    Returns:
        Human readable string (e.g., "1.5 KB")
    """
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


def mask_sensitive_value(value: str, visible_chars: int = 4) -> str:
    """
    Mask a sensitive value, showing only first few characters.
    
    Args:
        value: Value to mask
        visible_chars: Number of characters to show
        
    Returns:
        Masked string
    """
    if not value:
        return ''
    if len(value) <= visible_chars:
        return '*' * len(value)
    return value[:visible_chars] + '*' * (len(value) - visible_chars)


def is_valid_url(url: str) -> bool:
    """
    Check if a string is a valid URL.
    
    Args:
        url: URL string to validate
        
    Returns:
        True if valid URL
    """
    if not url:
        return False
    
    # Allow variable placeholders at start
    if url.startswith('{{'):
        return True
    
    pattern = re.compile(
        r'^https?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain
        r'localhost|'  # localhost
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # IP address
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    
    return bool(pattern.match(url))


def safe_json_loads(text: str, default: Any = None) -> Any:
    """
    Safely parse JSON, returning default on failure.
    
    Args:
        text: JSON string to parse
        default: Value to return on parse failure
        
    Returns:
        Parsed JSON or default value
    """
    if not text:
        return default
    
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return default


def truncate_string(text: str, max_length: int = 100, suffix: str = '...') -> str:
    """
    Truncate a string to a maximum length.
    
    Args:
        text: String to truncate
        max_length: Maximum length
        suffix: Suffix to add if truncated
        
    Returns:
        Truncated string
    """
    if not text or len(text) <= max_length:
        return text
    return text[:max_length - len(suffix)] + suffix


def get_encryption_key() -> bytes:
    """
    Get the encryption key from settings.
    
    Returns:
        Encryption key as bytes
    """
    key = getattr(settings, 'CREDENTIAL_ENCRYPTION_KEY', None)
    if key:
        if isinstance(key, str):
            return key.encode()
        return key
    
    # Generate a warning if no key is set
    import warnings
    warnings.warn(
        "CREDENTIAL_ENCRYPTION_KEY is not set in settings. "
        "Using a generated key which will change on restart.",
        RuntimeWarning
    )
    
    # Return a derived key from SECRET_KEY
    secret = getattr(settings, 'SECRET_KEY', 'fallback-key')
    return hashlib.sha256(secret.encode()).digest()


class Timer:
    """
    Simple context manager for timing code execution.
    
    Usage:
        with Timer() as t:
            # code to time
        print(f"Took {t.elapsed_ms}ms")
    """
    
    def __init__(self):
        self.start_time = None
        self.end_time = None
    
    def __enter__(self):
        self.start_time = timezone.now()
        return self
    
    def __exit__(self, *args):
        self.end_time = timezone.now()
    
    @property
    def elapsed(self) -> Optional[timedelta]:
        """Get elapsed time as timedelta."""
        if self.start_time and self.end_time:
            return self.end_time - self.start_time
        return None
    
    @property
    def elapsed_seconds(self) -> Optional[float]:
        """Get elapsed time in seconds."""
        elapsed = self.elapsed
        return elapsed.total_seconds() if elapsed else None
    
    @property
    def elapsed_ms(self) -> Optional[int]:
        """Get elapsed time in milliseconds."""
        seconds = self.elapsed_seconds
        return int(seconds * 1000) if seconds else None
