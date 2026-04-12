[CmdletBinding()]
param(
    [string]$DestinationRoot = (Join-Path $env:USERPROFILE ".codex\skills"),
    [string]$RepoId = "hotelAI"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $DestinationRoot)) {
    Write-Host "Destination root does not exist: $DestinationRoot"
    return
}

$resolvedDestinationRoot = (Resolve-Path -LiteralPath $DestinationRoot).Path
$manifestDirectory = Join-Path $resolvedDestinationRoot ".repo-sync-manifests"
$manifestPath = Join-Path $manifestDirectory "$RepoId.json"

if (-not (Test-Path -LiteralPath $manifestPath)) {
    Write-Host "No sync manifest found for repo '$RepoId' at $manifestPath"
    return
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$removedSkills = @()
$skippedSkills = @()

foreach ($skillName in $manifest.skills) {
    $skillPath = Join-Path $resolvedDestinationRoot $skillName
    $markerPath = Join-Path $skillPath ".repo-sync.json"

    if (-not (Test-Path -LiteralPath $skillPath)) {
        $skippedSkills += "$skillName (missing)"
        continue
    }

    if (-not (Test-Path -LiteralPath $markerPath)) {
        $skippedSkills += "$skillName (missing marker)"
        continue
    }

    $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
    if ($marker.repoId -ne $RepoId) {
        $skippedSkills += "$skillName (owned by $($marker.repoId))"
        continue
    }

    Remove-Item -LiteralPath $skillPath -Recurse -Force
    $removedSkills += $skillName
}

Remove-Item -LiteralPath $manifestPath -Force

if ((Test-Path -LiteralPath $manifestDirectory) -and -not (Get-ChildItem -LiteralPath $manifestDirectory -Force)) {
    Remove-Item -LiteralPath $manifestDirectory -Force
}

Write-Host "Removed $($removedSkills.Count) synced skills for repo '$RepoId'"
foreach ($skillName in $removedSkills) {
    Write-Host " - $skillName"
}

if ($skippedSkills.Count -gt 0) {
    Write-Host "Skipped $($skippedSkills.Count) entries:"
    foreach ($entry in $skippedSkills) {
        Write-Host " - $entry"
    }
}
