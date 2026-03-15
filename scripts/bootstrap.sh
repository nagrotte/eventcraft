#!/usr/bin/env bash
# =============================================================================
# EventCraft — AWS Bootstrap Script
# Creates ALL AWS resources from scratch using only AWS CLI
# Idempotent: safe to run multiple times
# Usage: ./scripts/bootstrap.sh [staging|prod]
# =============================================================================

set -euo pipefail

ENV="${1:-staging}"
APP="eventcraft"
REGION="us-east-1"
PROFILE="eventcraft-dev"
ACCOUNT_ID=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'

step()  { echo -e "\n${CYAN}${BOLD}==> $1${NC}"; }
ok()    { echo -e "    ${GREEN}[OK]${NC} $1"; }
skip()  { echo -e "    ${YELLOW}[--]${NC} $1 (already exists)"; }
info()  { echo -e "    ${CYAN}[  ]${NC} $1"; }

echo -e "${CYAN}${BOLD}"
cat << 'BANNER'
  ███████╗██╗   ██╗███████╗███╗   ██╗████████╗ ██████╗██████╗  █████╗ ███████╗████████╗
  ██╔════╝██║   ██║██╔════╝████╗  ██║╚══██╔══╝██╔════╝██╔══██╗██╔══██╗██╔════╝╚══██╔══╝
  █████╗  ██║   ██║█████╗  ██╔██╗ ██║   ██║   ██║     ██████╔╝███████║█████╗     ██║
  ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║╚██╗██║   ██║   ██║     ██╔══██╗██╔══██║██╔══╝     ██║
  ███████╗ ╚████╔╝ ███████╗██║ ╚████║   ██║   ╚██████╗██║  ██║██║  ██║██║        ██║
  ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝        ╚═╝
BANNER
echo -e "${NC}"
echo -e "  AWS Bootstrap  |  Environment: ${BOLD}${ENV}${NC}  |  Account: ${ACCOUNT_ID}  |  Region: ${REGION}"
echo ""

# ── helper: check if resource exists ─────────────────────────────────────────
s3_exists()      { aws s3api head-bucket --bucket "$1" --profile "$PROFILE" 2>/dev/null && return 0 || return 1; }
dynamo_exists()  { aws dynamodb describe-table --table-name "$1" --region "$REGION" --profile "$PROFILE" 2>/dev/null | grep -q TableName && return 0 || return 1; }
cognito_exists() { aws cognito-idp list-user-pools --max-results 60 --region "$REGION" --profile "$PROFILE" --query "UserPools[?Name=='${1}'].Id" --output text | grep -q . && return 0 || return 1; }
sqs_exists()     { aws sqs get-queue-url --queue-name "$1" --region "$REGION" --profile "$PROFILE" 2>/dev/null | grep -q QueueUrl && return 0 || return 1; }

# ── 1. S3 Buckets ─────────────────────────────────────────────────────────────
step "S3 Buckets"
BUCKETS=(
  "${APP}-frontend-${ENV}"
  "${APP}-designs-${ENV}"
  "${APP}-exports-${ENV}"
  "${APP}-media-${ENV}"
  "${APP}-lambda-artifacts-${ENV}"
)
for BUCKET in "${BUCKETS[@]}"; do
  if s3_exists "$BUCKET"; then
    skip "$BUCKET"
  else
    aws s3api create-bucket \
      --bucket "$BUCKET" \
      --region "$REGION" \
      --profile "$PROFILE" \
      --create-bucket-configuration LocationConstraint="$REGION" 2>/dev/null || \
    aws s3api create-bucket \
      --bucket "$BUCKET" \
      --region "$REGION" \
      --profile "$PROFILE" >/dev/null
    # Block all public access
    aws s3api put-public-access-block \
      --bucket "$BUCKET" \
      --profile "$PROFILE" \
      --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
    # Enable versioning on critical buckets
    if [[ "$BUCKET" == *"designs"* ]] || [[ "$BUCKET" == *"exports"* ]]; then
      aws s3api put-bucket-versioning \
        --bucket "$BUCKET" \
        --profile "$PROFILE" \
        --versioning-configuration Status=Enabled
    fi
    ok "$BUCKET created + public access blocked"
  fi
done

# ── 2. DynamoDB — single table design ─────────────────────────────────────────
step "DynamoDB — EventCraft single table"
TABLE="${APP}-${ENV}"
if dynamo_exists "$TABLE"; then
  skip "$TABLE"
else
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --billing-mode PAY_PER_REQUEST \
    --attribute-definitions \
      AttributeName=PK,AttributeType=S \
      AttributeName=SK,AttributeType=S \
      AttributeName=GSI1PK,AttributeType=S \
      AttributeName=GSI1SK,AttributeType=S \
      AttributeName=GSI2PK,AttributeType=S \
      AttributeName=GSI2SK,AttributeType=S \
    --key-schema \
      AttributeName=PK,KeyType=HASH \
      AttributeName=SK,KeyType=RANGE \
    --global-secondary-indexes \
      '[
        {
          "IndexName":"GSI1",
          "KeySchema":[
            {"AttributeName":"GSI1PK","KeyType":"HASH"},
            {"AttributeName":"GSI1SK","KeyType":"RANGE"}
          ],
          "Projection":{"ProjectionType":"ALL"}
        },
        {
          "IndexName":"GSI2",
          "KeySchema":[
            {"AttributeName":"GSI2PK","KeyType":"HASH"},
            {"AttributeName":"GSI2SK","KeyType":"RANGE"}
          ],
          "Projection":{"ProjectionType":"ALL"}
        }
      ]' \
    --tags \
      Key=App,Value="${APP}" \
      Key=Env,Value="${ENV}" \
      Key=ManagedBy,Value=bootstrap-script \
    --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
    >/dev/null
  ok "$TABLE created (PAY_PER_REQUEST + 2 GSIs + Streams)"
fi

# Usage events table (billing metering, separate for clean analytics)
USAGE_TABLE="${APP}-usage-events-${ENV}"
if dynamo_exists "$USAGE_TABLE"; then
  skip "$USAGE_TABLE"
else
  aws dynamodb create-table \
    --table-name "$USAGE_TABLE" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --billing-mode PAY_PER_REQUEST \
    --attribute-definitions \
      AttributeName=PK,AttributeType=S \
      AttributeName=SK,AttributeType=S \
    --key-schema \
      AttributeName=PK,KeyType=HASH \
      AttributeName=SK,KeyType=RANGE \
    --tags Key=App,Value="${APP}" Key=Env,Value="${ENV}" \
    >/dev/null
  ok "$USAGE_TABLE created (billing metering)"
fi

# ── 3. Cognito User Pool ──────────────────────────────────────────────────────
step "Cognito User Pool"
POOL_NAME="${APP}-users-${ENV}"
EXISTING_POOL=$(aws cognito-idp list-user-pools \
  --max-results 60 \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query "UserPools[?Name=='${POOL_NAME}'].Id" \
  --output text)

if [ -n "$EXISTING_POOL" ]; then
  skip "$POOL_NAME (ID: $EXISTING_POOL)"
  POOL_ID="$EXISTING_POOL"
else
  POOL_ID=$(aws cognito-idp create-user-pool \
    --pool-name "$POOL_NAME" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --auto-verified-attributes email \
    --username-attributes email \
    --username-configuration CaseSensitive=false \
    --password-policy \
      MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false \
    --schema \
      '[
        {"Name":"email","AttributeDataType":"String","Required":true,"Mutable":true},
        {"Name":"given_name","AttributeDataType":"String","Required":false,"Mutable":true},
        {"Name":"family_name","AttributeDataType":"String","Required":false,"Mutable":true},
        {"Name":"stripe_customer_id","AttributeDataType":"String","Required":false,"Mutable":true},
        {"Name":"plan","AttributeDataType":"String","Required":false,"Mutable":true}
      ]' \
    --email-configuration EmailSendingAccount=COGNITO_DEFAULT \
    --tags App="${APP}" Env="${ENV}" \
    --query UserPool.Id \
    --output text)
  ok "$POOL_NAME created (ID: $POOL_ID)"
fi

# Cognito App Client
CLIENT_NAME="${APP}-webclient-${ENV}"
EXISTING_CLIENT=$(aws cognito-idp list-user-pool-clients \
  --user-pool-id "$POOL_ID" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query "UserPoolClients[?ClientName=='${CLIENT_NAME}'].ClientId" \
  --output text)

if [ -n "$EXISTING_CLIENT" ]; then
  skip "App client $CLIENT_NAME"
  CLIENT_ID="$EXISTING_CLIENT"
else
  CLIENT_ID=$(aws cognito-idp create-user-pool-client \
    --user-pool-id "$POOL_ID" \
    --client-name "$CLIENT_NAME" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --generate-secret \
    --explicit-auth-flows \
      ALLOW_USER_PASSWORD_AUTH \
      ALLOW_REFRESH_TOKEN_AUTH \
      ALLOW_USER_SRP_AUTH \
    --supported-identity-providers COGNITO \
    --callback-urls "http://localhost:3000/auth/callback" "https://${APP}-${ENV}.your-domain.com/auth/callback" \
    --logout-urls "http://localhost:3000" "https://${APP}-${ENV}.your-domain.com" \
    --allowed-o-auth-flows code \
    --allowed-o-auth-scopes openid email profile \
    --allowed-o-auth-flows-user-pool-client \
    --query UserPoolClient.ClientId \
    --output text)
  ok "App client created (ID: $CLIENT_ID)"
fi

# ── 4. SQS Queue (export jobs) ────────────────────────────────────────────────
step "SQS Queue — export jobs"
QUEUE_NAME="${APP}-exports-${ENV}.fifo"
if sqs_exists "$QUEUE_NAME"; then
  skip "$QUEUE_NAME"
else
  QUEUE_URL=$(aws sqs create-queue \
    --queue-name "$QUEUE_NAME" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --attributes \
      FifoQueue=true \
      ContentBasedDeduplication=true \
      VisibilityTimeout=300 \
      MessageRetentionPeriod=86400 \
    --tags App="${APP}" Env="${ENV}" \
    --query QueueUrl \
    --output text)
  ok "$QUEUE_NAME created → $QUEUE_URL"
fi

# ── 5. CloudWatch Log Groups ──────────────────────────────────────────────────
step "CloudWatch Log Groups"
LAMBDAS=(events design export notify qr auth billing)
for LAMBDA in "${LAMBDAS[@]}"; do
  LOG_GROUP="/aws/lambda/${APP}-${LAMBDA}-${ENV}"
  EXISTING=$(aws logs describe-log-groups \
    --log-group-name-prefix "$LOG_GROUP" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query "logGroups[?logGroupName=='${LOG_GROUP}'].logGroupName" \
    --output text)
  if [ -n "$EXISTING" ]; then
    skip "$LOG_GROUP"
  else
    aws logs create-log-group \
      --log-group-name "$LOG_GROUP" \
      --region "$REGION" \
      --profile "$PROFILE"
    RETENTION=$( [[ "$ENV" == "prod" ]] && echo 90 || echo 30 )
    aws logs put-retention-policy \
      --log-group-name "$LOG_GROUP" \
      --retention-in-days "$RETENTION" \
      --region "$REGION" \
      --profile "$PROFILE"
    ok "$LOG_GROUP (${RETENTION}d retention)"
  fi
done

# ── 6. Secrets Manager placeholders ──────────────────────────────────────────
step "Secrets Manager — placeholder secrets"
SECRETS=(
  "${APP}/${ENV}/stripe-secret-key:YOUR_STRIPE_SECRET_KEY"
  "${APP}/${ENV}/anthropic-api-key:YOUR_ANTHROPIC_API_KEY"
  "${APP}/${ENV}/sentry-dsn:YOUR_SENTRY_DSN"
  "${APP}/${ENV}/recaptcha-secret:YOUR_RECAPTCHA_SECRET_KEY"
)
for SECRET_PAIR in "${SECRETS[@]}"; do
  SECRET_NAME="${SECRET_PAIR%%:*}"
  SECRET_PLACEHOLDER="${SECRET_PAIR##*:}"
  EXISTING=$(aws secretsmanager describe-secret \
    --secret-id "$SECRET_NAME" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query Name \
    --output text 2>/dev/null || echo "")
  if [ -n "$EXISTING" ]; then
    skip "$SECRET_NAME"
  else
    aws secretsmanager create-secret \
      --name "$SECRET_NAME" \
      --description "EventCraft ${ENV} secret — update value before deploy" \
      --secret-string "$SECRET_PLACEHOLDER" \
      --region "$REGION" \
      --profile "$PROFILE" \
      --tags Key=App,Value="${APP}" Key=Env,Value="${ENV}" \
      >/dev/null
    ok "$SECRET_NAME created (⚠ UPDATE VALUE BEFORE DEPLOYING)"
  fi
done

# ── 7. SAM deploy bucket (for Lambda artifacts) ───────────────────────────────
step "SAM artifact bucket"
SAM_BUCKET="${APP}-lambda-artifacts-${ENV}"
# Already created in step 1, just verify
if s3_exists "$SAM_BUCKET"; then
  ok "$SAM_BUCKET ready for SAM deployments"
fi

# ── 8. CloudWatch Alarms ─────────────────────────────────────────────────────
step "CloudWatch Alarms"
ALARM_EMAIL="your-email@example.com"
# SNS topic for alerts
TOPIC_NAME="${APP}-alerts-${ENV}"
EXISTING_TOPIC=$(aws sns list-topics \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query "Topics[?ends_with(TopicArn,'${TOPIC_NAME}')].TopicArn" \
  --output text)
if [ -n "$EXISTING_TOPIC" ]; then
  skip "SNS topic $TOPIC_NAME"
  TOPIC_ARN="$EXISTING_TOPIC"
else
  TOPIC_ARN=$(aws sns create-topic \
    --name "$TOPIC_NAME" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query TopicArn \
    --output text)
  aws sns subscribe \
    --topic-arn "$TOPIC_ARN" \
    --protocol email \
    --notification-endpoint "$ALARM_EMAIL" \
    --region "$REGION" \
    --profile "$PROFILE" \
    >/dev/null
  ok "SNS topic created → $ALARM_EMAIL (confirm subscription email)"
fi

# ── 9. Summary output ────────────────────────────────────────────────────────
step "Bootstrap complete — resource summary"
echo ""
echo -e "  ${GREEN}${BOLD}Environment:${NC}    ${ENV}"
echo -e "  ${GREEN}${BOLD}AWS Account:${NC}    ${ACCOUNT_ID}"
echo -e "  ${GREEN}${BOLD}Region:${NC}         ${REGION}"
echo -e "  ${GREEN}${BOLD}DynamoDB table:${NC} ${TABLE}"
echo -e "  ${GREEN}${BOLD}Cognito Pool:${NC}   ${POOL_ID}"
echo -e "  ${GREEN}${BOLD}Cognito Client:${NC} ${CLIENT_ID}"
echo ""
echo -e "  ${YELLOW}${BOLD}⚠  NEXT STEPS:${NC}"
echo "  1. Update Secrets Manager values (Stripe, Anthropic, Sentry, reCAPTCHA keys)"
echo "  2. Run: aws configure --profile eventcraft-dev  (if not done)"
echo "  3. Run: ./scripts/create-github-repo.sh  (creates repo + sets secrets)"
echo "  4. Run: ./scripts/deploy.sh ${ENV}  (first SAM deploy)"
echo ""

# Save config for other scripts to consume
cat > ".env.${ENV}" << ENVFILE
APP=${APP}
ENV=${ENV}
REGION=${REGION}
AWS_PROFILE=${PROFILE}
AWS_ACCOUNT_ID=${ACCOUNT_ID}
DYNAMODB_TABLE=${TABLE}
USAGE_TABLE=${USAGE_TABLE}
COGNITO_POOL_ID=${POOL_ID}
COGNITO_CLIENT_ID=${CLIENT_ID}
S3_DESIGNS_BUCKET=${APP}-designs-${ENV}
S3_EXPORTS_BUCKET=${APP}-exports-${ENV}
S3_MEDIA_BUCKET=${APP}-media-${ENV}
S3_FRONTEND_BUCKET=${APP}-frontend-${ENV}
SAM_BUCKET=${SAM_BUCKET}
ENVFILE

ok ".env.${ENV} written (source this in other scripts)"
