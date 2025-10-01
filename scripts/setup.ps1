# EmailAI - One-Command Setup Script (PowerShell)
# Usage: .\scripts\setup.ps1 [-Production]

param(
    [switch]$Production
)

$ErrorActionPreference = "Stop"

# Determine environment
$Environment = if ($Production) { "production" } else { "development" }

# Colors
function Write-Status { Write-Host "[*] $args" -ForegroundColor Blue }
function Write-Success { Write-Host "[✓] $args" -ForegroundColor Green }
function Write-Warning { Write-Host "[!] $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "[✗] $args" -ForegroundColor Red }

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║   EmailAI Setup Script ($Environment)   ║" -ForegroundColor Blue
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# Check if Node.js is installed
function Test-NodeVersion {
    try {
        $version = (node -v).TrimStart('v').Split('.')[0]
        return [int]$version -ge 18
    }
    catch {
        return $false
    }
}

# Check if PostgreSQL is installed
function Test-PostgreSQL {
    try {
        $null = Get-Command psql -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

# Install Node.js
function Install-NodeJS {
    Write-Status "Node.js 18+ is required"
    Write-Status "Please download and install from: https://nodejs.org/"
    Write-Status "Then re-run this script"
    exit 1
}

# Install PostgreSQL
function Install-PostgreSQL {
    Write-Status "PostgreSQL is required"
    Write-Status "Options:"
    Write-Host "  1. Download installer: https://www.postgresql.org/download/windows/" -ForegroundColor Cyan
    Write-Host "  2. Use Chocolatey: choco install postgresql" -ForegroundColor Cyan
    Write-Host "  3. Use Docker: docker run -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:15" -ForegroundColor Cyan

    if ($Environment -eq "production") {
        Write-Error "PostgreSQL is required for production. Please install it manually."
        exit 1
    }

    $response = Read-Host "Do you want to continue without PostgreSQL? (y/N)"
    if ($response -ne "y") {
        exit 1
    }
}

# Setup database
function Setup-Database {
    Write-Status "Setting up database..."

    $dbName = if ($Environment -eq "production") { "emailai_prod" } else { "emailai_dev" }
    $dbUser = "emailai"
    $dbPassword = if ($Environment -eq "production") {
        # Generate secure password
        -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
    }
    else {
        "emailai_dev_password"
    }

    if ($Environment -eq "production") {
        Write-Warning "Generated database password: $dbPassword"
        Write-Warning "Save this password in your password manager!"
    }

    try {
        # Check if database exists
        $dbExists = psql -U postgres -lqt | Select-String -Pattern $dbName

        if ($dbExists) {
            Write-Success "Database '$dbName' already exists"
        }
        else {
            Write-Status "Creating database '$dbName'..."

            # Create user and database
            psql -U postgres -c "CREATE USER $dbUser WITH ENCRYPTED PASSWORD '$dbPassword';" 2>$null
            psql -U postgres -c "CREATE DATABASE $dbName OWNER $dbUser;" 2>$null
            psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;" 2>$null

            # Enable extensions
            psql -U postgres -d $dbName -c "CREATE EXTENSION IF NOT EXISTS `"uuid-ossp`";" 2>$null
            psql -U postgres -d $dbName -c "CREATE EXTENSION IF NOT EXISTS `"pg_trgm`";" 2>$null

            Write-Success "Database created: $dbName"
        }
    }
    catch {
        Write-Warning "Could not create database automatically"
        Write-Status "Please create database manually:"
        Write-Host "  createdb -U postgres $dbName" -ForegroundColor Cyan
    }

    # Set environment variable for later use
    $script:DatabaseUrl = "postgresql://${dbUser}:${dbPassword}@localhost:5432/${dbName}"
}

# Setup environment file
function Setup-EnvFile {
    Write-Status "Setting up environment variables..."

    $envFile = if ($Environment -eq "production") {
        "apps\web\.env.production"
    }
    else {
        "apps\web\.env.local"
    }

    if (Test-Path $envFile) {
        Write-Success "Environment file already exists: $envFile"

        $response = Read-Host "Do you want to regenerate it? (y/N)"
        if ($response -ne "y") {
            return
        }
    }

    Write-Status "Creating $envFile..."

    # Generate secrets
    $nextAuthSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object { [char]$_ })

    $envContent = @"
# Database
DATABASE_URL="$script:DatabaseUrl"
DIRECT_URL="$script:DatabaseUrl"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$nextAuthSecret"

# Google OAuth (You need to configure these)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Payment Provider (Choose one)
# STRIPE_SECRET_KEY="sk_test_..."
# STRIPE_WEBHOOK_SECRET="whsec_..."
# STRIPE_PUBLISHABLE_KEY="pk_test_..."

# OR

# LEMON_SQUEEZY_API_KEY="..."
# LEMON_SQUEEZY_WEBHOOK_SECRET="..."
# LEMON_SQUEEZY_STORE_ID="..."

# Email Service (Optional)
# RESEND_API_KEY="re_..."
# RESEND_FROM_EMAIL="noreply@localhost"

# Application
NODE_ENV="$Environment"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# Feature Flags
NEXT_PUBLIC_ENABLE_ORGANIZATIONS="true"

# Monitoring (Optional)
# SENTRY_DSN="https://..."
# NEXT_PUBLIC_POSTHOG_KEY="phc_..."
# NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"

# Logging (Optional)
LOG_LEVEL="info"
"@

    $envContent | Out-File -FilePath $envFile -Encoding UTF8

    Write-Success "Environment file created: $envFile"
    Write-Warning "Please configure Google OAuth credentials in $envFile"
    Write-Warning "See: https://console.cloud.google.com/apis/credentials"
}

# Install dependencies
function Install-Dependencies {
    Write-Status "Installing npm dependencies..."

    if (Test-Path "node_modules") {
        Write-Success "Dependencies already installed (node_modules exists)"

        $response = Read-Host "Do you want to reinstall dependencies? (y/N)"
        if ($response -ne "y") {
            return
        }
    }

    npm install

    Write-Success "Dependencies installed"
}

# Run migrations
function Run-Migrations {
    Write-Status "Running database migrations..."

    Push-Location apps\web

    try {
        # Generate Prisma Client
        npx prisma generate

        # Run migrations
        if ($Environment -eq "production") {
            npx prisma migrate deploy
        }
        else {
            npx prisma migrate dev
        }

        Write-Success "Database migrations completed"
    }
    finally {
        Pop-Location
    }
}

# Verify setup
function Test-Setup {
    Write-Status "Verifying setup..."

    $checksPassed = 0
    $checksFailed = 0

    # Check Node.js
    if (Test-NodeVersion) {
        Write-Success "Node.js: $(node -v)"
        $checksPassed++
    }
    else {
        Write-Error "Node.js version check failed"
        $checksFailed++
    }

    # Check PostgreSQL
    if (Test-PostgreSQL) {
        Write-Success "PostgreSQL: $(psql --version)"
        $checksPassed++
    }
    else {
        Write-Error "PostgreSQL not found"
        $checksFailed++
    }

    # Check environment file
    $envFile = if ($Environment -eq "production") {
        "apps\web\.env.production"
    }
    else {
        "apps\web\.env.local"
    }

    if (Test-Path $envFile) {
        Write-Success "Environment file exists: $envFile"
        $checksPassed++
    }
    else {
        Write-Error "Environment file missing: $envFile"
        $checksFailed++
    }

    # Check Prisma Client
    if (Test-Path "node_modules\@prisma\client") {
        Write-Success "Prisma Client generated"
        $checksPassed++
    }
    else {
        Write-Error "Prisma Client not found"
        $checksFailed++
    }

    Write-Host ""
    Write-Host "════════════════════════════════════════" -ForegroundColor Blue
    Write-Host "Checks passed: $checksPassed" -ForegroundColor Green
    Write-Host "Checks failed: $checksFailed" -ForegroundColor Red
    Write-Host "════════════════════════════════════════" -ForegroundColor Blue

    return $checksFailed -eq 0
}

# Print next steps
function Show-NextSteps {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║         Setup Complete! 🎉             ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Blue
    Write-Host ""
    Write-Host "1. Configure Google OAuth:"
    Write-Host "   - Visit: https://console.cloud.google.com/apis/credentials"
    Write-Host "   - Create OAuth 2.0 credentials"

    $envFile = if ($Environment -eq "production") {
        "apps\web\.env.production"
    }
    else {
        "apps\web\.env.local"
    }

    Write-Host "   - Update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in:"
    Write-Host "     $envFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Start the development server:"
    Write-Host "   npm run dev" -ForegroundColor Green
    Write-Host ""
    Write-Host "3. Open in browser:"
    Write-Host "   http://localhost:3000" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Useful Commands:" -ForegroundColor Blue
    Write-Host "  npm run dev          - Start development server"
    Write-Host "  npm run build        - Build for production"
    Write-Host "  npm run test         - Run tests"
    Write-Host "  npm run lint         - Lint code"
    Write-Host ""
}

# Main setup flow
try {
    Write-Host ""

    # Check prerequisites
    Write-Status "Checking prerequisites..."

    # Check Node.js
    if (-not (Test-NodeVersion)) {
        Write-Warning "Node.js 18+ not found"
        Install-NodeJS
    }
    else {
        Write-Success "Node.js: $(node -v)"
    }

    # Check PostgreSQL
    if (-not (Test-PostgreSQL)) {
        Write-Warning "PostgreSQL not found"
        Install-PostgreSQL
    }
    else {
        Write-Success "PostgreSQL found"
    }

    # Setup database
    Setup-Database

    # Setup environment variables
    Setup-EnvFile

    # Install dependencies
    Install-Dependencies

    # Run migrations
    Run-Migrations

    # Verify setup
    Write-Host ""
    $setupSuccess = Test-Setup

    if ($setupSuccess) {
        # Print next steps
        Show-NextSteps
    }
    else {
        Write-Error "Setup completed with errors. Please review the output above."
        exit 1
    }
}
catch {
    Write-Error "Setup failed: $_"
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}
