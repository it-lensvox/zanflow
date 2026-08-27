"""
apps/org_config/services.py  (PM Backend — READ ONLY)

Reads org config from S3/Redis.
PM backend only READS config — Central writes it.

Usage in PM views:
    from apps.org_config.services import check_permission, get_org_config

    # Check if user's role has a permission
    if not check_permission(request, "task:create"):
        return Response({"detail": "Permission denied."}, status=403)

    # Get full config (rarely needed)
    config = get_org_config(request)
"""

import logging

from .cache     import get_cached_config, set_cached_config
from .s3_client import get_config, OrgConfigS3Error

logger = logging.getLogger(__name__)


# ── Core: get org config ───────────────────────────────────────────────────────

def get_org_config(request=None, org_slug: str = None, platform: str = "pm") -> dict | None:
    """
    Get org config from Redis (fast) or S3 (fallback).

    Args:
        request:  DRF request object — used to extract org_slug automatically
        org_slug: Override — pass directly instead of extracting from request
        platform: Product key — always "pm" in PM backend

    Returns:
        dict — org config JSON
        None — if not found (org has no config yet)

    Never raises — returns None on any failure.
    """
    # Extract org_slug from request if not provided
    if not org_slug and request:
        org_slug = _get_org_slug(request)

    if not org_slug:
        logger.warning("OrgConfig: cannot determine org_slug from request")
        return None

    # Step 1: Redis cache
    cached = get_cached_config(org_slug, platform)
    if cached is not None:
        return cached

    # Step 2: S3 fallback
    try:
        config = get_config(org_slug, platform)
        set_cached_config(org_slug, platform, config)
        logger.info(
            "OrgConfig cache miss → fetched from S3: org=%s platform=%s",
            org_slug, platform
        )
        return config
    except OrgConfigS3Error as e:
        logger.warning(
            "OrgConfig not found in S3: org=%s platform=%s — %s",
            org_slug, platform, e
        )
        return None


# ── Core: check permission ────────────────────────────────────────────────────

def check_permission(
    request,
    permission_code: str,
    platform: str = "pm",
) -> bool:
    """
    Check if the logged-in user's platform role has a specific permission.

    Reads from Redis/S3 org config — fully dynamic.

    Args:
        request:         DRF request with authenticated user + JWT claims
        permission_code: e.g. "task:create", "project:delete"
        platform:        always "pm" in PM backend

    Returns:
        True  — permission granted
        False — permission denied or config not found

    Usage:
        if not check_permission(request, "task:create"):
            return Response({"detail": "Permission denied."}, status=403)

    IMPORTANT:
        Falls back to True if org config not found in S3.
        This prevents locking out orgs whose config was not generated yet.
        Change FALLBACK_ALLOW to False for stricter enforcement.
    """
    FALLBACK_ALLOW = True  # Allow if config not found — safe default

    # Get user's PM role from JWT platform_roles
    role_code = _get_pm_role(request)
    if not role_code:
        logger.debug(
            "OrgConfig check_permission: no PM role in JWT for user %s",
            getattr(request.user, "id", "?")
        )
        return FALLBACK_ALLOW

    # Get org slug
    org_slug = _get_org_slug(request)
    if not org_slug:
        return FALLBACK_ALLOW

    # Get config
    config = get_org_config(org_slug=org_slug, platform=platform)
    if not config:
        logger.warning(
            "OrgConfig: config not found for org=%s — allowing (fallback)",
            org_slug
        )
        return FALLBACK_ALLOW

    # Check permission
    roles = config.get("roles", {})
    role  = roles.get(role_code)
    if not role:
        logger.debug(
            "OrgConfig: role '%s' not in config for org=%s — allowing (fallback)",
            role_code, org_slug
        )
        return FALLBACK_ALLOW

    has_perm = permission_code in role.get("permissions", [])
    if not has_perm:
        logger.info(
            "OrgConfig: DENIED — org=%s role=%s permission=%s",
            org_slug, role_code, permission_code
        )
    return has_perm


def check_permission_strict(
    request,
    permission_code: str,
    platform: str = "pm",
) -> bool:
    """
    Same as check_permission but returns False if config not found.
    Use this for sensitive operations (delete, approve etc.)
    """
    role_code = _get_pm_role(request)
    org_slug  = _get_org_slug(request)

    if not role_code or not org_slug:
        return False

    config = get_org_config(org_slug=org_slug, platform=platform)
    if not config:
        return False

    roles = config.get("roles", {})
    role  = roles.get(role_code)
    if not role:
        return False

    return permission_code in role.get("permissions", [])


# ── DRF Permission Class ───────────────────────────────────────────────────────

def make_permission_class(permission_code: str, strict: bool = False):
    """
    Create a DRF permission class for a specific permission code.

    Usage:
        class TaskCreateView(APIView):
            permission_classes = [
                IsAuthenticated,
                make_permission_class("task:create"),
            ]

    Args:
        permission_code: e.g. "task:create"
        strict:          if True, denies when config not found
    """
    from rest_framework.permissions import BasePermission

    class OrgConfigPermission(BasePermission):
        message = f"Permission denied: {permission_code} required."

        def has_permission(self, request, view):
            if not request.user or not request.user.is_authenticated:
                return False
            fn = check_permission_strict if strict else check_permission
            return fn(request, permission_code)

    OrgConfigPermission.__name__ = (
        f"OrgConfigPermission_{permission_code.replace(':', '_')}"
    )
    return OrgConfigPermission


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_org_slug(request) -> str | None:
    """
    Extract org_slug from the request.

    Priority:
      1. request.org_slug (set by middleware if configured)
      2. request.user.organization.slug (from PM DB)
      3. None
    """
    # From middleware (fastest)
    slug = getattr(request, "org_slug", None)
    if slug:
        return slug

    # From user's organisation
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        org = getattr(user, "organization", None)
        if org:
            return getattr(org, "slug", None)

    return None


def _get_pm_role(request) -> str | None:
    """
    Get user's PM role from JWT platform_roles claim.

    JWT carries: platform_roles = {"pm": "project_member", "hrms": "employee"}
    We read platform_roles.pm → "project_member"
    """
    # Try from token directly
    token = getattr(request, "auth", None)
    if token:
        platform_roles = token.get("platform_roles", {})
        pm_role = platform_roles.get("pm")
        if pm_role:
            return pm_role

    # Fallback: from user.role (legacy field)
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        return getattr(user, "role", None)

    return None