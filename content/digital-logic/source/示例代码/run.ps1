param(
  [string]$Example = 'all',
  [string]$Iverilog = 'iverilog',
  [string]$Vvp = 'vvp'
)
$ErrorActionPreference = 'Stop'
$examplesRoot = $PSScriptRoot
$labs = @(Get-ChildItem -LiteralPath $examplesRoot -Directory | Where-Object { $_.Name -match '^\d{2}-' } | Sort-Object Name)
if ($Example -ne 'all') { $labs = @($labs | Where-Object { $_.Name -eq $Example }) }
if ($labs.Count -eq 0) { throw "Unknown example: $Example" }
foreach ($lab in $labs) {
  $labOutput = Join-Path $lab.FullName '.build'
  New-Item -ItemType Directory -Force -Path $labOutput | Out-Null
  $simFile = Join-Path $labOutput 'sim.vvp'
  Push-Location -LiteralPath $lab.FullName
  try {
    & $Iverilog -g2012 -s tb -o $simFile design.sv tb.sv
    if ($LASTEXITCODE -ne 0) { throw "Compile failed: $($lab.Name)" }
    & $Vvp $simFile
    if ($LASTEXITCODE -ne 0) { throw "Simulation failed: $($lab.Name)" }
  } finally { Pop-Location }
}
Write-Output "Completed $($labs.Count) examples."
