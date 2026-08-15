# Register (or re-register) the Windows scheduled task that brings up local
# Supabase + Redis at logon, by running scripts/start-local-infra.ps1.
#
# RUN THIS ONCE. It is idempotent -- re-running just overwrites the task.
#
# Usage -- REQUIRES AN ADMINISTRATOR PowerShell:
#   Right-click PowerShell / Windows Terminal -> "Run as administrator", then:
#   powershell -ExecutionPolicy Bypass -File scripts\register-infra-task.ps1
#
# Measured 2026-08-15: running this WITHOUT elevation fails with
#   Register-ScheduledTask : Access is denied.  (HRESULT 0x80070005)
# because Register-ScheduledTask writes into the ROOT task folder, and that
# folder is admin-only regardless of who the task will later run AS. The
# elevation is needed once, to create the task -- the task itself then runs
# unelevated in the user's own session (see the principal below).
#
# No-admin alternative, if you would rather not elevate: drop a shortcut to
# start-local-infra.ps1 into the Startup folder (Win+R -> shell:startup). That
# needs no privileges at all, but it loses the on-battery settings below, which
# is the whole reason a scheduled task is preferred here.
#
# To remove it later:
#   Unregister-ScheduledTask -TaskName "AgenticRAG-LocalInfra" -Confirm:$false
#
# WHY A SCHEDULED TASK AT ALL, given the containers already auto-restart?
#   Docker's "restart: unless-stopped" covers the common case (reboot, Docker
#   Desktop restart) and it demonstrably works -- all 11 supabase_* containers
#   plus Redis came back on their own on 2026-08-15. It does NOT cover:
#     - "supabase stop", which REMOVES the containers outright. A restart policy
#       cannot restart a container that no longer exists.
#     - "docker compose down" for Redis, same reason.
#     - Containers that come up "running" but whose ports never bind. That is a
#       real observed failure here, not a hypothetical -- see the port-exclusion
#       note in start-local-infra.ps1's header.
#   The task exists to repair the first two and to LOUDLY REPORT the third,
#   instead of letting it surface later as a uvicorn ConnectionRefusedError.
#
# ASCII-ONLY STRINGS -- see the note in scripts/restart-backend.ps1 (v2, note (c)).

$ErrorActionPreference = "Stop"

$TaskName   = "AgenticRAG-LocalInfra"
$ScriptPath = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")) "scripts\start-local-infra.ps1"

if (-not (Test-Path $ScriptPath)) {
    Write-Error "start-local-infra.ps1 not found at $ScriptPath"
    exit 1
}

# Fail EARLY and in plain language. Without this check the script runs most of
# the way and then dies on a bare "Access is denied." from a cmdlet, which does
# not tell you that the fix is simply to reopen the shell as administrator.
$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "This script must run in an ADMINISTRATOR PowerShell."
    Write-Host ""
    Write-Host "  1. Right-click PowerShell or Windows Terminal -> 'Run as administrator'"
    Write-Host "  2. Re-run:"
    Write-Host ("     powershell -ExecutionPolicy Bypass -File `"{0}`"" -f $ScriptPath.Replace('start-local-infra.ps1','register-infra-task.ps1'))
    Write-Host ""
    Write-Host "Only the REGISTRATION needs admin. The task itself runs unelevated as you."
    exit 1
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $ScriptPath)

$trigger = New-ScheduledTaskTrigger -AtLogOn

# -AllowStartIfOnBatteries and -DontStopIfGoingOnBatteries are DELIBERATE, not
# boilerplate. Windows refuses to start scheduled tasks on battery by default,
# and vendor power utilities (Acer Care Center here) lean on exactly that knob.
# Without these two flags the task would silently not run on battery days, which
# is indistinguishable from "Docker broke again" from the user's side.
#
# ExecutionTimeLimit 20m: start-local-infra.ps1 waits up to 10 min for the Docker
# daemon plus up to 3 min for Postgres, so a shorter limit could kill a legitimately
# slow cold boot midway.
#
# RestartCount/RestartInterval: if Docker Desktop is slower than the daemon wait,
# retry twice at 5 min rather than giving up on the logon entirely.
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20) `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 5)

# The principal is LOAD-BEARING, not boilerplate. Registering from an elevated
# shell without one can leave the task running in a context that is not this
# user's interactive session -- and Docker Desktop is PER-USER. A task running as
# SYSTEM (or as another account) finds no Docker daemon at all and would fail
# every logon for a reason that looks nothing like its actual cause.
#
#   LogonType Interactive -> runs only while this user is logged on, and needs no
#                            stored password.
#   RunLevel  Limited     -> the task runs UNELEVATED. Nothing it does (supabase
#                            start, docker compose, port probes) needs admin;
#                            only creating the task did.
$principal = New-ScheduledTaskPrincipal `
    -UserId    ("{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME) `
    -LogonType Interactive `
    -RunLevel  Limited

Register-ScheduledTask `
    -TaskName    $TaskName `
    -Action      $action `
    -Trigger     $trigger `
    -Settings    $settings `
    -Principal   $principal `
    -Description "Bring up local Supabase + Redis once Docker is ready, and verify their ports actually accept connections." `
    -Force | Out-Null

Write-Host ("Registered scheduled task '{0}'." -f $TaskName)
Write-Host ("  Runs at:  logon")
Write-Host ("  Script:   {0}" -f $ScriptPath)
Write-Host ("  Log:      {0}" -f (Join-Path (Split-Path $ScriptPath) "start-local-infra.log"))
Write-Host ""
Write-Host "Test it now without rebooting:"
Write-Host ("  Start-ScheduledTask -TaskName '{0}'" -f $TaskName)
Write-Host ("  Get-ScheduledTaskInfo -TaskName '{0}'   # LastTaskResult 0 = success" -f $TaskName)
