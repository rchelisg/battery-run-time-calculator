# Kill any PowerShell process currently running serve.ps1
$procs = Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like '*serve.ps1*' }
if ($procs) {
  foreach ($p in $procs) {
    Write-Host "Stopping PID $($p.ProcessId)..."
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Milliseconds 600
  Write-Host "Done — all serve.ps1 processes stopped."
} else {
  Write-Host "No serve.ps1 processes were running."
}
