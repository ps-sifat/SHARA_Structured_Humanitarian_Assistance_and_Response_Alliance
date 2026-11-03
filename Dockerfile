FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt ./
COPY government_officer_crawler ./government_officer_crawler
COPY Sara ./Sara
COPY scripts/check_railway_assets.py ./scripts/check_railway_assets.py
RUN python scripts/check_railway_assets.py
RUN pip install --no-cache-dir -r requirements.txt gunicorn==26.2.0 whitenoise==6.11.0

COPY scripts/railway_start.py ./scripts/railway_start.py

ENV DJANGO_SETTINGS_MODULE=Sara.railway_settings
CMD ["python", "scripts/railway_start.py"]
