from django.urls import path
from . import views
urlpatterns = [
    path('', views.home, name='home'),
    path('apply/', views.apply, name='apply'),
    path('track/', views.track, name='track'),
    path('volunteer/requests/', views.index, name='volunteer_requests'),
    path('org/requests/', views.index, name='org_requests'),
    path('org/requests/<uuid:id>/', views.detail, name='org_request_detail'),
    path('admin/requests/', views.index, name='admin_requests'),
    path('admin/requests/<uuid:id>/', views.detail, name='admin_request_detail'),
]
