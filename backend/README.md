# SHARA Django backend

This Django/DRF monolith is the Part 1 persistence foundation. It owns the initial SQLite schema, admin inspection, demo seed command, and public health endpoint. The React application continues to use its existing local demo store until later integration phases.

## Local setup (Windows PowerShell)

From the project root:

```powershell
py -3.12 -m venv backend/.venv
& backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
$env:DJANGO_DEBUG = "true"
$env:DJANGO_SECRET_KEY = "local-development-only-change-before-deployment"
$env:DJANGO_ALLOWED_HOSTS = "localhost,127.0.0.1,testserver"
$env:DJANGO_CSRF_TRUSTED_ORIGINS = "http://localhost:8443"
Set-Location backend
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_demo
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

The checked-in `.env.example` documents variable names. Django reads process environment variables directly; no local `.env` loader or extra dependency is installed. The development-only `seed_demo` command refuses to run unless `DJANGO_DEBUG` is enabled. It creates fictional accounts with unusable passwords and never creates a Super Admin. Create a real local admin separately with `manage.py createsuperuser`.

The Vite development proxy forwards `/api/` to `VITE_DJANGO_PROXY_TARGET`, defaulting to `http://127.0.0.1:8000`. The existing hash routes and demo data are unchanged in Part 1.

The direct backend dependencies are pinned to Django 5.2.18 and Django REST framework 3.16.1; `requirements.txt` also pins their installed runtime dependencies.

## Configuration

- `DJANGO_SECRET_KEY` is mandatory when `DJANGO_DEBUG` is false.
- `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `DJANGO_SECURE_SSL_REDIRECT`, and `DJANGO_SECURE_HSTS_SECONDS` configure development/deployment behavior.
- `DJANGO_DATABASE_PATH` optionally selects a local SQLite file; the default is `backend/db.sqlite3`.
- Session login, CSRF-aware authentication APIs, workflow endpoints, and frontend data integration are Part 2 or later.
