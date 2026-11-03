from django.urls import path
from . import views
urlpatterns = [
    path('volunteer/missions/', views.index, name='volunteer_missions'),
    path('volunteer/missions/<uuid:id>/', views.detail, name='volunteer_mission_detail'),
    path('org/missions/', views.index, name='org_missions'),
    path('org/missions/<uuid:id>/', views.detail, name='org_mission_detail'),
    path('admin/missions/', views.index, name='admin_missions'),
    path('admin/missions/<uuid:id>/', views.detail, name='admin_mission_detail'),
]
