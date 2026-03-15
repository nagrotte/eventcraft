#!/usr/bin/env bash
# =============================================================================
# EventCraft — Custom Domain, ACM Certificates, CloudFront & Route 53 Setup
# Fully automated via AWS CLI. Idempotent — safe to re-run.
#
# What this script creates:
#   1. ACM wildcard certificate (us-east-1)  — for CloudFront + API Gateway
#   2. CloudFront distribution               — serves frontend (S3 → eventcraft.io)
#   3. API Gateway custom domain             — api.eventcraft.io → HTTP API
#   4. Route 53 A alias records              — eventcraft.io + api.eventcraft.io
#   5. Disables default API Gateway URL      — forces traffic through custom domain
#
# Usage:
#   ./scripts/setup-domain.sh staging yourdomain.com
#   ./scripts/setup-domain.sh prod    eventcraft.io
#
# Prerequisites:
#   - Route 53 hosted zone already exists for DOMAIN
#   - bootstrap.sh has been run (S3 + API GW exist)
#   - AWS CLI configured with profile eventcraft-dev
# =============================================================================

set -euo pipefail

ENV="${1:-staging}"
DOMAIN="${2:-eventcraft.io}"    # ← Your actual domain
source "$(dirname "$0")/../.env.${ENV}" 2>/dev/null || true

PROFILE="${AWS_PROFILE:-eventcraft-dev}"
REGION="us-east-1"             # API GW region
CF_REGION="us-east-1"          # ACM for CloudFront MUST be us-east-1
APP="eventcraft"

# Subdomain logic: staging uses staging.eventcraft.io, prod uses eventcraft.io
if [ "$ENV" = "prod" ]; then
  WEB_DOMAIN="${DOMAIN}"
  API_DOMAIN="api.${DOMAIN}"
  WWW_DOMAIN="www.${DOMAIN}"
else
  WEB_DOMAIN="${ENV}.${DOMAIN}"
  API_DOMAIN="api-${ENV}.${DOMAIN}"
  WWW_DOMAIN=""
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'

step()  { echo -e "\n${CYAN}${BOLD}==> $1${NC}"; }
ok()    { echo -e "    ${GREEN}[OK]${NC} $1"; }
skip()  { echo -e "    ${YELLOW}[--]${NC} $1 (already exists)"; }
info()  { echo -e "    ${CYAN}[  ]${NC} $1"; }
warn()  { echo -e "    ${RED}[!!]${NC} $1"; }

echo -e "${CYAN}${BOLD}"
echo "  EventCraft Domain Setup"
echo "  Environment : ${ENV}"
echo "  Domain      : ${DOMAIN}"
echo "  Web URL     : https://${WEB_DOMAIN}"
echo "  API URL     : https://${API_DOMAIN}"
echo -e "${NC}"

# ── 0. Get Route 53 Hosted Zone ID ────────────────────────────────────────────
step "Finding Route 53 hosted zone for ${DOMAIN}"
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
  --profile "$PROFILE" \
  --query "HostedZones[?Name=='${DOMAIN}.'].Id" \
  --output text | sed 's|/hostedzone/||')

if [ -z "$HOSTED_ZONE_ID" ]; then
  warn "No hosted zone found for ${DOMAIN}"
  warn "Run: aws route53 list-hosted-zones --profile ${PROFILE}"
  warn "Make sure the domain exists in Route 53 before running this script"
  exit 1
fi
ok "Hosted zone found: ${HOSTED_ZONE_ID}"

# ── 1. ACM Certificate (us-east-1 — covers BOTH CloudFront and API GW) ────────
step "ACM Certificate — us-east-1 (wildcard *.${DOMAIN} + ${DOMAIN})"

# Check if wildcard cert already exists
CERT_ARN=$(aws acm list-certificates \
  --region us-east-1 \
  --profile "$PROFILE" \
  --query "CertificateSummaryList[?DomainName=='*.${DOMAIN}'].CertificateArn" \
  --output text 2>/dev/null || echo "")

if [ -n "$CERT_ARN" ]; then
  CERT_STATUS=$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region us-east-1 \
    --profile "$PROFILE" \
    --query Certificate.Status \
    --output text)
  skip "Certificate exists (${CERT_ARN}) — Status: ${CERT_STATUS}"
else
  info "Requesting wildcard certificate for *.${DOMAIN} and ${DOMAIN}..."
  CERT_ARN=$(aws acm request-certificate \
    --domain-name "*.${DOMAIN}" \
    --subject-alternative-names "${DOMAIN}" \
    --validation-method DNS \
    --region us-east-1 \
    --profile "$PROFILE" \
    --tags Key=App,Value="${APP}" Key=Env,Value="${ENV}" \
    --query CertificateArn \
    --output text)
  ok "Certificate requested: ${CERT_ARN}"

  # Wait a moment for CNAME records to be available
  info "Waiting 10s for validation DNS records to generate..."
  sleep 10

  # Get the DNS validation records
  VALIDATION_RECORDS=$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region us-east-1 \
    --profile "$PROFILE" \
    --query "Certificate.DomainValidationOptions[*].ResourceRecord" \
    --output json)

  CNAME_NAME=$(echo "$VALIDATION_RECORDS" | python3 -c "
import json,sys
records = json.load(sys.stdin)
for r in records:
    if r and 'Name' in r:
        print(r['Name'])
        break
" 2>/dev/null || echo "")

  CNAME_VALUE=$(echo "$VALIDATION_RECORDS" | python3 -c "
import json,sys
records = json.load(sys.stdin)
for r in records:
    if r and 'Value' in r:
        print(r['Value'])
        break
" 2>/dev/null || echo "")

  if [ -n "$CNAME_NAME" ] && [ -n "$CNAME_VALUE" ]; then
    info "Adding DNS validation CNAME to Route 53..."
    aws route53 change-resource-record-sets \
      --hosted-zone-id "$HOSTED_ZONE_ID" \
      --profile "$PROFILE" \
      --change-batch "{
        \"Changes\": [{
          \"Action\": \"UPSERT\",
          \"ResourceRecordSet\": {
            \"Name\": \"${CNAME_NAME}\",
            \"Type\": \"CNAME\",
            \"TTL\": 300,
            \"ResourceRecords\": [{\"Value\": \"${CNAME_VALUE}\"}]
          }
        }]
      }" >/dev/null
    ok "Validation CNAME added to Route 53"
  fi

  # Wait for validation (ACM DNS validation usually takes 1-5 minutes)
  info "Waiting for certificate validation (up to 5 min)..."
  aws acm wait certificate-validated \
    --certificate-arn "$CERT_ARN" \
    --region us-east-1 \
    --profile "$PROFILE" && ok "Certificate validated!" || {
    warn "Certificate not yet validated — check ACM console"
    warn "Continue running this script later once certificate shows ISSUED"
    warn "Certificate ARN: ${CERT_ARN}"
    echo "CERT_ARN=${CERT_ARN}" >> ".env.${ENV}"
    exit 0
  }
  CERT_STATUS="ISSUED"
fi

if [ "$CERT_STATUS" != "ISSUED" ]; then
  warn "Certificate is ${CERT_STATUS} — not yet ready for use"
  warn "Re-run this script once the certificate shows ISSUED in ACM console"
  exit 1
fi

ok "Certificate is ISSUED and ready"

# ── 2. CloudFront Distribution ────────────────────────────────────────────────
step "CloudFront Distribution — ${WEB_DOMAIN} → S3"

# Check if distribution already exists for this domain
CF_DIST_ID=$(aws cloudfront list-distributions \
  --profile "$PROFILE" \
  --query "DistributionList.Items[?Aliases.Items[?@=='${WEB_DOMAIN}']].Id" \
  --output text 2>/dev/null || echo "")

if [ -n "$CF_DIST_ID" ]; then
  skip "CloudFront distribution exists: ${CF_DIST_ID}"
  CF_DOMAIN=$(aws cloudfront get-distribution \
    --id "$CF_DIST_ID" \
    --profile "$PROFILE" \
    --query Distribution.DomainName \
    --output text)
else
  S3_BUCKET="${APP}-frontend-${ENV}"
  # Get S3 bucket website domain
  S3_ORIGIN="${S3_BUCKET}.s3.${REGION}.amazonaws.com"

  # Create Origin Access Control
  OAC_ID=$(aws cloudfront create-origin-access-control \
    --profile "$PROFILE" \
    --origin-access-control-config "{
      \"Name\": \"${APP}-oac-${ENV}\",
      \"Description\": \"OAC for EventCraft ${ENV} frontend\",
      \"SigningProtocol\": \"sigv4\",
      \"SigningBehavior\": \"always\",
      \"OriginAccessControlOriginType\": \"s3\"
    }" \
    --query OriginAccessControl.Id \
    --output text 2>/dev/null || \
    aws cloudfront list-origin-access-controls \
      --profile "$PROFILE" \
      --query "OriginAccessControlList.Items[?Name=='${APP}-oac-${ENV}'].Id" \
      --output text)

  info "Creating CloudFront distribution for ${WEB_DOMAIN}..."

  # Build aliases array
  if [ -n "$WWW_DOMAIN" ]; then
    ALIASES="\"${WEB_DOMAIN}\",\"${WWW_DOMAIN}\""
    ALIASES_QUANTITY=2
  else
    ALIASES="\"${WEB_DOMAIN}\""
    ALIASES_QUANTITY=1
  fi

  CF_DIST_ID=$(aws cloudfront create-distribution \
    --profile "$PROFILE" \
    --distribution-config "{
      \"CallerReference\": \"${APP}-${ENV}-$(date +%s)\",
      \"Comment\": \"eventcraft-${ENV}\",
      \"DefaultRootObject\": \"index.html\",
      \"Aliases\": {
        \"Quantity\": ${ALIASES_QUANTITY},
        \"Items\": [${ALIASES}]
      },
      \"Origins\": {
        \"Quantity\": 1,
        \"Items\": [{
          \"Id\": \"S3-${S3_BUCKET}\",
          \"DomainName\": \"${S3_ORIGIN}\",
          \"OriginAccessControlId\": \"${OAC_ID}\",
          \"S3OriginConfig\": {\"OriginAccessIdentity\": \"\"}
        }]
      },
      \"DefaultCacheBehavior\": {
        \"TargetOriginId\": \"S3-${S3_BUCKET}\",
        \"ViewerProtocolPolicy\": \"redirect-to-https\",
        \"CachePolicyId\": \"658327ea-f89d-4fab-a63d-7e88639e58f6\",
        \"AllowedMethods\": {
          \"Quantity\": 2,
          \"Items\": [\"GET\",\"HEAD\"],
          \"CachedMethods\": {\"Quantity\": 2,\"Items\": [\"GET\",\"HEAD\"]}
        },
        \"Compress\": true
      },
      \"CustomErrorResponses\": {
        \"Quantity\": 2,
        \"Items\": [
          {\"ErrorCode\": 404,\"ResponsePagePath\": \"/index.html\",\"ResponseCode\": \"200\",\"ErrorCachingMinTTL\": 0},
          {\"ErrorCode\": 403,\"ResponsePagePath\": \"/index.html\",\"ResponseCode\": \"200\",\"ErrorCachingMinTTL\": 0}
        ]
      },
      \"PriceClass\": \"PriceClass_100\",
      \"HttpVersion\": \"http2and3\",
      \"IsIPV6Enabled\": true,
      \"Enabled\": true,
      \"ViewerCertificate\": {
        \"ACMCertificateArn\": \"${CERT_ARN}\",
        \"SSLSupportMethod\": \"sni-only\",
        \"MinimumProtocolVersion\": \"TLSv1.2_2021\"
      },
      \"Logging\": {
        \"Enabled\": false,
        \"IncludeCookies\": false,
        \"Bucket\": \"\",
        \"Prefix\": \"\"
      }
    }" \
    --query Distribution.Id \
    --output text)
  ok "CloudFront distribution created: ${CF_DIST_ID}"

  CF_DOMAIN=$(aws cloudfront get-distribution \
    --id "$CF_DIST_ID" \
    --profile "$PROFILE" \
    --query Distribution.DomainName \
    --output text)
  ok "CloudFront domain: ${CF_DOMAIN}"

  # Update S3 bucket policy to allow CloudFront OAC
  info "Updating S3 bucket policy for CloudFront OAC access..."
  ACCOUNT_ID=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)
  aws s3api put-bucket-policy \
    --bucket "${S3_BUCKET}" \
    --profile "$PROFILE" \
    --policy "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [{
        \"Sid\": \"AllowCloudFrontOAC\",
        \"Effect\": \"Allow\",
        \"Principal\": {\"Service\": \"cloudfront.amazonaws.com\"},
        \"Action\": \"s3:GetObject\",
        \"Resource\": \"arn:aws:s3:::${S3_BUCKET}/*\",
        \"Condition\": {
          \"StringEquals\": {
            \"AWS:SourceArn\": \"arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${CF_DIST_ID}\"
          }
        }
      }]
    }"
  ok "S3 bucket policy updated for OAC"
fi

# ── 3. API Gateway Custom Domain ──────────────────────────────────────────────
step "API Gateway custom domain — ${API_DOMAIN}"

EXISTING_APIGW_DOMAIN=$(aws apigatewayv2 get-domain-names \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query "Items[?DomainName=='${API_DOMAIN}'].DomainName" \
  --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_APIGW_DOMAIN" ]; then
  skip "API Gateway custom domain ${API_DOMAIN}"
  APIGW_DOMAIN_TARGET=$(aws apigatewayv2 get-domain-name \
    --domain-name "$API_DOMAIN" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query "DomainNameConfigurations[0].ApiGatewayDomainName" \
    --output text)
  APIGW_HZ=$(aws apigatewayv2 get-domain-name \
    --domain-name "$API_DOMAIN" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query "DomainNameConfigurations[0].HostedZoneId" \
    --output text)
else
  RESULT=$(aws apigatewayv2 create-domain-name \
    --domain-name "$API_DOMAIN" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --domain-name-configurations \
      "CertificateArn=${CERT_ARN},EndpointType=REGIONAL,SecurityPolicy=TLS_1_2" \
    --tags App="${APP}" Env="${ENV}")
  APIGW_DOMAIN_TARGET=$(echo "$RESULT" | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(d['DomainNameConfigurations'][0]['ApiGatewayDomainName'])
")
  APIGW_HZ=$(echo "$RESULT" | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(d['DomainNameConfigurations'][0]['HostedZoneId'])
")
  ok "API Gateway custom domain created"
  ok "Target: ${APIGW_DOMAIN_TARGET}"

  # Get the API ID and map it to the custom domain
  info "Creating API mapping..."
  API_ID=$(aws apigatewayv2 get-apis \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query "Items[?Name=='EventCraftApi' || Tags.App=='${APP}'].ApiId | [0]" \
    --output text 2>/dev/null || echo "")

  if [ -n "$API_ID" ] && [ "$API_ID" != "None" ]; then
    aws apigatewayv2 create-api-mapping \
      --domain-name "$API_DOMAIN" \
      --api-id "$API_ID" \
      --stage "$ENV" \
      --region "$REGION" \
      --profile "$PROFILE" >/dev/null
    ok "API ${API_ID} mapped to ${API_DOMAIN}"
  else
    warn "API not yet deployed — run deploy.sh first, then re-run this script"
    warn "The custom domain is created; just needs the API mapping after first SAM deploy"
  fi
fi

# ── 4. Route 53 DNS Records ───────────────────────────────────────────────────
step "Route 53 DNS records"

# Helper: upsert a Route 53 alias record
upsert_alias() {
  local NAME="$1"
  local TARGET="$2"
  local HOSTED_ZONE_TARGET="$3"
  local COMMENT="$4"

  info "Upserting A alias: ${NAME} → ${TARGET}"
  aws route53 change-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --profile "$PROFILE" \
    --change-batch "{
      \"Comment\": \"${COMMENT}\",
      \"Changes\": [{
        \"Action\": \"UPSERT\",
        \"ResourceRecordSet\": {
          \"Name\": \"${NAME}\",
          \"Type\": \"A\",
          \"AliasTarget\": {
            \"HostedZoneId\": \"${HOSTED_ZONE_TARGET}\",
            \"DNSName\": \"${TARGET}\",
            \"EvaluateTargetHealth\": false
          }
        }
      }]
    }" >/dev/null
  ok "${NAME} → ${TARGET}"
}

# CloudFront hosted zone ID is always Z2FDTNDATAQYW2 globally
CF_HZ="Z2FDTNDATAQYW2"

# Record 1: eventcraft.io (or staging.eventcraft.io) → CloudFront
upsert_alias "${WEB_DOMAIN}." "${CF_DOMAIN}" "${CF_HZ}" "EventCraft ${ENV} web → CloudFront"

# Record 2: www.eventcraft.io → CloudFront (prod only)
if [ -n "$WWW_DOMAIN" ]; then
  upsert_alias "${WWW_DOMAIN}." "${CF_DOMAIN}" "${CF_HZ}" "EventCraft www → CloudFront"
fi

# Record 3: api.eventcraft.io → API Gateway
if [ -n "$APIGW_DOMAIN_TARGET" ] && [ "$APIGW_DOMAIN_TARGET" != "None" ]; then
  upsert_alias "${API_DOMAIN}." "${APIGW_DOMAIN_TARGET}" "${APIGW_HZ:-Z1UJRXOUMOOFQ8}" "EventCraft ${ENV} API → API Gateway"
fi

# ── 5. Disable default API GW endpoint ───────────────────────────────────────
step "Disabling default API Gateway URL (force custom domain only)"
API_ID=$(aws apigatewayv2 get-apis \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query "Items[?Tags.App=='${APP}'].ApiId | [0]" \
  --output text 2>/dev/null || echo "")

if [ -n "$API_ID" ] && [ "$API_ID" != "None" ]; then
  aws apigatewayv2 update-api \
    --api-id "$API_ID" \
    --disable-execute-api-endpoint \
    --region "$REGION" \
    --profile "$PROFILE" >/dev/null 2>&1 || true
  ok "Default endpoint disabled — only ${API_DOMAIN} works now"
fi

# ── 6. Update .env with new values ───────────────────────────────────────────
step "Saving domain config to .env.${ENV}"
{
  echo ""
  echo "# Domain config (added by setup-domain.sh)"
  echo "DOMAIN=${DOMAIN}"
  echo "WEB_DOMAIN=${WEB_DOMAIN}"
  echo "API_DOMAIN=${API_DOMAIN}"
  echo "CERT_ARN=${CERT_ARN}"
  echo "CF_DIST_ID=${CF_DIST_ID}"
  echo "CF_DOMAIN=${CF_DOMAIN}"
  echo "HOSTED_ZONE_ID=${HOSTED_ZONE_ID}"
  echo "NEXT_PUBLIC_API_URL=https://${API_DOMAIN}"
  echo "EXPO_PUBLIC_API_URL=https://${API_DOMAIN}"
} >> ".env.${ENV}"
ok ".env.${ENV} updated"

# ── 7. Update GitHub secrets with new domain values ──────────────────────────
step "Updating GitHub Actions secrets"
GITHUB_USER=$(gh api user --jq .login 2>/dev/null || echo "")
REPO="${GITHUB_USER}/eventcraft"

if [ -n "$GITHUB_USER" ]; then
  secrets_to_update=(
    "CLOUDFRONT_ID_${ENV^^}:${CF_DIST_ID}"
    "NEXT_PUBLIC_API_URL:https://${API_DOMAIN}"
    "CERT_ARN_${ENV^^}:${CERT_ARN}"
    "S3_FRONTEND_BUCKET_${ENV^^}:${APP}-frontend-${ENV}"
  )
  for secret_pair in "${secrets_to_update[@]}"; do
    secret_name="${secret_pair%%:*}"
    secret_value="${secret_pair#*:}"
    echo "$secret_value" | gh secret set "$secret_name" --repo "$REPO" 2>/dev/null && \
      ok "Secret updated: $secret_name" || \
      warn "Could not set $secret_name (check gh auth)"
  done
fi

# ── 8. Summary ────────────────────────────────────────────────────────────────
step "Domain setup complete"
echo ""
echo -e "  ${GREEN}${BOLD}Environment:${NC}      ${ENV}"
echo -e "  ${GREEN}${BOLD}Web URL:${NC}          https://${WEB_DOMAIN}"
echo -e "  ${GREEN}${BOLD}API URL:${NC}          https://${API_DOMAIN}"
echo -e "  ${GREEN}${BOLD}Certificate:${NC}      ${CERT_ARN}"
echo -e "  ${GREEN}${BOLD}CloudFront ID:${NC}    ${CF_DIST_ID}"
echo -e "  ${GREEN}${BOLD}CloudFront domain:${NC} ${CF_DOMAIN}"
echo ""
echo -e "  ${YELLOW}${BOLD}⚠  CloudFront deployment takes 10-20 min to propagate globally${NC}"
echo -e "  ${YELLOW}${BOLD}   Test with: curl -I https://${WEB_DOMAIN}${NC}"
echo ""
echo -e "  ${CYAN}DNS propagation check:${NC}"
echo "  dig ${WEB_DOMAIN} +short"
echo "  dig ${API_DOMAIN} +short"
echo ""
