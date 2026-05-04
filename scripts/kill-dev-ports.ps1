# Stops processes listening on Mapping Studio dev ports (Windows).
# Note: netstat may still show LISTENING with a PID after the process died (stale entry); Stop-Process then fails safely.

$ports = 8020, 5173, 5174, 8000, 8001
foreach ($port in $ports) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object {
            $procId = $_
            if (-not $procId) { return }
            try {
                Stop-Process -Id $procId -Force -ErrorAction Stop
                Write-Host "Stopped PID $procId (port $port)"
            } catch {
                $msg = $_.Exception.Message
                if ($msg -match 'not found|Cannot find a process') {
                    # Ghost PID / race: TCP table out of sync with Process table
                } else {
                    Write-Host "Could not stop PID ${procId} on port ${port}: $msg"
                }
            }
        }
}
Write-Host "Done."
