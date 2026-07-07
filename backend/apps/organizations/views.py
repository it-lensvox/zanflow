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
from django.contrib.auth import get_user_model
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
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [GlobalSignupDailyThrottle]

    def post(self, request):
        serializer = TenantSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # 1. Variables are extracted and assigned here
        company_name = serializer.validated_data["company_name"]
        admin_email = serializer.validated_data["admin_email"]
        password = serializer.validated_data["password"]

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

        org = result["organization"]
        admin_user = result["admin_user"]

        # 2. Delete the OTP from cache (admin_email is safely defined above)
        cache.delete(f"signup_otp_{admin_email}")

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
            f"A new organization has signed up on Dyuksa.\n\n"
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

    GET /api/v1/organizations/dashboard/<org_id>/

    Returns full stats, all users, recent projects, and activity.
    """

    permission_classes = [IsSuperUser]

    def get(self, request, org_id):
        from apps.projects.models import Project
        from apps.tasksite.models import Task

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
            "id", "name", "task_type", "is_active", "created_at"
        )[:10]

        # Recent tasks
        recent_tasks = Task.original_objects.filter(
            organization=org
        ).order_by("-created_at").values(
            "id", "heading", "status", "priority", "created_at"
        )[:10]

        return Response({
            "organization": {
                "id": org.id,
                "name": org.name,
                "slug": org.slug,
                "is_active": org.is_active,
                "created_at": org.created_at,
                "updated_at": org.updated_at,
            },
            "stats": stats,
            "users": list(users),
            "recent_projects": list(recent_projects),
            "recent_tasks": list(recent_tasks),
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