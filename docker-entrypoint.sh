#!/bin/bash
set -e

mkdir -p /app/logs

if [ -n "$DYNAMODB_ENDPOINT_URL" ]; then
  echo "Waiting for local DynamoDB..."
  for i in {1..30}; do
    # A bare GET against DynamoDB Local's root always answers 400 (it
    # needs a signed AWS API request) -- `curl -f` treats that as
    # failure, so this checks for ANY HTTP response, not a 2xx status.
    if curl -s -o /dev/null "$DYNAMODB_ENDPOINT_URL" 2>/dev/null; then
      echo "Local DynamoDB is ready!"
      break
    fi
    echo "Waiting for local DynamoDB... ($i/30)"
    sleep 1
  done

  echo "Creating local DynamoDB tables (idempotent)..."
  python manage.py create_local_dynamodb_tables
fi

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
