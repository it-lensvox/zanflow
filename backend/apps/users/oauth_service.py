"""
OAuth token verification service for Dyuksa.

Supports:
  - Google  : verifies the id_token returned by Google Sign-In / One-Tap
  - Microsoft: verifies the access_token returned by MSAL / Azure AD

Design decision
---------------
We deliberately do NOT use python-social-auth or allauth here.
Those libraries bring in extra DB tables and session-based flows that conflict
with our stateless JWT + multi-tenant (organisation/workspace) architecture.
Instead we do a lightweight token-exchange ourselves:

  1. Frontend completes OAuth with the provider.
  2. Frontend sends the provider's token to our backend.
  3. We verify it against the provider's public API / JWKS endpoint.
  4. We return our own JWT pair — exactly the same tokens the rest of the app uses.
"""

import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Google
# ---------------------------------------------------------------------------

GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo"


def verify_google_token(id_token: str) -> dict:
    """
    Verify a Google id_token and return the user's profile information.

    Returns a dict with keys:
        sub   – Google's unique user ID (stable, use this as social_uid)
        email – verified email address
        name  – full display name (may be empty)
        picture – profile-photo URL (may be empty)

    Raises ValueError on any verification failure.
    """
    try:
        resp = requests.get(
            GOOGLE_TOKEN_INFO_URL,
            params={"id_token": id_token},
            timeout=10,
        )
    except requests.RequestException as exc:
        logger.error("Google token verification network error: %s", exc)
        raise ValueError("Could not reach Google's verification endpoint. Please try again.")

    if resp.status_code != 200:
        logger.warning("Google token verification failed (HTTP %s): %s", resp.status_code, resp.text)
        raise ValueError("Invalid or expired Google token.")

    data = resp.json()

    # Google returns an 'error' key when the token is invalid
    if "error" in data:
        raise ValueError(f"Google token error: {data.get('error_description', data['error'])}")

    # Audience check: make sure the token was issued for OUR client
    google_client_id = getattr(settings, "GOOGLE_CLIENT_ID", None)
    if google_client_id and data.get("aud") != google_client_id:
        raise ValueError("Google token audience mismatch — token was not issued for this application.")

    # 'email_verified' can be the string "true" or a boolean True depending on the endpoint
    if str(data.get("email_verified", "false")).lower() != "true":
        raise ValueError("Google account email is not verified.")

    return {
        "sub": data["sub"],
        "email": data.get("email", ""),
        "name": data.get("name", ""),
        "picture": data.get("picture", ""),
    }


# ---------------------------------------------------------------------------
# Microsoft
# ---------------------------------------------------------------------------

MICROSOFT_GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me"


def verify_microsoft_token(access_token: str) -> dict:
    """
    Verify a Microsoft access_token by calling the Graph /me endpoint.

    Returns a dict with keys:
        sub   – Microsoft's unique object ID (stable, use this as social_uid)
        email – primary email address
        name  – display name (may be empty)

    Raises ValueError on any verification failure.
    """
    try:
        resp = requests.get(
            MICROSOFT_GRAPH_ME_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
    except requests.RequestException as exc:
        logger.error("Microsoft token verification network error: %s", exc)
        raise ValueError("Could not reach Microsoft's verification endpoint. Please try again.")

    if resp.status_code == 401:
        raise ValueError("Invalid or expired Microsoft token.")

    if resp.status_code != 200:
        logger.warning("Microsoft Graph /me failed (HTTP %s): %s", resp.status_code, resp.text)
        raise ValueError("Microsoft token verification failed.")

    data = resp.json()

    # 'id' is the user's Azure AD object ID — globally unique per tenant
    uid = data.get("id") or data.get("objectId")
    if not uid:
        raise ValueError("Microsoft profile did not return a user ID.")

    # The primary email can live in different fields depending on the account type
    email = (
        data.get("mail")
        or data.get("userPrincipalName", "")
    )

    # userPrincipalName is sometimes an onmicrosoft.com address — try to
    # get the real email from otherMails if mail is missing
    if not email or email.endswith("onmicrosoft.com"):
        other_mails = data.get("otherMails", [])
        if other_mails:
            email = other_mails[0]

    return {
        "sub": uid,
        "email": email,
        "name": data.get("displayName", ""),
        "picture": "",  # Graph does NOT return photo URL in /me; skip for now
    }
