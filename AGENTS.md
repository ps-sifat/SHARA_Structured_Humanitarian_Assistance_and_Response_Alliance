# SHARA Django project

SHARA is a Django application with HTML templates, page-specific CSS and JavaScript, and static assets.

## Project structure

- `django/SHARA/manage.py` is the Django command entry point.
- `django/SHARA/SHARA/` contains settings, URL routing, and ASGI/WSGI entry points.
- `django/SHARA/templates/` contains the shared shell and page templates, styles, and scripts.
- `django/SHARA/static/` contains shared images, icons, and fonts.
- `django/SHARA/requirements.txt` lists Python dependencies.

## Local development

Create a Python virtual environment and install dependencies from the repository root:

```powershell
python -m venv django/.venv
.\django\.venv\Scripts\python.exe -m pip install -r .\django\SHARA\requirements.txt
.\django\.venv\Scripts\python.exe .\django\SHARA\manage.py runserver
```

The application does not require Node.js or npm. Runtime configuration uses `DJANGO_DEBUG`, `DJANGO_SECRET_KEY`, and `DJANGO_ALLOWED_HOSTS`; environment files are not loaded automatically.
