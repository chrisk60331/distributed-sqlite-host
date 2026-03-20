#!/usr/bin/env bash
# E2E smoke: health → signup → create DB → execute DDL/DML/SELECT (API DS) → STS s3-session.
# Tenant DS + boto3_session: uv run --project sdk python scripts/e2e_ds_tenant.py
# Requires: curl, jq; API on BASE_URL; LocalStack IAM role (see ./start.sh or bootstrap-localstack-sts.sh).
set -euo pipefail

cd "$(dirname "$0")/.."
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

BASE_URL="${BASE_URL:-http://localhost:8000}"
STAMP="$(date +%s)"
EMAIL="smoke-${STAMP}@example.com"
PASSWORD="smoke-password-${STAMP}-x"
DB_NAME="smt${STAMP}"

die() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || die "curl is required"
command -v jq >/dev/null 2>&1 || die "jq is required (brew install jq)"

echo "Smoke e2e → ${BASE_URL}"

code="$(curl -sS -o /tmp/dbhost_smoke_health.json -w "%{http_code}" "${BASE_URL}/health")"
[[ "${code}" == "200" ]] || die "GET /health expected 200, got ${code}"
[[ "$(jq -r .status </tmp/dbhost_smoke_health.json)" == "ok" ]] || die "GET /health body missing status ok"

code="$(curl -sS -o /tmp/dbhost_smoke_signup.json -w "%{http_code}" \
  -X POST "${BASE_URL}/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")"
[[ "${code}" == "201" ]] || die "POST /auth/signup expected 201, got ${code} $(cat /tmp/dbhost_smoke_signup.json)"

TOKEN="$(jq -r .access_token </tmp/dbhost_smoke_signup.json)"
[[ -n "${TOKEN}" && "${TOKEN}" != "null" ]] || die "no access_token from signup"

code="$(curl -sS -o /tmp/dbhost_smoke_createdb.json -w "%{http_code}" \
  -X POST "${BASE_URL}/databases" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${DB_NAME}\"}")"
[[ "${code}" == "201" ]] || die "POST /databases expected 201, got ${code} $(cat /tmp/dbhost_smoke_createdb.json)"

API_KEY="$(jq -r '.api_key // empty' </tmp/dbhost_smoke_createdb.json)"
DB_ID="$(jq -r .db_id </tmp/dbhost_smoke_createdb.json)"
PREFIX="$(jq -r .prefix </tmp/dbhost_smoke_createdb.json)"
BUCKET="$(jq -r .bucket </tmp/dbhost_smoke_createdb.json)"
if [[ -z "${API_KEY}" || "${API_KEY}" == "null" ]]; then
  code="$(curl -sS -o /tmp/dbhost_smoke_mint.json -w "%{http_code}" \
    -X POST "${BASE_URL}/databases/${DB_ID}/api-key" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json")"
  [[ "${code}" == "200" ]] || die "POST /databases/{id}/api-key expected 200, got ${code} $(cat /tmp/dbhost_smoke_mint.json)"
  API_KEY="$(jq -r .api_key </tmp/dbhost_smoke_mint.json)"
fi
[[ -n "${API_KEY}" && "${API_KEY}" != "null" ]] || die "no api_key from create database or mint api-key"

MARKER="curl-e2e-${STAMP}"
jq -n --arg m "${MARKER}" '{statements: [
  "CREATE TABLE IF NOT EXISTS smoke_e2e (id INTEGER PRIMARY KEY, msg TEXT)",
  ("INSERT INTO smoke_e2e (msg) VALUES (\u0027" + $m + "\u0027)"),
  "SELECT msg FROM smoke_e2e WHERE id = 1"
]}' >/tmp/dbhost_smoke_exec_body.json

code="$(curl -sS -o /tmp/dbhost_smoke_exec.json -w "%{http_code}" \
  -X POST "${BASE_URL}/databases/${DB_ID}/execute" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/dbhost_smoke_exec_body.json)"
[[ "${code}" == "200" ]] || die "POST execute expected 200, got ${code} $(cat /tmp/dbhost_smoke_exec.json)"

[[ "$(jq '.steps | length' </tmp/dbhost_smoke_exec.json)" == "3" ]] || die "execute expected 3 steps"
[[ "$(jq '.steps[0]' </tmp/dbhost_smoke_exec.json)" == "null" ]] || die "step 0 (CREATE) expected null, got $(jq -c .steps[0] </tmp/dbhost_smoke_exec.json)"
[[ "$(jq '.steps[1]' </tmp/dbhost_smoke_exec.json)" == "null" ]] || die "step 1 (INSERT) expected null, got $(jq -c .steps[1] </tmp/dbhost_smoke_exec.json)"
ROW="$(jq -r '.steps[2].rows[0][0] // empty' </tmp/dbhost_smoke_exec.json)"
[[ "${ROW}" == "${MARKER}" ]] || die "SELECT expected '${MARKER}', got '${ROW}' body=$(cat /tmp/dbhost_smoke_exec.json)"

code="$(curl -sS -o /tmp/dbhost_smoke_sts.json -w "%{http_code}" \
  -X POST "${BASE_URL}/databases/s3-session" \
  -H "Content-Type: application/json" \
  -d "{\"api_key\":\"${API_KEY}\"}")"
[[ "${code}" == "200" ]] || die "POST /databases/s3-session expected 200, got ${code} $(cat /tmp/dbhost_smoke_sts.json)"

AK="$(jq -r .access_key_id </tmp/dbhost_smoke_sts.json)"
[[ -n "${AK}" && "${AK}" != "null" ]] || die "s3-session missing access_key_id"

SK="$(jq -r .secret_access_key </tmp/dbhost_smoke_sts.json)"
TOKN="$(jq -r .session_token </tmp/dbhost_smoke_sts.json)"
[[ -n "${SK}" && "${SK}" != "null" ]] || die "s3-session missing secret_access_key"
[[ -n "${TOKN}" && "${TOKN}" != "null" ]] || die "s3-session missing session_token"

SBUCKET="$(jq -r .bucket </tmp/dbhost_smoke_sts.json)"
SPREFIX="$(jq -r .prefix </tmp/dbhost_smoke_sts.json)"
[[ "${SBUCKET}" == "${BUCKET}" ]] || die "session bucket mismatch ${SBUCKET} vs ${BUCKET}"
[[ "${SPREFIX}" == "${PREFIX}" ]] || die "session prefix mismatch ${SPREFIX} vs ${PREFIX}"

echo "PASS: e2e smoke (API DS write/read + tenant STS s3-session) OK"
echo "      tenant DS client:  uv run --project sdk python scripts/e2e_ds_tenant.py"
