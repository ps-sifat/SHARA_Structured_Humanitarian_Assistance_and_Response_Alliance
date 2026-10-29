# SHARA Django backend

The Django/DRF backend uses SQLite and owns identity, volunteer profiles, organization registration/review, and organization membership. Session cookies authenticate the React app. See [the API contract](../docs/api.md) for endpoint and permission details.

## Start locally on Windows PowerShell

From the project root, create the environment once:

```powershell
py -3.12 -m venv backend/.venv
& backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
```

In the backend terminal, configure development settings, migrate, seed the small fictional location/skill subset, create a real Super Admin, and run Django:

```powershell
$env:DJANGO_DEBUG = "true"
$env:DJANGO_SECRET_KEY = "local-development-only-change-before-deployment"
$env:DJANGO_ALLOWED_HOSTS = "localhost,127.0.0.1,testserver"
$env:DJANGO_CSRF_TRUSTED_ORIGINS = "http://localhost:8443"
Set-Location backend
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_demo
.\.venv\Scripts\python.exe manage.py createsuperuser
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Create the Super Admin with a normalized Bangladesh phone number and a strong password. The volunteer registration flow in the frontend creates ordinary users; it cannot create privileged roles. The seed command does not create an administrator or usable demo passwords.

The Vite app is normally already running on port `8443` in Figma Make. If starting it yourself, open a second terminal at the project root and run `npm run dev -- --port 8443`. Vite proxies same-origin `/api/` requests to `http://127.0.0.1:8000`; override the target with `VITE_DJANGO_PROXY_TARGET` if needed.

## Try the identity and organization flow

1. Open the Vite preview and register a volunteer. The district/upazila/skill options come from the database, so run `seed_demo` first.
2. Submit an organization registration while signed in, then use **Organization status** to see the pending application.
3. Sign out and sign in as the Super Admin. Open `/admin/organizations` and approve or reject the application with a reason.
4. Sign in as the applicant again. The approved organization appears as an authorized organization workspace. Register a second volunteer, request membership from **Find organizations**, then sign in as the organization admin to approve or reject it.
5. Change a password from the workspace sidebar. Login accepts the normalized email or Bangladesh phone number.

The seeded accounts are fictional and have unusable passwords. They provide limited locations and skills only; create real local accounts through the UI for login and workflow checks. Organization registration and membership use database records; other incomplete workflows are marked as local sample data.

## Tests and checks

From `backend/`:

```powershell
$env:DJANGO_DEBUG = "true"
.\.venv\Scripts\python.exe manage.py test tests
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

The frontend checks from the project root are `npm run typecheck`, `npm run build`, and `npm test`.

## Configuration and deployment

- `DJANGO_SECRET_KEY` is mandatory when `DJANGO_DEBUG` is false. Use a secret generated outside the repository.
- `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `DJANGO_SECURE_SSL_REDIRECT`, and `DJANGO_SECURE_HSTS_SECONDS` control deployment settings.
- `DJANGO_DATABASE_PATH` optionally selects a local SQLite database; the default is `backend/db.sqlite3`.
- Session and CSRF cookies are `SameSite=Lax`; the session cookie is HTTP-only and secure outside development. Serve production frontend/API from one origin and use HTTPS.
- `.env.example` documents variable names only. Django reads process environment variables directly; no `.env` loader is installed.
- `seed_demo` refuses to run unless `DJANGO_DEBUG` is enabled. It creates no Super Admin and performs no SMS/email delivery.
