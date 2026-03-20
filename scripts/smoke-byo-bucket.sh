#!/usr/bin/env bash
# BYO bucket smoke test.
#
# Tests the full flow against a running API + LocalStack:
#   signup → GET /byo-bucket/setup → bootstrap LocalStack "customer" role →
#   POST /byo-bucket/connect (validate) → GET /byo-bucket/config →
#   POST /databases (BYO bucket used) → POST /databases/s3-session (BYO role) →
#   DELETE /byo-bucket/config
#
# Requires: curl, jq, awslocal (or aws + AWS_ENDPOINT_URL set), LocalStack running
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
EMAIL="byo-smoke-${STAMP}@example.com"
PASSWORD="byo-smoke-password-${STAMP}-x"
DB_NAME="byosmt${STAMP}"

die() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || die "curl is required"
command -v jq   >/dev/null 2>&1 || die "jq is required (brew install jq)"

echo "BYO bucket smoke → ${BASE_URL}"
echo ""

# ── 1. health ─────────────────────────────────────────────────────────────────
code="$(curl -sS -o /tmp/byo_health.json -w "%{http_code}" "${BASE_URL}/health")"
[[ "${code}" == "200" ]] || die "GET /health expected 200, got ${code}"
echo "✓ health"

# ── 2. signup ─────────────────────────────────────────────────────────────────
code="$(curl -sS -o /tmp/byo_signup.json -w "%{http_code}" \
  -X POST "${BASE_URL}/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")"
[[ "${code}" == "201" ]] || die "POST /auth/signup expected 201, got ${code} $(cat /tmp/byo_signup.json)"
TOKEN="$(jq -r .access_token </tmp/byo_signup.json)"
[[ -n "${TOKEN}" && "${TOKEN}" != "null" ]] || die "no access_token"
echo "✓ signup"

# ── 3. GET /byo-bucket/setup ─────────────────────────────────────────────────
code="$(curl -sS -o /tmp/byo_setup.json -w "%{http_code}" \
  "${BASE_URL}/byo-bucket/setup" \
  -H "Authorization: Bearer ${TOKEN}")"
[[ "${code}" == "200" ]] || die "GET /byo-bucket/setup expected 200, got ${code} $(cat /tmp/byo_setup.json)"

EXTERNAL_ID="$(jq -r .external_id </tmp/byo_setup.json)"
ACCOUNT_ID="$(jq -r .platform_aws_account_id </tmp/byo_setup.json)"
[[ -n "${EXTERNAL_ID}" && "${EXTERNAL_ID}" != "null" ]] || die "no external_id in setup response"
[[ -n "${ACCOUNT_ID}" && "${ACCOUNT_ID}" != "null" ]] || die "no platform_aws_account_id in setup response"
echo "✓ setup  external_id=${EXTERNAL_ID}  account_id=${ACCOUNT_ID}"

# ── 4. Bootstrap LocalStack "customer" role with this ExternalId ───────────────
echo ""
echo "  Bootstrapping LocalStack BYO role..."
eval "$(bash scripts/bootstrap-localstack-byo.sh "${EXTERNAL_ID}" 2>/dev/null)"
[[ -n "${BYO_ROLE_ARN}"    ]] || die "bootstrap did not export BYO_ROLE_ARN"
[[ -n "${BYO_BUCKET_NAME}" ]] || die "bootstrap did not export BYO_BUCKET_NAME"
echo "  BYO_ROLE_ARN=${BYO_ROLE_ARN}"
echo "  BYO_BUCKET_NAME=${BYO_BUCKET_NAME}"
echo ""

# ── 5. POST /byo-bucket/connect ───────────────────────────────────────────────
code="$(curl -sS -o /tmp/byo_connect.json -w "%{http_code}" \
  -X POST "${BASE_URL}/byo-bucket/connect" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"role_arn\":\"${BYO_ROLE_ARN}\",\"bucket_name\":\"${BYO_BUCKET_NAME}\",\"bucket_region\":\"us-east-1\"}")"
[[ "${code}" == "200" ]] || die "POST /byo-bucket/connect expected 200, got ${code} $(cat /tmp/byo_connect.json)"

VALIDATED_AT="$(jq -r .validated_at </tmp/byo_connect.json)"
[[ -n "${VALIDATED_AT}" && "${VALIDATED_AT}" != "null" ]] || die "no validated_at in connect response"
echo "✓ connect  validated_at=${VALIDATED_AT}"

# ── 6. GET /byo-bucket/setup again — should show already_connected=true ───────
code="$(curl -sS -o /tmp/byo_setup2.json -w "%{http_code}" \
  "${BASE_URL}/byo-bucket/setup" \
  -H "Authorization: Bearer ${TOKEN}")"
[[ "${code}" == "200" ]] || die "GET /byo-bucket/setup (2nd) expected 200, got ${code}"
ALREADY_CONNECTED="$(jq -r .already_connected </tmp/byo_setup2.json)"
[[ "${ALREADY_CONNECTED}" == "true" ]] || die "expected already_connected=true, got ${ALREADY_CONNECTED}"
echo "✓ setup (2nd call) already_connected=true"

# ── 7. GET /byo-bucket/config ─────────────────────────────────────────────────
code="$(curl -sS -o /tmp/byo_config.json -w "%{http_code}" \
  "${BASE_URL}/byo-bucket/config" \
  -H "Authorization: Bearer ${TOKEN}")"
[[ "${code}" == "200" ]] || die "GET /byo-bucket/config expected 200, got ${code} $(cat /tmp/byo_config.json)"
GOT_ROLE="$(jq -r .role_arn </tmp/byo_config.json)"
[[ "${GOT_ROLE}" == "${BYO_ROLE_ARN}" ]] || die "role_arn mismatch: ${GOT_ROLE} vs ${BYO_ROLE_ARN}"
echo "✓ GET /byo-bucket/config"

# ── 8. POST /databases — should land in BYO bucket ───────────────────────────
code="$(curl -sS -o /tmp/byo_createdb.json -w "%{http_code}" \
  -X POST "${BASE_URL}/databases" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${DB_NAME}\"}")"
[[ "${code}" == "201" ]] || die "POST /databases expected 201, got ${code} $(cat /tmp/byo_createdb.json)"

DB_ID="$(jq -r .db_id </tmp/byo_createdb.json)"
DB_BUCKET="$(jq -r .bucket </tmp/byo_createdb.json)"
API_KEY="$(jq -r .api_key </tmp/byo_createdb.json)"
[[ "${DB_BUCKET}" == "${BYO_BUCKET_NAME}" ]] \
  || die "database bucket mismatch: ${DB_BUCKET} vs ${BYO_BUCKET_NAME}"
echo "✓ create database  db_id=${DB_ID}  bucket=${DB_BUCKET}"

# ── 9. POST /databases/s3-session — credentials from BYO role ────────────────
code="$(curl -sS -o /tmp/byo_sts.json -w "%{http_code}" \
  -X POST "${BASE_URL}/databases/s3-session" \
  -H "Content-Type: application/json" \
  -d "{\"api_key\":\"${API_KEY}\"}")"
[[ "${code}" == "200" ]] || die "POST /databases/s3-session expected 200, got ${code} $(cat /tmp/byo_sts.json)"

AK="$(jq -r .access_key_id </tmp/byo_sts.json)"
SK="$(jq -r .secret_access_key </tmp/byo_sts.json)"
TOKN="$(jq -r .session_token </tmp/byo_sts.json)"
STS_BUCKET="$(jq -r .bucket </tmp/byo_sts.json)"
[[ -n "${AK}"   && "${AK}"   != "null" ]] || die "s3-session missing access_key_id"
[[ -n "${SK}"   && "${SK}"   != "null" ]] || die "s3-session missing secret_access_key"
[[ -n "${TOKN}" && "${TOKN}" != "null" ]] || die "s3-session missing session_token"
[[ "${STS_BUCKET}" == "${BYO_BUCKET_NAME}" ]] \
  || die "s3-session bucket mismatch: ${STS_BUCKET} vs ${BYO_BUCKET_NAME}"
echo "✓ s3-session  access_key_id=${AK:0:8}...  bucket=${STS_BUCKET}"

# ── 10. Verify the scoped creds can actually list the bucket ──────────────────
LIST_OUT="$(AWS_ACCESS_KEY_ID="${AK}" \
  AWS_SECRET_ACCESS_KEY="${SK}" \
  AWS_SESSION_TOKEN="${TOKN}" \
  AWS_DEFAULT_REGION="us-east-1" \
  AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-http://localhost:4566}" \
  aws s3 ls "s3://${BYO_BUCKET_NAME}" 2>&1)" \
  || die "scoped creds could not list BYO bucket: ${LIST_OUT}"
echo "✓ scoped creds list s3://${BYO_BUCKET_NAME}"

# ── 11. DELETE /byo-bucket/config ────────────────────────────────────────────
code="$(curl -sS -o /tmp/byo_delete.json -w "%{http_code}" \
  -X DELETE "${BASE_URL}/byo-bucket/config" \
  -H "Authorization: Bearer ${TOKEN}")"
[[ "${code}" == "204" ]] || die "DELETE /byo-bucket/config expected 204, got ${code}"
echo "✓ DELETE /byo-bucket/config"

# ── 12. GET /byo-bucket/config should now 404 ────────────────────────────────
code="$(curl -sS -o /tmp/byo_config2.json -w "%{http_code}" \
  "${BASE_URL}/byo-bucket/config" \
  -H "Authorization: Bearer ${TOKEN}")"
[[ "${code}" == "404" ]] || die "GET /byo-bucket/config after delete expected 404, got ${code}"
echo "✓ config 404 after delete"

echo ""
echo "PASS: BYO bucket smoke test complete"
