# Bring up local dev infrastructure (Supabase + Redis) once Docker is ready.
#
# WHY THIS EXISTS
#   The backend's lifespan calls get_pg_pool() at startup (app/main.py:395).
#   If local Supabase Postgres is not listening on 127.0.0.1:54322, uvicorn dies
#   with ConnectionRefusedError [Errno 10061] and exits. That is by design -- the
#   app refuses to serve with a dead DB -- so the fix belongs here, not in main.py.
#
#   Redis already self-heals: docker-compose.dev.yml sets "restart: unless-stopped",
#   so Docker restarts it when the daemon comes back.
#
#   Supabase does NOT. The Supabase CLI creates its containers with no restart
#   policy, because "supabase start" is a one-shot command and not a compose stack.
#   When Docker Desktop stops (or is killed by a power/optimizer utility), the
#   supabase_db_* container stays down until someone runs "supabase start" again.
#   That asymmetry is the whole reason for this script.
#
# WHAT IT DOES (all steps idempotent -- safe to run any time, any number of times)
#   1. Waits for the Docker daemon to answer.
#   2. "supabase start"                      -> recreates the Supabase stack.
#   3. "docker compose ... up -d"            -> recreates Redis.
#   4. Pins a restart policy on the Supabase containers, and PRINTS the policy it
#      found first, so the claim "Supabase auto-starts on Docker Desktop boot"
#      becomes a measurement instead of an assumption.
#   5. Verifies 127.0.0.1:54322 and 127.0.0.1:6379 accept a real TCP connection --
#      the same thing asyncpg does. A container reported "running" whose port is
#      not yet accepting is the failure this step exists to catch.
#
# Step 4 is a belt-and-braces layer, not the primary mechanism. Docker restarts
# containers on daemon start with NO dependency ordering, so the Supabase services
# can race their own database. They retry and normally settle, but "supabase start"
# in step 2 is the path that is actually ordered. If a boot ever comes up flaky,
# re-run this script by hand -- that is the reliable door.
#
# Usage:
#   pwsh scripts/start-local-infra.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\start-local-infra.ps1
#   pwsh scripts/start-local-infra.ps1 -DockerTimeoutSec 900   # slow cold boot
#
# ASCII-ONLY STRINGS. Windows PowerShell 5.1 reads BOM-less .ps1 as Win-1252 and
# mojibakes UTF-8 punctuation inside expressions, breaking the parser. This is the
# same constraint recorded in scripts/restart-backend.ps1 (v2, note (c)).

[CmdletBinding()]
param(
    # How long to wait for the Docker daemon. Generous: a cold Docker Desktop
    # boot on this box can take several minutes before it answers "docker info".
    [int]$DockerTimeoutSec = 600,

    # Restart policy pinned onto the Supabase containers in step 4.
    #   unless-stopped = comes back on daemon start, but respects a deliberate
    #                    "docker stop" by a human.
    #   always         = comes back on daemon start even after a deliberate stop.
    # "unless-stopped" is the default because it matches what Redis already uses,
    # and because a container you stopped on purpose should stay stopped.
    [ValidateSet('unless-stopped', 'always', 'no')]
    [string]$RestartPolicy = 'unless-stopped',

    # Skip step 4 entirely (just start things, touch no policies).
    [switch]$SkipRestartPolicy
)

$ErrorActionPreference = "Stop"

$RepoRoot   = Resolve-Path (Join-Path $PSScriptRoot "..")
$ComposeFile = Join-Path $RepoRoot "docker-compose.dev.yml"
$LogFile    = Join-Path $RepoRoot "scripts\start-local-infra.log"

function Write-Step {
    param([string]$Message)
    $line = ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message)
    Write-Host $line
    # Tee to a log file: this script is meant to run from a hidden scheduled task,
    # where the console output goes nowhere and a silent failure is invisible.
    try { Add-Content -Path $LogFile -Value $line -ErrorAction SilentlyContinue } catch { }
}

function Invoke-Native {
    # Run a native (non-PowerShell) command and capture its merged output + exit code.
    #
    # WHY THIS WRAPPER EXISTS -- measured 2026-08-15, not theoretical:
    #   With $ErrorActionPreference = "Stop" set at script scope, Windows
    #   PowerShell 5.1 promotes ANY text a native .exe writes to stderr into a
    #   TERMINATING error the moment you pipe it with 2>&1. It does not matter
    #   that the exe exited 0, and it does not matter that the text is a routine
    #   notice rather than a failure.
    #
    #   That killed the first version of this script outright: "supabase start"
    #   prints "supabase start is already running." -- an entirely NORMAL,
    #   successful outcome for an idempotent call -- to stderr. The script threw
    #   at that line and never reached the compose step, the policy audit or the
    #   port checks. "docker compose up -d" writes its pull/create progress to
    #   stderr too, so it was next in line for the same death.
    #
    #   So: drop to 'Continue' for the duration of the call, catch anything that
    #   still escapes, and decide success from the EXIT CODE and the port probes
    #   -- never from whether the process happened to write to stderr.
    param([scriptblock]$Command)
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $raw = & $Command 2>&1
        $code = $LASTEXITCODE
        # Unwrap ErrorRecords. Text a native exe writes to stderr arrives here
        # wrapped in a System.Management.Automation.ErrorRecord, and letting
        # Out-String render that emits FOUR lines of PowerShell framing per
        # message -- "At C:\...\script.ps1:211 char:23", the offending source
        # line, a caret underline, "+ CategoryInfo ...", "+ FullyQualifiedErrorId
        # ...". None of that came from the program. It made a healthy log look
        # like a stack trace: "Container agentic-rag-redis Running" (a SUCCESS
        # notice) rendered as a six-line NativeCommandError block.
        # Keep the exception's Message -- that is the program's actual output.
        $lines = foreach ($item in $raw) {
            if ($item -is [System.Management.Automation.ErrorRecord]) {
                $item.Exception.Message
            } else {
                [string]$item
            }
        }
        $out = ($lines -join "`n")
    } catch {
        $out  = $_.Exception.Message
        $code = -1
    } finally {
        $ErrorActionPreference = $prevEAP
    }
    return [pscustomobject]@{ Output = $out; ExitCode = $code }
}

function Write-NativeOutput {
    # Log a native command's output, one prefixed line at a time, ASCII-only.
    #
    # The Supabase CLI draws its summary in Unicode box characters. Those do not
    # survive the round trip into this log -- Add-Content writes in the console's
    # legacy code page, so every border rendered as a run of replacement chars
    # and turned a readable log into forty lines of garbage. Rather than fight
    # the encoding, drop anything outside printable ASCII: the box art carries no
    # information, while the parts that matter (URLs, ports, keys, warnings, the
    # "Stopped services:" line) are plain ASCII and come through intact.
    #
    # A line with no letter or digit left after stripping was pure border, so it
    # is skipped entirely instead of logging a blank.
    param([string]$Prefix, [string]$Text)
    foreach ($l in ($Text -split "`r?`n")) {
        $clean = ($l -replace '[^\x20-\x7E]', '').Trim()
        if ($clean -and ($clean -match '[A-Za-z0-9]')) {
            Write-Step ("  {0}| {1}" -f $Prefix, $clean)
        }
    }
}

function Test-TcpPort {
    # A real connect, not a listening-socket lookup. Docker publishes a port on
    # the host the instant the container starts, but the service inside may not
    # be accepting yet -- and "published" is not the property the backend needs.
    param([string]$TargetHost, [int]$Port, [int]$TimeoutMs = 2000)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect($TargetHost, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) { return $false }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Wait-ForPort {
    param([string]$Label, [int]$Port, [int]$TimeoutSec = 120)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-TcpPort -TargetHost "127.0.0.1" -Port $Port) {
            Write-Step ("OK   {0} accepting connections on 127.0.0.1:{1}" -f $Label, $Port)
            return $true
        }
        Start-Sleep -Seconds 2
    }
    Write-Step ("FAIL {0} NOT accepting on 127.0.0.1:{1} after {2}s" -f $Label, $Port, $TimeoutSec)
    return $false
}

function Test-PortReservedByWindows {
    # Is $Port inside a Windows TCP port-exclusion range, and is that range an
    # AUTOMATIC reservation or an ADMINISTERED one?
    #
    # WHY THIS MATTERS -- this is the single most valuable check in the script,
    # and it exists because of a real six-step misdiagnosis on 2026-08-15:
    #   Windows (WinNAT / Hyper-V, which WSL2 and Docker Desktop both sit on)
    #   auto-reserves BLOCKS of TCP ports for dynamic allocation, and those
    #   blocks are RE-ROLLED ON EVERY REBOOT. When a block lands on top of the
    #   Supabase ports, Docker starts the containers fine and is then refused
    #   permission to publish them:
    #     bind: An attempt was made to access a socket in a way forbidden
    #           by its access permissions.        (WSAEACCES)
    #   The result is a container reporting "Up (healthy)" whose port accepts
    #   nothing, and a CLI cheerfully printing a connection string that cannot
    #   connect. Measured that day: block 54258-54357 swallowed 54321, 54322,
    #   54323, 54324 and 54327 at once, while Redis on 6379 was unaffected --
    #   which is exactly what made it look like a Supabase problem.
    #
    # THE ASTERISK IS THE WHOLE POINT. "netsh ... show excludedportrange" marks
    # administered exclusions with a trailing "*". An ADMINISTERED range is one
    # we claimed on purpose; explicit binds into it still succeed, so it is the
    # FIX, not the fault. An UNMARKED range is an automatic reservation, and
    # that is the thing that breaks Docker. Reporting "port is reserved" without
    # that distinction would now fire on our own remedy and be worse than
    # silence.
    param([int]$Port)
    $out = (Invoke-Native { netsh int ipv4 show excludedportrange protocol=tcp }).Output
    foreach ($line in ($out -split "`r?`n")) {
        if ($line -match '^\s*(\d+)\s+(\d+)') {
            $start = [int]$Matches[1]
            $end   = [int]$Matches[2]
            if ($Port -ge $start -and $Port -le $end) {
                return [pscustomobject]@{
                    Reserved     = $true
                    Start        = $start
                    End          = $end
                    Administered = ($line -match '\*')
                }
            }
        }
    }
    return [pscustomobject]@{ Reserved = $false; Start = 0; End = 0; Administered = $false }
}

function Write-PortDiagnosis {
    # Called ONLY when a port failed to accept. Answers "why" instead of leaving
    # a bare FAIL line, which is what the first version of this script did -- it
    # reported "NOT accepting on 127.0.0.1:54322" while the Docker daemon had a
    # precise, actionable reason available the whole time.
    param([string]$Label, [int]$Port, [string]$NameFilter)

    Write-Step ("DIAGNOSIS for {0} (port {1}):" -f $Label, $Port)

    $ps = (Invoke-Native {
        docker ps -a --filter ("name=" + $NameFilter) --format "{{.Names}}|{{.Status}}|{{.Ports}}"
    }).Output
    $rows = @($ps -split "`r?`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ }

    if (-not $rows) {
        Write-Step ("  No container matching '{0}' exists." -f $NameFilter)
        Write-Step "  -> The stack was never created, or was removed by 'supabase stop'."
        Write-Step "  -> Fix: run 'supabase start' from the repo root."
        return
    }

    foreach ($r in $rows) {
        $parts  = $r -split '\|'
        $name   = $parts[0]
        $status = if ($parts.Count -gt 1) { $parts[1] } else { "<unknown>" }
        $ports  = if ($parts.Count -gt 2) { $parts[2] } else { "" }
        Write-Step ("  container: {0}" -f $name)
        Write-Step ("  status:    {0}" -f $status)
        Write-Step ("  live map:  {0}" -f $(if ($ports) { $ports } else { "<none>" }))

        # Configured bindings vs live bindings. If the container HAS a configured
        # binding but shows no live "->" mapping, Docker was refused the bind --
        # it did not simply forget to publish.
        $cfg = (Invoke-Native {
            docker inspect -f "{{json .HostConfig.PortBindings}}" $name
        }).Output.Trim()
        Write-Step ("  configured: {0}" -f $cfg)

        if ($cfg -match [string]$Port -and $ports -notmatch '->') {
            Write-Step "  -> Port IS configured but NOT published. Docker was refused the bind."
        }
    }

    $res = Test-PortReservedByWindows -Port $Port
    if ($res.Reserved -and -not $res.Administered) {
        Write-Step ("  *** ROOT CAUSE: Windows has AUTO-RESERVED {0}-{1}, which covers {2}." -f $res.Start, $res.End, $Port)
        Write-Step "  *** Docker cannot bind a port inside an automatic reservation."
        Write-Step "  *** These blocks move on every reboot. Fix permanently in an ADMIN PowerShell:"
        Write-Step "  ***   net stop winnat"
        Write-Step "  ***   netsh int ipv4 add excludedportrange protocol=tcp startport=54320 numberofports=16 store=persistent"
        Write-Step "  ***   net start winnat"
        Write-Step "  *** Then restart Docker Desktop and run 'supabase start'."
    } elseif ($res.Reserved -and $res.Administered) {
        Write-Step ("  Windows reservation {0}-{1} covers this port, but it is ADMINISTERED (ours)." -f $res.Start, $res.End)
        Write-Step "  That is the intended fix, not a fault -- explicit binds into it still succeed."
        Write-Step "  -> Look elsewhere: container status above, or 'docker logs <container>'."
    } else {
        Write-Step "  No Windows port reservation covers this port."
        Write-Step "  -> Look at the container status above, or 'docker logs <container>'."
    }
}

Write-Step "=== start-local-infra begin ==="
Write-Step ("Repo root: {0}" -f $RepoRoot)

# ---------------------------------------------------------------------------
# Preflight: required executables
# ---------------------------------------------------------------------------
foreach ($exe in @('docker', 'supabase')) {
    if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) {
        Write-Step ("FATAL '{0}' not found on PATH. Cannot continue." -f $exe)
        exit 1
    }
}
if (-not (Test-Path $ComposeFile)) {
    Write-Step ("FATAL compose file missing: {0}" -f $ComposeFile)
    exit 1
}

# ---------------------------------------------------------------------------
# 1. Wait for the Docker daemon
# ---------------------------------------------------------------------------
Write-Step ("Waiting up to {0}s for the Docker daemon..." -f $DockerTimeoutSec)
$deadline    = (Get-Date).AddSeconds($DockerTimeoutSec)
$dockerReady = $false
while ((Get-Date) -lt $deadline) {
    # "docker info" answers only once the daemon is genuinely up; "docker version"
    # succeeds against the client alone and would let us proceed too early.
    docker info --format "{{.ServerVersion}}" *> $null
    if ($LASTEXITCODE -eq 0) { $dockerReady = $true; break }
    Start-Sleep -Seconds 5
}
if (-not $dockerReady) {
    Write-Step ("FATAL Docker daemon did not answer within {0}s. Is Docker Desktop running?" -f $DockerTimeoutSec)
    exit 1
}
Write-Step "Docker daemon is up."

# ---------------------------------------------------------------------------
# 2. Supabase
# ---------------------------------------------------------------------------
# "supabase start" is safe to re-run: when the stack is already up it prints
# "supabase local development setup is already running" and exits non-zero on
# some CLI versions. A non-zero exit here is therefore NOT proof of failure --
# the port check in step 5 is what actually decides. Do not gate on this code.
Write-Step "Running 'supabase start' (idempotent)..."
Push-Location $RepoRoot
try {
    $sb = Invoke-Native { supabase start }
} finally {
    Pop-Location
}
Write-Step ("supabase start exit code: {0}" -f $sb.ExitCode)
Write-NativeOutput -Prefix "supabase" -Text $sb.Output

# ---------------------------------------------------------------------------
# 3. Redis (compose already carries restart: unless-stopped)
# ---------------------------------------------------------------------------
Write-Step "Running 'docker compose up -d' for Redis..."
# Same stderr trap as supabase above: compose writes create/pull progress to
# stderr on success, so this MUST go through Invoke-Native.
$dc = Invoke-Native { docker compose -f $ComposeFile up -d }
Write-Step ("docker compose exit code: {0}" -f $dc.ExitCode)
Write-NativeOutput -Prefix "compose" -Text $dc.Output

# ---------------------------------------------------------------------------
# 4. Pin a restart policy onto the Supabase containers
# ---------------------------------------------------------------------------
if ($SkipRestartPolicy) {
    Write-Step "Skipping restart-policy step (-SkipRestartPolicy)."
} else {
    Write-Step ("Auditing + pinning restart policy '{0}' on supabase_* containers..." -f $RestartPolicy)
    $psOut = Invoke-Native { docker ps -a --filter "name=supabase_" --format "{{.Names}}" }
    $names = @($psOut.Output -split "`r?`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    if (-not $names -or $names.Count -eq 0) {
        Write-Step "  WARN no supabase_* containers found. Did 'supabase start' actually create them?"
    }
    foreach ($n in $names) {
        # Print the policy BEFORE changing it. This is the measurement that tells
        # us whether Supabase was ever really set to auto-start, or whether that
        # was an inherited claim nobody had checked.
        $before = (docker inspect -f "{{.HostConfig.RestartPolicy.Name}}" $n 2>$null)
        if (-not $before) { $before = "<unreadable>" }
        if ($before.Trim() -eq $RestartPolicy) {
            Write-Step ("  {0}: already '{1}' -- unchanged" -f $n, $before.Trim())
        } else {
            docker update --restart $RestartPolicy $n *> $null
            $after = (docker inspect -f "{{.HostConfig.RestartPolicy.Name}}" $n 2>$null)
            Write-Step ("  {0}: '{1}' -> '{2}'" -f $n, $before.Trim(), $after.Trim())
        }
    }
}

# ---------------------------------------------------------------------------
# 5. Verify the ports the backend actually needs
# ---------------------------------------------------------------------------
# 54322 is the one that produced the ConnectionRefusedError. 6379 is Redis.
# A container is "running" long before its service accepts connections, so this
# step is the only honest confirmation that the backend can now start.
$pgOk    = Wait-ForPort -Label "Supabase Postgres" -Port 54322 -TimeoutSec 180
if (-not $pgOk) { Write-PortDiagnosis -Label "Supabase Postgres" -Port 54322 -NameFilter "supabase_db" }

$redisOk = Wait-ForPort -Label "Redis" -Port 6379 -TimeoutSec 60
if (-not $redisOk) { Write-PortDiagnosis -Label "Redis" -Port 6379 -NameFilter "agentic-rag-redis" }

# Kong carries the REST/Auth/Storage API the app reaches through SUPABASE_URL,
# so a healthy Postgres alone is not enough for the backend to work. Checked
# after the two above because it is the less common failure, but checked --
# on 2026-08-15 it was dead for the same reason and nothing noticed.
$kongOk = Wait-ForPort -Label "Supabase API (Kong)" -Port 54321 -TimeoutSec 60
if (-not $kongOk) { Write-PortDiagnosis -Label "Supabase API (Kong)" -Port 54321 -NameFilter "supabase_kong" }

Write-Step "=== start-local-infra end ==="

if ($pgOk -and $redisOk -and $kongOk) {
    Write-Step "All local infrastructure is up. Backend is safe to start."
    exit 0
}

Write-Step "One or more services did NOT come up. See lines above."
Write-Step ("Log: {0}" -f $LogFile)
exit 1
