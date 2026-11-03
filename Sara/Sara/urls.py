from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path
from django.views.generic import RedirectView
from . import views

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('locations/', include('geo_locations.urls')),
    path('', include('shara_accounts.urls')),
    path('', include('organizations.urls')),
    path('', include('volunteers.urls')),
    path('', include('response_teams.urls')),
    path('', include('requests.urls')),
    path('', include('missions.urls')),
    path('', include('resource_contacts.urls')),
    path('admin/', views.dashboard, name='admin_dashboard'),
    path('privacy/', views.privacy, name='privacy'),
    path('access-denied/', views.denied, name='access_denied'),
    path('map/', RedirectView.as_view(pattern_name='home', permanent=False), name='map'),
    path('admin/suppliers/', RedirectView.as_view(pattern_name='admin_resources', permanent=False), name='admin_suppliers'),
    path('volunteer/teams/', RedirectView.as_view(pattern_name='volunteer_organizations', permanent=False), name='volunteer_teams'),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
handler403 = 'Sara.views.denied'
handler404 = 'Sara.views.not_found'
handler500 = 'Sara.views.server_error'
