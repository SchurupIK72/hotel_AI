[CmdletBinding()]
param(
    [switch]$KeepSupabaseRunning
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$normalizedRepoRoot = $repoRoot.ToLowerInvariant()
$supabaseCliPath = Join-Path $repoRoot "node_modules\.bin\supabase.cmd"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Get-SupabaseCliPath {
    if (Test-Path -LiteralPath $supabaseCliPath) {
        return $supabaseCliPath
    }

    if (Get-Command "supabase" -ErrorAction SilentlyContinue) {
        return "supabase"
    }

    throw "Supabase CLI not found. Run npm install first or install Supabase CLI globally."
}

function Stop-RepoNextDevProcesses {
    $stoppedCount = 0
    $candidatePids = [System.Collections.Generic.HashSet[int]]::new()

    $nodeProcesses = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
    foreach ($process in $nodeProcesses) {
        $commandLine = [string]$(if ($null -ne $process.CommandLine) { $process.CommandLine } else { "" })
        if (
            $commandLine.ToLowerInvariant().Contains("next dev") -and
            $commandLine.ToLowerInvariant().Contains($normalizedRepoRoot)
        ) {
            $candidatePids.Add([int]$process.ProcessId) | Out-Null
        }
    }

    $powershellProcesses = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue
    foreach ($process in $powershellProcesses) {
        $commandLine = [string]$(if ($null -ne $process.CommandLine) { $process.CommandLine } else { "" })
        if (
            $commandLine.ToLowerInvariant().Contains("npm.cmd run dev") -and
            $commandLine.ToLowerInvariant().Contains($normalizedRepoRoot)
        ) {
            $candidatePids.Add([int]$process.ProcessId) | Out-Null
        }
    }

    foreach ($processId in $candidatePids) {
        try {
            Stop-Process -Id $processId -Force -ErrorAction Stop
            $stoppedCount++
        } catch {
            # Ignore races where the process already exited.
        }
    }

    return $stoppedCount
}

Push-Location $repoRoot
try {
    $supabaseCli = Get-SupabaseCliPath

    Write-Step "Stopping Next.js dev processes for this repository"
    $stopped = Stop-RepoNextDevProcesses
    Write-Host "Stopped process count: $stopped"

    if (-not $KeepSupabaseRunning) {
        Write-Step "Stopping local Supabase stack"
        & $supabaseCli stop
        if ($LASTEXITCODE -ne 0) {
            throw "supabase stop failed."
        }
    } else {
        Write-Step "Keeping local Supabase stack running"
    }

    Write-Step "Local dev stop complete"
}
finally {
    Pop-Location
}
