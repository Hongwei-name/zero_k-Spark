[CmdletBinding()]
param(
  [string]$Python = 'python'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  & $Python -m PyInstaller --noconfirm --clean --onefile --windowed --name SparkHelperClient --paths $root apps/desktop/main.py
  if ($LASTEXITCODE -ne 0) { throw "PyInstaller exited with code $LASTEXITCODE." }
  Write-Output "Created $root\dist\SparkHelperClient.exe"
}
finally {
  Pop-Location
}
