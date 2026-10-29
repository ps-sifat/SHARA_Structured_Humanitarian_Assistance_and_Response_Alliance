from rest_framework.permissions import AllowAny
from rest_framework.viewsets import ReadOnlyModelViewSet

from accounts.models import Skill
from accounts.serializers import SkillSerializer

from .models import District
from .serializers import DistrictSerializer


class DistrictViewSet(ReadOnlyModelViewSet):
    queryset = District.objects.prefetch_related("upazilas").all()
    serializer_class = DistrictSerializer
    permission_classes = [AllowAny]


class SkillViewSet(ReadOnlyModelViewSet):
    queryset = Skill.objects.filter(is_active=True)
    serializer_class = SkillSerializer
    permission_classes = [AllowAny]
