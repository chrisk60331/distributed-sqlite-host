#!/usr/bin/env bash
# Idempotent LocalStack IAM role for db-host tenant STS (AssumeRole + session policy).
# Prints the role ARN on stdout (stderr is logs). Requires: aws or awslocal, LocalStack up.
set -euo pipefail

ROLE_NAME="${DB_HOST_STS_ROLE_NAME:-db-host-tenant-s3}"

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
TRUST_JSON="$(printf '%s' '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::'"${ACCOUNT}"':root"},"Action":"sts:AssumeRole"}]}')"
INLINE_POLICY='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"s3:*","Resource":"*"}]}'
ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${ROLE_NAME}"

if _awsl iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  log "IAM role already exists: ${ROLE_NAME}"
else
  log "Creating IAM role ${ROLE_NAME}..."
  _awsl iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document "${TRUST_JSON}" >/dev/null
fi

_awsl iam put-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-name db-host-tenant-s3-inline \
  --policy-document "${INLINE_POLICY}" >/dev/null

log "Assume-role target: ${ROLE_ARN}"
printf '%s' "${ROLE_ARN}"
