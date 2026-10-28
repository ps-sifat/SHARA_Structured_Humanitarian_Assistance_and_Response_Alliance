from rest_framework.permissions import BasePermission


class IsAssignedTeamLeaderOrSuperAdmin(BasePermission):
    """Allow progress access to the leader captured on the active assignment or a Super Admin."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_superuser:
            return True
        mission = getattr(obj, "mission", obj)
        return mission.assignments.filter(
            is_active=True, assigned_team_leader=user
        ).exists()
