# Restart the local backend uvicorn process (Windows PowerShell).
#
# Phase 075.4 Plan 05 — FORWARD-REF #2: update for `--workers N` when Phase 079
# enables multi-worker readiness (D-PRD-12 supersedes D-v2.5-02). Currently
# assumes single-worker per CLAUDE.md project rule.
#
# Phase 075.5 hardening (2026-05-23): previous version (a) only matched
# python.exe by Name (missed system-python orphans named python.exe with
# different paths) AND (b) launched the new backend in a visible PowerShell
# window via Start-Process powershell — leading to terminal-spam and
# port-8000 collisions when multiple restarts stacked.
#
# This version:
#   1. Matches BOTH python.exe AND pythonw.exe with `uvicorn.*app.main:app` in
#      command line (catches venv + system-python orphans equally).
#   2. Polls port 8000 after kill to confirm it's actually free before relaunch.
#   3. Launches the new backend HEADLESS (-WindowStyle Hidden) directly via
#      the venv python — no shell wrapper, no visible window.
#   4. Redirects stdout/stderr to backend/uvicorn.{out,err}.log so the
#      orchestrator can `tail` them deterministically.
#
# Usage:
#   pwsh scripts/restart-backend.ps1
#   # or from cmd.exe:
#   powershell -File scripts/restart-backend.ps1

$ErrorActionPreference = "Stop"

# ── 1. Kill any python.exe / pythonw.exe running our uvicorn target ─────────
$matched = Get-CimInstance Win32_Process `
    | Where-Object {
        ($_.Name -in @('python.exe', 'pythonw.exe')) `
        -and ($_.CommandLine -match 'uvicorn.*app\.main:app')
    }

foreach ($p in $matched) {
    Write-Host ("Stopping PID {0} ({1})" -f $p.ProcessId, $p.Name)
    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {
        Write-Host ("  (already exited or could not stop: {0})" -f $_.Exception.Message)
    }
}

# ── 2. Poll port 8000 to confirm release (handles Windows TIME_WAIT lag) ────
$maxWaitSec = 10
$elapsed = 0
while ($elapsed -lt $maxWaitSec) {
    Start-Sleep -Seconds 1
    $elapsed++
    # Use Get-NetTCPConnection (built-in on Win10+) for a clean port check.
    $stillBound = $null
    try {
        $stillBound = Get-NetTCPConnection -State Listen -LocalPort 8000 -ErrorAction SilentlyContinue
    } catch {}
    if (-not $stillBound) { break }
}
if ($stillBound) {
    Write-Warning ("Port 8000 still held after {0}s — may collide. Continuing anyway." -f $maxWaitSec)
}

# ── 3. Relaunch headless, output to backend/uvicorn.{out,err}.log ───────────
$BackendDir = Resolve-Path (Join-Path $PSScriptRoot "..\backend")
$Python     = Join-Path $BackendDir "venv\Scripts\python.exe"
$OutLog     = Join-Path $BackendDir "uvicorn.out.log"
$ErrLog     = Join-Path $BackendDir "uvicorn.err.log"

if (-not (Test-Path $Python)) {
    Write-Error "venv python not found at $Python — run 'python -m venv venv' first."
    exit 1
}

Start-Process -FilePath $Python `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info" `
    -WorkingDirectory $BackendDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError  $ErrLog

Write-Host "Backend relaunched headless. Tail logs:"
Write-Host "  Get-Content -Path '$OutLog' -Wait -Tail 30"
