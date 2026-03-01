# Simple static file server for local testing
$logFile = "C:\Users\User\Documents\AI\Claude\battery-run-time-calculator\.claude\worktrees\confident-brown\serve_debug.log"
"[$(Get-Date)] serve.ps1 started. PORT=$($env:PORT)" | Out-File $logFile -Append

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = if ($env:PORT) { [int]$env:PORT } else { 8082 }

"[$(Get-Date)] root=$root port=$port" | Out-File $logFile -Append

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css'
  '.js'   = 'application/javascript'
  '.json' = 'application/json'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
}

try {
  "[$(Get-Date)] Creating HttpListener..." | Out-File $logFile -Append
  $listener = [System.Net.HttpListener]::new()
  $listener.Prefixes.Add("http://localhost:$port/")
  "[$(Get-Date)] Starting listener on port $port..." | Out-File $logFile -Append
  $listener.Start()
  "[$(Get-Date)] Listener started OK" | Out-File $logFile -Append
} catch {
  "[$(Get-Date)] ERROR starting listener: $_" | Out-File $logFile -Append
  Write-Error "Cannot start listener on port ${port}: $_"
  exit 1
}

Write-Host "Serving $root at http://localhost:$port/"
[Console]::Out.Flush()

try {
  "[$(Get-Date)] Entering request loop" | Out-File $logFile -Append
  while ($listener.IsListening) {
    $ctx  = $listener.GetContext()
    $req  = $ctx.Request
    $resp = $ctx.Response

    $urlPath = $req.Url.AbsolutePath
    if ($urlPath -eq '/') { $urlPath = '/index.html' }
    $filePath = Join-Path $root $urlPath.TrimStart('/')

    if (Test-Path $filePath -PathType Leaf) {
      $ext   = [System.IO.Path]::GetExtension($filePath)
      $mime  = if ($mimeTypes[$ext]) { $mimeTypes[$ext] } else { 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $resp.ContentType     = $mime
      $resp.ContentLength64 = $bytes.Length
      $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $resp.StatusCode = 404
      $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $resp.OutputStream.Write($body, 0, $body.Length)
    }
    $resp.OutputStream.Close()
  }
} catch {
  "[$(Get-Date)] ERROR in request loop: $_" | Out-File $logFile -Append
} finally {
  "[$(Get-Date)] Stopping listener" | Out-File $logFile -Append
  $listener.Stop()
}

"[$(Get-Date)] serve.ps1 exiting" | Out-File $logFile -Append
