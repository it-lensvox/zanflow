"""
WebSocket authentication middleware for Django Channels.

Provides JWT authentication for WebSocket connections.
Token can be passed via:
1. Query string: ws://host/ws/chat/?token=<jwt_token>
2. Subprotocol header (for browsers that support it)
"""
import logging
from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from channels.auth import AuthMiddlewareStack
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.conf import settings
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

logger = logging.getLogger(__name__)
User = get_user_model()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom middleware for JWT authentication in WebSocket connections.
    
    Extracts JWT token from query string and authenticates the user.
    Falls back to AnonymousUser if authentication fails.
    """

    def __init__(self, inner):
        super().__init__(inner)

    async def __call__(self, scope, receive, send):
        """
        Main middleware entry point.
        Extracts token, validates it, and attaches user to scope.
        """
        # Extract query string parameters
        query_string = scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)
        
        # Try to get token from query string
        token = None
        token_list = query_params.get('token', [])
        if token_list:
            token = token_list[0]
        
        # Authenticate user
        if token:
            scope['user'] = await self.get_user_from_token(token)
        else:
            # Check for static API token (for service-to-service communication)
            static_token_list = query_params.get('api_token', [])
            if static_token_list and settings.STATIC_API_TOKEN:
                if static_token_list[0] == settings.STATIC_API_TOKEN:
                    # For static token, we might want to use a service user
                    # For now, set as anonymous but mark as authenticated
                    scope['user'] = AnonymousUser()
                    scope['is_api_authenticated'] = True
                else:
                    scope['user'] = AnonymousUser()
            else:
                scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_user_from_token(self, token):
        """
        Validate JWT token and return the associated user.
        
        Args:
            token: JWT access token string
            
        Returns:
            User instance if valid, AnonymousUser otherwise
        """
        try:
            # Validate the access token
            access_token = AccessToken(token)
            
            # Get user ID from token payload
            user_id = access_token.get('user_id')
            
            if user_id is None:
                logger.warning("JWT token missing user_id claim")
                return AnonymousUser()
            
            # Fetch user from PM DB via central_user_id
            # JWT carries Central's user_id — resolve via central_user_id field
            # NOT User.objects.get(id=user_id) — that would use PM local id
            try:
                user = User.objects.get(central_user_id=user_id)
            except User.DoesNotExist:
                logger.warning(
                    f"WebSocket: Central user_id={user_id} has no PM mirror. "
                    f"Webhook may not have fired yet."
                )
                return AnonymousUser()

            # Check if user is active
            if not user.is_active:
                logger.warning(
                    f"Inactive user attempted WebSocket connection: "
                    f"central_user_id={user_id} pm_id={user.id}"
                )
                return AnonymousUser()
            
            logger.debug(f"WebSocket authenticated user: {user.username}")
            return user
            
        except (InvalidToken, TokenError) as e:
            logger.warning(f"Invalid JWT token for WebSocket: {str(e)}")
            return AnonymousUser()
        except User.DoesNotExist:
            logger.warning(f"User not found for JWT token")
            return AnonymousUser()
        except Exception as e:
            logger.error(f"Unexpected error in JWT WebSocket auth: {str(e)}")
            return AnonymousUser()


class TokenAuthMiddleware(BaseMiddleware):
    """
    Alternative token auth that also checks headers.
    Useful for clients that can set custom headers.
    """

    async def __call__(self, scope, receive, send):
        # Check headers for token
        headers = dict(scope.get('headers', []))
        auth_header = headers.get(b'authorization', b'').decode('utf-8')
        
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]  # Remove 'Bearer ' prefix
            scope['user'] = await self.get_user_from_token(token)
        else:
            # Fall back to query string
            query_string = scope.get('query_string', b'').decode('utf-8')
            query_params = parse_qs(query_string)
            token_list = query_params.get('token', [])
            
            if token_list:
                scope['user'] = await self.get_user_from_token(token_list[0])
            else:
                scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_user_from_token(self, token):
        """Validate token and return user."""
        try:
            access_token = AccessToken(token)
            user_id = access_token.get('user_id')
            
            if user_id is None:
                return AnonymousUser()
            
            user = User.objects.get(id=user_id)
            return user if user.is_active else AnonymousUser()
            
        except (InvalidToken, TokenError, User.DoesNotExist):
            return AnonymousUser()
        except Exception as e:
            logger.error(f"Token auth error: {str(e)}")
            return AnonymousUser()


def JWTAuthMiddlewareStack(inner):
    """
    Convenience function to wrap the ASGI application with JWT auth.
    
    Usage in asgi.py:
        application = JWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns))
    """
    return JWTAuthMiddleware(AuthMiddlewareStack(inner))