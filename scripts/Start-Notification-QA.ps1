$ErrorActionPreference = 'Stop'
try {
    $runtime = Join-Path $PSScriptRoot 'runtime\electron.exe'
    $fixture = Join-Path $PSScriptRoot 'app'
    if (!(Test-Path -LiteralPath $runtime) -or !(Test-Path -LiteralPath (Join-Path $fixture 'main.cjs'))) { throw 'Fixture files are missing. Copy the entire update-notification folder.' }
    $base = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PageHearth-Notification-QA\runs'
    $run = Join-Path $base ([Guid]::NewGuid().ToString('N'))
    foreach ($part in @('', 'userData', 'sessionData', 'cache', 'temp', 'logs', 'crashDumps')) { New-Item -ItemType Directory -Path (Join-Path $run $part) -Force | Out-Null }
    $stdout = Join-Path $run 'logs\stdout.log'
    $stderr = Join-Path $run 'logs\stderr.log'
    $ready = Join-Path $run 'window-ready.json'
    $priorRun = $env:PAGEHEARTH_NOTIFICATION_QA_RUN
    $priorNode = $env:ELECTRON_RUN_AS_NODE
    try {
        $env:PAGEHEARTH_NOTIFICATION_QA_RUN = $run
        Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
        $argsList = @(('"' + $fixture + '"'), ('--user-data-dir="' + (Join-Path $run 'userData') + '"'), ('--disk-cache-dir="' + (Join-Path $run 'cache') + '"'), '--enable-logging=stderr')
        $child = Start-Process -FilePath $runtime -ArgumentList $argsList -WorkingDirectory $PSScriptRoot -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Normal -PassThru
    } finally {
        $env:PAGEHEARTH_NOTIFICATION_QA_RUN = $priorRun
        if ($null -eq $priorNode) { Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue } else { $env:ELECTRON_RUN_AS_NODE = $priorNode }
    }
    $null = $child.Handle # Retain the handle so Windows PowerShell can retrieve the exit code.
    Write-Host "Notification QA diagnostics: $run"
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while (!$child.HasExited -and !(Test-Path -LiteralPath $ready) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 200; $child.Refresh() }
    if (!(Test-Path -LiteralPath $ready)) {
        if (!$child.HasExited) { Stop-Process -Id $child.Id; $child.WaitForExit() }
        Write-Host 'Notification QA failed before its window was ready.'
        Get-Content -LiteralPath $stdout,$stderr -ErrorAction SilentlyContinue | Write-Host
        exit 1
    }
    Write-Host 'Notification QA is ready. Use Fixture (not production) > available. Close its window to finish.'
    $child.WaitForExit()
    if ($child.ExitCode -ne 0) {
        Write-Host "Notification QA exited with code $($child.ExitCode)."
        Get-Content -LiteralPath $stdout,$stderr -ErrorAction SilentlyContinue | Write-Host
        exit 1
    }
    Write-Host 'Notification QA closed. Its disposable diagnostics were retained; no cleanup is required.'
    exit 0
} catch {
    Write-Host ('Notification QA could not start: ' + $_.Exception.Message)
    exit 1
}
