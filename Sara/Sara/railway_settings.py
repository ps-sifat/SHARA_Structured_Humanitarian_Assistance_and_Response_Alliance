"""Deployment settings used only by the Railway container."""
import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from .settings import *  # noqa: F403

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    raise ImproperlyConfigured('DJANGO_SECRET_KEY must be set for Railway.')

DEBUG = False
public_domain = os.environ.get('RAILWAY_PUBLIC_DOMAIN', '').strip()
configured_hosts = [host.strip() for host in os.environ.get('DJANGO_ALLOWED_HOSTS', '').split(',') if host.strip()]
if not public_domain and not configured_hosts:
    raise ImproperlyConfigured('Set DJANGO_ALLOWED_HOSTS or generate a Railway public domain.')
ALLOWED_HOSTS = list(dict.fromkeys(configured_hosts + ([public_domain] if public_domain else []) + ['healthcheck.railway.app']))
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',') if origin.strip()]
if public_domain:
    CSRF_TRUSTED_ORIGINS.append(f'https://{public_domain}')

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

DATABASES['default']['NAME'] = Path('/data/shara.sqlite3')  # noqa: F405
MEDIA_ROOT = Path('/data/media')
STATIC_ROOT = BASE_DIR / 'staticfiles'  # noqa: F405
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')  # noqa: F405
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage'},
}
ROOT_URLCONF = 'Sara.railway_urls'
