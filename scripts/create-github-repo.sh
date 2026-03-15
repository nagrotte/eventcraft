#!/usr/bin/env bash
# =============================================================================
# EventCraft — GitHub Repository Setup
# Creates the repo, sets branch protection, pushes initial structure,
# and wires all GitHub Actions secrets from AWS
# Requires: gh CLI authenticated, .env.staging loaded
# Usage: ./scripts/create-github-repo.sh
# =============================================================================

set -euo pipefail

source "$(dirname "$0")/../.env.staging" 2>/dev/null || true

REPO_NAME="eventcraft"
REPO_DESC="EventCraft — Full-stack event invitation and design platform"
GITHUB_USER=$(gh api user --jq .login)

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'
step() { echo -e "\n${CYAN}${BOLD}==> $1${NC}"; }
ok()   { echo -e "    ${GREEN}[OK]${NC} $1"; }
skip() { echo -e "    ${YELLOW}[--]${NC} $1 (already set)"; }

step "Creating GitHub repository: ${GITHUB_USER}/${REPO_NAME}"
if gh repo view "${GITHUB_USER}/${REPO_NAME}" >/dev/null 2>&1; then
  skip "Repo already exists"
else
  gh repo create "$REPO_NAME" \
    --private \
    --description "$REPO_DESC" \
    --clone=false
  ok "Repository ${GITHUB_USER}/${REPO_NAME} created (private)"
fi

# ── Bootstrap monorepo structure locally if not already done ──────────────────
step "Scaffolding monorepo structure"
REPO_DIR="$(dirname "$0")/.."
cd "$REPO_DIR"

if [ ! -f "pnpm-workspace.yaml" ]; then

# Root package.json
cat > package.json << 'JSON'
{
  "name": "eventcraft-monorepo",
  "private": true,
  "scripts": {
    "dev":       "turbo dev",
    "build":     "turbo build",
    "lint":      "turbo lint",
    "test":      "turbo test",
    "typecheck": "turbo typecheck",
    "clean":     "turbo clean"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
JSON

# pnpm workspace
cat > pnpm-workspace.yaml << 'YAML'
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"
YAML

# turbo.json
cat > turbo.json << 'JSON'
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": [".next/**",".expo/**","dist/**"] },
    "dev":       { "persistent": true, "cache": false },
    "lint":      { "dependsOn": ["^build"] },
    "test":      { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "clean":     { "cache": false }
  }
}
JSON

# .gitignore
cat > .gitignore << 'IGNORE'
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
.next/
.expo/
out/

# AWS / SAM
.aws-sam/
.env.*
!.env.example
samconfig.toml.local

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/settings.json
*.swp
*.swo

# Testing
coverage/

# Sentry
.sentryclirc

# Lambda build
apps/api/*/bin/
apps/api/*/obj/
IGNORE

# .env.example (committed — shows all vars needed, no values)
cat > .env.example << 'ENV'
# Copy to .env.staging or .env.prod and fill in values
# NEVER commit actual values

APP=eventcraft
ENV=staging
REGION=us-east-1
AWS_PROFILE=eventcraft-dev
AWS_ACCOUNT_ID=
DYNAMODB_TABLE=eventcraft-staging
USAGE_TABLE=eventcraft-usage-events-staging
COGNITO_POOL_ID=
COGNITO_CLIENT_ID=
S3_DESIGNS_BUCKET=eventcraft-designs-staging
S3_EXPORTS_BUCKET=eventcraft-exports-staging
S3_MEDIA_BUCKET=eventcraft-media-staging
S3_FRONTEND_BUCKET=eventcraft-frontend-staging
SAM_BUCKET=eventcraft-lambda-artifacts-staging
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_COGNITO_POOL_ID=
NEXT_PUBLIC_COGNITO_CLIENT_ID=
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
NEXT_PUBLIC_SENTRY_DSN=
STRIPE_PUBLISHABLE_KEY=
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_COGNITO_POOL_ID=
EXPO_PUBLIC_COGNITO_CLIENT_ID=
ENV

# Create directory structure
mkdir -p apps/{web,mobile,api}
mkdir -p packages/{ui,tokens,hooks,services,types,utils}
mkdir -p tooling/{eslint,typescript}
mkdir -p scripts
mkdir -p infrastructure/migrations
mkdir -p docs
mkdir -p .github/workflows

# Placeholder READMEs to create git-tracked dirs
for dir in apps/web apps/mobile apps/api \
           packages/ui packages/tokens packages/hooks \
           packages/services packages/types packages/utils \
           tooling/eslint tooling/typescript \
           infrastructure docs; do
  echo "# ${dir##*/}" > "$dir/README.md"
done

ok "Monorepo directory structure created"

else
  skip "Monorepo structure (already exists)"
fi

# ── Git init and first commit ─────────────────────────────────────────────────
step "Git init and first commit"
if [ ! -d ".git" ]; then
  git init
  git branch -M main
  ok "Git initialized"
fi

git add -A
git diff --staged --quiet || {
  git commit -m "chore: initial monorepo scaffold

  - pnpm workspaces + Turborepo
  - apps/ (web, mobile, api)
  - packages/ (ui, tokens, hooks, services, types, utils)
  - tooling/ (eslint, typescript)
  - infrastructure/ (SAM template placeholder)
  - scripts/ (bootstrap, deploy, seed)
  - GitHub Actions workflows placeholder
  - .gitignore, .env.example"
  ok "Initial commit created"
}

# ── Push to GitHub ────────────────────────────────────────────────────────────
step "Pushing to GitHub"
if git remote get-url origin >/dev/null 2>&1; then
  skip "Remote 'origin' already set"
else
  git remote add origin "https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
  ok "Remote origin added"
fi
git push -u origin main
ok "Pushed to ${GITHUB_USER}/${REPO_NAME}"

# ── Branch protection ─────────────────────────────────────────────────────────
step "Branch protection rules"
# main branch
gh api \
  --method PUT \
  "repos/${GITHUB_USER}/${REPO_NAME}/branches/main/protection" \
  --input - << 'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["ci-frontend", "ci-backend"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
ok "main branch protection: PR required + CI must pass"

# Create staging branch
git checkout -b staging 2>/dev/null || git checkout staging
git push origin staging 2>/dev/null || true
git checkout main
ok "staging branch created"

# ── GitHub Actions secrets ────────────────────────────────────────────────────
step "GitHub Actions secrets"

# Get AWS credentials from current profile
AWS_ACCESS_KEY=$(aws configure get aws_access_key_id --profile "${AWS_PROFILE:-eventcraft-dev}")
AWS_SECRET_KEY=$(aws configure get aws_secret_access_key --profile "${AWS_PROFILE:-eventcraft-dev}")

SECRETS=(
  "AWS_ACCESS_KEY_ID:${AWS_ACCESS_KEY}"
  "AWS_SECRET_ACCESS_KEY:${AWS_SECRET_KEY}"
  "AWS_REGION:${REGION:-us-east-1}"
  "AWS_ACCOUNT_ID:${AWS_ACCOUNT_ID:-}"
  "DYNAMODB_TABLE_STAGING:eventcraft-staging"
  "DYNAMODB_TABLE_PROD:eventcraft-prod"
  "COGNITO_POOL_ID_STAGING:${COGNITO_POOL_ID:-REPLACE_ME}"
  "COGNITO_CLIENT_ID_STAGING:${COGNITO_CLIENT_ID:-REPLACE_ME}"
  "SAM_BUCKET_STAGING:eventcraft-lambda-artifacts-staging"
  "SAM_BUCKET_PROD:eventcraft-lambda-artifacts-prod"
  "SENTRY_AUTH_TOKEN:REPLACE_WITH_SENTRY_AUTH_TOKEN"
  "SENTRY_ORG:REPLACE_WITH_SENTRY_ORG"
  "SENTRY_PROJECT:eventcraft"
  "EXPO_TOKEN:REPLACE_WITH_EAS_TOKEN"
)

for SECRET_PAIR in "${SECRETS[@]}"; do
  SECRET_NAME="${SECRET_PAIR%%:*}"
  SECRET_VALUE="${SECRET_PAIR#*:}"
  EXISTING=$(gh secret list --repo "${GITHUB_USER}/${REPO_NAME}" \
    --jq ".[] | select(.name==\"${SECRET_NAME}\") | .name" 2>/dev/null || echo "")
  if [ -n "$EXISTING" ]; then
    skip "Secret: $SECRET_NAME"
  else
    echo "$SECRET_VALUE" | gh secret set "$SECRET_NAME" \
      --repo "${GITHUB_USER}/${REPO_NAME}"
    ok "Secret: $SECRET_NAME"
  fi
done

# ── Summary ───────────────────────────────────────────────────────────────────
step "Repository setup complete"
echo ""
echo -e "  ${GREEN}${BOLD}Repo:${NC}     https://github.com/${GITHUB_USER}/${REPO_NAME}"
echo -e "  ${GREEN}${BOLD}Branches:${NC} main (protected) + staging"
echo -e "  ${GREEN}${BOLD}Secrets:${NC}  ${#SECRETS[@]} secrets configured"
echo ""
echo -e "  ${YELLOW}${BOLD}⚠  NEXT STEPS:${NC}"
echo "  1. Update REPLACE_ME secrets in GitHub → Settings → Secrets"
echo "  2. Run: ./scripts/deploy.sh staging  (first deploy)"
echo "  3. Open VS Code: code ."
echo ""
