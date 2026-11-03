from django.urls import path
from . import views
urlpatterns = [
    path('org/teams/', views.index, name='org_teams'),
    path('org/teams/new/', views.edit, name='org_team_new'),
    path('org/teams/<uuid:id>/edit/', views.edit, name='org_team_edit'),
    path('admin/teams/', views.index, name='admin_teams'),
]
