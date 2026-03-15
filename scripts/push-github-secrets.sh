#!/usr/bin/env bash
# =============================================================================
# EventCraft — Push all secrets to GitHub Actions
# Reads from AWS Secrets Manager → pushes to GitHub repo secrets
# Run after setup-iam.sh and after repo is created
# Usage: bash scripts/push-github-secrets.sh
# =============================================================================

set -euo pipefail
source "$(dirname "$0")/read-secrets.sh"
source "$(dirname "$0")/../.env.staging" 2>/dev/null || true

GITHUB_USER=$(gh api user --jq .login)
REPO="${GITHUB_USER}/eventcraft"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'
ok() { echo -e "    ${GREEN}[OK]${NC} $1"; }
step() { echo -e "\n${CYAN}${BOLD}==> $1${NC}"; }

push_secret() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ] || [ "$value" = "None" ]; then
    echo -e "    \033[1;33m[SKIP]\033[0m ${name} — no value in Secrets Manager yet"
    return
  fi
  printf '%s' "$value" | gh secret set "$name" --repo "$REPO"
  ok "GitHub secret: ${name}"
}

step "Pushing all secrets from Secrets Manager to GitHub: ${REPO}"

# AWS credentials for CI/CD
push_secret "AWS_ACCESS_KEY_ID"     "$EVENTCRAFT_DEPLOY_KEY_ID"
push_secret "AWS_SECRET_ACCESS_KEY" "$EVENTCRAFT_DEPLOY_SECRET"
push_secret "AWS_REGION"            "${REGION:-us-east-1}"
push_secret "AWS_ACCOUNT_ID"        "${AWS_ACCOUNT_ID:-}"

# DynamoDB table names
push_secret "DYNAMODB_TABLE_STAGING" "eventcraft-staging"
push_secret "DYNAMODB_TABLE_PROD"    "eventcraft-prod"

# Cognito
push_secret "COGNITO_POOL_ID_STAGING"   "${COGNITO_POOL_ID:-}"
push_secret "COGNITO_CLIENT_ID_STAGING" "${COGNITO_CLIENT_ID:-}"

# SAM artifact buckets
push_secret "SAM_BUCKET_STAGING" "eventcraft-lambda-artifacts-staging"
push_secret "SAM_BUCKET_PROD"    "eventcraft-lambda-artifacts-prod"

# S3 frontend buckets
push_secret "S3_FRONTEND_BUCKET_STAGING" "eventcraft-frontend-staging"
push_secret "S3_FRONTEND_BUCKET_PROD"    "eventcraft-frontend-prod"

# Third-party secrets (read from Secrets Manager)
push_secret "SENTRY_AUTH_TOKEN"           "$SENTRY_AUTH_TOKEN"
push_secret "SENTRY_ORG"                  "$SENTRY_ORG"
push_secret "SENTRY_PROJECT"              "eventcraft"
push_secret "SENTRY_DSN"                  "$SENTRY_DSN"
push_secret "EXPO_TOKEN"                  "$EXPO_TOKEN"
push_secret "RECAPTCHA_SITE_KEY_STAGING"  "$RECAPTCHA_SITE_KEY"
push_secret "RECAPTCHA_SITE_KEY_PROD"     "$RECAPTCHA_SITE_KEY"
push_secret "STRIPE_PUBLISHABLE_KEY_STAGING" "$STRIPE_PUBLISHABLE_KEY"
push_secret "STRIPE_PUBLISHABLE_KEY_PROD"    "$STRIPE_PUBLISHABLE_KEY"
push_secret "STRIPE_WEBHOOK_SECRET"       "$STRIPE_WEBHOOK_SECRET"
push_secret "ANTHROPIC_API_KEY"           "$ANTHROPIC_API_KEY"

step "Done — all GitHub Actions secrets set from Secrets Manager"
echo -e "  Check: https://github.com/${REPO}/settings/secrets/actions"
