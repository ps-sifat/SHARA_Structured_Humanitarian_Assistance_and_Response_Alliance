from rest_framework.permissions import BasePermission


class IsSuperAdmin(BasePermission):
    """Restrict an operation to Django superusers; there is no signup role for this."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser and user.is_active)
