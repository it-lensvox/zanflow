from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, PasswordResetOTP, Invitation


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["username", "email", "role", "is_active", "is_staff"]
    list_filter = ["role", "is_active", "is_staff"]
    fieldsets = BaseUserAdmin.fieldsets + (
        ("ZanFlow", {"fields": ("role", "avatar")}),
    )
@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    # This controls which columns show up in the main list view
    list_display = ('email', 'role', 'organization', 'is_used', 'expires_at', 'token')
    
    # This adds a search bar so you can quickly find an invite by email
    search_fields = ('email', 'token')
    
    # This adds filters on the right sidebar
    list_filter = ('role', 'is_used', 'organization')
    
    # It's good practice to make auto-generated fields read-only in the admin panel
    readonly_fields = ('token', 'created_at', 'expires_at')
