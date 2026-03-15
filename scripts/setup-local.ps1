# =============================================================================
# EventCraft — Local Developer Machine Setup
# Run as Administrator in PowerShell
# Idempotent: safe to run multiple times
# =============================================================================

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

function Write-Step  { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan   }
function Write-Ok    { param($msg) Write-Host "    [OK] $msg"  -ForegroundColor Green  }
function Write-Skip  { param($msg) Write-Host "    [--] $msg (already installed)" -ForegroundColor DarkGray }
function Write-Warn  { param($msg) Write-Host "    [!!] $msg"  -ForegroundColor Yellow }

Write-Host @"

  ███████╗██╗   ██╗███████╗███╗   ██╗████████╗ ██████╗██████╗  █████╗ ███████╗████████╗
  ██╔════╝██║   ██║██╔════╝████╗  ██║╚══██╔══╝██╔════╝██╔══██╗██╔══██╗██╔════╝╚══██╔══╝
  █████╗  ██║   ██║█████╗  ██╔██╗ ██║   ██║   ██║     ██████╔╝███████║█████╗     ██║
  ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║╚██╗██║   ██║   ██║     ██╔══██╗██╔══██║██╔══╝     ██║
  ███████╗ ╚████╔╝ ███████╗██║ ╚████║   ██║   ╚██████╗██║  ██║██║  ██║██║        ██║
  ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝        ╚═╝

  Local Machine Setup Script  |  Run as Administrator
"@ -ForegroundColor Magenta

# ── 1. Winget (package manager) ───────────────────────────────────────────────
Write-Step "Checking winget"
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Warn "winget not found. Install App Installer from Microsoft Store, then re-run."
    exit 1
} else { Write-Ok "winget available" }

# ── helper: winget install idempotent ─────────────────────────────────────────
function Install-Tool {
    param($id, $name, $checkCmd)
    if (Get-Command $checkCmd -ErrorAction SilentlyContinue) {
        Write-Skip $name
    } else {
        Write-Host "    Installing $name..." -ForegroundColor Yellow
        winget install --id $id --silent --accept-source-agreements --accept-package-agreements
        Write-Ok "$name installed"
    }
}

# ── 2. Core runtimes ──────────────────────────────────────────────────────────
Write-Step "Core runtimes"
Install-Tool "OpenJS.NodeJS.LTS"      "Node.js LTS"       "node"
Install-Tool "Microsoft.DotNet.SDK.8" ".NET 8 SDK"        "dotnet"
Install-Tool "Git.Git"                "Git"               "git"
Install-Tool "GitHub.cli"             "GitHub CLI (gh)"   "gh"

# ── 3. Package managers ───────────────────────────────────────────────────────
Write-Step "Package managers"
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "    Installing pnpm..." -ForegroundColor Yellow
    npm install -g pnpm
    Write-Ok "pnpm installed"
} else { Write-Skip "pnpm" }

if (-not (Get-Command turbo -ErrorAction SilentlyContinue)) {
    Write-Host "    Installing Turborepo..." -ForegroundColor Yellow
    pnpm install -g turbo
    Write-Ok "turbo installed"
} else { Write-Skip "turbo" }

# ── 4. AWS tooling ────────────────────────────────────────────────────────────
Write-Step "AWS tooling"
Install-Tool "Amazon.AWSCLI"          "AWS CLI v2"        "aws"
Install-Tool "Amazon.SAM-CLI"         "AWS SAM CLI"       "sam"

# ── 5. Expo / mobile tooling ──────────────────────────────────────────────────
Write-Step "Expo / mobile"
if (-not (Get-Command eas -ErrorAction SilentlyContinue)) {
    Write-Host "    Installing EAS CLI..." -ForegroundColor Yellow
    npm install -g eas-cli
    Write-Ok "eas-cli installed"
} else { Write-Skip "eas-cli" }

if (-not (Get-Command expo -ErrorAction SilentlyContinue)) {
    Write-Host "    Installing Expo CLI..." -ForegroundColor Yellow
    npm install -g expo-cli
    Write-Ok "expo-cli installed"
} else { Write-Skip "expo-cli" }

# ── 6. VS Code extensions ─────────────────────────────────────────────────────
Write-Step "VS Code extensions"
$extensions = @(
    # .NET / C#
    "ms-dotnettools.csharp",
    "ms-dotnettools.csdevkit",
    "ms-dotnettools.vscode-dotnet-runtime",
    # AWS
    "amazonwebservices.aws-toolkit-vscode",
    "amazonwebservices.amazon-q-vscode",
    # React / JS / TS
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "styled-components.vscode-styled-components",
    # React Native / Expo
    "msjsdiag.vscode-react-native",
    "expo.vscode-expo-tools",
    # Git
    "eamodio.gitlens",
    "github.vscode-pull-request-github",
    "github.vscode-github-actions",
    # Quality
    "streetsidesoftware.code-spell-checker",
    "usernamehw.errorlens",
    "gruntfuggly.todo-tree",
    "christian-kohler.path-intellisense",
    # DynamoDB
    "aws-dynamodb.aws-dynamodb-explorer",
    # REST testing
    "humao.rest-client",
    # Markdown / docs
    "yzhang.markdown-all-in-one",
    # Docker (optional, useful later)
    "ms-azuretools.vscode-docker"
)

if (Get-Command code -ErrorAction SilentlyContinue) {
    foreach ($ext in $extensions) {
        $installed = code --list-extensions 2>$null | Where-Object { $_ -eq $ext }
        if ($installed) {
            Write-Skip $ext
        } else {
            code --install-extension $ext --force 2>$null
            Write-Ok $ext
        }
    }
} else {
    Write-Warn "VS Code 'code' command not found. Open VS Code, run: Shell Command: Install 'code' command in PATH, then re-run this script."
}

# ── 7. VS Code workspace settings ────────────────────────────────────────────
Write-Step "VS Code workspace settings"
$vscodeDir = "$PSScriptRoot\.vscode"
if (-not (Test-Path $vscodeDir)) { New-Item -ItemType Directory -Path $vscodeDir | Out-Null }

$settings = @'
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.tabSize": 2,
  "editor.rulers": [100],
  "editor.bracketPairColorization.enabled": true,
  "editor.guides.bracketPairs": "active",
  "editor.inlineSuggest.enabled": true,
  "files.autoSave": "onFocusChange",
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "terminal.integrated.defaultProfile.windows": "PowerShell",
  "eslint.validate": ["javascript","javascriptreact","typescript","typescriptreact"],
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "tailwindCSS.includeLanguages": { "typescriptreact": "html" },
  "tailwindCSS.experimental.classRegex": [["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]],
  "[csharp]": { "editor.defaultFormatter": "ms-dotnettools.csharp" },
  "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[json]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "csharp.inlayHints.enableInlayHintsForParameters": true,
  "aws.samcli.location": "",
  "aws.profile": "eventcraft-dev",
  "gitlens.hovers.currentLine.over": "line",
  "todo-tree.regex.regex": "(//|#|<!--|;|/\\*)\\s*(TODO|FIXME|HACK|WARN|NOTE|PERF):",
  "errorLens.enabledDiagnosticLevels": ["error","warning","info"],
  "extensions.ignoreRecommendations": false
}
'@
$settings | Out-File -FilePath "$vscodeDir\settings.json" -Encoding UTF8
Write-Ok ".vscode/settings.json written"

# ── 8. .prettierrc ────────────────────────────────────────────────────────────
$prettier = @'
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "avoid"
}
'@
$prettier | Out-File -FilePath "$PSScriptRoot\.prettierrc" -Encoding UTF8
Write-Ok ".prettierrc written"

# ── 9. AWS CLI profile setup ──────────────────────────────────────────────────
Write-Step "AWS CLI profile"
Write-Host @"

    You need AWS credentials for the 'eventcraft-dev' profile.
    Run the following and paste your IAM user keys when prompted:

    aws configure --profile eventcraft-dev

    Required IAM permissions (attach these policies to your IAM user):
      - AmazonDynamoDBFullAccess
      - AmazonS3FullAccess
      - AWSLambda_FullAccess
      - AmazonAPIGatewayAdministrator
      - AmazonCognitoPowerUser
      - AmazonSESFullAccess
      - AmazonSQSFullAccess
      - CloudWatchFullAccess
      - SecretsManagerReadWrite
      - IAMFullAccess  (needed for SAM to create Lambda execution roles)

    Recommended: Create a dedicated IAM user 'eventcraft-deploy' with these policies.
    Never use root credentials.

"@ -ForegroundColor Yellow

# ── 10. Git global config ─────────────────────────────────────────────────────
Write-Step "Git global config"
$gitName  = git config --global user.name  2>$null
$gitEmail = git config --global user.email 2>$null
if (-not $gitName) {
    $name = Read-Host "    Enter your Git display name"
    git config --global user.name $name
}
if (-not $gitEmail) {
    $email = Read-Host "    Enter your Git email"
    git config --global user.email $email
}
git config --global core.autocrlf  input
git config --global pull.rebase     false
git config --global init.defaultBranch main
Write-Ok "Git configured"

# ── 11. gh CLI auth ───────────────────────────────────────────────────────────
Write-Step "GitHub CLI auth"
$ghStatus = gh auth status 2>&1
if ($ghStatus -match "Logged in") {
    Write-Ok "Already authenticated with GitHub"
} else {
    Write-Host "    Authenticating with GitHub..." -ForegroundColor Yellow
    gh auth login
}

# ── 12. .NET global tools ─────────────────────────────────────────────────────
Write-Step ".NET global tools"
$dotnetTools = dotnet tool list -g 2>$null
if ($dotnetTools -notmatch "amazon.lambda.tools") {
    dotnet tool install -g Amazon.Lambda.Tools
    Write-Ok "Amazon.Lambda.Tools installed"
} else { Write-Skip "Amazon.Lambda.Tools" }

if ($dotnetTools -notmatch "dotnet-ef") {
    dotnet tool install -g dotnet-ef
    Write-Ok "dotnet-ef installed"
} else { Write-Skip "dotnet-ef" }

# ── 13. Version summary ───────────────────────────────────────────────────────
Write-Step "Installed versions"
$tools = @{
    "node"   = "node --version"
    "npm"    = "npm --version"
    "pnpm"   = "pnpm --version"
    "turbo"  = "turbo --version"
    "dotnet" = "dotnet --version"
    "git"    = "git --version"
    "aws"    = "aws --version"
    "sam"    = "sam --version"
    "gh"     = "gh --version"
    "eas"    = "eas --version"
}
foreach ($tool in $tools.Keys) {
    try {
        $version = Invoke-Expression $tools[$tool] 2>$null | Select-Object -First 1
        Write-Ok "$tool  →  $version"
    } catch {
        Write-Warn "$tool not found"
    }
}

Write-Host "`n===========================================================" -ForegroundColor Cyan
Write-Host "  Setup complete! Next steps:" -ForegroundColor Green
Write-Host "  1. Run: aws configure --profile eventcraft-dev" -ForegroundColor White
Write-Host "  2. Run: scripts\bootstrap.sh  (creates all AWS resources)" -ForegroundColor White
Write-Host "  3. Run: scripts\create-github-repo.sh  (creates GitHub repo)" -ForegroundColor White
Write-Host "===========================================================`n" -ForegroundColor Cyan
