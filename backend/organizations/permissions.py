from rest_framework.permissions import BasePermission

from .models import Organization


def _organization_id(obj):
    if isinstance(obj, Organization):
        return obj.pk
    organization_id = getattr(obj, "organization_id", None)
    if organization_id:
        return organization_id
    team = getattr(obj, "team", None)
    return getattr(team, "organization_id", None)


class IsOrganizationAdmin(BasePermission):
    """Allow the active administrator relationship for this organization."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_superuser:
            return True
        organization_id = _organization_id(obj)
        return bool(
            organization_id
            and user.organization_admin_roles.filter(organization_id=organization_id, status="active").exists()
        )
