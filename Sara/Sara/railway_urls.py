"""Keep uploaded files accessible when Django debug mode is disabled."""
from django.conf import settings
from django.urls import re_path
from django.views.static import serve

from .urls import *  # noqa: F403
from .urls import urlpatterns as app_urlpatterns

urlpatterns = [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
] + app_urlpatterns
