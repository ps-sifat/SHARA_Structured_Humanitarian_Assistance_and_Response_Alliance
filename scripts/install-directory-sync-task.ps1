param(
    [ValidateRange(0, 23)][int]$Hour = 3,
    [string]$TaskName = 'SHARA-Directory-Sync',
    [switch]$Preview
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runnerPath = Join-Path $projectRoot 'scripts\run-directory-sync.ps1'
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Create the project .venv before installing the schedule.' }
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $runnerPath + '"'
$firstCheck = (Get-Date).Date.AddDays(1).AddHours($Hour)

if ($Preview) {
    [pscustomobject]@{
        TaskName = $TaskName
        User = $userId
        Executable = $powershellPath
        Arguments = $arguments
        FirstCheck = $firstCheck
        Schedule = 'Daily due-date check; each successful source refreshes every 15 days'
        Logon = 'Interactive (user must be logged in; no password is stored)'
    } | Format-List
    exit 0
}

if ($userId -match 'CodexSandbox|ContainerAdministrator|SYSTEM$') {
    throw 'Run this installer from your normal Windows account, not a sandbox/service account.'
}
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    $expectedAction = @($existing.Actions | Where-Object { $_.Arguments -eq $arguments })
    if ($expectedAction.Count -ne 1 -or $existing.Actions.Count -ne 1) {
        throw 'An unrelated task already uses this name. Choose another -TaskName.'
    }
}
$action = New-ScheduledTaskAction -Execute $powershellPath -Argument $arguments -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $firstCheck
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 8)
$task = Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings -Description `
    'SHARA government/NGO contact refresh: daily check, 15-day per-source interval, automatic publication of valid contacts.' -Force
$task | Select-Object TaskName, State
Get-ScheduledTaskInfo -TaskName $TaskName | Select-Object NextRunTime, LastTaskResult
