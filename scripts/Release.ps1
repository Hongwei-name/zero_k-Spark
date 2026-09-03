[CmdletBinding()]
param(
  [ValidateSet('major', 'minor', 'patch')]
  [string]$Bump = 'patch'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $root 'tampermonkey/douyin-spark-helper.user.js'
$readmePath = Join-Path $root 'README.md'
$source = Get-Content -Raw $scriptPath
$match = [regex]::Match($source, '(?m)^// @version\s+(?<version>\d+\.\d+\.\d+)\s*$')
if (-not $match.Success) { throw 'Tampermonkey version metadata was not found.' }

$parts = $match.Groups['version'].Value.Split('.') | ForEach-Object { [int]$_ }
switch ($Bump) {
  'major' { $parts[0]++; $parts[1] = 0; $parts[2] = 0 }
  'minor' { $parts[1]++; $parts[2] = 0 }
  'patch' { $parts[2]++ }
}
$next = $parts -join '.'
$source = $source.Substring(0, $match.Groups['version'].Index) + $next + $source.Substring($match.Groups['version'].Index + $match.Groups['version'].Length)
Set-Content -NoNewline -Encoding utf8 $scriptPath $source

$readme = Get-Content -Raw $readmePath
$readme = [regex]::Replace($readme, '当前油猴脚本版本：`\d+\.\d+\.\d+`', ('当前油猴脚本版本：`' + $next + '`'))
Set-Content -NoNewline -Encoding utf8 $readmePath $readme

Write-Output "Updated Tampermonkey version to $next. Add changelog notes, commit, tag v$next, then push the branch and tag."
