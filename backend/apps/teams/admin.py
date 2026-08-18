"""
Django admin configuration for the teams app.
"""
from django.contrib import admin
from django.utils.html import format_html

from .models import Team, TeamMember


class TeamMemberInline(admin.TabularInline):
    """Inline admin for team members."""
    
    model = TeamMember
    extra = 0
    readonly_fields = ["joined_at", "added_by"]
    autocomplete_fields = ["user"]
    
    def get_queryset(self, request):
        return super().get_queryset(request).filter(deleted_at__isnull=True)


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    """Admin configuration for Team model."""
    
    list_display = [
        "name",
        "team_type",
        "color_display",
        "leader",
        "member_count_display",
        "created_at",
        "is_deleted",
    ]
    list_filter = ["team_type", "created_at", "deleted_at"]
    search_fields = ["name", "description", "leader__email"]
    readonly_fields = ["id", "created_at", "updated_at", "deleted_at"]
    autocomplete_fields = ["leader"]
    inlines = [TeamMemberInline]
    
    fieldsets = (
        (None, {
            "fields": ("id", "name", "team_type", "color", "description")
        }),
        ("Leadership", {
            "fields": ("leader",)
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at", "deleted_at"),
            "classes": ("collapse",)
        }),
    )
    
    def color_display(self, obj):
        """Display color as a colored badge."""
        return format_html(
            '<span style="background-color: {}; padding: 2px 10px; '
            'border-radius: 3px; color: white;">{}</span>',
            obj.color,
            obj.get_color_display()
        )
    color_display.short_description = "Color"
    
    def member_count_display(self, obj):
        """Display member count."""
        return obj.members.filter(deleted_at__isnull=True).count()
    member_count_display.short_description = "Members"
    
    def is_deleted(self, obj):
        """Display soft delete status."""
        return obj.deleted_at is not None
    is_deleted.boolean = True
    is_deleted.short_description = "Deleted"
    
    def get_queryset(self, request):
        """Include soft-deleted teams in admin."""
        return Team.all_objects.all()
    
    actions = ["soft_delete_teams", "restore_teams"]
    
    @admin.action(description="Soft delete selected teams")
    def soft_delete_teams(self, request, queryset):
        for team in queryset:
            if not team.is_deleted:
                team.soft_delete()
    
    @admin.action(description="Restore selected teams")
    def restore_teams(self, request, queryset):
        for team in queryset:
            if team.is_deleted:
                team.restore()


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    """Admin configuration for TeamMember model."""
    
    list_display = [
        "user",
        "team",
        "role",
        "joined_at",
        "is_deleted",
    ]
    list_filter = ["role", "joined_at", "deleted_at"]
    search_fields = ["user__email", "team__name"]
    readonly_fields = ["id", "joined_at", "created_at", "updated_at", "deleted_at"]
    autocomplete_fields = ["user", "team", "added_by"]
    
    fieldsets = (
        (None, {
            "fields": ("id", "team", "user", "role")
        }),
        ("Metadata", {
            "fields": ("added_by", "joined_at")
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at", "deleted_at"),
            "classes": ("collapse",)
        }),
    )
    
    def is_deleted(self, obj):
        return obj.deleted_at is not None
    is_deleted.boolean = True
    is_deleted.short_description = "Deleted"
    
    def get_queryset(self, request):
        """Include soft-deleted memberships in admin."""
        return TeamMember.all_objects.all()
