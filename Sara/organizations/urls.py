from django.urls import path
from . import views
urlpatterns = [
    path('organization/register/', views.register, name='organization_register'),
    path('org/', views.dashboard, name='org_dashboard'),
    path('org/profile/', views.profile, name='org_profile'),
    path('org/memberships/', views.memberships, name='org_memberships'),
    path('org/volunteers/', views.memberships, {'approved_members':True}, name='org_volunteers'),
    path('admin/organizations/', views.review, name='admin_organizations'),
]
