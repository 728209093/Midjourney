#!/usr/bin/env bash
# Deploy this Next.js app on the Lightsail server.
# Usage: cd /home/ubuntu/Midjourney && bash deploy.sh

set -euo pipefail

APP_NAME="${APP_NAME:-midjourney}"
APP_DIR="${APP_DIR:-/home/ubuntu/Midjourney}"
BRANCH="${BRANCH:-master}"
PORT="${PORT:-5000}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"

echo "Starting deploy: $APP_NAME"

cd "$APP_DIR"

echo "Updating code from origin/$BRANCH..."
git pull origin "$BRANCH"

echo "Building Docker image..."
docker build -t "$APP_NAME" .

echo "Restarting container..."
docker stop "$APP_NAME" 2>/dev/null || true
docker rm "$APP_NAME" 2>/dev/null || true

DOCKER_ENV_ARGS=()
if [ -f "$ENV_FILE" ]; then
  echo "Loading optional env file: $ENV_FILE"
  DOCKER_ENV_ARGS+=(--env-file "$ENV_FILE")
else
  echo "No env file found, using dynamic API settings from the app."
fi

docker run -d \
  --name "$APP_NAME" \
  --restart unless-stopped \
  "${DOCKER_ENV_ARGS[@]}" \
  -p "${PORT}:5000" \
  "$APP_NAME"

echo "Cleaning unused images..."
docker image prune -f

echo
echo "Deploy finished."
docker ps --filter "name=$APP_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo
echo "Local check:"
curl -I "http://127.0.0.1:${PORT}" || true
