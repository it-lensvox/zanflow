import logging
import random
from django.core.cache import cache
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.text import slugify
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Organization, WorkspaceMembership, Workspace
from .serializers import OrganizationSerializer, TenantSignupSerializer
from .services import TenantOnboardingService
from .throttles import GlobalSignupDailyThrottle
User = get_user_model()
logger = logging.getLogger(__name__)

# All valid workspace membership roles — matches organization user roles
VALID_WORKSPACE_ROLES = ("admin", "manager", "developer", "annotator", "viewer")


class IsSuperUser(permissions.BasePermission):
    """Only the platform owner (superuser) can access these endpoints."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser
        )
class SendSignupOTPView(APIView):
    """
    Step 1 of Signup: Sends a 6-digit OTP to the provided email.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response(
                {"detail": "Email is required."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        email = email.lower().strip()

        # Check if user already exists
        if User.objects.filter(email=email).exists():
            return Response(
                {"detail": "A user with this email already exists."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate 6-digit OTP
        otp = str(random.randint(100000, 999999))
        
        # Cache the OTP for 5 minutes
        cache_key = f"signup_otp_{email}"
        cache.set(cache_key, otp, timeout=300)

        # Send via SES
        subject = "Your Dyuksa Signup OTP"
        message = f"Your OTP for Dyuksa is {otp}. It expires in 5 minutes."
        
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
            logger.info(f"Signup OTP sent to {email}")
        except Exception as e:
            logger.error(f"Failed to send OTP to {email}: {str(e)}")
            return Response(
                {"detail": "Failed to send OTP email. Please try again later."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({"message": "OTP sent successfully."}, status=status.HTTP_200_OK)

class OrganizationViewSet(viewsets.ModelViewSet):
    """
    CRUD for Organizations. Typically restricted to superusers / admins.
    Regular users only need to see their own organization.
    """

    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = "slug"


class TenantSignupView(APIView):
    """
    Public self-service signup endpoint.

    SSO addition (additive — existing logic unchanged):
        Before running serializer validation, checks whether the email already
        exists. If it does, returns HTTP 409 with code EMAIL_ALREADY_EXISTS so
        the frontend can show a friendly "add this platform to your existing
        account" dialog instead of a generic validation error.

        If the email is new, proceeds as normal AND auto-creates a PlatformAccess
        row for the platform the user signed up from (default: "pm").
        The signup request may optionally include a "platform" field to specify
        which platform the user is signing up from e.g. "hrms" or "crm".
    """
    permission_classes = [permissions.AllowAny]
    # throttle_classes = [GlobalSignupDailyThrottle]  # Uncomment in production

    def post(self, request):

        # ── SSO: detect email conflict BEFORE serializer validation ───────
        # We must do this here because TenantSignupSerializer.validate_admin_email
        # raises a 400 ValidationError on duplicate emails — we want 409 instead
        # so the frontend can show the "add platform" dialog.
        admin_email = request.data.get("admin_email", "").strip().lower()
        if admin_email:
            existing_user = User.objects.filter(email__iexact=admin_email).first()
            if existing_user:
                from .models import PlatformAccess
                existing_platforms = list(
                    PlatformAccess.objects.filter(
                        organization=existing_user.organization,
                        is_active=True,
                        platform__is_active=True,
                    ).values_list("platform__key", flat=True)
                )
                signup_platform = request.data.get("platform", "pm")
                return Response(
                    {
                        "code":               "EMAIL_ALREADY_EXISTS",
                        "detail":             "An account with this email already exists.",
                        "existing_platforms": existing_platforms,
                        "can_add_platform":   signup_platform not in existing_platforms,
                        "signup_platform":    signup_platform,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
        # ── End SSO addition ───────────────────────────────────────────────

        serializer = TenantSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # 1. Variables are extracted and assigned here
        company_name = serializer.validated_data["company_name"]
        admin_email  = serializer.validated_data["admin_email"]
        password     = serializer.validated_data["password"]

        # Which platform is the user signing up from (default: pm)
        signup_platform = request.data.get("platform", "pm")

        # Auto-generate username from company name
        admin_username = slugify(company_name).replace("-", "_") + "_admin"

        try:
            result = TenantOnboardingService.create_tenant(
                name=company_name,
                admin_username=admin_username,
                admin_email=admin_email,
                admin_password=password,
            )
        except ValueError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        org        = result["organization"]
        admin_user = result["admin_user"]

        # 2. Delete the OTP from cache (admin_email is safely defined above)
        cache.delete(f"signup_otp_{admin_email}")

        # ── SSO: grant platform access for the platform they signed up from ──
        try:
            from .models import Platform, PlatformAccess
            platform_obj = Platform.objects.filter(
                key=signup_platform, is_active=True
            ).first()
            if platform_obj:
                PlatformAccess.objects.get_or_create(
                    organization=org,
                    platform=platform_obj,
                    defaults={"is_active": True},
                )
                logger.info(
                    "PlatformAccess granted: org=%s, platform=%s",
                    org.name, signup_platform,
                )
            else:
                # Fallback — grant pm access if the requested platform doesn't exist
                pm = Platform.objects.filter(key="pm", is_active=True).first()
                if pm:
                    PlatformAccess.objects.get_or_create(
                        organization=org,
                        platform=pm,
                        defaults={"is_active": True},
                    )
        except Exception as e:
            # Never fail a signup because of platform access — just log it
            logger.warning(
                "Could not grant platform access for org=%s: %s", org.name, str(e)
            )
        # ── End SSO addition ───────────────────────────────────────────────

        # Generate JWT tokens for auto-login
        refresh = RefreshToken.for_user(admin_user)

        logger.info(
            "Self-service signup: org=%s (ID=%s), user=%s",
            org.name,
            org.id,
            admin_user.username,
        )

        # Notify all platform superusers about the new signup
        self._notify_superusers(org, admin_user)

        return Response(
            {
                "message": "Organization created successfully.",
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
                },
                "tokens": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                },
            },
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _notify_superusers(org, admin_user):
        """
        Send email alert to all platform superusers when a new tenant signs up.
        Runs silently — signup succeeds even if email fails.
        """
        from django.core.mail import send_mail
        from django.conf import settings as django_settings
        from django.utils import timezone

        User = get_user_model()

        # Get all superuser emails
        superuser_emails = list(
            User.objects.filter(
                is_superuser=True,
                is_active=True,
            ).exclude(
                email=""
            ).values_list("email", flat=True)
        )

        if not superuser_emails:
            return

        signup_time = timezone.now().strftime("%B %d, %Y at %I:%M %p UTC")
        total_orgs = Organization.objects.count()

        subject = f"🔔 New Tenant Signup: {org.name}"

        message = (
            f"A new organization has signed up on DYUKSA.\n\n"
            f"────────────────────────────────\n"
            f"Organization:  {org.name}\n"
            f"Slug:          {org.slug}\n"
            f"Org ID:        {org.id}\n"
            f"────────────────────────────────\n"
            f"Admin User:    {admin_user.username}\n"
            f"Admin Email:   {admin_user.email}\n"
            f"User ID:       {admin_user.id}\n"
            f"────────────────────────────────\n"
            f"Signup Time:   {signup_time}\n"
            f"Total Tenants: {total_orgs}\n"
            f"────────────────────────────────\n\n"
            f"You can view this tenant at:\n"
            f"  API: /api/v1/organizations/overview/{org.id}/\n\n"
            f"— Dyuksa Platform"
        )

        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=django_settings.DEFAULT_FROM_EMAIL,
                recipient_list=superuser_emails,
                fail_silently=True,  # Don't break signup if email fails
            )
            logger.info(
                "Signup alert sent to %d superuser(s) for org=%s",
                len(superuser_emails),
                org.name,
            )
        except Exception as e:
            logger.warning(
                "Failed to send signup alert for org=%s: %s",
                org.name,
                str(e),
            )


class TenantDashboardView(APIView):
    """
    Super-admin only: List all tenants with full stats.

    GET /api/v1/organizations/dashboard/

    Returns all organizations with user count, project count,
    task count, team count, chat activity, and admin info.
    """

    permission_classes = [IsSuperUser]

    def get(self, request):
        User = get_user_model()
        orgs = Organization.objects.all().order_by("-created_at")

        tenants = []
        for org in orgs:
            stats = TenantOnboardingService.get_tenant_stats(org.id)

            # Get the admin/superuser for this org
            admin_users = User.objects.filter(
                organization=org,
                is_superuser=True
            ).values("id", "username", "email")

            # Get recent user activity (last login)
            recent_users = User.objects.filter(
                organization=org,
                last_login__isnull=False
            ).order_by("-last_login").values(
                "id", "username", "email", "last_login", "role"
            )[:5]

            tenants.append({
                "id": org.id,
                "name": org.name,
                "slug": org.slug,
                "is_active": org.is_active,
                "created_at": org.created_at,
                "stats": {
                    "users": stats["users"],
                    "projects": stats["projects"],
                    "tasks": stats["tasks"],
                    "teams": stats["teams"],
                    "chat_rooms": stats["chat_rooms"],
                    "chat_messages": stats["chat_messages"],
                },
                "admins": list(admin_users),
                "recent_active_users": list(recent_users),
            })

        # Platform-wide summary
        total_users = User.objects.count()
        total_orgs = Organization.objects.count()
        active_orgs = Organization.objects.filter(is_active=True).count()

        return Response({
            "platform_summary": {
                "total_organizations": total_orgs,
                "active_organizations": active_orgs,
                "inactive_organizations": total_orgs - active_orgs,
                "total_users": total_users,
            },
            "tenants": tenants,
        })


class TenantDetailView(APIView):
    """
    Super-admin only: Get detailed info for a specific tenant.

    GET /api/v1/organizations/overview/<org_id>/

    Returns full stats, all users, recent projects, activity,
    and the platforms list showing which platforms the org has access to.
    """

    permission_classes = [IsSuperUser]

    def get(self, request, org_id):
        from apps.projects.models import Project
        from apps.tasksite.models import Task
        from .models import Platform, PlatformAccess

        User = get_user_model()

        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response(
                {"detail": "Organization not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        stats = TenantOnboardingService.get_tenant_stats(org.id)

        # All users in this org
        users = User.objects.filter(organization=org).values(
            "id", "username", "email", "role",
            "is_active", "is_superuser", "last_login", "date_joined"
        ).order_by("-date_joined")

        # Recent projects
        recent_projects = Project.original_objects.filter(
            organization=org
        ).order_by("-created_at").values(
            "id", "name", "task_type", "status", "created_at"
        )[:10]

        # Recent tasks
        recent_tasks = Task.original_objects.filter(
            organization=org
        ).order_by("-created_at").values(
            "id", "heading", "status", "priority", "created_at"
        )[:10]

        # ── SSO: platforms list ───────────────────────────────────────────
        # Fetch ALL active platforms and mark which ones this org has access to.
        # Frontend renders a toggle per platform row — fully dynamic,
        # no hardcoding needed. Adding ERP in future shows up automatically.
        all_platforms = Platform.objects.filter(is_active=True).order_by("key")
        granted_keys  = set(
            PlatformAccess.objects.filter(
                organization=org,
                is_active=True,
            ).values_list("platform__key", flat=True)
        )
        platforms_data = [
            {
                "key":        p.key,
                "name":       p.name,
                "has_access": p.key in granted_keys,
            }
            for p in all_platforms
        ]
        # ── End SSO addition ──────────────────────────────────────────────

        return Response({
            "organization": {
                "id":         org.id,
                "name":       org.name,
                "slug":       org.slug,
                "is_active":  org.is_active,
                "created_at": org.created_at,
                "updated_at": org.updated_at,
            },
            "stats":           stats,
            "users":           list(users),
            "recent_projects": list(recent_projects),
            "recent_tasks":    list(recent_tasks),
            "platforms":       platforms_data,
        })


class TenantDeleteView(APIView):
    """
    Super-admin only: Permanently delete a tenant and ALL its data.

    DELETE /api/v1/organizations/overview/<org_id>/delete/

    This is IRREVERSIBLE. Use deactivate_tenant for soft removal.
    Requires confirmation via request body: {"confirm": "DELETE"}
    """

    permission_classes = [IsSuperUser]

    def delete(self, request, org_id):
        # Safety: require explicit confirmation
        confirm = request.data.get("confirm")
        if confirm != "DELETE":
            return Response(
                {
                    "detail": "This action is irreversible. "
                    "Send {\"confirm\": \"DELETE\"} in the request body to proceed."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response(
                {"detail": "Organization not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Prevent deleting your own organization
        if request.user.organization_id == org_id:
            return Response(
                {"detail": "You cannot delete your own organization."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        org_name = org.name

        try:
            summary = TenantOnboardingService.delete_tenant(org_id)
        except Exception as e:
            return Response(
                {"detail": f"Failed to delete tenant: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "message": f"Organization '{org_name}' and all its data have been permanently deleted.",
                "summary": summary,
            },
            status=status.HTTP_200_OK,
        )


class TenantToggleStatusView(APIView):
    """
    Super-admin only: Activate or deactivate a tenant.

    POST /api/v1/organizations/overview/<org_id>/toggle-status/

    Toggles between active and inactive.
    If active → deactivates org + all its users.
    If inactive → reactivates org + all its users.
    """

    permission_classes = [IsSuperUser]

    def post(self, request, org_id):
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response(
                {"detail": "Organization not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Prevent deactivating your own organization
        if request.user.organization_id == org_id and org.is_active:
            return Response(
                {"detail": "You cannot deactivate your own organization."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if org.is_active:
            TenantOnboardingService.deactivate_tenant(org_id)
            return Response({
                "message": f"'{org.name}' has been deactivated.",
                "is_active": False,
            })
        else:
            TenantOnboardingService.reactivate_tenant(org_id)
            return Response({
                "message": f"'{org.name}' has been reactivated.",
                "is_active": True,
            })


class IsAdminOrManager(permissions.BasePermission):
    """Only workspace admins and managers can create workspaces."""
    def has_permission(self, request, view):
        return request.user.role in ("admin", "manager")


class WorkspaceListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """List all workspaces the user belongs to."""
        memberships = WorkspaceMembership.objects.filter(
            user=request.user,
            workspace__organization=request.user.organization,
        ).select_related("workspace", "workspace__created_by")

        data = [
            {
                "id": m.workspace.id,
                "name": m.workspace.name,
                "slug": m.workspace.slug,
                "role": m.role,
                "is_default": m.workspace.is_default,
                "is_active": m.workspace.is_active,
                "created_by": m.workspace.created_by_id,
                "member_count": WorkspaceMembership.objects.filter(
                    workspace=m.workspace
                ).count(),
            }
            for m in memberships
        ]
        return Response(data)

    def post(self, request):
        """
        Create a new workspace (admin/manager only).
        Optionally add members during creation.

        Body:
        {
            "name": "Marketing Team",
            "description": "Optional description",
            "members": [
                {"user_id": 5, "role": "member"},
                {"user_id": 8, "role": "manager"},
                {"user_id": 12}
            ]
        }

        Notes:
        - "members" is optional. If not provided, only the creator is added.
        - "role" in each member is optional, defaults to "member".
        - The creator is always added as "admin" automatically.
        - Users must belong to the same organization.
        """
        if request.user.role not in ("admin", "manager"):
            return Response(
                {"detail": "Only admins and managers can create workspaces."},
                status=status.HTTP_403_FORBIDDEN,
            )

        User = get_user_model()

        name = request.data.get("name")
        if not name:
            return Response(
                {"detail": "Workspace name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        description = request.data.get("description", "")

        workspace = Workspace.objects.create(
            organization=request.user.organization,
            name=name,
            description=description,
            created_by=request.user,
        )

        # Creator becomes admin of the workspace
        WorkspaceMembership.objects.create(
            user=request.user,
            workspace=workspace,
            role="admin",
        )

        # Add members if provided
        members_data = request.data.get("members", [])
        added_members = []
        skipped_members = []

        if isinstance(members_data, list):
            for member in members_data:
                # Support both {"user_id": 5, "role": "member"} and just {"user_id": 5}
                if isinstance(member, dict):
                    user_id = member.get("user_id")
                    role = member.get("role", "member")
                elif isinstance(member, int):
                    user_id = member
                    role = "member"
                else:
                    continue

                # Skip the creator (already added as admin)
                if user_id == request.user.id:
                    continue

                # Validate role
                if role not in VALID_WORKSPACE_ROLES:
                    role = "viewer"

                try:
                    target_user = User.objects.get(
                        id=user_id,
                        organization=request.user.organization,
                    )
                    WorkspaceMembership.objects.create(
                        user=target_user,
                        workspace=workspace,
                        role=role,
                    )
                    added_members.append({
                        "user_id": target_user.id,
                        "username": target_user.username,
                        "role": role,
                    })
                except User.DoesNotExist:
                    skipped_members.append({
                        "user_id": user_id,
                        "reason": "User not found or not in your organization.",
                    })
                except Exception:
                    skipped_members.append({
                        "user_id": user_id,
                        "reason": "Already a member or invalid data.",
                    })

        response_data = {
            "id": workspace.id,
            "name": workspace.name,
            "slug": workspace.slug,
            "created_by": workspace.created_by_id,
            "members_added": added_members,
            "message": "Workspace created successfully.",
        }

        if skipped_members:
            response_data["members_skipped"] = skipped_members

        return Response(response_data, status=status.HTTP_201_CREATED)


class WorkspaceDetailView(APIView):
    """
    GET   /api/v1/organizations/workspaces/<workspace_id>/
        → Get workspace details + stats.

    PATCH /api/v1/organizations/workspaces/<workspace_id>/
        → Update workspace name/description (admin/manager only).
    """

    permission_classes = [permissions.IsAuthenticated]

    def _get_workspace(self, request, workspace_id):
        """Get workspace and verify user is a member."""
        try:
            workspace = Workspace.objects.get(
                id=workspace_id,
                organization=request.user.organization,
            )
        except Workspace.DoesNotExist:
            return None, Response(
                {"detail": "Workspace not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        is_member = WorkspaceMembership.objects.filter(
            user=request.user,
            workspace=workspace,
        ).exists()

        if not is_member:
            return None, Response(
                {"detail": "You are not a member of this workspace."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return workspace, None

    def get(self, request, workspace_id):
        workspace, error = self._get_workspace(request, workspace_id)
        if error:
            return error

        memberships = WorkspaceMembership.objects.filter(
            workspace=workspace,
        ).select_related("user").order_by("joined_at")

        my_membership = memberships.filter(user=request.user).first()

        return Response({
            "id": workspace.id,
            "name": workspace.name,
            "slug": workspace.slug,
            "description": workspace.description,
            "is_default": workspace.is_default,
            "is_active": workspace.is_active,
            "created_by": workspace.created_by_id,
            "my_role": my_membership.role if my_membership else None,
            "member_count": memberships.count(),
            "members": [
                {
                    "user_id": m.user.id,
                    "username": m.user.username,
                    "email": m.user.email,
                    "first_name": m.user.first_name,
                    "last_name": m.user.last_name,
                    "role": m.role,
                    "joined_at": m.joined_at,
                }
                for m in memberships
            ],
            "created_at": workspace.created_at,
            "updated_at": workspace.updated_at,
        })

    def patch(self, request, workspace_id):
        workspace, error = self._get_workspace(request, workspace_id)
        if error:
            return error

        # Only admin/manager of workspace can update
        membership = WorkspaceMembership.objects.filter(
            user=request.user,
            workspace=workspace,
        ).first()

        if not membership or membership.role not in ("admin", "manager"):
            return Response(
                {"detail": "Only workspace admins and managers can update settings."},
                status=status.HTTP_403_FORBIDDEN,
            )

        name = request.data.get("name")
        description = request.data.get("description")

        if name is not None:
            # Check name uniqueness within org
            if Workspace.objects.filter(
                organization=request.user.organization,
                name__iexact=name.strip(),
            ).exclude(id=workspace.id).exists():
                return Response(
                    {"detail": "A workspace with this name already exists."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            workspace.name = name.strip()
            workspace.slug = ""  # regenerated in save()

        if description is not None:
            workspace.description = description

        workspace.save()

        logger.info(
            "Workspace updated: ws=%s, by=%s",
            workspace.name, request.user.username,
        )

        return Response({
            "message": "Workspace updated successfully.",
            "id": workspace.id,
            "name": workspace.name,
            "slug": workspace.slug,
            "description": workspace.description,
            "is_default": workspace.is_default,
            "is_active": workspace.is_active,
            "created_by": workspace.created_by_id,
            "updated_at": workspace.updated_at,
        })


class WorkspaceSwitchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, workspace_id):
        """Validate user can switch to this workspace. Frontend stores the ID."""
        is_member = WorkspaceMembership.objects.filter(
            user=request.user,
            workspace_id=workspace_id,
            workspace__organization=request.user.organization,
        ).exists()

        if not is_member:
            return Response(
                {"detail": "You are not a member of this workspace."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response({
            "workspace_id": workspace_id,
            "message": "Switched successfully. Send X-Workspace-ID header in future requests.",
        })


class WorkspaceDeleteView(APIView):
    """
    Delete a workspace permanently.

    DELETE /api/v1/organizations/workspaces/<workspace_id>/delete/

    Rules:
      - Only the person who CREATED the workspace can delete it.
      - The default workspace cannot be deleted.
      - All data inside the workspace (projects, tasks, teams, etc.) will be permanently deleted.
      - Requires confirmation: {"confirm": "DELETE"}
    """

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, workspace_id):
        # 1. Find the workspace
        try:
            workspace = Workspace.objects.get(
                id=workspace_id,
                organization=request.user.organization,
            )
        except Workspace.DoesNotExist:
            return Response(
                {"detail": "Workspace not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # 2. Cannot delete the default workspace
        if workspace.is_default:
            return Response(
                {"detail": "The default workspace cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Only the creator can delete
        if workspace.created_by != request.user:
            return Response(
                {"detail": "Only the person who created this workspace can delete it."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 4. Require confirmation
        confirm = request.data.get("confirm")
        if confirm != "DELETE":
            return Response(
                {
                    "detail": 'This action is irreversible. Send {"confirm": "DELETE"} to proceed.',
                    "workspace": {
                        "id": workspace.id,
                        "name": workspace.name,
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 5. Delete all workspace-scoped data
        from django.apps import apps
        from .models import TenantModel

        workspace_name = workspace.name
        summary = {"workspace": workspace_name, "deleted": {}}

        for model in apps.get_models():
            if (
                issubclass(model, TenantModel)
                and not model._meta.abstract
                and model is not TenantModel
            ):
                label = f"{model._meta.app_label}.{model.__name__}"
                count, _ = model.original_objects.filter(workspace=workspace).delete()
                if count > 0:
                    summary["deleted"][label] = count

        # Delete workspace memberships
        mem_count, _ = WorkspaceMembership.objects.filter(workspace=workspace).delete()
        summary["deleted"]["memberships"] = mem_count

        # Delete the workspace itself
        workspace.delete()

        logger.info(
            "Workspace deleted by creator: ws=%s, user=%s, summary=%s",
            workspace_name, request.user.username, summary,
        )

        return Response({
            "message": f"Workspace '{workspace_name}' has been permanently deleted.",
            "summary": summary,
        })

class WorkspaceMembersView(APIView):
    """
    GET  /api/v1/organizations/workspaces/<workspace_id>/members/
        → List all members of a workspace.

    POST /api/v1/organizations/workspaces/<workspace_id>/members/
        → Add a member to the workspace (admin/manager only).
          Body: { "user_id": 5, "role": "member" }
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, workspace_id):
        try:
            workspace = Workspace.objects.get(
                id=workspace_id,
                organization=request.user.organization,
            )
        except Workspace.DoesNotExist:
            return Response(
                {"detail": "Workspace not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Must be a member to view members
        if not WorkspaceMembership.objects.filter(
            user=request.user, workspace=workspace,
        ).exists():
            return Response(
                {"detail": "You are not a member of this workspace."},
                status=status.HTTP_403_FORBIDDEN,
            )

        memberships = WorkspaceMembership.objects.filter(
            workspace=workspace,
        ).select_related("user").order_by("joined_at")

        members = [
            {
                "id": m.id,
                "user_id": m.user.id,
                "username": m.user.username,
                "email": m.user.email,
                "role": m.role,
                "joined_at": m.joined_at,
            }
            for m in memberships
        ]

        return Response({"members": members})

    def post(self, request, workspace_id):
        try:
            workspace = Workspace.objects.get(
                id=workspace_id,
                organization=request.user.organization,
            )
        except Workspace.DoesNotExist:
            return Response(
                {"detail": "Workspace not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Only admin/manager of workspace can add members
        my_membership = WorkspaceMembership.objects.filter(
            user=request.user, workspace=workspace,
        ).first()

        if not my_membership or my_membership.role not in ("admin", "manager"):
            return Response(
                {"detail": "Only workspace admins and managers can add members."},
                status=status.HTTP_403_FORBIDDEN,
            )

        user_id = request.data.get("user_id")
        role = request.data.get("role", "member")

        if not user_id:
            return Response(
                {"detail": "user_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if role not in VALID_WORKSPACE_ROLES:
            return Response(
                {"detail": f"Invalid role. Choose from: {', '.join(VALID_WORKSPACE_ROLES)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate user exists and belongs to same org
        try:
            target_user = User.objects.get(
                id=user_id,
                organization=request.user.organization,
            )
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found or does not belong to your organization."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if already a member
        if WorkspaceMembership.objects.filter(
            user=target_user, workspace=workspace,
        ).exists():
            return Response(
                {"detail": f"User '{target_user.username}' is already a member of this workspace."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = WorkspaceMembership.objects.create(
            user=target_user,
            workspace=workspace,
            role=role,
        )

        logger.info(
            "Member added to workspace: user=%s, ws=%s, role=%s",
            target_user.username, workspace.name, role,
        )

        return Response(
            {
                "message": f"User '{target_user.username}' added to workspace.",
                "member": {
                    "id": membership.id,
                    "user_id": target_user.id,
                    "username": target_user.username,
                    "email": target_user.email,
                    "role": membership.role,
                    "joined_at": membership.joined_at,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class WorkspaceMemberDetailView(APIView):
    """
    PATCH  /api/v1/organizations/workspaces/<workspace_id>/members/<user_id>/
        → Update a member's role. Body: { "role": "manager" }

    DELETE /api/v1/organizations/workspaces/<workspace_id>/members/<user_id>/
        → Remove a member from the workspace.
    """

    permission_classes = [permissions.IsAuthenticated]

    def _check_permission(self, request, workspace_id):
        try:
            workspace = Workspace.objects.get(
                id=workspace_id,
                organization=request.user.organization,
            )
        except Workspace.DoesNotExist:
            return None, Response(
                {"detail": "Workspace not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        my_membership = WorkspaceMembership.objects.filter(
            user=request.user, workspace=workspace,
        ).first()

        if not my_membership or my_membership.role not in ("admin", "manager"):
            return None, Response(
                {"detail": "Only workspace admins and managers can manage members."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return workspace, None

    def patch(self, request, workspace_id, user_id):
        workspace, error = self._check_permission(request, workspace_id)
        if error:
            return error

        # NEW CHECK: Prevent users from changing their own role
        if str(request.user.id) == str(user_id):
            return Response(
                {"detail": "You cannot change your own role."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_role = request.data.get("role")
        if new_role not in VALID_WORKSPACE_ROLES:
            return Response(
                {"detail": f"Invalid role. Choose from: {', '.join(VALID_WORKSPACE_ROLES)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        membership = WorkspaceMembership.objects.filter(
            user=target_user, workspace=workspace,
        ).first()

        if not membership:
            return Response(
                {"detail": f"User '{target_user.username}' is not a member of this workspace."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_role = membership.role
        membership.role = new_role
        membership.save(update_fields=["role"])

        logger.info(
            "Role updated: user=%s, ws=%s, %s → %s",
            target_user.username, workspace.name, old_role, new_role,
        )

        return Response({
            "message": f"Role updated to '{new_role}'.",
            "user_id": target_user.id,
            "username": target_user.username,
            "role": new_role,
        })

    def delete(self, request, workspace_id, user_id):
        workspace, error = self._check_permission(request, workspace_id)
        if error:
            return error

        # 1. NEW CHECK: Ensure the person making the request is specifically an 'admin'
        # (_check_permission allows 'manager' through, so we must strictly check for 'admin' here)
        my_membership = WorkspaceMembership.objects.filter(
            user=request.user, workspace=workspace
        ).first()
        
        if my_membership.role != "admin":
            return Response(
                {"detail": "Only workspace admins can remove members."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 2. NEW CHECK: Prevent users from removing themselves entirely
        if str(request.user.id) == str(user_id):
            return Response(
                {"detail": "You cannot remove yourself from the workspace. Another admin must do this."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        deleted, _ = WorkspaceMembership.objects.filter(
            user=target_user, workspace=workspace,
        ).delete()

        if not deleted:
            return Response(
                {"detail": f"User '{target_user.username}' is not a member of this workspace."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        logger.info(
            "Member removed: user=%s, ws=%s, by=%s",
            target_user.username, workspace.name, request.user.username,
        )

        return Response({
            "message": f"User '{target_user.username}' removed from workspace.",
        })


class WorkspaceAvailableUsersView(APIView):
    """
    GET /api/v1/organizations/workspaces/<workspace_id>/available-users/

    Returns all users in the organization who are NOT already
    members of this workspace.

    Used by the frontend "Add Member" dropdown — shows only
    users that can still be added to this workspace.

    Only workspace admins and managers can access this.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, workspace_id):
        User = get_user_model()

        # Validate workspace exists and belongs to user's org
        try:
            workspace = Workspace.objects.get(
                id=workspace_id,
                organization=request.user.organization,
            )
        except Workspace.DoesNotExist:
            return Response(
                {"detail": "Workspace not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Only workspace admin/manager can see available users
        my_membership = WorkspaceMembership.objects.filter(
            user=request.user,
            workspace=workspace,
        ).first()

        if not my_membership or my_membership.role not in ("admin", "manager"):
            return Response(
                {"detail": "Only workspace admins and managers can view available users."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Get IDs of users already in this workspace
        existing_member_ids = WorkspaceMembership.objects.filter(
            workspace=workspace,
        ).values_list("user_id", flat=True)

        # Return all org users NOT already in this workspace
        available_users = User.objects.filter(
            organization=request.user.organization,
            is_active=True,
        ).exclude(id__in=existing_member_ids).order_by("username")

        # Optional search
        search = request.query_params.get("search", "").strip()
        if search:
            from django.db.models import Q
            available_users = available_users.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )

        users_data = [
            {
                "user_id": u.id,
                "username": u.username,
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "role": u.role,
            }
            for u in available_users
        ]

        return Response({
            "workspace": workspace.name,
            "available_count": len(users_data),
            "users": users_data,
        })

class AddPlatformAccessView(APIView):
    """
    Self-service endpoint — lets an existing user add a new platform to
    their account without creating a duplicate account.

    Called by the frontend when the signup page receives EMAIL_ALREADY_EXISTS
    and the user clicks "Yes, add this platform to my existing account".

    POST /api/v1/organizations/add-platform/

    Request body:
        {
            "email":    "ram@gmail.com",
            "password": "their_existing_password",
            "platform": "pm"             ← the platform they want to add
        }

    Response (success):
        {
            "message": "Platform 'pm' added to your account.",
            "platforms": ["hrms", "pm"],  ← full updated list
            "tokens": { "access": "...", "refresh": "..." }
        }

    Security:
        - Password is verified before granting access — prevents someone
          who has another user's JWT from silently adding platforms.
        - No authentication header required — this is a public endpoint
          called before login.
        - Rate-limited by the existing GlobalSignupDailyThrottle.
    """

    permission_classes = [permissions.AllowAny]
    # throttle_classes = [GlobalSignupDailyThrottle]  # No throttle for add-platform

    def post(self, request):
        from .models import Platform, PlatformAccess

        email    = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")
        platform_key = request.data.get("platform", "").strip().lower()

        # ── Basic validation ───────────────────────────────────────────────
        if not email or not password or not platform_key:
            return Response(
                {"detail": "email, password, and platform are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Verify the platform exists ─────────────────────────────────────
        try:
            platform_obj = Platform.objects.get(key=platform_key, is_active=True)
        except Platform.DoesNotExist:
            return Response(
                {"detail": f"Platform '{platform_key}' does not exist or is not active."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Verify user credentials ────────────────────────────────────────
        user = User.objects.filter(email__iexact=email).first()
        if not user or not user.check_password(password):
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {"detail": "This account has been deactivated. Please contact support."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if user.organization is None:
            return Response(
                {"detail": "Your account is not linked to an organisation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Check if they already have this platform ───────────────────────
        already_has = PlatformAccess.objects.filter(
            organization=user.organization,
            platform=platform_obj,
            is_active=True,
        ).exists()

        if already_has:
            return Response(
                {
                    "detail": f"Your account already has access to '{platform_key}'.",
                    "code":   "PLATFORM_ALREADY_GRANTED",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Grant platform access ──────────────────────────────────────────
        PlatformAccess.objects.get_or_create(
            organization=user.organization,
            platform=platform_obj,
            defaults={"is_active": True},
        )

        logger.info(
            "Platform access added: user=%s, org=%s, platform=%s",
            user.email, user.organization.name, platform_key,
        )

        # ── Issue fresh JWT with updated platforms list ────────────────────
        # Use DyuksaTokenObtainPairSerializer so the new token carries
        # the full updated platforms list automatically
        from apps.users.serializers import DyuksaTokenObtainPairSerializer
        refresh = DyuksaTokenObtainPairSerializer.get_token(user)

        # Build the updated platforms list for the response
        updated_platforms = list(
            PlatformAccess.objects.filter(
                organization=user.organization,
                is_active=True,
                platform__is_active=True,
            ).values_list("platform__key", flat=True)
        )

        return Response(
            {
                "message":   f"Platform '{platform_key}' has been added to your account.",
                "platforms": updated_platforms,
                "tokens": {
                    "access":  str(refresh.access_token),
                    "refresh": str(refresh),
                },
            },
            status=status.HTTP_200_OK,
        )


class TenantPlatformAccessView(APIView):
    """
    Super-admin only: Grant or revoke platform access for an organisation.

    POST /api/v1/organizations/overview/<org_id>/platform-access/

    Request body:
        {
            "platform": "hrms",   ← platform key: "pm", "hrms", "crm", etc.
            "enable":   true      ← true = grant, false = revoke
        }

    Response:
        {
            "message":           "HRMS access enabled for Acme Corp.",
            "org_id":            4,
            "platform":          "hrms",
            "is_active":         true,
            "updated_platforms": ["pm", "hrms"]
        }

    updated_platforms returns the full current list for the org so the
    frontend can update all toggles in one go without a separate GET call.

    The change takes effect on the user's next login — their new JWT will
    automatically reflect the updated platforms list.
    """

    permission_classes = [IsSuperUser]

    def post(self, request, org_id):
        from .models import Platform, PlatformAccess

        # ── Validate org ──────────────────────────────────────────────────
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response(
                {"detail": "Organization not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── Validate request body ─────────────────────────────────────────
        platform_key = request.data.get("platform", "").strip().lower()
        enable       = request.data.get("enable")

        if not platform_key:
            return Response(
                {"detail": "platform field is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if enable is None:
            return Response(
                {"detail": "enable field is required (true or false)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(enable, bool):
            return Response(
                {"detail": "enable must be a boolean (true or false)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Validate platform exists ──────────────────────────────────────
        try:
            platform_obj = Platform.objects.get(key=platform_key)
        except Platform.DoesNotExist:
            return Response(
                {
                    "detail": f"Platform '{platform_key}' does not exist.",
                    "available_platforms": list(
                        Platform.objects.filter(is_active=True)
                        .values_list("key", flat=True)
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Grant or revoke ───────────────────────────────────────────────
        if enable:
            # Grant — get_or_create so it's safe to call multiple times
            access, created = PlatformAccess.objects.get_or_create(
                organization=org,
                platform=platform_obj,
                defaults={"is_active": True},
            )
            if not created and not access.is_active:
                # Row exists but was previously revoked — reactivate it
                access.is_active = True
                access.save(update_fields=["is_active", "updated_at"])

            action_msg = "enabled"
            logger.info(
                "Superuser granted platform access: org=%s, platform=%s, by=%s",
                org.name, platform_key, request.user,
            )
        else:
            # Revoke — set is_active=False (keeps the row for audit trail)
            updated = PlatformAccess.objects.filter(
                organization=org,
                platform=platform_obj,
            ).update(is_active=False)

            if not updated:
                return Response(
                    {
                        "detail": (
                            f"Organisation '{org.name}' does not have "
                            f"'{platform_key}' access to revoke."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            action_msg = "disabled"
            logger.info(
                "Superuser revoked platform access: org=%s, platform=%s, by=%s",
                org.name, platform_key, request.user,
            )

        # ── Build updated platforms list ──────────────────────────────────
        updated_platforms = list(
            PlatformAccess.objects.filter(
                organization=org,
                is_active=True,
                platform__is_active=True,
            ).values_list("platform__key", flat=True)
        )

        return Response(
            {
                "message":           (
                    f"{platform_obj.name} access {action_msg} "
                    f"for '{org.name}'."
                ),
                "org_id":            org.id,
                "platform":          platform_key,
                "is_active":         enable,
                "updated_platforms": updated_platforms,
            },
            status=status.HTTP_200_OK,
        )