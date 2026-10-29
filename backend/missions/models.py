from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Mission(models.Model):
    class Status(models.TextChoices):
        AWAITING_ASSIGNMENT = "awaiting_assignment", "Awaiting assignment"
        ASSIGNED = "assigned", "Assigned"
        ACKNOWLEDGED = "acknowledged", "Acknowledged"
        ONGOING = "ongoing", "Ongoing"
        PROBLEM = "problem", "Problem reported"
        DONE = "done", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        FAILED = "failed", "Failed"

    help_request = models.OneToOneField(
        "help_requests.HelpRequest", on_delete=models.PROTECT, related_name="mission"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_missions"
    )
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.AWAITING_ASSIGNMENT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "updated_at"], name="missions_status_updated_idx")]

    def __str__(self):
        return f"Mission for {self.help_request.request_code} ({self.status})"


class MissionAssignment(models.Model):
    mission = models.ForeignKey(Mission, on_delete=models.PROTECT, related_name="assignments")
    team = models.ForeignKey("teams.Team", on_delete=models.PROTECT, related_name="mission_assignments")
    assigned_team_leader = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="led_mission_assignments"
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="made_mission_assignments"
    )
    is_active = models.BooleanField(default=True)
    assignment_note = models.TextField(blank=True)
    assigned_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-assigned_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["mission"], condition=Q(is_active=True), name="missions_one_active_assignment"
            ),
            models.UniqueConstraint(
                fields=["team"], condition=Q(is_active=True), name="missions_team_one_active_assignment"
            ),
        ]
        indexes = [
            models.Index(fields=["mission", "is_active"], name="missions_assign_mission_idx"),
            models.Index(fields=["team", "is_active"], name="missions_assign_team_idx"),
        ]

    def __str__(self):
        return f"{self.mission} → {self.team}"


class MissionUpdate(models.Model):
    mission = models.ForeignKey(Mission, on_delete=models.PROTECT, related_name="updates")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="mission_updates")
    status = models.CharField(max_length=24, choices=Mission.Status.choices)
    action = models.CharField(max_length=32, default="status_change")
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["mission", "created_at"], name="missions_update_history_idx")]

    def __str__(self):
        return f"{self.mission} — {self.get_status_display()}"
