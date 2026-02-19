import hashlib
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid


class User(AbstractUser):
    """
    Custom User model with role-based access control.
    """
    
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MANAGER = "manager", "Manager"
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
