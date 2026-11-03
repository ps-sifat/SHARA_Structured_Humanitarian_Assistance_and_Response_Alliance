from django.urls import path
from . import views
urlpatterns = [
    path('volunteer/register/', views.register, name='volunteer_register'),
    path('volunteer/', views.dashboard, name='volunteer_dashboard'),
    path('volunteer/profile/edit/', views.profile, name='volunteer_profile'),
    path('volunteer/organizations/', views.organizations, name='volunteer_organizations'),
    path('volunteer/organization/', views.organization, name='volunteer_organization'),
    path('volunteer/team/', views.team, name='volunteer_team'),
]
