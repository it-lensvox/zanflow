# apps/users/auth.py
from django.conf import settings
from rest_framework import authentication
from rest_framework import exceptions
from django.contrib.auth import get_user_model

User = get_user_model()

class StaticTokenAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        # Look for 'X-Static-Token' in headers
        static_token = request.META.get('HTTP_X_STATIC_TOKEN')
        
        # Get the secret key from settings
        expected_token = getattr(settings, 'STATIC_API_TOKEN', None)

        if not static_token or not expected_token:
            return None  # Fall back to other auth methods (like JWT)

        if static_token == expected_token:
            # For testing, we usually associate this with an admin or test user
            try:
                # Replace 'admin' with the username of your test account
                user = User.objects.get(is_superuser=True) 
                return (user, None)
            except User.DoesNotExist:
                raise exceptions.AuthenticationFailed('Static token user not found')

        raise exceptions.AuthenticationFailed('Invalid Static Token')