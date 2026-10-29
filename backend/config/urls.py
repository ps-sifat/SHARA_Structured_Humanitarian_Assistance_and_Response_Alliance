from django.contrib import admin
from django.urls import include, path
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter

from accounts.views import VolunteerProfileView
from locations.views import DistrictViewSet, SkillViewSet
from organizations.views import MembershipRequestViewSet, OrganizationMembershipViewSet, OrganizationViewSet


def health(request):
    return JsonResponse({"status": "ok"})


router = DefaultRouter()
router.register("locations/districts", DistrictViewSet, basename="district")
router.register("skills", SkillViewSet, basename="skill")
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("membership-requests", MembershipRequestViewSet, basename="membership-request")
router.register("memberships", OrganizationMembershipViewSet, basename="membership")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="api-health"),
    path("api/auth/", include("accounts.urls")),
    path("api/profile/", VolunteerProfileView.as_view(), name="api-volunteer-profile"),
    path("api/", include(router.urls)),
]
