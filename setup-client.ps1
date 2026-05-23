# =============================================================
#  setup-client.ps1  —  New client onboarding for Railway
# =============================================================
#  Usage: .\setup-client.ps1
#  Run from the Accounting App folder in PowerShell.
# =============================================================

Write-Host ""
Write-Host "  =================================================" -ForegroundColor Cyan
Write-Host "   Small Business Accounting App" -ForegroundColor Cyan
Write-Host "   New Client Setup Script" -ForegroundColor Cyan
Write-Host "  =================================================" -ForegroundColor Cyan
Write-Host ""

# --- Gather input --------------------------------------------
$ClientName = Read-Host "  Client / Business name (e.g. 'ABC Store')"
if (-not $ClientName) { Write-Host "ERROR: Client name is required." -ForegroundColor Red; exit 1 }

$Password = Read-Host "  Login password for this client"
if (-not $Password)   { Write-Host "ERROR: Password is required." -ForegroundColor Red; exit 1 }

# --- Generate a secure SESSION_SECRET ------------------------
$chars  = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#%^&*'
$secret = -join (1..48 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })

# --- URL-safe slug from client name --------------------------
$Slug = ($ClientName -replace '[^a-zA-Z0-9]', '-').ToLower() -replace '-+', '-'
$Slug = $Slug.Trim('-')

# --- Display Railway setup instructions ----------------------
Write-Host ""
Write-Host "  =================================================" -ForegroundColor Green
Write-Host "   RAILWAY SETUP  —  $ClientName" -ForegroundColor Green
Write-Host "  =================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  STEP 1 — Create a new Railway project" -ForegroundColor Yellow
Write-Host "    1. Go to  https://railway.app/new" -ForegroundColor White
Write-Host "    2. Choose 'Deploy from GitHub Repo'" -ForegroundColor Gray
Write-Host "    3. Select: AccountingAppForSmallBusinesses" -ForegroundColor Gray
Write-Host "    4. Rename the project to: accounting-$Slug" -ForegroundColor Cyan
Write-Host ""
Write-Host "  STEP 2 — Add a persistent Volume" -ForegroundColor Yellow
Write-Host "    Service → Volumes → Add Volume" -ForegroundColor Gray
Write-Host "    Mount Path: /data" -ForegroundColor White
Write-Host ""
Write-Host "  STEP 3 — Set these Variables (copy exactly)" -ForegroundColor Yellow
Write-Host ""
Write-Host "    APP_PASSWORD    = $Password" -ForegroundColor Cyan
Write-Host "    SESSION_SECRET  = $secret" -ForegroundColor Cyan
Write-Host "    DB_PATH         = /data/accounting.db" -ForegroundColor Cyan
Write-Host "    NODE_ENV        = production" -ForegroundColor Cyan
Write-Host ""
Write-Host "  STEP 4 — Generate a public domain" -ForegroundColor Yellow
Write-Host "    Service → Settings → Networking → Generate Domain" -ForegroundColor Gray
Write-Host ""
Write-Host "  STEP 5 — Send client their login details" -ForegroundColor Yellow
Write-Host "    URL      : (the Railway domain from Step 4)" -ForegroundColor Gray
Write-Host "    Password : $Password" -ForegroundColor Gray
Write-Host ""
Write-Host "  =================================================" -ForegroundColor Green
Write-Host ""

# --- Save client record to file ------------------------------
$Date       = Get-Date -Format 'yyyy-MM-dd HH:mm'
$OutputFile = "clients\client-$Slug.txt"

# Create clients folder if it doesn't exist
if (-not (Test-Path "clients")) { New-Item -ItemType Directory -Path "clients" | Out-Null }

@"
================================================
Client Record — $ClientName
Created: $Date
================================================

Railway Project  : accounting-$Slug
Volume Path      : /data
Railway URL      : (fill in after Step 4)

Variables:
  APP_PASSWORD   = $Password
  SESSION_SECRET = $secret
  DB_PATH        = /data/accounting.db
  NODE_ENV       = production

Setup Checklist:
  [ ] Created Railway project from AccountingAppForSmallBusinesses repo
  [ ] Added Volume at /data
  [ ] Set all 4 Variables
  [ ] Generated domain
  [ ] Tested login
  [ ] Shared URL + password with client

Notes:


================================================
KEEP THIS FILE SECURE — it contains client credentials
================================================
"@ | Out-File -FilePath $OutputFile -Encoding utf8

Write-Host "  Saved to: $OutputFile" -ForegroundColor Green
Write-Host "  Keep the clients\ folder private — it contains passwords." -ForegroundColor Yellow
Write-Host ""
