from django.contrib import admin
from django.urls import include, path
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter

from accounts.views import VolunteerProfileView
from help_requests.views import HelpRequestViewSet
from missions.views import MissionViewSet
from locations.views import DistrictViewSet, PublicMapSummaryView, SkillViewSet
from organizations.views import MembershipRequestViewSet, OrganizationMembershipViewSet, OrganizationViewSet
from teams.views import TeamMembershipViewSet, TeamViewSet


def health(request):
    return JsonResponse({"status": "ok"})


router = DefaultRouter()
router.register("locations/districts", DistrictViewSet, basename="district")
router.register("skills", SkillViewSet, basename="skill")
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("help-requests", HelpRequestViewSet, basename="help-request")
router.register("teams", TeamViewSet, basename="team")
router.register("team-memberships", TeamMembershipViewSet, basename="team-membership")
router.register("missions", MissionViewSet, basename="mission")
router.register("membership-requests", MembershipRequestViewSet, basename="membership-request")
router.register("memberships", OrganizationMembershipViewSet, basename="membership")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="api-health"),
    path("api/auth/", include("accounts.urls")),
    path("api/profile/", VolunteerProfileView.as_view(), name="api-volunteer-profile"),
    path("api/map/summary/", PublicMapSummaryView.as_view(), name="api-public-map-summary"),
    path("api/", include(router.urls)),
]
