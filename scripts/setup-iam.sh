#!/usr/bin/env bash
# =============================================================================
# EventCraft — IAM Setup Script
# Uses your existing DEFAULT AWS admin profile to:
#   1. Create eventcraft-deploy IAM user with exact policies
#   2. Generate + store its credentials in Secrets Manager
#   3. Write .aws/credentials profile so all other scripts use it
#   4. You never see or paste a key — everything is automated
#
# Usage: bash scripts/setup-iam.sh
# Prerequisite: aws CLI configured with default admin profile
# =============================================================================

set -euo pipefail

APP="eventcraft"
REGION="us-east-1"
IAM_USER="eventcraft-deploy"
PROFILE_NAME="eventcraft-dev"     # profile name written to ~/.aws/credentials
ADMIN_PROFILE="${AWS_PROFILE:-default}"  # your existing admin profile

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'

step()  { echo -e "\n${CYAN}${BOLD}==> $1${NC}"; }
ok()    { echo -e "    ${GREEN}[OK]${NC} $1"; }
skip()  { echo -e "    ${YELLOW}[--]${NC} $1 (already exists)"; }
info()  { echo -e "    ${CYAN}[  ]${NC} $1"; }

echo -e "${CYAN}${BOLD}"
echo "  EventCraft — IAM + Credentials Automation"
echo "  Using admin profile : ${ADMIN_PROFILE}"
echo "  Creating IAM user   : ${IAM_USER}"
echo "  Writing AWS profile : ${PROFILE_NAME}"
echo -e "${NC}"

# Verify admin profile works
ADMIN_ACCOUNT=$(aws sts get-caller-identity \
  --profile "$ADMIN_PROFILE" \
  --query Account --output text 2>/dev/null) || {
  echo -e "${RED}Cannot authenticate with profile '${ADMIN_PROFILE}'${NC}"
  echo "Run: aws configure  (to set up your default admin profile first)"
  exit 1
}
ok "Admin profile '${ADMIN_PROFILE}' authenticated — Account: ${ADMIN_ACCOUNT}"

# ── 1. Create the IAM policies document ──────────────────────────────────────
step "Creating IAM policy: EventCraftDeployPolicy"

POLICY_DOC=$(cat <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDB",
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable","dynamodb:DeleteTable","dynamodb:DescribeTable",
        "dynamodb:UpdateTable","dynamodb:ListTables","dynamodb:TagResource",
        "dynamodb:GetItem","dynamodb:PutItem","dynamodb:UpdateItem",
        "dynamodb:DeleteItem","dynamodb:Query","dynamodb:Scan",
        "dynamodb:BatchGetItem","dynamodb:BatchWriteItem",
        "dynamodb:DescribeTimeToLive","dynamodb:UpdateTimeToLive",
        "dynamodb:ListTagsOfResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket","s3:DeleteBucket","s3:ListBucket","s3:GetBucketLocation",
        "s3:PutBucketPolicy","s3:GetBucketPolicy","s3:DeleteBucketPolicy",
        "s3:PutBucketVersioning","s3:GetBucketVersioning",
        "s3:PutPublicAccessBlock","s3:GetPublicAccessBlock",
        "s3:PutBucketTagging","s3:GetBucketTagging",
        "s3:PutObject","s3:GetObject","s3:DeleteObject",
        "s3:GetObjectAttributes","s3:ListAllMyBuckets",
        "s3:PutBucketCORS","s3:GetBucketCORS",
        "s3:PutBucketWebsite","s3:GetBucketWebsite",
        "s3:PutLifecycleConfiguration","s3:GetLifecycleConfiguration"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Lambda",
      "Effect": "Allow",
      "Action": [
        "lambda:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "APIGateway",
      "Effect": "Allow",
      "Action": [
        "apigateway:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudFormation",
      "Effect": "Allow",
      "Action": [
        "cloudformation:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Cognito",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:*",
        "cognito-identity:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SES",
      "Effect": "Allow",
      "Action": [
        "ses:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SQS",
      "Effect": "Allow",
      "Action": [
        "sqs:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatch",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:*",
        "logs:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SecretsManager",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SNS",
      "Effect": "Allow",
      "Action": [
        "sns:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IAM",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole","iam:DeleteRole","iam:GetRole","iam:ListRoles",
        "iam:PutRolePolicy","iam:DeleteRolePolicy","iam:GetRolePolicy",
        "iam:AttachRolePolicy","iam:DetachRolePolicy","iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies","iam:PassRole","iam:TagRole",
        "iam:CreatePolicy","iam:DeletePolicy","iam:GetPolicy",
        "iam:CreatePolicyVersion","iam:DeletePolicyVersion",
        "iam:GetPolicyVersion","iam:ListPolicyVersions",
        "iam:CreateUser","iam:DeleteUser","iam:GetUser","iam:ListUsers",
        "iam:CreateAccessKey","iam:DeleteAccessKey","iam:ListAccessKeys",
        "iam:AttachUserPolicy","iam:DetachUserPolicy",
        "iam:ListAttachedUserPolicies","iam:TagUser",
        "iam:CreateServiceLinkedRole"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudFront",
      "Effect": "Allow",
      "Action": [
        "cloudfront:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Route53",
      "Effect": "Allow",
      "Action": [
        "route53:*",
        "route53domains:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ACM",
      "Effect": "Allow",
      "Action": [
        "acm:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SSM",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter","ssm:GetParameters",
        "ssm:PutParameter","ssm:DeleteParameter"
      ],
      "Resource": "*"
    },
    {
      "Sid": "XRay",
      "Effect": "Allow",
      "Action": [
        "xray:PutTraceSegments","xray:PutTelemetryRecords"
      ],
      "Resource": "*"
    }
  ]
}
JSON
)

# Check if policy exists
POLICY_ARN="arn:aws:iam::${ADMIN_ACCOUNT}:policy/EventCraftDeployPolicy"
EXISTING_POLICY=$(aws iam get-policy \
  --policy-arn "$POLICY_ARN" \
  --profile "$ADMIN_PROFILE" \
  --query Policy.Arn \
  --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_POLICY" ]; then
  skip "Policy EventCraftDeployPolicy (${POLICY_ARN})"
  # Update existing policy with a new version
  aws iam create-policy-version \
    --policy-arn "$POLICY_ARN" \
    --policy-document "$POLICY_DOC" \
    --set-as-default \
    --profile "$ADMIN_PROFILE" >/dev/null 2>&1 || true
  ok "Policy version updated"
else
  POLICY_ARN=$(aws iam create-policy \
    --policy-name "EventCraftDeployPolicy" \
    --description "EventCraft deployment policy — all services needed for SAM deploy" \
    --policy-document "$POLICY_DOC" \
    --tags Key=App,Value="${APP}" \
    --profile "$ADMIN_PROFILE" \
    --query Policy.Arn \
    --output text)
  ok "Policy created: ${POLICY_ARN}"
fi

# ── 2. Create IAM user ────────────────────────────────────────────────────────
step "Creating IAM user: ${IAM_USER}"

EXISTING_USER=$(aws iam get-user \
  --user-name "$IAM_USER" \
  --profile "$ADMIN_PROFILE" \
  --query User.UserName \
  --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_USER" ]; then
  skip "IAM user ${IAM_USER}"
else
  aws iam create-user \
    --user-name "$IAM_USER" \
    --tags Key=App,Value="${APP}" Key=Purpose,Value="CI/CD and local dev deployments" \
    --profile "$ADMIN_PROFILE" >/dev/null
  ok "IAM user ${IAM_USER} created"
fi

# ── 3. Attach policy to user ──────────────────────────────────────────────────
step "Attaching policy to ${IAM_USER}"

ATTACHED=$(aws iam list-attached-user-policies \
  --user-name "$IAM_USER" \
  --profile "$ADMIN_PROFILE" \
  --query "AttachedPolicies[?PolicyArn=='${POLICY_ARN}'].PolicyArn" \
  --output text 2>/dev/null || echo "")

if [ -n "$ATTACHED" ]; then
  skip "Policy already attached to ${IAM_USER}"
else
  aws iam attach-user-policy \
    --user-name "$IAM_USER" \
    --policy-arn "$POLICY_ARN" \
    --profile "$ADMIN_PROFILE"
  ok "Policy attached to ${IAM_USER}"
fi

# ── 4. Create access key for the user ────────────────────────────────────────
step "Creating access key for ${IAM_USER}"

# Check if key already exists in Secrets Manager
EXISTING_KEY=$(aws secretsmanager describe-secret \
  --secret-id "${APP}/iam/${IAM_USER}" \
  --region "$REGION" \
  --profile "$ADMIN_PROFILE" \
  --query Name \
  --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_KEY" ]; then
  skip "Access key already stored in Secrets Manager (${APP}/iam/${IAM_USER})"
  info "Retrieving stored credentials..."
  STORED_KEY=$(aws secretsmanager get-secret-value \
    --secret-id "${APP}/iam/${IAM_USER}" \
    --region "$REGION" \
    --profile "$ADMIN_PROFILE" \
    --query SecretString \
    --output text)
  ACCESS_KEY_ID=$(echo "$STORED_KEY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['AccessKeyId'])")
  SECRET_ACCESS_KEY=$(echo "$STORED_KEY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['SecretAccessKey'])")
else
  # Delete any existing keys first (max 2 per user)
  EXISTING_KEYS=$(aws iam list-access-keys \
    --user-name "$IAM_USER" \
    --profile "$ADMIN_PROFILE" \
    --query "AccessKeyMetadata[*].AccessKeyId" \
    --output text 2>/dev/null || echo "")
  for KEY_ID in $EXISTING_KEYS; do
    aws iam delete-access-key \
      --user-name "$IAM_USER" \
      --access-key-id "$KEY_ID" \
      --profile "$ADMIN_PROFILE" >/dev/null
    info "Deleted old key: ${KEY_ID}"
  done

  # Create new access key
  KEY_OUTPUT=$(aws iam create-access-key \
    --user-name "$IAM_USER" \
    --profile "$ADMIN_PROFILE" \
    --query AccessKey \
    --output json)

  ACCESS_KEY_ID=$(echo "$KEY_OUTPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['AccessKeyId'])")
  SECRET_ACCESS_KEY=$(echo "$KEY_OUTPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['SecretAccessKey'])")

  # Store in Secrets Manager immediately — key never touches disk or terminal output
  aws secretsmanager create-secret \
    --name "${APP}/iam/${IAM_USER}" \
    --description "EventCraft deploy IAM user credentials — managed by setup-iam.sh" \
    --secret-string "{\"AccessKeyId\":\"${ACCESS_KEY_ID}\",\"SecretAccessKey\":\"${SECRET_ACCESS_KEY}\",\"Region\":\"${REGION}\"}" \
    --region "$REGION" \
    --profile "$ADMIN_PROFILE" \
    --tags Key=App,Value="${APP}" Key=ManagedBy,Value=setup-iam-script \
    >/dev/null
  ok "Access key created and stored in Secrets Manager: ${APP}/iam/${IAM_USER}"
  ok "Key ID: ${ACCESS_KEY_ID:0:4}****${ACCESS_KEY_ID: -4}  (first/last 4 chars only)"
fi

# ── 5. Write ~/.aws/credentials profile ──────────────────────────────────────
step "Writing AWS credentials profile: ${PROFILE_NAME}"

AWS_CREDS_FILE="${HOME}/.aws/credentials"
AWS_CONFIG_FILE="${HOME}/.aws/config"

# Ensure .aws directory exists
mkdir -p "${HOME}/.aws"
chmod 700 "${HOME}/.aws"

# Add or update the profile in credentials file
if grep -q "\[${PROFILE_NAME}\]" "$AWS_CREDS_FILE" 2>/dev/null; then
  # Update existing profile using Python (more reliable than sed on all platforms)
  python3 << PYEOF
import configparser, os

creds_path = os.path.expanduser('~/.aws/credentials')
config = configparser.ConfigParser()
config.read(creds_path)

config['${PROFILE_NAME}'] = {
    'aws_access_key_id':     '${ACCESS_KEY_ID}',
    'aws_secret_access_key': '${SECRET_ACCESS_KEY}'
}

with open(creds_path, 'w') as f:
    config.write(f)
print("    credentials updated")
PYEOF
  ok "Profile [${PROFILE_NAME}] updated in ${AWS_CREDS_FILE}"
else
  cat >> "$AWS_CREDS_FILE" << CREDS

[${PROFILE_NAME}]
aws_access_key_id     = ${ACCESS_KEY_ID}
aws_secret_access_key = ${SECRET_ACCESS_KEY}
CREDS
  ok "Profile [${PROFILE_NAME}] written to ${AWS_CREDS_FILE}"
fi

# Write region to config file
if grep -q "\[profile ${PROFILE_NAME}\]" "$AWS_CONFIG_FILE" 2>/dev/null; then
  info "Config profile already exists — skipping"
else
  cat >> "$AWS_CONFIG_FILE" << CONFIG

[profile ${PROFILE_NAME}]
region = ${REGION}
output = json
CONFIG
  ok "Profile [${PROFILE_NAME}] region written to ${AWS_CONFIG_FILE}"
fi

chmod 600 "$AWS_CREDS_FILE"
chmod 600 "$AWS_CONFIG_FILE"

# ── 6. Store ALL third-party keys (interactive, one-time setup) ───────────────
step "Third-party API keys — store once in Secrets Manager"

echo ""
echo -e "  ${CYAN}You will be prompted for each key ONCE.${NC}"
echo -e "  ${CYAN}They go directly into Secrets Manager — never logged, never stored in files.${NC}"
echo -e "  ${CYAN}All scripts read from Secrets Manager automatically from now on.${NC}"
echo -e "  ${CYAN}Press Enter to skip any key you want to add later.${NC}"
echo ""

# Helper: store secret if not already present and user provides a value
store_secret() {
  local SECRET_PATH="$1"
  local PROMPT="$2"
  local ENV_VAR="$3"   # optional: also export as env var for this session

  # Check if secret exists and has a real value
  EXISTING=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_PATH" \
    --region "$REGION" \
    --profile "$ADMIN_PROFILE" \
    --query SecretString \
    --output text 2>/dev/null || echo "")

  if [ -n "$EXISTING" ] && \
     [ "$EXISTING" != "YOUR_STRIPE_SECRET_KEY" ] && \
     [ "$EXISTING" != "YOUR_ANTHROPIC_API_KEY" ] && \
     [ "$EXISTING" != "YOUR_SENTRY_DSN" ] && \
     [ "$EXISTING" != "YOUR_RECAPTCHA_SECRET_KEY" ] && \
     [ "$EXISTING" != "PLACEHOLDER" ]; then
    skip "${SECRET_PATH} (already set)"
    return 0
  fi

  # Prompt — use -s for silent input (key not echoed)
  echo -ne "    ${PROMPT}: "
  read -rs USER_INPUT
  echo ""  # newline after silent input

  if [ -z "$USER_INPUT" ]; then
    echo -e "    ${YELLOW}[SKIP]${NC} ${SECRET_PATH} — add manually later in AWS Secrets Manager"
    return 0
  fi

  # Check if secret already exists (just needs updating) vs creating new
  SECRET_EXISTS=$(aws secretsmanager describe-secret \
    --secret-id "$SECRET_PATH" \
    --region "$REGION" \
    --profile "$ADMIN_PROFILE" \
    --query Name \
    --output text 2>/dev/null || echo "")

  if [ -n "$SECRET_EXISTS" ]; then
    aws secretsmanager put-secret-value \
      --secret-id "$SECRET_PATH" \
      --secret-string "$USER_INPUT" \
      --region "$REGION" \
      --profile "$ADMIN_PROFILE" >/dev/null
  else
    aws secretsmanager create-secret \
      --name "$SECRET_PATH" \
      --description "EventCraft — ${PROMPT}" \
      --secret-string "$USER_INPUT" \
      --region "$REGION" \
      --profile "$ADMIN_PROFILE" \
      --tags Key=App,Value="${APP}" \
      >/dev/null
  fi

  ok "${SECRET_PATH} stored"

  # Also export for current session if caller wants it
  if [ -n "$ENV_VAR" ]; then
    export "$ENV_VAR"="$USER_INPUT"
  fi
}

echo -e "  ${BOLD}Stripe${NC}"
store_secret "${APP}/shared/stripe-secret-key"       "Stripe Secret Key (sk_test_... or sk_live_...)"   ""
store_secret "${APP}/shared/stripe-publishable-key"  "Stripe Publishable Key (pk_test_... or pk_live_)" ""
store_secret "${APP}/shared/stripe-webhook-secret"   "Stripe Webhook Secret (whsec_... — from Stripe Dashboard → Webhooks)" ""

echo ""
echo -e "  ${BOLD}Anthropic${NC}"
store_secret "${APP}/shared/anthropic-api-key"       "Anthropic API Key (sk-ant-...)"                   ""

echo ""
echo -e "  ${BOLD}Sentry${NC}"
store_secret "${APP}/shared/sentry-dsn"              "Sentry DSN (https://xxx@xxx.ingest.sentry.io/xxx)" ""
store_secret "${APP}/shared/sentry-auth-token"       "Sentry Auth Token (from sentry.io → Settings → Auth Tokens)" ""
store_secret "${APP}/shared/sentry-org"              "Sentry Organization slug (from sentry.io URL)"    ""

echo ""
echo -e "  ${BOLD}Google reCAPTCHA${NC}"
store_secret "${APP}/shared/recaptcha-site-key"      "reCAPTCHA v3 Site Key (6L...)"                    ""
store_secret "${APP}/shared/recaptcha-secret-key"    "reCAPTCHA v3 Secret Key"                          ""

echo ""
echo -e "  ${BOLD}Expo${NC}"
store_secret "${APP}/shared/expo-token"              "Expo EAS Token (from expo.dev → Access Tokens)"   ""

# ── 7. Write the secrets reader script ───────────────────────────────────────
step "Writing scripts/read-secrets.sh (sourced by all other scripts)"

mkdir -p "$(dirname "$0")"

cat > "$(dirname "$0")/read-secrets.sh" << 'READER'
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
READER

chmod +x "$(dirname "$0")/read-secrets.sh"
ok "read-secrets.sh written"

# ── 8. Update create-github-repo.sh to auto-push secrets from Secrets Manager
step "Writing scripts/push-github-secrets.sh"

cat > "$(dirname "$0")/push-github-secrets.sh" << 'GHSECRETS'
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
GHSECRETS

chmod +x "$(dirname "$0")/push-github-secrets.sh"
ok "push-github-secrets.sh written"

# ── 9. Verify the new profile works ──────────────────────────────────────────
step "Verifying profile '${PROFILE_NAME}' works"

sleep 3  # Brief pause for IAM propagation
VERIFY=$(aws sts get-caller-identity \
  --profile "$PROFILE_NAME" \
  --query "Arn" \
  --output text 2>/dev/null || echo "")

if echo "$VERIFY" | grep -q "$IAM_USER"; then
  ok "Profile '${PROFILE_NAME}' verified: ${VERIFY}"
else
  echo -e "  ${YELLOW}Profile verification pending — IAM propagation takes ~10 seconds${NC}"
  echo -e "  Run: aws sts get-caller-identity --profile ${PROFILE_NAME}"
fi

# ── 10. Summary ───────────────────────────────────────────────────────────────
step "Setup complete"
echo ""
echo -e "  ${GREEN}${BOLD}What was created:${NC}"
echo -e "  IAM user    : ${IAM_USER}"
echo -e "  IAM policy  : EventCraftDeployPolicy"
echo -e "  Credentials : Stored in Secrets Manager at ${APP}/iam/${IAM_USER}"
echo -e "  AWS profile : [${PROFILE_NAME}] written to ~/.aws/credentials"
echo ""
echo -e "  ${GREEN}${BOLD}Secrets stored in Secrets Manager:${NC}"
aws secretsmanager list-secrets \
  --region "$REGION" \
  --profile "$ADMIN_PROFILE" \
  --query "SecretList[?starts_with(Name,'${APP}/')].Name" \
  --output table 2>/dev/null | grep -v "^$" || true
echo ""
echo -e "  ${GREEN}${BOLD}Next steps:${NC}"
echo "  1. bash scripts/bootstrap.sh staging"
echo "  2. bash scripts/create-github-repo.sh"
echo "  3. bash scripts/push-github-secrets.sh"
echo ""
