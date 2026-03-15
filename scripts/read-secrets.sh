#!/usr/bin/env bash
# =============================================================================
# EventCraft — Secrets Reader
# Sources all secrets from AWS Secrets Manager into environment variables
# Called at the top of every script that needs secrets:
#   source "$(dirname "$0")/read-secrets.sh"
# =============================================================================

APP="eventcraft"
REGION="${REGION:-us-east-1}"
_PROF="${AWS_PROFILE:-eventcraft-dev}"

_get() {
  aws secretsmanager get-secret-value \
    --secret-id "$1" \
    --region "$REGION" \
    --profile "$_PROF" \
    --query SecretString \
    --output text 2>/dev/null || echo ""
}

_getjson() {
  local raw
  raw=$(_get "$1")
  echo "$raw" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('$2',''))" 2>/dev/null || echo ""
}

echo "  [secrets] Loading from AWS Secrets Manager..." >&2

# IAM deploy credentials (for profile bootstrap)
export EVENTCRAFT_DEPLOY_KEY_ID=$(_getjson "${APP}/iam/eventcraft-deploy" "AccessKeyId")
export EVENTCRAFT_DEPLOY_SECRET=$(_getjson "${APP}/iam/eventcraft-deploy" "SecretAccessKey")

# Stripe
export STRIPE_SECRET_KEY=$(_get "${APP}/shared/stripe-secret-key")
export STRIPE_PUBLISHABLE_KEY=$(_get "${APP}/shared/stripe-publishable-key")
export STRIPE_WEBHOOK_SECRET=$(_get "${APP}/shared/stripe-webhook-secret")

# Anthropic
export ANTHROPIC_API_KEY=$(_get "${APP}/shared/anthropic-api-key")

# Sentry
export SENTRY_DSN=$(_get "${APP}/shared/sentry-dsn")
export SENTRY_AUTH_TOKEN=$(_get "${APP}/shared/sentry-auth-token")
export SENTRY_ORG=$(_get "${APP}/shared/sentry-org")

# reCAPTCHA
export RECAPTCHA_SITE_KEY=$(_get "${APP}/shared/recaptcha-site-key")
export RECAPTCHA_SECRET_KEY=$(_get "${APP}/shared/recaptcha-secret-key")

# Expo
export EXPO_TOKEN=$(_get "${APP}/shared/expo-token")

echo "  [secrets] Done" >&2
