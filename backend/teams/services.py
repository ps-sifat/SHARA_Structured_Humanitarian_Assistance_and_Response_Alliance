from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from organizations.models import Organization, OrganizationAdmin, OrganizationMembership
from missions.models import MissionAssignment

from .models import TeamMembership


@transaction.atomic
def assign_team_member(team, volunteer, assigned_by, role=TeamMembership.Role.MEMBER):
    if not assigned_by.is_active or not OrganizationAdmin.objects.filter(
        organization=team.organization, user=assigned_by, status=OrganizationAdmin.Status.ACTIVE
    ).exists():
        raise PermissionDenied("An active administrator of this organization is required.")
    if (
        not team.is_active
        or not team.organization.is_active
        or team.organization.registration_status != Organization.RegistrationStatus.APPROVED
    ):
        raise ValidationError("Members can only be assigned to an active team in an approved organization.")
    is_member = OrganizationMembership.objects.filter(
        organization=team.organization,
        volunteer=volunteer,
        status=OrganizationMembership.Status.ACTIVE,
    ).exists()
    if not is_member:
        raise ValidationError("The volunteer must be an approved member of this organization.")
    if not volunteer.user.is_active:
        raise ValidationError("The volunteer account must be active.")
    if TeamMembership.objects.filter(volunteer=volunteer, status=TeamMembership.Status.ACTIVE).exists():
        raise ValidationError("The volunteer already has an active team membership.")
    if role == TeamMembership.Role.LEADER and TeamMembership.objects.filter(
        team=team, status=TeamMembership.Status.ACTIVE, role=TeamMembership.Role.LEADER
    ).exists():
        raise ValidationError("This team already has an active leader.")
    return TeamMembership.objects.create(team=team, volunteer=volunteer, assigned_by=assigned_by, role=role)


@transaction.atomic
def set_team_leader(team, volunteer, assigned_by):
    if not assigned_by.is_active or not OrganizationAdmin.objects.filter(
        organization=team.organization, user=assigned_by, status=OrganizationAdmin.Status.ACTIVE
    ).exists():
        raise PermissionDenied("An active administrator of this organization is required.")
    if not team.is_active or team.organization.registration_status != Organization.RegistrationStatus.APPROVED:
        raise ValidationError("A leader can only be selected for an active team in an approved organization.")
    membership = TeamMembership.objects.filter(
        team=team, volunteer=volunteer, status=TeamMembership.Status.ACTIVE
    ).first()
    if not membership:
        raise ValidationError("Select an active member of this team as its leader.")
    if not volunteer.user.is_active or not OrganizationMembership.objects.filter(
        organization=team.organization,
        volunteer=volunteer,
        status=OrganizationMembership.Status.ACTIVE,
    ).exists():
        raise ValidationError("The team leader must be an active volunteer and organization member.")
    if MissionAssignment.objects.filter(team=team, is_active=True).exists():
        raise ValidationError("Reassign the active mission before changing this team's leader.")
    current = TeamMembership.objects.filter(
        team=team, status=TeamMembership.Status.ACTIVE, role=TeamMembership.Role.LEADER
    ).first()
    if current and current.pk == membership.pk:
        return membership
    if current:
        current.role = TeamMembership.Role.MEMBER
        current.save(update_fields=["role", "updated_at"])
    membership.role = TeamMembership.Role.LEADER
    membership.save(update_fields=["role", "updated_at"])
    return membership


@transaction.atomic
def remove_team_member(membership, removed_by):
    team = membership.team
    if not removed_by.is_active or not OrganizationAdmin.objects.filter(
        organization=team.organization, user=removed_by, status=OrganizationAdmin.Status.ACTIVE
    ).exists():
        raise PermissionDenied("An active administrator of this organization is required.")
    if membership.status != TeamMembership.Status.ACTIVE:
        raise ValidationError("This membership is already inactive.")
    if MissionAssignment.objects.filter(team=team, is_active=True).exists():
        raise ValidationError("Reassign the active mission before removing a team member or leader.")
    membership.status = TeamMembership.Status.REMOVED
    membership.ended_at = timezone.now()
    membership.save(update_fields=["status", "ended_at", "updated_at"])
    return membership
