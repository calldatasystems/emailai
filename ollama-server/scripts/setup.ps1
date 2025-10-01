<#
.SYNOPSIS
    Ollama Server Setup Script for EmailAI (Windows)

.DESCRIPTION
    This script sets up an Ollama server to provide local AI inference
    for EmailAI. It can be run on a separate Windows machine from EmailAI.

.PARAMETER Mode
    Deployment mode: 'dev' for Llama 3.1 8B or 'prod' for Llama 3.3 70B

.EXAMPLE
    .\setup.ps1 -Mode dev
    Installs Ollama with Llama 3.1 8B (lightweight)

.EXAMPLE
    .\setup.ps1 -Mode prod
    Installs Ollama with Llama 3.3 70B (best quality)

.NOTES
    Requires Administrator privileges
    Supports Windows 10/11 and Windows Server 2019+
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('dev','prod')]
    [string]$Mode = 'dev'
)

# Requires Administrator
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script requires Administrator privileges. Please run as Administrator."
    exit 1
}

# Helper functions
function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
    exit 1
}

Write-Info "Starting Ollama setup in $Mode mode..."

#######################################################################
# Step 1: Check System Requirements
#######################################################################

Write-Info "Checking system requirements..."

# Check Windows version
$OSVersion = [System.Environment]::OSVersion.Version
if ($OSVersion.Major -lt 10) {
    Write-Err "Windows 10 or later required. Current version: $($OSVersion.Major).$($OSVersion.Minor)"
}
Write-Success "OS: Windows $($OSVersion.Major).$($OSVersion.Minor)"

# Check available RAM
$TotalRAM = [math]::Round((Get-CimInstance -ClassName Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
Write-Info "Total RAM: ${TotalRAM}GB"

if ($Mode -eq 'prod' -and $TotalRAM -lt 48) {
    Write-Warn "Production mode (Llama 3.3 70B) requires 48GB+ RAM. You have ${TotalRAM}GB."
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y') { exit 1 }
} elseif ($Mode -eq 'dev' -and $TotalRAM -lt 8) {
    Write-Warn "Development mode (Llama 3.1 8B) requires 8GB+ RAM. You have ${TotalRAM}GB."
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y') { exit 1 }
}

# Check GPU
$GPU = Get-CimInstance -ClassName Win32_VideoController | Where-Object { $_.Name -like "*NVIDIA*" }
if ($GPU) {
    Write-Success "NVIDIA GPU detected: $($GPU.Name)"
    $UseGPU = $true
} else {
    Write-Info "No NVIDIA GPU detected. Will use CPU (slower)."
    $UseGPU = $false
}

#######################################################################
# Step 2: Install Ollama
#######################################################################

Write-Info "Checking for Ollama installation..."

$OllamaPath = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
$OllamaInstalled = Test-Path $OllamaPath

if ($OllamaInstalled) {
    Write-Success "Ollama already installed at $OllamaPath"
    $reinstall = Read-Host "Reinstall Ollama? (y/n)"
    if ($reinstall -eq 'y') {
        $OllamaInstalled = $false
    }
}

if (-not $OllamaInstalled) {
    Write-Info "Downloading Ollama installer..."

    $InstallerUrl = "https://ollama.com/download/OllamaSetup.exe"
    $InstallerPath = "$env:TEMP\OllamaSetup.exe"

    try {
        Invoke-WebRequest -Uri $InstallerUrl -OutFile $InstallerPath -UseBasicParsing
        Write-Success "Installer downloaded"

        Write-Info "Installing Ollama (this may take a minute)..."
        Start-Process -FilePath $InstallerPath -ArgumentList "/S" -Wait

        # Wait for installation to complete
        Start-Sleep -Seconds 5

        if (Test-Path $OllamaPath) {
            Write-Success "Ollama installed successfully"
        } else {
            Write-Err "Installation failed. Ollama executable not found at $OllamaPath"
        }

        # Clean up installer
        Remove-Item $InstallerPath -Force
    }
    catch {
        Write-Err "Failed to download or install Ollama: $_"
    }
}

# Add Ollama to PATH if not already there
$OllamaDir = Split-Path $OllamaPath -Parent
if ($env:PATH -notlike "*$OllamaDir*") {
    $env:PATH += ";$OllamaDir"
    [Environment]::SetEnvironmentVariable("PATH", $env:PATH, [EnvironmentVariableTarget]::Machine)
    Write-Success "Added Ollama to PATH"
}

#######################################################################
# Step 3: Start Ollama Service
#######################################################################

Write-Info "Starting Ollama service..."

# Check if Ollama service is running
$OllamaProcess = Get-Process -Name "ollama" -ErrorAction SilentlyContinue

if ($OllamaProcess) {
    Write-Success "Ollama is already running"
} else {
    Write-Info "Starting Ollama..."
    Start-Process -FilePath $OllamaPath -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

# Verify Ollama is responding
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 5
    Write-Success "Ollama is running on http://localhost:11434"
}
catch {
    Write-Err "Ollama is not responding. Please check the service."
}

#######################################################################
# Step 4: Pull AI Models
#######################################################################

Write-Info "Downloading AI models..."

if ($Mode -eq 'prod') {
    $ModelName = "llama3.3:70b"
    $ModelSize = "~40GB"
    Write-Info "Production mode: Pulling Llama 3.3 70B (this will take a while...)"
} else {
    $ModelName = "llama3.1:8b"
    $ModelSize = "~4.7GB"
    Write-Info "Development mode: Pulling Llama 3.1 8B"
}

Write-Warn "This will download approximately $ModelSize of data"
$continue = Read-Host "Continue with download? (y/n)"

if ($continue -eq 'y') {
    Write-Info "Pulling $ModelName..."
    & $OllamaPath pull $ModelName

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Model $ModelName downloaded successfully"
    } else {
        Write-Warn "Model download may have failed. Check Ollama logs."
    }
} else {
    Write-Warn "Skipping model download. You can pull models later with: ollama pull $ModelName"
}

#######################################################################
# Step 5: Test the Model
#######################################################################

Write-Info "Testing the model..."

try {
    $testOutput = & $OllamaPath run $ModelName "Say 'Hello from Ollama!' in one sentence" 2>&1

    if ($LASTEXITCODE -eq 0 -and $testOutput) {
        Write-Success "Model test successful!"
        Write-Info "Response: $testOutput"
    } else {
        Write-Warn "Model test had issues. Response: $testOutput"
    }
}
catch {
    Write-Warn "Could not test model: $_"
}

#######################################################################
# Step 6: Configure Windows Firewall
#######################################################################

Write-Info "Configuring Windows Firewall..."

$firewallRule = Get-NetFirewallRule -DisplayName "Ollama Server" -ErrorAction SilentlyContinue

if ($firewallRule) {
    Write-Success "Firewall rule already exists"
} else {
    $addRule = Read-Host "Allow Ollama port 11434 through Windows Firewall? (y/n)"

    if ($addRule -eq 'y') {
        try {
            New-NetFirewallRule `
                -DisplayName "Ollama Server" `
                -Direction Inbound `
                -Protocol TCP `
                -LocalPort 11434 `
                -Action Allow `
                -Profile Any

            Write-Success "Firewall rule created for port 11434"
        }
        catch {
            Write-Warn "Could not create firewall rule: $_"
            Write-Warn "You may need to manually allow port 11434"
        }
    }
}

#######################################################################
# Step 7: Create Configuration File
#######################################################################

Write-Info "Creating configuration file..."

$ConfigDir = "$env:PROGRAMDATA\Ollama"
if (-not (Test-Path $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
}

$ConfigFile = "$ConfigDir\config.env"

$ConfigContent = @"
# Ollama Configuration for EmailAI
# Generated: $(Get-Date)

# Model configuration
OLLAMA_MODEL=$ModelName
OLLAMA_MODE=$Mode

# Server configuration
OLLAMA_HOST=0.0.0.0:11434
OLLAMA_ORIGINS=*

# Performance tuning
OLLAMA_NUM_PARALLEL=4
OLLAMA_MAX_LOADED_MODELS=1

# GPU configuration (if available)
$(if ($UseGPU) { "OLLAMA_GPU_LAYERS=999" } else { "# OLLAMA_GPU_LAYERS=0" })

# Logging
OLLAMA_DEBUG=false
"@

$ConfigContent | Out-File -FilePath $ConfigFile -Encoding UTF8
Write-Success "Configuration saved to $ConfigFile"

#######################################################################
# Step 8: Create Helper Scripts
#######################################################################

Write-Info "Creating helper scripts..."

# Create status check script
$StatusScript = @"
`$response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing
`$models = (`$response.Content | ConvertFrom-Json).models

Write-Host "=== Ollama Status ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service Status:" -ForegroundColor Green
Get-Process -Name "ollama" -ErrorAction SilentlyContinue | Format-Table -AutoSize
Write-Host ""
Write-Host "Loaded Models:" -ForegroundColor Green
`$models | ForEach-Object { Write-Host "`$(`$_.name) - `$([math]::Round(`$_.size/1GB, 2))GB" }
Write-Host ""
Write-Host "Listening on:" -ForegroundColor Green
Get-NetTCPConnection -LocalPort 11434 -ErrorAction SilentlyContinue | Format-Table -AutoSize
"@

$StatusScriptPath = "$ConfigDir\ollama-status.ps1"
$StatusScript | Out-File -FilePath $StatusScriptPath -Encoding UTF8
Write-Success "Created status script: $StatusScriptPath"

# Create test script
$TestScript = @"
param(
    [string]`$Model = "$ModelName"
)

Write-Host "Testing model: `$Model" -ForegroundColor Cyan
Write-Host ""
ollama run `$Model "Respond with exactly 5 words: I am working correctly"
"@

$TestScriptPath = "$ConfigDir\ollama-test.ps1"
$TestScript | Out-File -FilePath $TestScriptPath -Encoding UTF8
Write-Success "Created test script: $TestScriptPath"

#######################################################################
# Step 9: Display Connection Information
#######################################################################

# Get server IP
$ServerIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" } | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Success "Ollama Setup Complete!"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Info "Configuration Summary:"
Write-Host "  Mode: $Mode"
Write-Host "  Model: $ModelName"
Write-Host "  GPU: $UseGPU"
Write-Host ""
Write-Info "Connection Details:"
Write-Host "  Local URL: http://localhost:11434"
Write-Host "  Network URL: http://${ServerIP}:11434"
Write-Host ""
Write-Info "Add these to your EmailAI .env file:"
Write-Host ""
Write-Host "  OLLAMA_BASE_URL=http://${ServerIP}:11434/api" -ForegroundColor Yellow
Write-Host "  NEXT_PUBLIC_OLLAMA_MODEL=$ModelName" -ForegroundColor Yellow
Write-Host "  DEFAULT_LLM_PROVIDER=ollama" -ForegroundColor Yellow
Write-Host ""
Write-Info "Useful Commands:"
Write-Host "  Check status: powershell -File `"$StatusScriptPath`""
Write-Host "  Test model: powershell -File `"$TestScriptPath`""
Write-Host "  List models: ollama list"
Write-Host "  Pull new model: ollama pull [model-name]"
Write-Host ""
Write-Info "Next Steps:"
Write-Host "  1. Copy the environment variables above to your EmailAI .env file"
Write-Host "  2. Restart EmailAI application"
Write-Host "  3. Test the connection from EmailAI"
Write-Host ""
Write-Warn "Security Note:"
Write-Host "  Ollama is now accessible on your network at http://${ServerIP}:11434"
Write-Host "  Consider setting up authentication or restricting access via firewall."
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
