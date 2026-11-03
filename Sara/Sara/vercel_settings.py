"""Vercel test settings. All SQLite and uploaded-file changes are temporary."""
import os
import shutil
import tempfile
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from .settings import *  # noqa: F403

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    raise ImproperlyConfigured('Set DJANGO_SECRET_KEY in Vercel project settings.')

DEBUG = False
ALLOWED_HOSTS = ['.vercel.app']
ALLOWED_HOSTS += [value.strip() for value in os.environ.get('DJANGO_ALLOWED_HOSTS', '').split(',') if value.strip()]
CSRF_TRUSTED_ORIGINS = [value.strip() for value in os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',') if value.strip()]
for variable in ('VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL'):
    hostname = os.environ.get(variable, '').strip()
    if hostname:
        ALLOWED_HOSTS.append(hostname)
        CSRF_TRUSTED_ORIGINS.append(f'https://{hostname}')

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Each function instance receives its own disposable copy. Never use for live data.
TEMP_ROOT = Path(tempfile.gettempdir()) / 'shara-vercel-test'
TEMP_ROOT.mkdir(parents=True, exist_ok=True)
database = TEMP_ROOT / 'shara.sqlite3'
if not database.exists():
    fd, name = tempfile.mkstemp(prefix='shara-seed-', dir=TEMP_ROOT)
    os.close(fd)
    temporary = Path(name)
    try:
        shutil.copyfile(BASE_DIR / 'shara.sqlite3', temporary)  # noqa: F405
        try:
            os.link(temporary, database)
        except FileExistsError:
            pass
    finally:
        temporary.unlink(missing_ok=True)
DATABASES['default']['NAME'] = database  # noqa: F405
MEDIA_ROOT = TEMP_ROOT / 'media'
MEDIA_ROOT.mkdir(exist_ok=True)
for source in (BASE_DIR / 'media').rglob('*'):  # noqa: F405
    if source.is_file():
        target = MEDIA_ROOT / source.relative_to(BASE_DIR / 'media')  # noqa: F405
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            with source.open('rb') as original, target.open('xb') as copy:
                shutil.copyfileobj(original, copy)
        except FileExistsError:
            pass

STATIC_ROOT = BASE_DIR / 'staticfiles'  # noqa: F405
ROOT_URLCONF = 'Sara.railway_urls'
