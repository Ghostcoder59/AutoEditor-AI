## Shim activation script.
## If some script or history still calls .venv-1\Scripts\Activate.ps1, this will
## forward activation to the real workspace .venv without recreating the full venv.

$projectRoot = 'C:\Users\Yuvraj S Galley\Downloads\AutoEditor-AI-main\AutoEditor-AI-main'
$target = Join-Path $projectRoot '.venv\Scripts\Activate.ps1'
if (Test-Path $target) {
  & $target
} else {
  Write-Host "Warning: expected .venv activation script not found at: $target" -ForegroundColor Yellow
}
