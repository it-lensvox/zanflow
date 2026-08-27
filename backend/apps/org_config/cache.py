"""
apps/org_config/cache.py

Redis cache layer for org config JSON.

Cache key pattern:  config:{org_slug}:{platform}
TTL:                5 minutes (configurable via DYUKSA_CONFIG_CACHE_TTL_SECONDS)

Uses Django's existing Redis CACHES["default"] — no new Redis setup needed.

Usage:
    from apps.org_config.cache import get_cached_config, set_cached_config, clear_cached_config

    config = get_cached_config("lensvox", "pm")   # None on miss
    set_cached_config("lensvox", "pm", config)    # stores with TTL
    clear_cached_config("lensvox", "pm")          # manual invalidation
"""

import json
import logging

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

# Default TTL: 5 minutes
_DEFAULT_TTL = 300


def _ttl() -> int:
    return getattr(settings, "DYUKSA_CONFIG_CACHE_TTL_SECONDS", _DEFAULT_TTL)


def _key(org_slug: str, platform: str) -> str:
    """Return Redis cache key for an org+platform config."""
    return f"config:{org_slug}:{platform}"


# ── Public API ─────────────────────────────────────────────────────────────────

def get_cached_config(org_slug: str, platform: str) -> dict | None:
    """
    Return cached config dict for org+platform, or None on cache miss.

    Never raises — cache failures return None (caller falls back to S3).
    """
    key = _key(org_slug, platform)
    try:
        raw = cache.get(key)
        if raw is None:
            return None
        return json.loads(raw) if isinstance(raw, str) else raw
    except Exception as e:
        logger.warning("OrgConfig cache GET failed for %s: %s", key, e)
        return None


def set_cached_config(org_slug: str, platform: str, config: dict) -> None:
    """
    Store config dict in Redis with TTL.

    Never raises — cache failures are logged and ignored.
    S3 is always the source of truth.
    """
    key = _key(org_slug, platform)
    try:
        cache.set(key, json.dumps(config), timeout=_ttl())
        logger.debug("OrgConfig cached: %s (TTL=%ds)", key, _ttl())
    except Exception as e:
        logger.warning("OrgConfig cache SET failed for %s: %s", key, e)


def clear_cached_config(org_slug: str, platform: str) -> None:
    """
    Invalidate the Redis cache for an org+platform config.

    Called by Central when an admin updates role permissions.
    Next request will fetch fresh config from S3.

    Never raises — cache failures are logged and ignored.
    """
    key = _key(org_slug, platform)
    try:
        cache.delete(key)
        logger.info("OrgConfig cache cleared: %s", key)
    except Exception as e:
        logger.warning("OrgConfig cache CLEAR failed for %s: %s", key, e)


def clear_all_org_configs(org_slug: str) -> None:
    """
    Invalidate ALL platform configs for an org.

    Used when an org is deactivated or slug changes (rare).
    Iterates known platforms — no Redis key scanning needed.
    """
    from apps.organizations.models import Platform
    try:
        platforms = Platform.objects.values_list("key", flat=True)
    except Exception:
        platforms = ["pm", "hrms", "crm", "ims"]

    for platform in platforms:
        clear_cached_config(org_slug, platform)
