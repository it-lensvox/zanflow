"""
Tenant context management using thread-local storage.

This module provides a thread-safe mechanism to store and retrieve the current
organization_id during a request-response cycle. This is the backbone of the
multi-tenant data isolation strategy.

Usage:
    # Set context (typically done by TenantMiddleware)
    set_current_organization(org_id)

    # Get context (used by TenantManager in querysets)
    org_id = get_current_organization()

    # Clear context (done by TenantMiddleware after response)
    clear_current_organization()
"""

import threading

_thread_locals = threading.local()


def set_current_organization(organization_id: int | None) -> None:
    """Store the current organization ID in thread-local storage."""
    _thread_locals.organization_id = organization_id


def get_current_organization() -> int | None:
    """Retrieve the current organization ID from thread-local storage."""
    return getattr(_thread_locals, "organization_id", None)


def clear_current_organization() -> None:
    """Clear the organization context to prevent data leakage between requests."""
    _thread_locals.organization_id = None
