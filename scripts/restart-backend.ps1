# Restart the local backend uvicorn process (Windows PowerShell).
#
# Phase 075.4 Plan 05 — FORWARD-REF #2: update for `--workers N` when Phase 079
# enables multi-worker readiness (D-PRD-12 supersedes D-v2.5-02). Currently
# assumes single-worker per CLAUDE.md project rule.
#
# Windows-aware design: pkill is unavailable on Windows. We scan all python.exe
# processes for the literal uvicorn command line and Stop-Process each match.
# This catches orphan workers that nohup-style detachment can leave behind on
# Windows (Ctrl-C in a parent shell doesn't always reap children — Stop-Process
# -Force is the cleanest equivalent).
#
# Usage:
#   pwsh scripts/restart-backend.ps1
#   # or from cmd.exe:
#   powershell -File scripts/restart-backend.ps1

$ErrorActionPreference = "Stop"

# Find any python.exe whose CommandLine contains 'uvicorn ... app.main:app'.
# CIM (not WMI) is the modern interface; Get-CimInstance preserves the property
# shape we filter on below. The Where-Object regex matches the import path
# verbatim ('app\.main:app') so it doesn't accidentally kill other uvicorn jobs.
Get-CimInstance Win32_Process -Filter "Name='python.exe'" `
    | Where-Object { $_.CommandLine -match 'uvicorn.*app\.main:app' } `
    | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# Give Windows ~2s to release port 8000 + close socket handles before relaunch.
Start-Sleep -Seconds 2

# Relaunch in a new background process so this script returns promptly.
# Start-Process spawns detached; the new window owns its own console.
$BackendDir = Join-Path $PSScriptRoot "..\backend"
Start-Process powershell -ArgumentList "-NoProfile", "-Command", `
    "cd '$BackendDir'; .\venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

Write-Host "Backend restart initiated"
