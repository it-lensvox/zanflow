"""
Services module for API Testing Platform.

Provides business logic layer for:
- API execution
- Credential management
- Result processing
"""
from .executor import APIExecutionService, api_executor, ExecutionContext

__all__ = [
    'APIExecutionService',
    'api_executor',
    'ExecutionContext',
]
