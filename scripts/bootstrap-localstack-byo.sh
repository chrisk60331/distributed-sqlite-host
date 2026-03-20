#!/usr/bin/env bash
# Idempotent LocalStack setup for BYO bucket smoke testing.
#
# Simulates a "customer" account by creating:
#   - A separate S3 bucket  (BYO_BUCKET_NAME, default: byo-customer-bucket)
#   - An IAM role           (BYO_ROLE_NAME,   default: byo-customer-role)
#     with a trust policy that lets the platform account assume it using ExternalId
#
# LocalStack runs a single account so cross-account is simulated within it.
# Prints two lines to stdout that the smoke test sources:
#   BYO_ROLE_ARN=arn:aws:iam::...
#   BYO_BUCKET_NAME=byo-customer-bucket
#
# Usage:
#   eval "$(bash scripts/bootstrap-localstack-byo.sh <external_id>)"
set -euo pipefail

EXTERNAL_ID="${1:?Usage: $0 <external_id>}"
BYO_ROLE_NAME="${BYO_ROLE_NAME:-byo-customer-role}"
BYO_BUCKET_NAME="${BYO_BUCKET_NAME:-byo-customer-bucket}"

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
export AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-http://localhost:4566}"

log() { printf '%s\n' "$*" >&2; }

_awsl() {
  if command -v awslocal >/dev/null 2>&1; then
    awslocal "$@"
  else
    aws --endpoint-url "${AWS_ENDPOINT_URL}" "$@"
  fi
}

ACCOUNT="$(_awsl sts get-caller-identity --query Account --output text)"

# ── S3 bucket ──────────────────────────────────────────────────────────────────
if _awsl s3api head-bucket --bucket "${BYO_BUCKET_NAME}" >/dev/null 2>&1; then
  log "S3 bucket already exists: ${BYO_BUCKET_NAME}"
else
  log "Creating S3 bucket: ${BYO_BUCKET_NAME}"
  _awsl s3 mb "s3://${BYO_BUCKET_NAME}" >&2
fi

# ── IAM role with ExternalId trust policy ─────────────────────────────────────
TRUST_JSON="$(printf '%s' '{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"AWS": "arn:aws:iam::'"${ACCOUNT}"':root"},
    "Action": "sts:AssumeRole",
    "Condition": {"StringEquals": {"sts:ExternalId": "'"${EXTERNAL_ID}"'"}}
  }]
}')"

INLINE_POLICY="$(printf '%s' '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ObjectRW",
      "Effect": "Allow",
      "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject",
                 "s3:AbortMultipartUpload","s3:ListMultipartUploadParts"],
      "Resource": "arn:aws:s3:::'"${BYO_BUCKET_NAME}"'/*"
    },
    {
      "Sid": "BucketList",
      "Effect": "Allow",
      "Action": ["s3:ListBucket","s3:ListBucketMultipartUploads","s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::'"${BYO_BUCKET_NAME}"'"
    }
  ]
}')"

ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${BYO_ROLE_NAME}"

if _awsl iam get-role --role-name "${BYO_ROLE_NAME}" >/dev/null 2>&1; then
  log "IAM role already exists: ${BYO_ROLE_NAME} — updating trust policy"
  _awsl iam update-assume-role-policy \
    --role-name "${BYO_ROLE_NAME}" \
    --policy-document "${TRUST_JSON}" >/dev/null
else
  log "Creating IAM role: ${BYO_ROLE_NAME}"
  _awsl iam create-role \
    --role-name "${BYO_ROLE_NAME}" \
    --assume-role-policy-document "${TRUST_JSON}" >/dev/null
fi

_awsl iam put-role-policy \
  --role-name "${BYO_ROLE_NAME}" \
  --policy-name byo-bucket-inline \
  --policy-document "${INLINE_POLICY}" >/dev/null

log "BYO role ready: ${ROLE_ARN}"
log "BYO bucket ready: ${BYO_BUCKET_NAME}"

# ── Emit for eval() ────────────────────────────────────────────────────────────
printf 'BYO_ROLE_ARN=%s\n' "${ROLE_ARN}"
printf 'BYO_BUCKET_NAME=%s\n' "${BYO_BUCKET_NAME}"
