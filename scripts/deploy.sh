#!/usr/bin/env bash
# =============================================================================
# EventCraft — SAM Deploy Script
# Builds and deploys all Lambda functions via SAM
# Usage: ./scripts/deploy.sh [staging|prod]
# =============================================================================

set -euo pipefail
ENV="${1:-staging}"
source "$(dirname "$0")/../.env.${ENV}"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'
step() { echo -e "\n${CYAN}${BOLD}==> $1${NC}"; }
ok()   { echo -e "    ${GREEN}[OK]${NC} $1"; }

step "Building Lambda functions (SAM)"
sam build \
  --template-file infrastructure/template.yaml \
  --build-dir .aws-sam/build \
  --parallel

ok "SAM build complete"

step "Deploying to ${ENV}"
sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name "eventcraft-${ENV}" \
  --s3-bucket "${SAM_BUCKET}" \
  --s3-prefix "sam/${ENV}" \
  --region "${REGION}" \
  --profile "${AWS_PROFILE}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Environment="${ENV}" \
    DynamoDBTable="${DYNAMODB_TABLE}" \
    UsageTable="${USAGE_TABLE}" \
    CognitoPoolId="${COGNITO_POOL_ID}" \
    S3DesignsBucket="${S3_DESIGNS_BUCKET}" \
    S3ExportsBucket="${S3_EXPORTS_BUCKET}" \
    S3MediaBucket="${S3_MEDIA_BUCKET}" \
  --no-fail-on-empty-changeset \
  --tags App=eventcraft Env="${ENV}" ManagedBy=deploy-script

ok "SAM deploy complete → stack: eventcraft-${ENV}"

step "Deploying frontend to S3 + CloudFront invalidation"
# Build Next.js
cd apps/web
pnpm build
pnpm export 2>/dev/null || true

# Sync to S3
aws s3 sync out/ "s3://${S3_FRONTEND_BUCKET}" \
  --delete \
  --profile "${AWS_PROFILE}" \
  --region "${REGION}" \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "*.html"

aws s3 sync out/ "s3://${S3_FRONTEND_BUCKET}" \
  --delete \
  --profile "${AWS_PROFILE}" \
  --region "${REGION}" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --include "*.html"

ok "Frontend synced to s3://${S3_FRONTEND_BUCKET}"

# CloudFront invalidation
CF_ID=$(aws cloudfront list-distributions \
  --profile "${AWS_PROFILE}" \
  --query "DistributionList.Items[?Comment=='eventcraft-${ENV}'].Id" \
  --output text)
if [ -n "$CF_ID" ]; then
  aws cloudfront create-invalidation \
    --distribution-id "$CF_ID" \
    --paths "/*" \
    --profile "${AWS_PROFILE}" \
    >/dev/null
  ok "CloudFront invalidation created for $CF_ID"
fi

cd ../..
step "Deploy complete → ${ENV}"
echo -e "  ${GREEN}${BOLD}All services deployed successfully${NC}"
