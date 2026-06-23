#!/bin/bash
set -e

mkdir -p /app/logs

echo "Waiting for Redis..."
for i in {1..30}; do
  if python -c "import socket; socket.create_connection(('$REDIS_HOST', $REDIS_PORT), timeout=2)" 2>/dev/null; then
    echo "Redis is ready!"
    break
  fi
  echo "Waiting for Redis... ($i/30)"
  sleep 1
done

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Seeding game data..."
python manage.py create_initial_data || echo "create_initial_data: skipped (already seeded)"
python manage.py create_video_institucional || echo "create_video_institucional: skipped (already seeded)"
python manage.py create_stage3 || echo "create_stage3: skipped (already seeded)"
python manage.py create_stage4 || echo "create_stage4: skipped (already seeded)"
python manage.py update_challenges || echo "update_challenges: skipped"

echo "Starting server..."
exec "$@"
