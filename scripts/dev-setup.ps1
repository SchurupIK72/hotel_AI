[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipAppStart,
    [switch]$ForceEnvRewrite
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envLocalPath = Join-Path $repoRoot ".env.local"
$supabaseCliPath = Join-Path $repoRoot "node_modules\.bin\supabase.cmd"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-CommandExists {
    param([string]$CommandName)

    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $CommandName"
    }
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

function Parse-KeyValueLines {
    param([string[]]$Lines)

    $result = @{}

    foreach ($line in $Lines) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        $trimmed = $line.Trim()
        if ($trimmed.StartsWith("#")) {
            continue
        }

        $separatorIndex = $trimmed.IndexOf("=")
        if ($separatorIndex -lt 1) {
            continue
        }

        $key = $trimmed.Substring(0, $separatorIndex).Trim()
        $value = $trimmed.Substring($separatorIndex + 1).Trim()

        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        $result[$key] = $value
    }

    return $result
}

function Read-EnvFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return @{}
    }

    return Parse-KeyValueLines -Lines (Get-Content -LiteralPath $Path)
}

function Write-EnvFile {
    param(
        [string]$Path,
        [hashtable]$Values
    )

    $orderedKeys = @(
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPER_ADMIN_EMAILS",
        "DEMO_HOTEL_ID",
        "DEMO_HOTEL_NAME",
        "DEMO_HOTEL_SLUG",
        "DEMO_ADMIN_EMAIL",
        "DEMO_ADMIN_PASSWORD",
        "DEMO_ADMIN_FULL_NAME"
    )

    $lines = foreach ($key in $orderedKeys) {
        if ($Values.ContainsKey($key)) {
            "$key=$($Values[$key])"
        }
    }

    $content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $content, $utf8NoBom)
}

function Invoke-InRepo {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FileName,
        [string[]]$Arguments = @(),
        [switch]$AllowStderrOnSuccess
    )

    function Format-ProcessArgument {
        param([string]$Value)

        if ($null -eq $Value) {
            return '""'
        }

        if ($Value -notmatch '[\s"]') {
            return $Value
        }

        return '"' + ($Value -replace '(\\*)"', '$1$1\"') + '"'
    }

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $FileName
    $startInfo.WorkingDirectory = $repoRoot
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.Arguments = (($Arguments | ForEach-Object { Format-ProcessArgument $_ }) -join " ")

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    [void]$process.Start()

    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    if ($process.ExitCode -ne 0) {
        if (-not [string]::IsNullOrWhiteSpace($stdout)) {
            Write-Host $stdout.TrimEnd()
        }
        if (-not [string]::IsNullOrWhiteSpace($stderr)) {
            Write-Host $stderr.TrimEnd()
        }
        throw "Command failed: $FileName $($Arguments -join ' ')"
    }

    if ((-not $AllowStderrOnSuccess) -and (-not [string]::IsNullOrWhiteSpace($stderr))) {
        Write-Host $stderr.TrimEnd()
    }

    if ([string]::IsNullOrWhiteSpace($stdout)) {
        return @()
    }

    return @($stdout -split "\r?\n")
}

Assert-CommandExists -CommandName "npm.cmd"
Assert-CommandExists -CommandName "docker"

Push-Location $repoRoot
try {
    if (-not $SkipInstall) {
        Write-Step "Installing npm dependencies"
        & npm.cmd install
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed."
        }
    }

    $supabaseCli = Get-SupabaseCliPath

    Write-Step "Starting local Supabase stack"
    & $supabaseCli start
    if ($LASTEXITCODE -ne 0) {
        throw "supabase start failed."
    }

    Write-Step "Reading local Supabase secrets"
    $statusEnvLines = Invoke-InRepo -FileName $supabaseCli -Arguments @("status", "-o", "env") -AllowStderrOnSuccess
    $statusVars = Parse-KeyValueLines -Lines $statusEnvLines

    if (-not $statusVars.ContainsKey("ANON_KEY")) {
        throw "Could not read ANON_KEY from supabase status -o env output."
    }

    if (-not $statusVars.ContainsKey("SERVICE_ROLE_KEY")) {
        throw "Could not read SERVICE_ROLE_KEY from supabase status -o env output."
    }

    Write-Step "Writing .env.local"
    $existingEnv = if ($ForceEnvRewrite) { @{} } else { Read-EnvFile -Path $envLocalPath }
    $mergedEnv = @{}

    foreach ($entry in $existingEnv.GetEnumerator()) {
        $mergedEnv[$entry.Key] = $entry.Value
    }

    $mergedEnv["NEXT_PUBLIC_SUPABASE_URL"] = "http://127.0.0.1:54321"
    $mergedEnv["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = $statusVars["ANON_KEY"]
    $mergedEnv["SUPABASE_SERVICE_ROLE_KEY"] = $statusVars["SERVICE_ROLE_KEY"]

    if (-not $mergedEnv.ContainsKey("SUPER_ADMIN_EMAILS")) {
        $mergedEnv["SUPER_ADMIN_EMAILS"] = "owner@example.com"
    }

    if (-not $mergedEnv.ContainsKey("DEMO_HOTEL_ID")) {
        $mergedEnv["DEMO_HOTEL_ID"] = "11111111-1111-1111-1111-111111111111"
    }

    if (-not $mergedEnv.ContainsKey("DEMO_HOTEL_NAME")) {
        $mergedEnv["DEMO_HOTEL_NAME"] = "Demo Hotel"
    }

    if (-not $mergedEnv.ContainsKey("DEMO_HOTEL_SLUG")) {
        $mergedEnv["DEMO_HOTEL_SLUG"] = "demo-hotel"
    }

    if (-not $mergedEnv.ContainsKey("DEMO_ADMIN_EMAIL")) {
        $mergedEnv["DEMO_ADMIN_EMAIL"] = "demo-admin@hotel.local"
    }

    if (-not $mergedEnv.ContainsKey("DEMO_ADMIN_PASSWORD")) {
        $mergedEnv["DEMO_ADMIN_PASSWORD"] = "DemoPass123!"
    }

    if (-not $mergedEnv.ContainsKey("DEMO_ADMIN_FULL_NAME")) {
        $mergedEnv["DEMO_ADMIN_FULL_NAME"] = "Demo Hotel Admin"
    }

    Write-EnvFile -Path $envLocalPath -Values $mergedEnv

    Write-Step "Resetting local database and applying migrations"
    & $supabaseCli db reset --yes
    if ($LASTEXITCODE -ne 0) {
        throw "supabase db reset failed."
    }

    Write-Step "Bootstrapping demo hotel and demo auth user"
    & node .\scripts\bootstrap-local-demo.mjs
    if ($LASTEXITCODE -ne 0) {
        throw "Demo bootstrap failed."
    }

    if (-not $SkipAppStart) {
        Write-Step "Starting Next.js dev server in a new PowerShell window"
        $devCommand = "Set-Location `"$repoRoot`"; npm.cmd run dev"
        Start-Process -FilePath "powershell.exe" -ArgumentList @(
            "-NoExit",
            "-ExecutionPolicy", "Bypass",
            "-Command", $devCommand
        ) | Out-Null
    }

    Write-Step "Local setup complete"
    Write-Host "App URL: http://localhost:3000"
    Write-Host "Supabase Studio: http://127.0.0.1:54323"
    Write-Host "Demo email: $($mergedEnv["DEMO_ADMIN_EMAIL"])"
    Write-Host "Demo password: $($mergedEnv["DEMO_ADMIN_PASSWORD"])"

    if ($SkipAppStart) {
        Write-Host "App server was not started because -SkipAppStart was used."
    } else {
        Write-Host "A separate PowerShell window was opened for `npm run dev`."
    }
}
finally {
    Pop-Location
}
