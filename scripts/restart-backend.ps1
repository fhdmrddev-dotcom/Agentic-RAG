# Restart the local backend uvicorn process (Windows PowerShell).
#
# Phase 079: Multi-worker enabled (D-PRD-12). WORKER_COUNT=2 default;
# --reload for dev (single-process).
#
# Phase 075.5 hardening history:
#   v1 (2026-05-23): matched python.exe + pythonw.exe by Name AND uvicorn
#       cmdline; polled port; launched headless with stdout/err to log files.
#   v2 (2026-05-23, this version): v1 only killed the IMMEDIATE process, not
#       its multiprocessing.spawn children -- those detach and survive, then
#       keep the listening socket on 127.0.0.1:8000 wedged with stale code.
#       This was the EXACT root cause of the Phase 075.5 live-test loop where
#       restarts looked clean but the UI kept hitting an orphan worker serving
#       pre-fix code. v2 changes:
#         (a) taskkill /F /T to kill the full process tree under each uvicorn
#             reloader (handles the normal restart path).
#         (b) Second pass sweeps any multiprocessing.spawn worker whose
#             parent_pid no longer exists -- catches orphans from a prior
#             reloader that died before this script ran.
#         (c) All Write-Warning / Write-Error strings are ASCII-only.
#             Windows PowerShell 5.1 reads BOM-less .ps1 files as Win-1252
#             and mojibakes UTF-8 em-dashes inside expressions, breaking
#             the parser.
#
# Usage:
#   pwsh scripts/restart-backend.ps1
#   # or from cmd.exe / Windows PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts/restart-backend.ps1

$ErrorActionPreference = "Stop"

# Pass 1: taskkill /F /T on every uvicorn launcher (kills full process tree)
$uvicornProcs = Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -in @('python.exe', 'pythonw.exe')) `
    -and ($_.CommandLine -match 'uvicorn.*app\.main:app')
}

foreach ($p in $uvicornProcs) {
    Write-Host ("Killing uvicorn tree PID {0} ({1})" -f $p.ProcessId, $p.Name)
    # cmd /c with internal redirection bypasses PowerShell's stderr handling --
    # taskkill writes "process not found" to stderr when /T already got the
    # descendant before this iteration's outer kill ran. That's benign noise.
    cmd /c "taskkill /F /T /PID $($p.ProcessId) >nul 2>&1"
}

# Pass 2: sweep orphan multiprocessing.spawn children whose parent is gone.
# These come from a prior uvicorn reloader that was killed before us; the
# spawn worker detached and survived. Without this sweep they keep serving
# stale code on 127.0.0.1:8000 -- the Phase 075.5 F-1 root cause.
$spawnWorkers = Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -in @('python.exe', 'pythonw.exe')) `
    -and ($_.CommandLine -match 'multiprocessing\.spawn.*spawn_main') `
    -and ($_.CommandLine -match 'parent_pid=(\d+)')
}

foreach ($w in $spawnWorkers) {
    $parentPidMatch = [regex]::Match($w.CommandLine, 'parent_pid=(\d+)')
    if (-not $parentPidMatch.Success) { continue }
    $parentPid = [int]$parentPidMatch.Groups[1].Value
    $parentAlive = Get-CimInstance Win32_Process -Filter "ProcessId = $parentPid" -ErrorAction SilentlyContinue
    if (-not $parentAlive) {
        Write-Host ("Killing orphan spawn worker PID {0} (parent {1} gone)" -f $w.ProcessId, $parentPid)
        cmd /c "taskkill /F /PID $($w.ProcessId) >nul 2>&1"
    }
}

# Poll port 8000 to confirm release (handles Windows TIME_WAIT lag)
$maxWaitSec = 10
$elapsed = 0
$stillBound = $null
while ($elapsed -lt $maxWaitSec) {
    Start-Sleep -Seconds 1
    $elapsed++
    try {
        $stillBound = Get-NetTCPConnection -State Listen -LocalPort 8000 -ErrorAction SilentlyContinue
    } catch { $stillBound = $null }
    if (-not $stillBound) { break }
}
if ($stillBound) {
    Write-Warning ("Port 8000 still held after {0}s -- may collide. Continuing anyway." -f $maxWaitSec)
}

# Relaunch headless, stdout/stderr to backend/uvicorn.{out,err}.log
$BackendDir = Resolve-Path (Join-Path $PSScriptRoot "..\backend")
$Python     = Join-Path $BackendDir "venv\Scripts\python.exe"
$OutLog     = Join-Path $BackendDir "uvicorn.out.log"
$ErrLog     = Join-Path $BackendDir "uvicorn.err.log"

if (-not (Test-Path $Python)) {
    Write-Error "venv python not found at $Python -- run 'python -m venv venv' first."
    exit 1
}

$WorkerCount = if ($env:WORKER_COUNT) { [int]$env:WORKER_COUNT } else { 2 }

# T-079-01: clamp to sane range to prevent accidental fork-bomb
if ($WorkerCount -lt 1) { $WorkerCount = 1 }
if ($WorkerCount -gt 16) { $WorkerCount = 16 }

# --reload is incompatible with --workers > 1 in uvicorn.
# Dev mode (--reload) always runs single-process; multi-worker is for production.
if ($WorkerCount -gt 1) {
    Start-Process -FilePath $Python `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", $WorkerCount, "--log-level", "info" `
        -WorkingDirectory $BackendDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $OutLog `
        -RedirectStandardError  $ErrLog
} else {
    Start-Process -FilePath $Python `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info" `
        -WorkingDirectory $BackendDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $OutLog `
        -RedirectStandardError  $ErrLog
}

Write-Host ("Backend relaunched headless (workers={0}). Tail logs:" -f $WorkerCount)
Write-Host "  Get-Content -Path '$OutLog' -Wait -Tail 30"
