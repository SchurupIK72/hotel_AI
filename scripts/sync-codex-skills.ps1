[CmdletBinding()]
param(
    [string]$SourceRoot = "",
    [string]$DestinationRoot = (Join-Path $env:USERPROFILE ".codex\skills"),
    [string]$RepoId = "hotelAI"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-ExistingPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Path does not exist: $Path"
    }

    return (Resolve-Path -LiteralPath $Path).Path
}

if ([string]::IsNullOrWhiteSpace($SourceRoot)) {
    $SourceRoot = Join-Path $PSScriptRoot "..\.codex\skills"
}

$resolvedSourceRoot = Resolve-ExistingPath -Path $SourceRoot

if (-not (Test-Path -LiteralPath $DestinationRoot)) {
    New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null
}

$resolvedDestinationRoot = (Resolve-Path -LiteralPath $DestinationRoot).Path
$skillDirectories = Get-ChildItem -LiteralPath $resolvedSourceRoot -Directory |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "SKILL.md") } |
    Sort-Object Name

if ($skillDirectories.Count -eq 0) {
    throw "No skill directories with SKILL.md were found in $resolvedSourceRoot"
}

$manifestDirectory = Join-Path $resolvedDestinationRoot ".repo-sync-manifests"
if (-not (Test-Path -LiteralPath $manifestDirectory)) {
    New-Item -ItemType Directory -Path $manifestDirectory -Force | Out-Null
}

$manifestPath = Join-Path $manifestDirectory "$RepoId.json"
$results = @()

foreach ($skillDirectory in $skillDirectories) {
    $targetPath = Join-Path $resolvedDestinationRoot $skillDirectory.Name
    $action = if (Test-Path -LiteralPath $targetPath) { "updated" } else { "installed" }

    if (Test-Path -LiteralPath $targetPath) {
        Remove-Item -LiteralPath $targetPath -Recurse -Force
    }

    New-Item -ItemType Directory -Path $targetPath -Force | Out-Null

    Get-ChildItem -LiteralPath $skillDirectory.FullName -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $targetPath -Recurse -Force
    }

    $markerPath = Join-Path $targetPath ".repo-sync.json"
    $markerPayload = @{
        repoId = $RepoId
        skill = $skillDirectory.Name
        sourceRoot = $resolvedSourceRoot
        syncedAt = (Get-Date).ToString("o")
    } | ConvertTo-Json -Depth 4

    Set-Content -LiteralPath $markerPath -Value $markerPayload -Encoding utf8

    $results += [PSCustomObject]@{
        Name = $skillDirectory.Name
        Action = $action
        Path = $targetPath
    }
}

$manifestPayload = @{
    repoId = $RepoId
    sourceRoot = $resolvedSourceRoot
    destinationRoot = $resolvedDestinationRoot
    syncedAt = (Get-Date).ToString("o")
    skills = @($results.Name)
} | ConvertTo-Json -Depth 4

Set-Content -LiteralPath $manifestPath -Value $manifestPayload -Encoding utf8

Write-Host "Synced $($results.Count) skills from $resolvedSourceRoot to $resolvedDestinationRoot"
foreach ($result in $results) {
    Write-Host (" - {0}: {1}" -f $result.Name, $result.Action)
}
Write-Host "Manifest: $manifestPath"
