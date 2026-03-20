#!/usr/bin/env bash
# Start LocalStack + the containerised db-host app for local smoke testing.
#
# Usage:
#   bash start-docker.sh              # builds image, then runs
#   bash start-docker.sh --no-build   # skips docker build (reuses existing image)
#
# The app is served on http://localhost:$PORT (default 8080).
# LocalStack remains on http://localhost:4566.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"

IMAGE="db-host"
CONTAINER="db-host-app"
PORT="${PORT:-8080}"

BUILD=1
for arg in "$@"; do
  case "$arg" in
    --no-build) BUILD=0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# ── Trap: stop container + LocalStack on exit ─────────────────────────────────
cleanup() {
  echo ""
  echo "⏹  Stopping..."
  docker stop "${CONTAINER}" 2>/dev/null || true
  docker compose stop 2>/dev/null || true
}
trap cleanup EXIT SIGINT SIGTERM

# ── LocalStack ────────────────────────────────────────────────────────────────
echo "🐳  Starting LocalStack..."
docker compose up -d localstack

echo "⏳  Waiting for LocalStack to be healthy..."
until curl -sf http://localhost:4566/_localstack/health | grep -q '"s3": "available"'; do
  sleep 1
done
echo "✅  LocalStack ready"

S3_BUCKET="${S3_BUCKET:-db-host-databases}"
awslocal s3 mb "s3://${S3_BUCKET}" 2>/dev/null || true

echo "☁️   Uploading CFN template to LocalStack..."
BYO_BUCKET_CF_TEMPLATE_URL="$(bash "${SCRIPT_DIR}/scripts/upload-cfn-template.sh" \
  --endpoint http://localhost:4566 --bucket db-host-public)"
echo "   BYO_BUCKET_CF_TEMPLATE_URL=${BYO_BUCKET_CF_TEMPLATE_URL}"

echo "🔐  Ensuring LocalStack IAM role for tenant STS..."
DB_HOST_S3_ASSUMABLE_ROLE_ARN="$(bash "${SCRIPT_DIR}/scripts/bootstrap-localstack-sts.sh")"
echo "   DB_HOST_S3_ASSUMABLE_ROLE_ARN=${DB_HOST_S3_ASSUMABLE_ROLE_ARN}"

# ── Build ─────────────────────────────────────────────────────────────────────
if [[ "${BUILD}" == "1" ]]; then
  echo "🔨  Building Docker image: ${IMAGE}..."
  docker build -t "${IMAGE}" .
else
  echo "⏭  Skipping build (--no-build)"
fi

# Remove any stale container with the same name
docker rm -f "${CONTAINER}" 2>/dev/null || true

# ── Run ───────────────────────────────────────────────────────────────────────
echo "🚀  Starting container: ${CONTAINER} on :${PORT}..."

# On macOS/Windows, the host is reachable from inside a container via
# host.docker.internal.  We override AWS_ENDPOINT_URL so the app reaches
# LocalStack, and pin NEXT_PUBLIC_API_URL to /api (already baked at build
# time but guard against the .env value leaking through env-file).
DOCKER_RUN_ARGS=(
  --rm
  --name "${CONTAINER}"
  -p "${PORT}:${PORT}"
  -e PORT="${PORT}"
  -e AWS_ENDPOINT_URL=http://host.docker.internal:4566
  -e BYO_BUCKET_CF_TEMPLATE_URL="${BYO_BUCKET_CF_TEMPLATE_URL}"
  -e DB_HOST_S3_ASSUMABLE_ROLE_ARN="${DB_HOST_S3_ASSUMABLE_ROLE_ARN}"
  -e NEXT_PUBLIC_API_URL=/api
  -e PUBLIC_API_BASE_URL="http://localhost:${PORT}/api"
  -e FRONTEND_URL="http://localhost:${PORT}"
)

# Pass .env vars as a base layer; the -e flags above take precedence for any
# key that appears in both (Docker applies --env-file before -e flags).
if [[ -f .env ]]; then
  DOCKER_RUN_ARGS+=(--env-file .env)
fi

docker run "${DOCKER_RUN_ARGS[@]}" "${IMAGE}" &
APP_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  db-host (Docker) is running"
echo "  App        →  http://localhost:${PORT}"
echo "  LocalStack →  http://localhost:4566"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

wait "${APP_PID}"
