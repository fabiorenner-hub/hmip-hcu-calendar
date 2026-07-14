# Publish an EXPERIMENTAL OTA build to the rolling GitHub prerelease `experimental`.
#
# Steering: experimental NEVER bumps the version and NEVER does `git push` or a
# stable release. It builds the SPA + experimental OTA assets and uploads them
# to a fixed prerelease tag `experimental` with --clobber. Stable users never
# see it (they follow releases/latest, which stays on the stable version).
$ErrorActionPreference = 'Stop'
$repo = 'fabiorenner-hub/hmip-hcu-calendar'
$root = Split-Path -Parent $PSScriptRoot

Push-Location $root
try {
  Write-Host '== build SPA + experimental OTA assets =='
  npm run build:spa
  npm run build:ota:exp

  $outDir = Join-Path $root 'dist/ota-dist'
  $assets = Get-ChildItem $outDir -File | Where-Object { $_.Name -like '*exp*' }
  if (-not $assets) { throw "no experimental assets in $outDir" }
  Write-Host ("assets: " + ($assets.Name -join ', '))

  # Ensure the rolling prerelease exists (create once), then clobber-upload assets.
  $exists = gh release view experimental -R $repo 2>$null
  if (-not $exists) {
    Write-Host '== creating rolling prerelease `experimental` =='
    gh release create experimental -R $repo --prerelease --title 'Experimental (rolling)' `
      --notes 'Rolling experimental OTA channel. Not for stable users. Auto-updated by publish-ota-experimental.ps1.'
  } else {
    gh release edit experimental -R $repo --prerelease | Out-Null
  }

  foreach ($a in $assets) {
    Write-Host "== upload $($a.Name) (clobber) =="
    gh release upload experimental $a.FullName -R $repo --clobber
  }
  Write-Host '== done: experimental OTA published =='
} finally {
  Pop-Location
}
