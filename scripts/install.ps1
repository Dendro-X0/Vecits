#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

npm run v1:build-release

$Binary = node ./scripts/resolve-release-binary.mjs
$DataDir = if ($args.Count -gt 0) { $args[0] } else { Join-Path $Root ".data\default" }

& $Binary node init --data-dir $DataDir

Write-Host ""
Write-Host "Vectis node initialized."
Write-Host ""
Write-Host "Next:"
Write-Host "  & `"$Binary`" node serve --data-dir `"$DataDir`" --bind 127.0.0.1:7878"
Write-Host "  curl http://127.0.0.1:7878/health"
