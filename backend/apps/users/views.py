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
                    defaults={"role": "member"}  # Standard workspace role
                )
            except Exception:
                # Failsafe: if the workspace ID is invalid, the user is still created successfully
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
        serializer = SendInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        role = serializer.validated_data['role']

        if User.objects.filter(email=email).exists():
            return Response({"detail": "A user with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        invitation = Invitation.objects.create(
            email=email,
            role=role,
            organization=request.user.organization
        )

        # 1. Set your frontend URL here. 
        frontend_url = settings.FRONTEND_URL # Update with your actual frontend URL
        invite_link = f"{frontend_url}/setup-account?token={invitation.token}"

        # 2. Pass the data to the HTML template
        context = {
            'email': email,
            'role': role,
            'invite_link': invite_link
        }

        # 3. Render the beautiful HTML you designed
        html_content = render_to_string('dyuksa.html', context)
        
        # 4. Plain text fallback
        text_content = f"You have been invited to join DYUKSA as a {role}. Click here to set up your account: {invite_link}. This link expires in 12 hours."

        # 5. Send the email
        subject = "You've been invited to join DYUKSA"
        msg = EmailMultiAlternatives(
            subject,
            text_content,
            settings.DEFAULT_FROM_EMAIL,
            [email]
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()

        return Response({"detail": "Invitation sent successfully."}, status=status.HTTP_200_OK)

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

        # Auto-add to default workspace
        from apps.organizations.models import Workspace, WorkspaceMembership
        default_ws = Workspace.objects.filter(
            organization=invitation.organization, is_default=True
        ).first()
        if default_ws:
            WorkspaceMembership.objects.get_or_create(
                user=user,
                workspace=default_ws,
                defaults={"role": "member"},
            )

        # Burn the invitation token so it can't be used again
        invitation.is_used = True
        invitation.save()

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
            subject = f"New Contact Submission on Dyuksa from {contact_message.name}"
            
            # You can also use render_to_string here if you want a beautiful HTML email like your invitations
            text_content = f"""
New contact form submission on the Dyuksa platform:

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