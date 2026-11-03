from django.urls import path
from . import views
urlpatterns = [
    path('resources/', views.index, name='resources'),
    path('admin/resources/', views.manage, name='admin_resources'),
]
