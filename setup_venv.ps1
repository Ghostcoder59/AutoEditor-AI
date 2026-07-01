param(
  [switch]$Force
)

# Creates a .venv in the workspace root and installs requirements
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

if (-Not (Test-Path '.venv')) {
  Write-Output "Creating virtualenv at ./.venv"
  python -m venv .venv
} elseif ($Force) {
  Write-Output "Forcing recreation of .venv"
  Remove-Item -Recurse -Force .venv
  python -m venv .venv
}

Write-Output "Activating .venv"
& ".\.venv\Scripts\Activate.ps1"

Write-Output "Upgrading pip and installing requirements"
python -m pip install --upgrade pip
if (Test-Path "backend/requirements.txt") { python -m pip install -r backend/requirements.txt }
if (Test-Path "requirements.txt") { python -m pip install -r requirements.txt }

Write-Output "Done. To run the backend: python backend/main.py"
