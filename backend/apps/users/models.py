import hashlib
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid
import secrets

class User(AbstractUser):
    """
    Custom User model with role-based access control.
    """
    
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MANAGER = "manager", "Manager"
        DEVELOPER = "developer", "Developer"
        ANNOTATOR = "annotator", "Annotator"
        VIEWER = "viewer", "Viewer"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.ANNOTATOR,
    )
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)

    # NEW: Store skills as a list of strings
    skills = models.JSONField(default=list, blank=True)

    # ── SOCIAL AUTH ───────────────────────────────────────────────────────────
    # Tracks which provider was used to create / authenticate this account.
    # 'local' = traditional email + password (existing behaviour, unchanged)
    # 'google' / 'microsoft' = OAuth SSO
    AUTH_PROVIDER_LOCAL = "local"
    AUTH_PROVIDER_GOOGLE = "google"
    AUTH_PROVIDER_MICROSOFT = "microsoft"
    AUTH_PROVIDER_CHOICES = [
        (AUTH_PROVIDER_LOCAL, "Local"),
        (AUTH_PROVIDER_GOOGLE, "Google"),
        (AUTH_PROVIDER_MICROSOFT, "Microsoft"),
    ]
    auth_provider = models.CharField(
        max_length=20,
        choices=AUTH_PROVIDER_CHOICES,
        default=AUTH_PROVIDER_LOCAL,
    )
    # Stores the unique ID returned by the OAuth provider so we can look the
    # user up on subsequent logins without relying on email alone.
    social_uid = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    # ──────────────────────────────────────────────────────────────────────────

    # ── MULTI-TENANCY ─────────────────────────────────────────────────────
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.SET_NULL,
        related_name="users",
        null=True,
        blank=True,
        db_index=True,
    )
    # ──────────────────────────────────────────────────────────────────────
    
    class Meta:
        db_table = "users"
        ordering = ["username"]
    
    def __str__(self):
        return self.username
    
    def save(self, *args, **kwargs):
        # 1. If superuser, force role to ADMIN
        if self.is_superuser:
            self.role = self.Role.ADMIN
        
        # 2. FIX: If role is ADMIN, grant is_staff so they pass IsAdminUser permissions
        if self.role == self.Role.ADMIN:
            self.is_staff = True
        else:
            # Optional: remove staff status if role is demoted from Admin
            # Be careful if you want Managers to have Django Admin panel access
            if not self.is_superuser: 
                self.is_staff = False
                
        super().save(*args, **kwargs)
    
    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN or self.is_superuser
    
    @property
    def is_manager(self):
        return self.role in [self.Role.ADMIN, self.Role.MANAGER] or self.is_superuser
    
    @property
    def is_developer(self):
        return self.role == self.Role.DEVELOPER
    
    @property
    def can_annotate(self):
        return self.role in [self.Role.ADMIN, self.Role.MANAGER, self.Role.ANNOTATOR]


class PasswordResetOTP(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_otps")
    otp_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_verified = models.BooleanField(default=False)
    token = models.CharField(max_length=100, unique=True, null=True, blank=True)

    def is_expired(self):
        return timezone.now() > self.expires_at

    def generate_reset_token(self):
        self.token = str(uuid.uuid4())
        self.save()
        return self.token

    @staticmethod
    def hash_otp(otp):
        return hashlib.sha256(str(otp).encode()).hexdigest()

class Invitation(models.Model):
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=User.Role.choices)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="invitations"
    )
    # Optional: invite directly to a specific workspace
    # If null, user gets added to the default workspace only
    workspace = models.ForeignKey(
        "organizations.Workspace",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invitations",
        help_text="If set, user is added to this workspace on acceptance. Otherwise added to default workspace.",
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if not self.token:
            # Generate a cryptographically secure random token
            self.token = secrets.token_urlsafe(32)
        if not self.expires_at:
            # Set expiration to 12 hours from now
            self.expires_at = timezone.now() + timedelta(hours=12)
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at
    
class ContactMessage(models.Model):
    """
    Stores contact form submissions from the public Dyuksa landing page.
    """
    name = models.CharField(max_length=255)
    email = models.EmailField()
    company = models.CharField(max_length=255, blank=True, null=True)
    problem = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "contact_messages"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Message from {self.name} ({self.email})"