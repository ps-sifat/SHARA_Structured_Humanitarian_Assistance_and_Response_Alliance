from django.core.exceptions import ValidationError
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction
from django.test import Client, TestCase, override_settings

from accounts.models import User, VolunteerProfile
from accounts.phone import normalize_bd_phone
from help_requests.models import HelpRequest
from locations.models import District, Upazila
from missions.models import Mission, MissionAssignment
from organizations.models import MembershipRequest, Organization, OrganizationMembership
from teams.models import Team, TeamMembership


class DatabaseConstraintTests(TestCase):
    def setUp(self):
        self.owner = self.make_user(1, "Organization Contact")
        self.reviewer = User.objects.create_superuser(
            phone_number="01700000999", name="Test Super Admin", password="test-password"
        )
        self.district = District.objects.create(name_bn="Demo District", name_en="Demo District", is_demo_subset=True)
        self.upazila = Upazila.objects.create(
            district=self.district, name_bn="Demo Upazila", name_en="Demo Upazila", is_demo_subset=True
        )
        self.organization = Organization.objects.create(name="Demo Organization", registered_by=self.owner)

    @staticmethod
    def make_user(number, name):
        return User.objects.create_user(
            phone_number=f"01700000{number:03d}", name=name, password="test-password"
        )

    def make_volunteer(self, number):
        user = self.make_user(number, f"Volunteer {number}")
        return VolunteerProfile.objects.create(user=user, district=self.district, upazila=self.upazila)

    def make_mission(self, number):
        request = HelpRequest.objects.create(
            request_code=f"SH-TEST-{number:04d}",
            district=self.district,
            upazila=self.upazila,
            contact_phone="01700000888",
        )
        return Mission.objects.create(help_request=request)

    def test_phone_numbers_are_normalized_and_email_is_optional_and_casefolded(self):
        self.assertEqual(normalize_bd_phone("০১৭০০০০০০০১"), "+8801700000001")
        with self.assertRaises(ValidationError):
            normalize_bd_phone("call 01700000001")
        volunteer = User.objects.create_user(
            phone_number="01700-000-002", name="Normalized User", email="Person@Example.Test"
        )
        self.assertEqual(volunteer.phone_number, "+8801700000002")
        self.assertEqual(volunteer.email, "person@example.test")
        self.assertFalse(volunteer.has_usable_password())
        self.assertIsNone(self.make_user(3, "No Email").email)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                User.objects.create_user(
                    phone_number="01700000004", name="Duplicate Email", email="PERSON@example.test"
                )

    def test_volunteer_has_at_most_one_active_organization_membership_but_keeps_history(self):
        volunteer = self.make_volunteer(10)
        second_organization = Organization.objects.create(name="Second Organization", registered_by=self.owner)
        membership = OrganizationMembership.objects.create(
            organization=self.organization, volunteer=volunteer, status=OrganizationMembership.Status.ACTIVE
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                OrganizationMembership.objects.create(
                    organization=second_organization, volunteer=volunteer, status=OrganizationMembership.Status.ACTIVE
                )

        membership.status = OrganizationMembership.Status.ENDED
        membership.save(update_fields=["status", "updated_at"])
        OrganizationMembership.objects.create(
            organization=second_organization, volunteer=volunteer, status=OrganizationMembership.Status.ACTIVE
        )
        self.assertEqual(OrganizationMembership.objects.filter(volunteer=volunteer).count(), 2)

    def test_only_one_pending_membership_request_exists_per_volunteer_and_organization(self):
        volunteer = self.make_volunteer(11)
        MembershipRequest.objects.create(organization=self.organization, volunteer=volunteer)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                MembershipRequest.objects.create(organization=self.organization, volunteer=volunteer)

        MembershipRequest.objects.create(
            organization=self.organization, volunteer=volunteer, status=MembershipRequest.Status.REJECTED
        )
        self.assertEqual(MembershipRequest.objects.filter(volunteer=volunteer).count(), 2)

    def test_volunteer_has_one_active_team_and_team_has_one_active_leader(self):
        volunteer = self.make_volunteer(12)
        other_volunteer = self.make_volunteer(13)
        first_team = Team.objects.create(organization=self.organization, name="First Team")
        second_team = Team.objects.create(organization=self.organization, name="Second Team")
        TeamMembership.objects.create(team=first_team, volunteer=volunteer, role=TeamMembership.Role.LEADER)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                TeamMembership.objects.create(team=second_team, volunteer=volunteer)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                TeamMembership.objects.create(team=first_team, volunteer=other_volunteer, role=TeamMembership.Role.LEADER)

        TeamMembership.objects.create(team=first_team, volunteer=other_volunteer, role=TeamMembership.Role.MEMBER)
        self.assertEqual(first_team.memberships.filter(status=TeamMembership.Status.ACTIVE).count(), 2)

    def test_mission_assignment_history_allows_only_one_active_assignment(self):
        mission = self.make_mission(1)
        first_team = Team.objects.create(organization=self.organization, name="Mission Team One")
        second_team = Team.objects.create(organization=self.organization, name="Mission Team Two")
        assignment = MissionAssignment.objects.create(
            mission=mission,
            team=first_team,
            assigned_team_leader=self.owner,
            assigned_by=self.reviewer,
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                MissionAssignment.objects.create(
                    mission=mission,
                    team=second_team,
                    assigned_team_leader=self.owner,
                    assigned_by=self.reviewer,
                )

        assignment.is_active = False
        assignment.save(update_fields=["is_active", "updated_at"])
        MissionAssignment.objects.create(
            mission=mission,
            team=second_team,
            assigned_team_leader=self.owner,
            assigned_by=self.reviewer,
        )
        self.assertEqual(mission.assignments.count(), 2)
        self.assertEqual(mission.assignments.filter(is_active=True).count(), 1)

    def test_request_verification_is_separate_from_mission_status(self):
        mission = self.make_mission(2)
        self.assertEqual(mission.help_request.verification_status, HelpRequest.VerificationStatus.PENDING)
        self.assertEqual(mission.status, Mission.Status.AWAITING_ASSIGNMENT)

    def test_help_request_rejects_zero_people_at_the_database_layer(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                HelpRequest.objects.create(
                    request_code="SH-TEST-0000",
                    district=self.district,
                    upazila=self.upazila,
                    contact_phone="01700000888",
                    people_affected=0,
                )

    @override_settings(DEBUG=True)
    def test_demo_seed_is_idempotent_and_creates_no_super_admin(self):
        from django.core.management import call_command

        superuser_count = User.objects.filter(is_superuser=True).count()
        call_command("seed_demo", verbosity=0)
        counts = (
            User.objects.count(),
            District.objects.count(),
            Upazila.objects.count(),
            Organization.objects.count(),
            HelpRequest.objects.count(),
        )
        call_command("seed_demo", verbosity=0)

        self.assertEqual(
            counts,
            (
                User.objects.count(),
                District.objects.count(),
                Upazila.objects.count(),
                Organization.objects.count(),
                HelpRequest.objects.count(),
            ),
        )
        self.assertEqual(User.objects.filter(is_superuser=True).count(), superuser_count)
        self.assertTrue(District.objects.filter(is_demo_subset=True).exists())

    @override_settings(DEBUG=False)
    def test_demo_seed_refuses_to_run_outside_development(self):
        from django.core.management import call_command

        with self.assertRaises(CommandError):
            call_command("seed_demo", verbosity=0)

    def test_health_endpoint_is_public_and_returns_ok(self):
        response = Client().get("/api/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
