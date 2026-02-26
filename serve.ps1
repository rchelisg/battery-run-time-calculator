# Simple static file server for local testing
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8181
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$port/"

$mimeTypes = @{
  '.html' = 'text/html'
  '.css'  = 'text/css'
  '.js'   = 'application/javascript'
  '.json' = 'application/json'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
}

while ($listener.IsListening) {
  $ctx  = $listener.GetContext()
  $req  = $ctx.Request
  $resp = $ctx.Response

  $urlPath = $req.Url.AbsolutePath
  if ($urlPath -eq '/') { $urlPath = '/index.html' }
  $filePath = Join-Path $root $urlPath.TrimStart('/')

  if (Test-Path $filePath -PathType Leaf) {
    $ext     = [System.IO.Path]::GetExtension($filePath)
    $mime    = if ($mimeTypes[$ext]) { $mimeTypes[$ext] } else { 'application/octet-stream' }
    $bytes   = [System.IO.File]::ReadAllBytes($filePath)
    $resp.ContentType   = $mime
    $resp.ContentLength64 = $bytes.Length
    $resp.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $resp.StatusCode = 404
    $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
    $resp.OutputStream.Write($body, 0, $body.Length)
  }
  $resp.OutputStream.Close()
}
