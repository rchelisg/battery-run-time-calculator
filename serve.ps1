# Simple static file server for local testing
$root    = Split-Path -Parent $MyInvocation.MyCommand.Path
$port    = 8080
$pidFile = Join-Path $root '.server.pid'

# ── Kill any previously running server instance ──────────────────────────────
if (Test-Path $pidFile) {
  $oldPid = (Get-Content $pidFile -ErrorAction SilentlyContinue) -as [int]
  if ($oldPid) {
    $oldProc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
    if ($oldProc) {
      Write-Host "Stopping previous server (PID $oldPid)..."
      Stop-Process -Id $oldPid -Force
      Start-Sleep -Milliseconds 400   # allow HTTP.sys to release the prefix
    }
  }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
}

# ── Record current PID so the next run can stop this instance ────────────────
$PID | Out-File $pidFile

# ── Start listener ────────────────────────────────────────────────────────────
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")
try {
  $listener.Start()
} catch {
  Write-Error "Cannot bind to port ${port}: $_"
  Remove-Item $pidFile -ErrorAction SilentlyContinue
  exit 1
}
Write-Host "Serving $root at http://localhost:$port/"

$mimeTypes = @{
  '.html' = 'text/html'
  '.css'  = 'text/css'
  '.js'   = 'application/javascript'
  '.json' = 'application/json'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
}

try {
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
} finally {
  $listener.Stop()
  Remove-Item $pidFile -ErrorAction SilentlyContinue
}
