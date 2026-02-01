# PowerShell script to check OCR API status
Write-Host "Checking OCR API Status..." -ForegroundColor Cyan
Write-Host ""

# Check Image OCR API (Port 8001)
Write-Host "Image OCR API (Port 8001):" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8001/health" -Method GET -TimeoutSec 2 -ErrorAction Stop
    Write-Host "  ✓ Running - Status: $($response.StatusCode)" -ForegroundColor Green
    $json = $response.Content | ConvertFrom-Json
    Write-Host "  Service: $($json.service)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Not running or unreachable" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Check PDF OCR API (Port 8002)
Write-Host "PDF OCR API (Port 8002):" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8002/health" -Method GET -TimeoutSec 2 -ErrorAction Stop
    Write-Host "  ✓ Running - Status: $($response.StatusCode)" -ForegroundColor Green
    $json = $response.Content | ConvertFrom-Json
    Write-Host "  Service: $($json.service)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Not running or unreachable" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Check if ports are in use
Write-Host "Port Status:" -ForegroundColor Yellow
$port8001 = Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue
$port8002 = Get-NetTCPConnection -LocalPort 8002 -ErrorAction SilentlyContinue

if ($port8001) {
    Write-Host "  Port 8001: In use (PID: $($port8001.OwningProcess))" -ForegroundColor Green
} else {
    Write-Host "  Port 8001: Not in use" -ForegroundColor Red
}

if ($port8002) {
    Write-Host "  Port 8002: In use (PID: $($port8002.OwningProcess))" -ForegroundColor Green
} else {
    Write-Host "  Port 8002: Not in use" -ForegroundColor Red
}
