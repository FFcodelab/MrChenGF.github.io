$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$url = 'http://127.0.0.1:4179/'
function Show-PublisherError([string]$Message) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show($Message, 'MrChenGF 笔记发布助手') | Out-Null
}
try {
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  $version = & $node --version
  if ([int]($version.TrimStart('v').Split('.')[0]) -lt 22) { throw '需要 Node.js 22 或更新版本。' }
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/gray-matter/package.json'))) {
    Push-Location -LiteralPath $projectRoot
    try { & npm.cmd ci --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw '首次安装依赖未完成，请联网后再次双击。' } } finally { Pop-Location }
  }
  $running = $false
  try { $health = Invoke-RestMethod -Uri ($url + 'api/health') -TimeoutSec 2; $running = $health.app -eq 'mrchengf-publisher-v1' } catch {}
  if (-not $running) {
    $server = Join-Path $PSScriptRoot 'publisher/server.mjs'
    $process = Start-Process -FilePath $node -ArgumentList @(('"' + $server + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
      Start-Sleep -Milliseconds 200
      try { $health = Invoke-RestMethod -Uri ($url + 'api/health') -TimeoutSec 1; if ($health.app -eq 'mrchengf-publisher-v1') { $running = $true; break } } catch {}
      if ($process.HasExited) { break }
    }
  }
  if (-not $running) { throw '发布助手未能启动，可能是端口 4179 已被其他程序占用。' }
  if (-not ($args -contains '-NoBrowser')) { Start-Process -FilePath $url }
} catch { Show-PublisherError $_.Exception.Message; exit 1 }
