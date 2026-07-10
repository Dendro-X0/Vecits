#Requires -Version 5.1
<#
.SYNOPSIS
  Register a daily Vectis backup task (Windows Task Scheduler).

.EXAMPLE
  .\deploy\windows\Register-VectisBackupTask.ps1 -DataDir "E:\vectis\.data\r2"
#>
param(
  [string]$DataDir = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) ".data\r2"),
  [string]$BackupRoot = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) "target\backups"),
  [string]$TaskName = "VectisDailyBackup"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BackupScript = Join-Path $RepoRoot "scripts\r2-backup.mjs"

$Action = New-ScheduledTaskAction -Execute "node.exe" -Argument "`"$BackupScript`" --data-dir `"$DataDir`" --dest `"$BackupRoot\$(Get-Date -Format yyyy-MM-dd)`""
$Trigger = New-ScheduledTaskTrigger -Daily -At "2:15AM"
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Force | Out-Null

Write-Host "Registered scheduled task: $TaskName"
Write-Host "  Data dir:  $DataDir"
Write-Host "  Backup to: $BackupRoot\<date>"
