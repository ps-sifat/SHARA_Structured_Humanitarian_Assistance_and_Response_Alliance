param(
    [switch]$Force,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
$managePath = Join-Path $projectRoot 'Sara\manage.py'
$runtimePath = Join-Path $projectRoot '.runtime\directory-sync'
New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
$logPath = Join-Path $runtimePath ('scheduler-' + (Get-Date -Format 'yyyy-MM') + '.log')

try {
    if (-not (Test-Path -LiteralPath $pythonPath)) {
        throw 'Project Python not found. Create .venv and install requirements.txt first.'
    }
    $environmentPath = Join-Path $projectRoot '.env'
    if (Test-Path -LiteralPath $environmentPath) {
        foreach ($line in Get-Content -LiteralPath $environmentPath -Encoding UTF8) {
            if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
                [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
            }
        }
    }
    $syncArguments = @($managePath, 'sync_directory', '--interval-days', '15')
    if ($Force) { $syncArguments += '--force' }
    if ($DryRun) { $syncArguments += '--dry-run' }
    if ($env:SHARA_SYNC_ACTOR_PHONE) { $syncArguments += @('--actor-phone', $env:SHARA_SYNC_ACTOR_PHONE) }
    if ($env:SHARA_CRAWLER_USER_AGENT) { $syncArguments += @('--user-agent', $env:SHARA_CRAWLER_USER_AGENT) }
    $env:PYTHONIOENCODING = 'utf-8'
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    Add-Content -LiteralPath $logPath -Encoding UTF8 -Value ("`r`n[" + (Get-Date -Format o) + '] Starting directory sync')
    Push-Location -LiteralPath $projectRoot
    try {
        $savedErrorPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            & $pythonPath @syncArguments 2>&1 | ForEach-Object { $_.ToString() } | Out-File -FilePath $logPath -Append -Encoding utf8 -ErrorAction Stop
            $syncExitCode = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $savedErrorPreference
        }
    } finally {
        Pop-Location
    }
    Add-Content -LiteralPath $logPath -Encoding UTF8 -Value ('Exit code: ' + $syncExitCode)
    exit $syncExitCode
} catch {
    Add-Content -LiteralPath $logPath -Encoding UTF8 -Value ('Scheduler error: ' + $_.Exception.Message)
    exit 1
}
