"""
Views for Users app.
"""
from django.contrib.auth import get_user_model
from django.template.loader import render_to_string
from rest_framework import generics, permissions, status, permissions
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from django.shortcuts import get_object_or_404
from .serializers import UserRoleUpdateSerializer, ContactMessageSerializer
from .serializers import UserCreateSerializer, UserSerializer, VerifyOTPSerializer, ForgotPasswordSerializer, SetNewPasswordSerializer, AuthenticatedResetPasswordSerializer, SendInvitationSerializer, AcceptInvitationSerializer
import random
import uuid
from django.core.mail import send_mail,EmailMultiAlternatives
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from .models import PasswordResetOTP, Invitation, ContactMessage
from apps.organizations.models import WorkspaceMembership
User = get_user_model()

class WorkspaceSafeTokenRefreshView(TokenRefreshView):
    """
    Custom refresh view that bypasses global workspace authentication checks.
    The refresh token payload is sufficient for this specific endpoint.
    """
    authentication_classes = []  


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/

    Blacklists the supplied refresh token so it can no longer be used
    to obtain new access tokens.  The mobile/web client should discard
    both tokens from local storage after calling this endpoint.

    Request body:
        { "refresh": "<refresh_token>" }

    Returns 205 Reset Content on success (signals the client to clear state).
    Returns 400 if the token is missing, already blacklisted, or invalid.

    Authentication: not required — the refresh token itself is the credential.
    This mirrors the behaviour of TokenRefreshView (no JWT auth needed).
    """

    authentication_classes = []          # refresh token is the credential
    permission_classes     = [permissions.AllowAny]

    def post(self, request):
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework_simplejwt.exceptions import TokenError

        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(status=status.HTTP_205_RESET_CONTENT)


class RegisterView(generics.CreateAPIView):
    """
    Register a new user.
    """
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [permissions.AllowAny]

class IsAdminRole(permissions.BasePermission):
    """
    Allows access only to users with the 'admin' role.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')

class UserCreateView(generics.CreateAPIView):
    """
    Admin-only view to create new users/employees.
    Auto-assigns the new user to the creator's organization and active workspace.
    """
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [IsAdminRole]

    def perform_create(self, serializer):
        # 1. Save the user to the database and attach to the organization
        new_user = serializer.save(organization=self.request.user.organization)

        # 2. Grab the active workspace ID from the frontend's request headers
        workspace_id = self.request.META.get("HTTP_X_WORKSPACE_ID")

        # 3. If a workspace ID was sent, auto-assign the user to it
        if workspace_id:
            from apps.organizations.models import WorkspaceMembership
            try:
                WorkspaceMembership.objects.get_or_create(
                    user=new_user,
                    workspace_id=workspace_id,
                    # FIX: Use the role assigned to the user instead of "member"
                    defaults={"role": new_user.role} 
                )
            except Exception:
                pass

class MeView(APIView):
    """
    Get current user profile.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    
    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

class IsAdminRole(permissions.BasePermission):
    """
    Allows access only to users with the 'admin' role.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')
class UserListView(generics.ListAPIView):
    """
    List all users (for assignments, etc.)
    If X-Workspace-ID header is present, returns only workspace members.
    Otherwise falls back to all users in the organization.
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["username", "email", "first_name", "last_name"]

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.filter(is_active=True)

        # Check for workspace header
        workspace_id = self.request.META.get("HTTP_X_WORKSPACE_ID")
        if workspace_id:
            from apps.organizations.models import WorkspaceMembership
            try:
                workspace_id = int(workspace_id)
                member_user_ids = WorkspaceMembership.objects.filter(
                    workspace_id=workspace_id,
                    workspace__organization_id=user.organization_id,
                ).values_list('user_id', flat=True)
                return qs.filter(id__in=member_user_ids)
            except (ValueError, TypeError):
                pass

        # Fallback: scope to organization
        if user.organization_id:
            qs = qs.filter(organization_id=user.organization_id)
        return qs

class ChangeUserRoleView(APIView):
    """
    Endpoint to change a user's role with strict hierarchy rules.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id):
        user = request.user
        # Only allow changing roles for users in the same organization
        qs = User.objects.all()
        if user.organization_id:
            qs = qs.filter(organization_id=user.organization_id)
        target_user = get_object_or_404(qs, id=user_id)
        new_role = request.data.get('role')

        # 1. SECURITY: Prevent any user from changing their own role
        if user.id == target_user.id:
            return Response(
                {"detail": "You cannot change your own role."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. MANAGER RESTRICTIONS
        if user.role == User.Role.MANAGER:
            # A. Prevent Managers from touching Admins or other Managers
            if target_user.role in [User.Role.ADMIN, User.Role.MANAGER]:
                return Response(
                    {"detail": "Managers cannot change roles for Admins or other Managers."},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # B. Limit allowed role transitions (Rule 6 implemented here)
            # --> Added User.Role.DEVELOPER to allowed assignments
            allowed_manager_roles = [User.Role.ANNOTATOR, User.Role.VIEWER, User.Role.DEVELOPER]
            if new_role not in allowed_manager_roles:
                return Response(
                    {"detail": "Managers can only assign Developer, Annotator or Viewer roles."},
                    status=status.HTTP_403_FORBIDDEN
                )

        # 3. ADMIN CHECK: If not Admin and failed Manager check, deny access (Rule 2 implemented here)
        elif user.role != User.Role.ADMIN:
            return Response(
                {"detail": "Only Admins and Managers can change user roles."},
                status=status.HTTP_403_FORBIDDEN
            )

        # 4. PERFORM UPDATE
        serializer = UserRoleUpdateSerializer(target_user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                "message": f"Role for {target_user.username} updated to {new_role}",
                "user": serializer.data
            }, status=status.HTTP_200_OK)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
class UserDeleteView(generics.DestroyAPIView):
    """
    Admin-only view to delete a user.
    Scoped to the current user's organization.
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'id'

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.all()
        if user.organization_id:
            qs = qs.filter(organization_id=user.organization_id)
        return qs

    def delete(self, request, *args, **kwargs):
        user_to_delete = self.get_object()
        
        # Security check: Prevent self-deletion
        if request.user.id == user_to_delete.id:
            return Response(
                {"detail": "You cannot delete your own admin account."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        return super().delete(request, *args, **kwargs)
    
class ForgotPasswordView(APIView):
    """Step 1: Send OTP to Email"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        
        user = User.objects.filter(email=email).first()
        if user:
            # Generate 4-digit OTP
            otp = str(random.randint(1000, 9999))
            expiry = timezone.now() + timedelta(minutes=10)
            
            # Delete old OTPs for this user and save new one
            PasswordResetOTP.objects.filter(user=user).delete()
            PasswordResetOTP.objects.create(
                user=user,
                otp_hash=PasswordResetOTP.hash_otp(otp),
                expires_at=expiry
            )

            # Send Email
            send_mail(
                'Your Password Reset OTP',
                f'Your OTP is {otp}. It expires in 10 minutes.',
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
            )

        # Return 200 regardless of user existence for security (prevent email enumeration)
        return Response({"detail": "If this email is registered, an OTP has been sent."}, status=status.HTTP_200_OK)

class VerifyOTPView(APIView):
    """Step 2: Verify OTP and return a temporary reset token"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        otp = serializer.validated_data['otp']
        hashed_otp = PasswordResetOTP.hash_otp(otp)

        otp_record = PasswordResetOTP.objects.filter(
            user__email=email, 
            otp_hash=hashed_otp
        ).first()

        if not otp_record or otp_record.is_expired():
            return Response({"detail": "Invalid or expired OTP."}, status=status.HTTP_400_BAD_REQUEST)

        # OTP is valid: mark as verified and generate a unique temporary token
        otp_record.is_verified = True
        reset_token = str(uuid.uuid4())
        otp_record.token = reset_token  # Ensure you've added this field to your model
        otp_record.save()

        return Response({
            "detail": "OTP verified. Use the reset_token to set a new password.",
            "reset_token": reset_token
        }, status=status.HTTP_200_OK)

class SetNewPasswordView(APIView):
    """Step 3: Update password using verified reset_token"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SetNewPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        reset_token = serializer.validated_data['reset_token'] # Match serializer field

        # Query using the token instead of the otp
        otp_record = PasswordResetOTP.objects.filter(
            user__email=email, 
            token=reset_token, # This field must exist in your model
            is_verified=True
        ).first()

        if not otp_record or otp_record.is_expired():
            return Response({"detail": "Invalid or expired reset token."}, status=status.HTTP_400_BAD_REQUEST)

        # Update the user's password
        user = otp_record.user
        user.set_password(serializer.validated_data['password'])
        user.save()
        
        # Burn the record so it can't be used again
        otp_record.delete()
        
        return Response({"detail": "Password has been reset successfully."}, status=status.HTTP_200_OK)

class AuthenticatedResetPasswordView(APIView):
    """
    Reset password for logged-in users.
    No OTP required. Requires username, old password, and new password.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = AuthenticatedResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        validated_data = serializer.validated_data

        # 1. Security Check: Verify the username matches the authenticated user
        if user.username != validated_data['username']:
            return Response(
                {"detail": "Username does not match the authenticated session."}, 
                status=status.HTTP_403_FORBIDDEN
            )

        # 2. Verify old password
        if not user.check_password(validated_data['old_password']):
            return Response(
                {"old_password": ["Incorrect old password."]}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Update to the new hashed password
        user.set_password(validated_data['new_password'])
        user.save()

        return Response(
            {"detail": "Password has been updated successfully."}, 
            status=status.HTTP_200_OK
        )
    
class SendInvitationView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request):
        serializer = SendInvitationSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        role = serializer.validated_data['role']
        workspace_id = serializer.validated_data.get('workspace_id')

        if User.objects.filter(email=email).exists():
            return Response(
                {"detail": "A user with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Resolve workspace if provided
        workspace = None
        if workspace_id:
            from apps.organizations.models import Workspace
            workspace = Workspace.objects.filter(
                id=workspace_id,
                organization=request.user.organization,
                is_active=True,
            ).first()

        invitation = Invitation.objects.create(
            email=email,
            role=role,
            organization=request.user.organization,
            workspace=workspace,
        )

        # Build invite link
        frontend_url = settings.FRONTEND_URL
        invite_link = f"{frontend_url}/setup-account?token={invitation.token}"

        # Email context
        context = {
            'email': email,
            'role': role,
            'invite_link': invite_link,
            'workspace_name': workspace.name if workspace else None,
        }

        html_content = render_to_string('dyuksa.html', context)
        text_content = (
            f"You have been invited to join DYUKSA as a {role}"
            + (f" in the '{workspace.name}' workspace" if workspace else "")
            + f". Click here to set up your account: {invite_link}. This link expires in 12 hours."
        )

        subject = "You've been invited to join DYUKSA"
        msg = EmailMultiAlternatives(
            subject,
            text_content,
            settings.DEFAULT_FROM_EMAIL,
            [email]
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()

        return Response({
            "detail": "Invitation sent successfully.",
            "workspace": workspace.name if workspace else "Default workspace",
        }, status=status.HTTP_200_OK)

class VerifyInvitationTokenView(APIView):
    """
    Public endpoint for the frontend to check if a token is valid on page load.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        invitation = get_object_or_404(Invitation, token=token)
        
        if not invitation.is_valid:
            return Response({"detail": "This invitation link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({
            "email": invitation.email,
            "role": invitation.role
        }, status=status.HTTP_200_OK)


class AcceptInvitationView(APIView):
    """
    Public endpoint to complete registration using the valid token.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        token = serializer.validated_data['token']
        invitation = get_object_or_404(Invitation, token=token)

        # Re-verify token validity right before creation
        if not invitation.is_valid:
            return Response({"detail": "This invitation link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)

        # Create the new user
        user = User.objects.create(
            username=serializer.validated_data['username'],
            email=invitation.email,       # Take directly from DB, not user input
            role=invitation.role,         # Take directly from DB, not user input
            organization=invitation.organization, # Assign to correct tenant
            first_name=serializer.validated_data.get('first_name', ''),
            last_name=serializer.validated_data.get('last_name', '')
        )
        user.set_password(serializer.validated_data['password'])
        user.save()

        # Workspace assignment:
        # - No workspace in invitation → add to DEFAULT workspace only
        # - Workspace in invitation → add to THAT workspace only (not default)
        # Workspace assignment:
        # - No workspace in invitation → add to DEFAULT workspace only
        # - Workspace in invitation → add to THAT workspace only (not default)
        from apps.organizations.models import Workspace, WorkspaceMembership

        if invitation.workspace:
            # Admin specified a workspace → add to that workspace ONLY
            WorkspaceMembership.objects.get_or_create(
                user=user,
                workspace=invitation.workspace,
                # FIX: Use the user's actual role
                defaults={"role": user.role},
            )
        else:
            # No workspace specified → add to default workspace
            default_ws = Workspace.objects.filter(
                organization=invitation.organization,
                is_default=True,
            ).first()
            if default_ws:
                WorkspaceMembership.objects.get_or_create(
                    user=user,
                    workspace=default_ws,
                    # FIX: Use the user's actual role
                    defaults={"role": user.role},
                )

        # Burn the invitation token so it can't be used again
        invitation.is_used = True
        invitation.save()

        # PLATFORM_SEPARATION — assign RBAC roles for products in invite link
        from apps.organizations.services import EmployeeOnboardingService
        products = [p.strip() for p in request.data.get("products", "hrms").split(",") if p.strip()]
        EmployeeOnboardingService.on_invite_accepted(user=user, products=products)
        # END PLATFORM_SEPARATION

        return Response({"detail": "Account setup successful. You can now log in."}, status=status.HTTP_201_CREATED)
    
class ContactUsView(APIView):
    """
    Public endpoint for the Dyuksa landing page contact form.
    Requires no authentication. Emails superusers upon submission.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ContactMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # 1. Save the record to the database
        contact_message = serializer.save()

        # 2. Fetch all active superusers
        superuser_emails = list(
            User.objects.filter(is_superuser=True, is_active=True)
            .exclude(email='')
            .values_list('email', flat=True)
        )

        # 3. Send email via AWS SES if superusers exist
        if superuser_emails:
            subject = f"New Contact Submission on {contact_message.source or 'Unknown Platform'} from {contact_message.name}"
            
            # You can also use render_to_string here if you want a beautiful HTML email like your invitations
            text_content = f"""
Name: {contact_message.name}
Email: {contact_message.email}
Company: {contact_message.company or 'Not provided'}

Problem / Message:
{contact_message.problem}
            """
            
            send_mail(
                subject=subject,
                message=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=superuser_emails,
                fail_silently=False, 
            )

        return Response(
            {"detail": "Thank you! Your message has been sent successfully."}, 
            status=status.HTTP_201_CREATED
        )

# =============================================================================
# SOCIAL / OAUTH AUTHENTICATION
# =============================================================================

class SocialAuthView(APIView):
    """
    Unified social auth endpoint for Google and Microsoft OAuth.

    POST /api/users/social-auth/

    Request body - two use-cases:

    1. Existing-user sign-in (the user already has an account in Dyuksa):
       {
           "provider": "google" | "microsoft",
           "token":    "<id_token from Google  OR  access_token from Microsoft>"
       }

    2. NEW organisation signup via OAuth (replaces the normal email+password
       TenantSignupView when the company wants to sign up with Google/Microsoft):
       {
           "provider":      "google" | "microsoft",
           "token":         "<provider token>",
           "company_name":  "Acme Corp"
       }

    All existing functionality (normal email/password login, invitations,
    workspace middleware, etc.) is completely unchanged.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.users.oauth_service import verify_google_token, verify_microsoft_token

        provider = request.data.get("provider", "").lower().strip()
        token = request.data.get("token", "").strip()
        company_name = request.data.get("company_name", "").strip()

        # 1. Basic validation
        if provider not in ("google", "microsoft"):
            return Response(
                {"detail": "provider must be 'google' or 'microsoft'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not token:
            return Response(
                {"detail": "token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Verify token with the provider
        try:
            if provider == "google":
                profile = verify_google_token(token)
            else:
                profile = verify_microsoft_token(token)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_401_UNAUTHORIZED)

        social_uid = profile["sub"]
        email = profile["email"].lower()
        display_name = profile.get("name", "")

        if not email:
            return Response(
                {"detail": "Your OAuth account did not return a verified email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Route to signup or sign-in
        if company_name:
            return self._handle_oauth_signup(
                request, provider, social_uid, email, display_name, company_name
            )
        return self._handle_oauth_signin(
            request, provider, social_uid, email, display_name
        )

    # ------------------------------------------------------------------
    # Sign-in: user already has a Dyuksa account
    # ------------------------------------------------------------------
    def _handle_oauth_signin(self, request, provider, social_uid, email, display_name):
        from rest_framework_simplejwt.tokens import RefreshToken

        # Look up by social_uid first (most accurate)
        user = User.objects.filter(auth_provider=provider, social_uid=social_uid).first()

        if not user:
            # Fallback: email match — handles invited users signing in via SSO
            # for the first time (their account was created without social_uid)
            user = User.objects.filter(email__iexact=email).first()
            if user:
                # Link OAuth identity to the existing account going forward
                user.auth_provider = provider
                user.social_uid = social_uid
                user.save(update_fields=["auth_provider", "social_uid"])

        if not user:
            return Response(
                {
                    "detail": (
                        "No Dyuksa account found for this email. "
                        "Please sign up or ask your organisation admin to invite you."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user.is_active:
            return Response(
                {"detail": "Your account has been deactivated. Contact your admin."},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "message": "Login successful.",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "role": user.role,
                    "auth_provider": user.auth_provider,
                },
                "tokens": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                },
            },
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # Signup: create a brand-new organisation via OAuth
    # ------------------------------------------------------------------
    def _handle_oauth_signup(self, request, provider, social_uid, email, display_name, company_name):
        from rest_framework_simplejwt.tokens import RefreshToken
        from django.utils.text import slugify
        from apps.organizations.models import Organization
        from apps.organizations.services import TenantOnboardingService
        import secrets as _secrets

        if Organization.objects.filter(name__iexact=company_name.strip()).exists():
            return Response(
                {"detail": "An organisation with this name already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email__iexact=email).exists():
            return Response(
                {
                    "detail": (
                        "A Dyuksa account already exists for this email. "
                        "Please log in instead."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Derive a unique username from the email local-part
        base = slugify(email.split("@")[0] or display_name or "user").replace("-", "_")
        admin_username = base
        suffix = 1
        while User.objects.filter(username=admin_username).exists():
            admin_username = f"{base}_{suffix}"
            suffix += 1

        # Create org + admin user via the existing service (keeps business logic DRY)
        # We pass a random unusable password — OAuth users never log in with a password
        unusable_pw = _secrets.token_hex(32)

        try:
            result = TenantOnboardingService.create_tenant(
                name=company_name.strip(),
                admin_username=admin_username,
                admin_email=email,
                admin_password=unusable_pw,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        org = result["organization"]
        admin_user = result["admin_user"]

        # Mark as OAuth user and disable local password login
        admin_user.auth_provider = provider
        admin_user.social_uid = social_uid
        if display_name and not admin_user.first_name:
            parts = display_name.split(" ", 1)
            admin_user.first_name = parts[0]
            admin_user.last_name = parts[1] if len(parts) > 1 else ""
        admin_user.set_unusable_password()
        admin_user.save(update_fields=["auth_provider", "social_uid", "first_name", "last_name", "password"])

        refresh = RefreshToken.for_user(admin_user)

        return Response(
            {
                "message": "Organisation created successfully via OAuth.",
                "organization": {
                    "id": org.id,
                    "name": org.name,
                    "slug": org.slug,
                },
                "user": {
                    "id": admin_user.id,
                    "username": admin_user.username,
                    "email": admin_user.email,
                    "role": admin_user.role,
                    "auth_provider": admin_user.auth_provider,
                },
                "tokens": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                },
            },
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────────────────────
# PLATFORM ONBOARDING VIEWS                                  PLATFORM_SEPARATION
#
# When the Dyuksa codebase is separated, move these three views to the
# Central System project. The service layer (EmployeeOnboardingService in
# apps/organizations/services.py) moves with them.
# ─────────────────────────────────────────────────────────────────────────────

class InviteEmployeeView(APIView):  # PLATFORM_SEPARATION
    """
    POST /api/v1/auth/employees/invite/

    Product-aware invite. Same as SendInvitationView but also accepts
    a products list and validates it against the org's license.

    Payload:
    {
        "email":         "priya@lensvox.com",
        "products":      ["hrms", "pm"],
        "role":          "annotator",       (optional — PM role, default annotator)
        "designation":   "HR Manager",     (optional)
        "department_id": 3,                (optional — dept scope for HRMS)
        "workspace_id":  1                 (optional)
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.organizations.services import EmployeeOnboardingService

        if not _is_platform_admin(request.user):
            return Response(
                {"error": "Only Owner or Org Admin can invite employees."},
                status=status.HTTP_403_FORBIDDEN,
            )

        email         = request.data.get("email")
        products      = request.data.get("products", [])
        role          = request.data.get("role", "annotator")
        designation   = request.data.get("designation")
        department_id = request.data.get("department_id")
        workspace_id  = request.data.get("workspace_id")

        if not email:
            return Response({"error": "email is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not products or not isinstance(products, list):
            return Response(
                {"error": "products must be a list e.g. ['hrms', 'pm']"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = EmployeeOnboardingService.invite_employee(
                invited_by    = request.user,
                email         = email,
                products      = products,
                role          = role,
                workspace_id  = workspace_id,
                designation   = designation,
                department_id = department_id,
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"message": f"Invite sent to {email}.", **result},
            status=status.HTTP_201_CREATED,
        )


class CreateEmployeeView(APIView):  # PLATFORM_SEPARATION
    """
    POST /api/v1/auth/employees/create/

    Create employee directly. Account created immediately with temp password.
    Welcome email sent with credentials and product list.

    Payload:
    {
        "first_name":         "Priya",
        "last_name":          "Sharma",
        "email":              "priya@lensvox.com",
        "products":           ["hrms", "pm"],
        "role":               "annotator",    (optional)
        "designation":        "HR Manager",   (optional)
        "department_id":      3,              (optional)
        "workspace_id":       1,              (optional)
        "send_welcome_email": true            (optional, default true)
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.organizations.services import EmployeeOnboardingService

        if not _is_platform_admin(request.user):
            return Response(
                {"error": "Only Owner or Org Admin can create employees."},
                status=status.HTTP_403_FORBIDDEN,
            )

        email              = request.data.get("email")
        products           = request.data.get("products", [])
        first_name         = request.data.get("first_name", "")
        last_name          = request.data.get("last_name", "")
        role               = request.data.get("role", "annotator")
        designation        = request.data.get("designation")
        department_id      = request.data.get("department_id")
        workspace_id       = request.data.get("workspace_id")
        send_welcome_email = request.data.get("send_welcome_email", True)

        # Password — HR Admin sets directly, no temp password
        password         = request.data.get("password", "")
        password_confirm = request.data.get("password_confirm", "")

        # Per-product roles — e.g. {"hrms": "hr_admin", "pm": "project_viewer"}
        # If not provided, defaults to lowest role per product
        product_roles = request.data.get("product_roles", {})

        if not email:
            return Response({"error": "email is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not products or not isinstance(products, list):
            return Response(
                {"error": "products must be a list e.g. ['hrms', 'pm']"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not password:
            return Response({"error": "password is required."}, status=status.HTTP_400_BAD_REQUEST)
        if password != password_confirm:
            return Response({"error": "Passwords do not match."}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 8:
            return Response({"error": "Password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = EmployeeOnboardingService.create_employee(
                created_by         = request.user,
                first_name         = first_name,
                last_name          = last_name,
                email              = email,
                products           = products,
                password           = password,
                product_roles      = product_roles if product_roles else None,
                role               = role,
                designation        = designation,
                department_id      = department_id,
                workspace_id       = workspace_id,
                send_welcome_email = send_welcome_email,
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"message": "Employee created successfully.", **result},
            status=status.HTTP_201_CREATED,
        )


class OffboardEmployeeView(APIView):  # PLATFORM_SEPARATION
    """
    POST /api/v1/auth/employees/<id>/offboard/

    Process an employee exit. Revokes all product access on last working day.
    One call covers PM, HRMS, and CRM simultaneously.

    Payload:
    {
        "last_working_day": "2026-08-15"
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from apps.organizations.services import EmployeeOnboardingService
        from django.contrib.auth import get_user_model
        User = get_user_model()

        if not _is_platform_admin(request.user):
            return Response(
                {"error": "Only Owner or Org Admin can offboard employees."},
                status=status.HTTP_403_FORBIDDEN,
            )

        last_working_day = request.data.get("last_working_day")
        if not last_working_day:
            return Response(
                {"error": "last_working_day is required. Format: YYYY-MM-DD"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(pk=pk, organization=request.user.organization)
        except User.DoesNotExist:
            return Response(
                {"error": "Employee not found in your organisation."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.pk == request.user.pk:
            return Response(
                {"error": "You cannot offboard yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = EmployeeOnboardingService.offboard_employee(
                user             = user,
                last_working_day = last_working_day,
                offboarded_by    = request.user,
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_200_OK)


class LicensedProductsView(APIView):  # PLATFORM_SEPARATION
    """
    GET /api/v1/auth/products/

    Returns products the current org is licensed for.
    Used by the invite/create form to populate the product picker.

    Response:
    {
        "products": [
            {"key": "hrms", "name": "Human Resources", "is_active": true},
            {"key": "pm",   "name": "Project Management", "is_active": true}
        ]
    }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.organizations.models import PlatformAccess

        org = request.user.organization
        if not org:
            return Response({"products": []})

        accesses = PlatformAccess.objects.filter(
            organization        = org,
            is_active           = True,
            platform__is_active = True,
        ).select_related("platform").order_by("platform__key")

        from apps.rbac.models import Role

        products = []
        for a in accesses:
            # Get all available roles for this product sorted from lowest to highest
            roles = list(
                Role.objects.filter(
                    platform    = a.platform.key,
                    tenant_id   = None,
                    role_class  = "functional",
                ).values("code", "display_name").order_by("id")
            )
            # If no functional roles, fall back to all roles for this platform
            if not roles:
                roles = list(
                    Role.objects.filter(
                        platform  = a.platform.key,
                        tenant_id = None,
                    ).exclude(role_class="platform").values("code", "display_name").order_by("id")
                )

            products.append({
                "key":          a.platform.key,
                "name":         a.platform.name,
                "is_active":    a.is_active,
                "roles":        roles,          # available roles for this product
                "default_role": roles[0]["code"] if roles else None,  # lowest role
            })

        return Response({"products": products})


def _is_platform_admin(user) -> bool:  # PLATFORM_SEPARATION
    """Returns True if user is Owner or Org Admin via RBAC or old PM role."""
    from django.utils import timezone
    from django.db.models import Q
    from apps.rbac.models import RoleAssignment
    today = timezone.now().date()
    has_rbac = RoleAssignment.objects.filter(
        user_id          = user.pk,
        role__code__in   = ["owner", "org_admin"],
        role__role_class = "platform",
        valid_from__lte  = today,
    ).filter(
        Q(valid_to__isnull=True) | Q(valid_to__gte=today)
    ).exists()
    return has_rbac or getattr(user, "role", None) == "admin" or getattr(user, "is_superuser", False)