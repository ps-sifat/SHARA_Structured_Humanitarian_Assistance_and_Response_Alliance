from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from accounts.models import Skill, User, VolunteerProfile
from help_requests.models import AssistanceCategory, HelpRequest
from locations.models import District, Upazila
from notifications.models import Notification
from organizations.models import MembershipRequest, Organization
from suppliers.models import Supplier, SupplierResource


class Command(BaseCommand):
    help = "Create a small, fictional SHARA dataset for local development only."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo is available only when DJANGO_DEBUG is enabled.")

        kurigram, _ = District.objects.get_or_create(
            name_bn="কুড়িগ্রাম",
            defaults={"name_en": "Kurigram", "is_demo_subset": True},
        )
        sunamganj, _ = District.objects.get_or_create(
            name_bn="সুনামগঞ্জ",
            defaults={"name_en": "Sunamganj", "is_demo_subset": True},
        )
        kurigram_sadar, _ = Upazila.objects.get_or_create(
            district=kurigram,
            name_bn="কুড়িগ্রাম সদর",
            defaults={"name_en": "Kurigram Sadar", "is_demo_subset": True},
        )
        sunamganj_sadar, _ = Upazila.objects.get_or_create(
            district=sunamganj,
            name_bn="সুনামগঞ্জ সদর",
            defaults={"name_en": "Sunamganj Sadar", "is_demo_subset": True},
        )

        skills = [
            Skill.objects.get_or_create(name="First aid")[0],
            Skill.objects.get_or_create(name="Boat operation")[0],
            Skill.objects.get_or_create(name="Food distribution")[0],
        ]
        categories = [
            AssistanceCategory.objects.get_or_create(
                code=code, defaults={"name_bn": name_bn, "name_en": name_en}
            )[0]
            for code, name_bn, name_en in [
                ("food", "খাদ্য", "Food"),
                ("clean-water", "বিশুদ্ধ পানি", "Clean water"),
                ("medicine", "ওষুধ", "Medicine"),
                ("rescue", "উদ্ধার", "Rescue"),
                ("shelter", "আশ্রয়", "Shelter"),
            ]
        ]

        volunteer_a = self.get_demo_user("+8801700000001", "Demo Volunteer A", "volunteer-a@example.test")
        volunteer_b = self.get_demo_user("+8801700000002", "Demo Volunteer B", "volunteer-b@example.test")
        organization_contact = self.get_demo_user(
            "+8801700000003", "Demo Organization Contact", "organization-contact@example.test"
        )
        profile_a, _ = VolunteerProfile.objects.get_or_create(
            user=volunteer_a,
            defaults={"district": kurigram, "upazila": kurigram_sadar, "availability": "available"},
        )
        profile_b, _ = VolunteerProfile.objects.get_or_create(
            user=volunteer_b,
            defaults={"district": sunamganj, "upazila": sunamganj_sadar, "availability": "limited"},
        )
        profile_a.skills.set(skills[:2])
        profile_b.skills.set(skills[1:])
        profile_a.service_upazilas.add(kurigram_sadar)
        profile_b.service_upazilas.add(sunamganj_sadar)

        organization, _ = Organization.objects.get_or_create(
            name="Demo River Response Group",
            registered_by=organization_contact,
            defaults={
                "description": "Fictional organization for local development.",
                "organization_type": "Community group",
                "contact_email": "contact@example.test",
                "contact_phone": "+8801700000003",
                "office_district": kurigram,
                "office_upazila": kurigram_sadar,
                "registration_status": Organization.RegistrationStatus.PENDING,
            },
        )
        organization.service_districts.add(kurigram)
        organization.service_upazilas.add(kurigram_sadar)
        MembershipRequest.objects.get_or_create(organization=organization, volunteer=profile_a, status="pending")

        direct_request, _ = HelpRequest.objects.get_or_create(
            request_code="SH-DEMO-0001",
            defaults={
                "reporter_type": HelpRequest.ReporterType.DIRECT,
                "affected_person_name": "Fictional Person A",
                "contact_phone": "+8801700000011",
                "district": kurigram,
                "upazila": kurigram_sadar,
                "people_affected": 4,
                "description": "Fictional request used to preview the request workflow.",
                "priority": HelpRequest.Priority.HIGH,
            },
        )
        direct_request.assistance_categories.set([categories[0], categories[1]])
        proxy_request, _ = HelpRequest.objects.get_or_create(
            request_code="SH-DEMO-0002",
            defaults={
                "reporter_type": HelpRequest.ReporterType.PROXY,
                "affected_person_name": "Fictional Person B",
                "contact_phone": "+8801700000012",
                "reporter_name": "Demo Neighbor",
                "reporter_phone": "+8801700000013",
                "relation_to_affected": "Neighbor",
                "district": sunamganj,
                "upazila": sunamganj_sadar,
                "people_affected": 2,
                "description": "Fictional proxy request used for local development.",
            },
        )
        proxy_request.assistance_categories.set([categories[2], categories[4]])

        supplier, _ = Supplier.objects.get_or_create(
            name="Demo Relief Supplier",
            defaults={
                "category": "Food supplies",
                "contact_name": "Demo Contact",
                "contact_phone": "+8801700000020",
                "contact_email": "supplier@example.test",
                "location_label": "Kurigram (demo subset)",
                "upazila": kurigram_sadar,
                "status": Supplier.Status.PENDING,
            },
        )
        SupplierResource.objects.get_or_create(
            supplier=supplier,
            name="Fictional food pack",
            defaults={"category": "Food", "quantity": 20, "unit": "packs", "note": "Demo quantity only."},
        )
        Notification.objects.get_or_create(
            user=volunteer_a,
            title="Welcome to the SHARA demo",
            category="demo",
            defaults={"body": "This fictional record is for local development only."},
        )

        self.stdout.write(self.style.SUCCESS("Created or confirmed fictional SHARA demo records."))
        self.stdout.write("The location records are an explicitly marked subset; no full Bangladesh import was created.")
        self.stdout.write("Demo accounts have unusable passwords. No Super Admin or SMS/email delivery integration was configured.")

    @staticmethod
    def get_demo_user(phone_number, name, email):
        user = User.objects.filter(phone_number=phone_number).first()
        if user:
            return user
        return User.objects.create_user(
            phone_number=phone_number,
            name=name,
            email=email,
            is_active=True,
        )
