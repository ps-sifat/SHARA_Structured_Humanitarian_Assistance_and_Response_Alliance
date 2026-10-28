from django.core.exceptions import PermissionDenied
from django.test import TestCase

from accounts.models import User, VolunteerProfile
from help_requests.models import HelpRequest
from locations.models import District, Upazila
from missions.models import Mission
from missions.services import assign_mission_to_team, record_mission_update
from organizations.models import MembershipRequest, Organization, OrganizationAdmin, OrganizationMembership
from organizations.services import approve_membership_request, approve_organization_registration
from teams.models import Team, TeamMembership


class DomainServiceTests(TestCase):
    def setUp(self):
        self.super_admin = User.objects.create_superuser(
            phone_number="01700000101", name="Demo Super Admin", password="test-password"
        )
        self.owner = User.objects.create_user(
            phone_number="01700000102", name="Demo Organization Contact", password="test-password"
        )
        self.volunteer_user = User.objects.create_user(
            phone_number="01700000103", name="Demo Volunteer", password="test-password"
        )
        self.district = District.objects.create(name_bn="Demo District", name_en="Demo District")
        self.upazila = Upazila.objects.create(district=self.district, name_bn="Demo Upazila", name_en="Demo Upazila")
        self.organization = Organization.objects.create(name="Demo Organization", registered_by=self.owner)
        self.volunteer = VolunteerProfile.objects.create(
            user=self.volunteer_user, district=self.district, upazila=self.upazila
        )

    def test_super_admin_approval_grants_admin_to_the_linked_registration_user(self):
        approve_organization_registration(self.organization, self.super_admin)

        self.assertEqual(self.organization.registration_status, Organization.RegistrationStatus.APPROVED)
        self.assertTrue(
            OrganizationAdmin.objects.filter(
                organization=self.organization, user=self.owner, status=OrganizationAdmin.Status.ACTIVE
            ).exists()
        )

    def test_only_this_organizations_admin_can_approve_volunteer_membership(self):
        approve_organization_registration(self.organization, self.super_admin)
        request = MembershipRequest.objects.create(organization=self.organization, volunteer=self.volunteer)

        with self.assertRaises(PermissionDenied):
            approve_membership_request(request, self.super_admin)

        membership = approve_membership_request(request, self.owner)
        self.assertEqual(membership.status, OrganizationMembership.Status.ACTIVE)
        self.assertEqual(request.status, MembershipRequest.Status.APPROVED)

    def test_mission_reassignment_closes_previous_row_and_keeps_assigned_leader(self):
        approve_organization_registration(self.organization, self.super_admin)
        OrganizationMembership.objects.create(organization=self.organization, volunteer=self.volunteer)
        request = HelpRequest.objects.create(
            request_code="SH-SERVICE-01",
            district=self.district,
            upazila=self.upazila,
            contact_phone="01700000888",
            verification_status=HelpRequest.VerificationStatus.VERIFIED,
        )
        mission = Mission.objects.create(help_request=request)
        first_team = Team.objects.create(organization=self.organization, name="First Team")
        second_team = Team.objects.create(organization=self.organization, name="Second Team")
        TeamMembership.objects.create(team=first_team, volunteer=self.volunteer, role=TeamMembership.Role.LEADER)
        second_leader = User.objects.create_user(
            phone_number="01700000104", name="Second Volunteer", password="test-password"
        )
        second_profile = VolunteerProfile.objects.create(
            user=second_leader, district=self.district, upazila=self.upazila
        )
        OrganizationMembership.objects.create(organization=self.organization, volunteer=second_profile)
        TeamMembership.objects.create(team=second_team, volunteer=second_profile, role=TeamMembership.Role.LEADER)

        first_assignment = assign_mission_to_team(mission, first_team, self.super_admin)
        next_assignment = assign_mission_to_team(mission, second_team, self.super_admin, "Reassignment")

        first_assignment.refresh_from_db()
        self.assertFalse(first_assignment.is_active)
        self.assertIsNotNone(first_assignment.ended_at)
        self.assertEqual(next_assignment.assigned_team_leader, second_leader)
        self.assertEqual(mission.assignments.count(), 2)
        self.assertEqual(mission.assignments.filter(is_active=True).count(), 1)
        update = record_mission_update(mission, second_leader, Mission.Status.ACKNOWLEDGED)
        self.assertEqual(update.status, Mission.Status.ACKNOWLEDGED)
        with self.assertRaises(PermissionDenied):
            record_mission_update(mission, self.super_admin, Mission.Status.ONGOING)
