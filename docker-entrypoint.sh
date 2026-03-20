#!/usr/bin/env bash
# Container entrypoint for db-host.
# Starts FastAPI on :8000 (loopback) and Next.js standalone on :$PORT (8080).
# Next.js rewrites /api/* → http://127.0.0.1:8000/* so only $PORT is exposed.
set -euo pipefail

PORT="${PORT:-8080}"

# ── FastAPI ────────────────────────────────────────────────────────────────────
echo "Starting FastAPI on 127.0.0.1:8000..."
cd /app/api
uvicorn main:app --host 127.0.0.1 --port 8000 &
API_PID=$!

# Wait for the API to accept connections before Next.js starts proxying to it.
echo "Waiting for FastAPI..."
until curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; do
  # Bail early if the API process died.
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "FastAPI process exited unexpectedly" >&2
    exit 1
  fi
  sleep 1
done
echo "FastAPI ready"

# ── Next.js standalone ────────────────────────────────────────────────────────
echo "Starting Next.js on :${PORT}..."
cd /app/web
HOSTNAME=0.0.0.0 PORT="${PORT}" node server.js &
WEB_PID=$!

# ── Graceful shutdown (App Runner sends SIGTERM on deploy/stop) ────────────────
_shutdown() {
  echo "Shutting down..."
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
  wait "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap _shutdown EXIT SIGTERM SIGINT

echo "db-host running — API :8000 (internal) | Web :${PORT} (exposed)"
wait
