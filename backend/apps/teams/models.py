"""
Team models for ZanFlow.
Supports team-based collaboration with role-based access control.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone


class TeamType(models.TextChoices):
    """Team type choices based on UI requirements."""
    DEVELOPMENT = "development", "Development"
    QA = "qa", "QA"
    DESIGN = "design", "Design"
    PRODUCT = "product", "Product"
    MARKETING = "marketing", "Marketing"
    OPERATIONS = "operations", "Operations"
    OTHER = "other", "Other"


class TeamColor(models.TextChoices):
    """Predefined team colors from UI."""
    BLACK = "#1a1a2e", "Black"
    BLUE = "#3b82f6", "Blue"
    PURPLE = "#8b5cf6", "Purple"
    PINK = "#ec4899", "Pink"
    RED = "#ef4444", "Red"
    GREEN = "#22c55e", "Green"
    ORANGE = "#f97316", "Orange"
    TEAL = "#14b8a6", "Teal"


class TeamRole(models.TextChoices):
    """Team member role choices."""
    OWNER = "owner", "Owner"
    MANAGER = "manager", "Manager"
    MEMBER = "member", "Member"


class SoftDeleteManager(models.Manager):
    """Manager that excludes soft-deleted records by default."""
    
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)
    
    def with_deleted(self):
        """Include soft-deleted records."""
        return super().get_queryset()
    
    def deleted_only(self):
        """Return only soft-deleted records."""
        return super().get_queryset().filter(deleted_at__isnull=False)


class BaseModel(models.Model):
    """Abstract base model with timestamps and soft delete."""
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    
    objects = SoftDeleteManager()
    all_objects = models.Manager()
    
    class Meta:
        abstract = True
    
    def soft_delete(self):
        """Soft delete the record."""
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])
    
    def restore(self):
        """Restore a soft-deleted record."""
        self.deleted_at = None
        self.save(update_fields=["deleted_at", "updated_at"])
    
    @property
    def is_deleted(self):
        return self.deleted_at is not None


class Team(BaseModel):
    """
    Team model for organizing users into collaborative groups.
    Projects can belong to teams and inherit team permissions.
    """
    
    name = models.CharField(max_length=255)
    team_type = models.CharField(
        max_length=50,
        choices=TeamType.choices,
        default=TeamType.DEVELOPMENT
    )
    favorited_by = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="favorite_teams",
        blank=True
    )
    color = models.CharField(
        max_length=20,
        choices=TeamColor.choices,
        default=TeamColor.BLUE
    )
    description = models.TextField(blank=True, default="")
    
    # Denormalized field for quick access to team leader
    # This is updated via signals/services when ownership changes
    leader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="led_teams"
    )
    
    class Meta:
        db_table = "teams_team"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["team_type"]),
            models.Index(fields=["deleted_at"]),
        ]
    
    def __str__(self):
        return self.name
    
    @property
    def member_count(self):
        """Return the count of active team members."""
        return self.members.filter(deleted_at__isnull=True).count()
    
    def get_members_by_role(self, role: str):
        """Get all members with a specific role."""
        return self.members.filter(role=role, deleted_at__isnull=True)
    
    def get_owners(self):
        """Get all team owners."""
        return self.get_members_by_role(TeamRole.OWNER)
    
    def get_managers(self):
        """Get all team managers."""
        return self.get_members_by_role(TeamRole.MANAGER)
    
    def is_member(self, user) -> bool:
        """Check if a user is a member of this team."""
        return self.members.filter(
            user=user, 
            deleted_at__isnull=True
        ).exists()
    
    def get_user_role(self, user) -> str | None:
        """Get the role of a specific user in this team."""
        membership = self.members.filter(
            user=user,
            deleted_at__isnull=True
        ).first()
        return membership.role if membership else None
    
    def can_user_manage(self, user) -> bool:
        """Check if user has management permissions (owner or manager)."""
        role = self.get_user_role(user)
        return role in [TeamRole.OWNER, TeamRole.MANAGER]


class TeamMember(BaseModel):
    """
    Team membership model linking users to teams with roles.
    A user can belong to multiple teams with different roles.
    """
    
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="members"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="team_memberships"
    )
    role = models.CharField(
        max_length=20,
        choices=TeamRole.choices,
        default=TeamRole.MEMBER
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    
    # Optional: who added this member
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="team_members_added"
    )
    
    class Meta:
        db_table = "teams_teammember"
        ordering = ["-joined_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["team", "user"],
                condition=models.Q(deleted_at__isnull=True),
                name="unique_active_team_member"
            )
        ]
        indexes = [
            models.Index(fields=["team", "user"]),
            models.Index(fields=["role"]),
            models.Index(fields=["deleted_at"]),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.team.name} ({self.role})"
    
    @property
    def is_owner(self):
        return self.role == TeamRole.OWNER
    
    @property
    def is_manager(self):
        return self.role == TeamRole.MANAGER
    
    @property
    def can_manage(self):
        """Check if this member can manage the team."""
        return self.role in [TeamRole.OWNER, TeamRole.MANAGER]
