import logging

from django.contrib.auth import get_user_model
from django.utils.text import slugify
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Organization
from .serializers import OrganizationSerializer, TenantSignupSerializer
from .services import TenantOnboardingService
from .throttles import GlobalSignupDailyThrottle

logger = logging.getLogger(__name__)


class IsSuperUser(permissions.BasePermission):
    """Only the platform owner (superuser) can access these endpoints."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser
        )


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
    No authentication required.

    POST /api/v1/organizations/signup/
    {
        "company_name": "Acme Corp",
        "admin_email": "admin@acme.com",
        "password": "SecurePass123",
        "password_confirm": "SecurePass123"
    }

    Returns:
        - Organization details
        - Admin user details
        - JWT tokens (access + refresh) for auto-login
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [GlobalSignupDailyThrottle]

    def post(self, request):
        serializer = TenantSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

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
            f"A new organization has signed up on ZanFlow.\n\n"
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
            f"— ZanFlow Platform"
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