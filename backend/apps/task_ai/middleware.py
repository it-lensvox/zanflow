from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from apps.users.models import User # Adjust import if needed

@database_sync_to_async
def get_user(token_key):
    try:
        # Decode the JWT token
        access_token = AccessToken(token_key)
        user_id = access_token['user_id']
        return User.objects.get(id=user_id)
    except Exception:
        return AnonymousUser()

class JWTAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        # 1. Grab the query string from the WebSocket connection
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        
        # 2. Extract the token from the '?token=' parameter
        token = query_params.get('token')

        if token:
            # 3. If a token exists, authenticate the user
            scope['user'] = await get_user(token[0])
        else:
            scope['user'] = AnonymousUser()

        return await self.inner(scope, receive, send)