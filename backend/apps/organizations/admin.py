from django.contrib import admin

from .models import Organization, Platform, PlatformAccess


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ("created_at", "updated_at")


@admin.register(Platform)
class PlatformAdmin(admin.ModelAdmin):
    list_display = ("key", "name", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("key", "name")
    readonly_fields = ("created_at", "updated_at")


@admin.register(PlatformAccess)
class PlatformAccessAdmin(admin.ModelAdmin):
    list_display = ("organization", "platform", "is_active", "granted_at")
    list_filter = ("platform", "is_active")
    search_fields = ("organization__name", "platform__key")
    readonly_fields = ("granted_at", "updated_at")
    list_select_related = ("organization", "platform")