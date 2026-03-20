#!/usr/bin/env bash
# Upload infra/cfn/byo-bucket-role.yaml to S3 (or LocalStack) and print the
# resulting public URL to stdout.  All log messages go to stderr.
#
# Usage:
#   # LocalStack (creates bucket automatically):
#   BYO_BUCKET_CF_TEMPLATE_URL="$(bash scripts/upload-cfn-template.sh \
#     --endpoint http://localhost:4566 --bucket db-host-public)"
#
#   # Real AWS (bucket must pre-exist with s3:GetObject on *):
#   BYO_BUCKET_CF_TEMPLATE_URL="$(bash scripts/upload-cfn-template.sh \
#     --bucket my-public-bucket)"
#
# Options:
#   --bucket    Target S3 bucket name          (default: db-host-public)
#   --prefix    Key prefix inside the bucket   (default: cfn)
#   --endpoint  LocalStack base URL            (omit for real AWS)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE_FILE="${SCRIPT_DIR}/infra/cfn/byo-bucket-role.yaml"

BUCKET="db-host-public"
PREFIX="cfn"
ENDPOINT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bucket)   BUCKET="$2";   shift 2 ;;
    --prefix)   PREFIX="$2";   shift 2 ;;
    --endpoint) ENDPOINT="$2"; shift 2 ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; exit 1 ;;
  esac
done

log() { printf '%s\n' "$*" >&2; }

if [[ ! -f "${TEMPLATE_FILE}" ]]; then
  log "ERROR: CloudFormation template not found: ${TEMPLATE_FILE}"
  exit 1
fi

REGION="${AWS_DEFAULT_REGION:-us-east-1}"

# ── AWS CLI wrapper ────────────────────────────────────────────────────────────
# When --endpoint is given, prefer awslocal (no SSL issues); otherwise fall
# back to aws --endpoint-url --no-verify-ssl.  For real AWS omit both flags.
_aws() {
  if [[ -n "${ENDPOINT}" ]]; then
    if command -v awslocal >/dev/null 2>&1; then
      awslocal "$@"
    else
      aws --endpoint-url "${ENDPOINT}" --no-verify-ssl "$@"
    fi
  else
    aws "$@"
  fi
}

# ── Ensure bucket exists (LocalStack only) ────────────────────────────────────
if [[ -n "${ENDPOINT}" ]]; then
  if _aws s3api head-bucket --bucket "${BUCKET}" >/dev/null 2>&1; then
    log "S3 bucket already exists: ${BUCKET}"
  else
    log "Creating S3 bucket: ${BUCKET}"
    _aws s3 mb "s3://${BUCKET}" >/dev/null
  fi
fi

# ── Upload ────────────────────────────────────────────────────────────────────
S3_KEY="${PREFIX}/byo-bucket-role.yaml"
log "Uploading ${TEMPLATE_FILE} → s3://${BUCKET}/${S3_KEY}"

if [[ -n "${ENDPOINT}" ]]; then
  _aws s3 cp "${TEMPLATE_FILE}" "s3://${BUCKET}/${S3_KEY}" >/dev/null
else
  _aws s3 cp "${TEMPLATE_FILE}" "s3://${BUCKET}/${S3_KEY}" --acl public-read >/dev/null
fi

# ── Construct URL ─────────────────────────────────────────────────────────────
if [[ -n "${ENDPOINT}" ]]; then
  # LocalStack path-style URL
  TEMPLATE_URL="${ENDPOINT}/${BUCKET}/${S3_KEY}"
else
  # Real AWS virtual-hosted URL (path-style is deprecated for new buckets)
  TEMPLATE_URL="https://${BUCKET}.s3.${REGION}.amazonaws.com/${S3_KEY}"
fi

log "Template available at: ${TEMPLATE_URL}"
printf '%s\n' "${TEMPLATE_URL}"
