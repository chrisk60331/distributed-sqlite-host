#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# ── Clean runtime/build state ─────────────────────────────────────────────────
echo "🧹  Cleaning build artifacts..."
rm -rf api/__pycache__ api/**/__pycache__ api/*.pyc
rm -rf web/.next

# ── Trap: kill all child processes on exit ────────────────────────────────────
pids=()
cleanup() {
  echo ""
  echo "⏹  Stopping services..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  docker compose stop 2>/dev/null || true
  wait
}
trap cleanup EXIT SIGINT SIGTERM

# ── LocalStack (S3) ───────────────────────────────────────────────────────────
echo "🐳  Starting LocalStack..."
docker compose up -d localstack

echo "⏳  Waiting for LocalStack to be healthy..."
until curl -sf http://localhost:4566/_localstack/health | grep -q '"s3": "available"'; do
  sleep 1
done
echo "✅  LocalStack is ready"
S3_BUCKET="${S3_BUCKET:-db-host-databases}"
awslocal s3 mb "s3://${S3_BUCKET}" || true

echo "🔐  Ensuring LocalStack IAM role for tenant STS..."
DB_HOST_S3_ASSUMABLE_ROLE_ARN="$(bash "${SCRIPT_DIR}/scripts/bootstrap-localstack-sts.sh")"
export DB_HOST_S3_ASSUMABLE_ROLE_ARN
echo "   DB_HOST_S3_ASSUMABLE_ROLE_ARN=${DB_HOST_S3_ASSUMABLE_ROLE_ARN}"

# ── Python API ────────────────────────────────────────────────────────────────
if lsof -iTCP:8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "❌  Port 8000 is already in use — another API may be bound there."
  echo "    macOS can end up with two listeners (e.g. 127.0.0.1 vs 0.0.0.0), and"
  echo "    the browser may hit a stale process: signup returns 500 with no CORS."
  echo "    Fix: stop extras, then rerun.  Example:  lsof -nP -iTCP:8000 -sTCP:LISTEN"
  exit 1
fi
echo "🐍  Setting up Python virtual environment..."
if [ ! -d api/.venv ]; then
  (cd api && uv venv)
fi
(cd api && uv run uvicorn main:app --host 0.0.0.0 --port 8000 ) &
pids+=($!)

# Wait for API to be accepting connections before starting the frontend
echo "⏳  Waiting for API..."
until curl -sf http://localhost:8000/health > /dev/null 2>&1; do sleep 1; done
echo "✅  API is ready"

# ── Next.js frontend ──────────────────────────────────────────────────────────
echo "🌐  Installing frontend dependencies..."
(cd web && npm install --silent)

# Sync env vars to .env.local for Next.js
if [ -f .env ]; then
  grep -E "^(NEXT_PUBLIC_|PUBLIC_API_)" .env > web/.env.local 2>/dev/null || true
else
  echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > web/.env.local
fi

echo "🌐  Starting frontend on :3000..."
(cd web && npm run dev 2>&1 | sed -u 's/^/\x1b[35m[WEB]\x1b[0m /') &
pids+=($!)

# ── Wait ──────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  db-host is running"
echo "  Frontend   →  http://localhost:3000"
echo "  API        →  http://localhost:8000"
echo "  LocalStack →  http://localhost:4566"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

wait
