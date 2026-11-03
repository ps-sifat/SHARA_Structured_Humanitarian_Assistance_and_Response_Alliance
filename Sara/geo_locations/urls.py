from django.urls import path
from . import views

app_name = 'geo_locations'

urlpatterns = [path('unions/',views.unions,name='unions')]

