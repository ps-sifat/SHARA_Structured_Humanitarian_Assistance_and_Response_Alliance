from django.db.models import Count
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ReadOnlyModelViewSet

from accounts.models import Skill
from accounts.serializers import SkillSerializer

from .models import District
from .serializers import DistrictSerializer


class PublicMapSummaryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        from help_requests.models import HelpRequest

        counts = dict(
            HelpRequest.objects.filter(verification_status=HelpRequest.VerificationStatus.VERIFIED)
            .values("district_id")
            .annotate(total=Count("id"))
            .values_list("district_id", "total")
        )
        return Response(
            [
                {
                    "district_id": district.pk,
                    "district": district.name_en or district.name_bn,
                    "verified_requests": counts[district.pk] if counts.get(district.pk, 0) >= 3 else None,
                    "count_label": "3+" if counts.get(district.pk, 0) >= 3 else "not_reported",
                }
                for district in District.objects.all().order_by("name_en", "name_bn")
            ]
        )


class DistrictViewSet(ReadOnlyModelViewSet):
    queryset = District.objects.prefetch_related("upazilas").all()
    serializer_class = DistrictSerializer
    permission_classes = [AllowAny]


class SkillViewSet(ReadOnlyModelViewSet):
    queryset = Skill.objects.filter(is_active=True)
    serializer_class = SkillSerializer
    permission_classes = [AllowAny]
