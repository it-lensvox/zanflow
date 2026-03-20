"""
Custom throttle for global signup rate limiting.

Limits the total number of signups across the ENTIRE platform per day,
regardless of IP address. Uses Django cache to track the count.

Usage:
    Set in settings.py:
        SIGNUP_DAILY_LIMIT = 3  # max signups per day
"""

from django.core.cache import cache
from django.conf import settings
from rest_framework.throttling import BaseThrottle


class GlobalSignupDailyThrottle(BaseThrottle):
    """
    Allows only N total signups per day across the entire platform.
    N is configured via settings.SIGNUP_DAILY_LIMIT (default: 3).

    Uses Django's cache backend to store the counter.
    The counter resets automatically after 24 hours.
    """

    CACHE_KEY = "global_signup_count"
    CACHE_TIMEOUT = 86400  # 24 hours in seconds

    def get_daily_limit(self):
        return getattr(settings, "SIGNUP_DAILY_LIMIT", 3)

    def allow_request(self, request, view):
        # Only throttle POST requests (actual signups)
        if request.method != "POST":
            return True

        limit = self.get_daily_limit()
        current_count = cache.get(self.CACHE_KEY, 0)

        if current_count >= limit:
            self.wait_time = cache.ttl(self.CACHE_KEY) if hasattr(cache, "ttl") else self.CACHE_TIMEOUT
            return False

        # Increment the counter
        if current_count == 0:
            # First signup of the day — set with expiry
            cache.set(self.CACHE_KEY, 1, self.CACHE_TIMEOUT)
        else:
            # Increment without resetting the expiry
            try:
                cache.incr(self.CACHE_KEY)
            except ValueError:
                cache.set(self.CACHE_KEY, 1, self.CACHE_TIMEOUT)

        return True

    def wait(self):
        """Return seconds until the throttle resets."""
        remaining = cache.ttl(self.CACHE_KEY) if hasattr(cache, "ttl") else None
        if remaining:
            return remaining
        return self.CACHE_TIMEOUT