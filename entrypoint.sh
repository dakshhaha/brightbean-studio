#!/bin/sh
set -e

echo "Starting BrightBean Studio on Render..."

# Apply database migrations to Turso
echo "Applying database migrations..."
python manage.py migrate --noinput || echo "Migration warning, continuing..."

# Start the background task worker process in the background
echo "Starting background worker..."
python manage.py run_studio_worker --sleep 2 &

# Start Gunicorn web server
echo "Starting Gunicorn on port ${PORT:-8000}..."
exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 1 --threads 4
