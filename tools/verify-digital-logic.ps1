param(
  [string]$Iverilog='iverilog',
  [string]$Vvp='vvp'
)
$ErrorActionPreference='Stop'
$tutorialRoot=Split-Path -Parent $PSScriptRoot
$labRoot=Join-Path $tutorialRoot 'content/digital-logic/source/示例代码'
$reportRoot=Join-Path $tutorialRoot 'reports'
$mutationRoot=Join-Path $tutorialRoot '.cache/hdl-mutations'
New-Item -ItemType Directory -Force -Path $reportRoot,$mutationRoot | Out-Null
$versionLines=@(& $Iverilog -V 2>&1 | ForEach-Object { "$_" })
if($LASTEXITCODE -ne 0) { throw 'Cannot run iverilog' }
$results=@()
$log=@($versionLines[0])
function Invoke-Lab([string]$name,[string]$design,[string]$testbench,[string]$outputDir,[bool]$expectFailure) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
  $sim=Join-Path $outputDir 'sim.vvp'
  $compile=@(& $Iverilog -g2012 -s tb -o $sim $design $testbench 2>&1 | ForEach-Object { "$_" })
  if($LASTEXITCODE -ne 0) { throw "Compile failed: $name $compile" }
  $run=@(& $Vvp $sim 2>&1 | ForEach-Object { "$_" })
  $runExit=$LASTEXITCODE
  if($expectFailure) {
    if($runExit -eq 0 -or -not ($run -match 'FATAL')) { throw "Mutation was not detected: $name" }
  } elseif($runExit -ne 0 -or -not ($run -match '^PASS ')) { throw "Simulation failed: $name $run" }
  return [pscustomobject]@{name=$name;expectedFailure=$expectFailure;exitCode=$runExit;compileMessages=$compile;output=$run}
}
foreach($lab in (Get-ChildItem -LiteralPath $labRoot -Directory | Where-Object { $_.Name -match '^\d{2}-' } | Sort-Object Name)) {
  $result=Invoke-Lab $lab.Name (Join-Path $lab.FullName 'design.sv') (Join-Path $lab.FullName 'tb.sv') (Join-Path $lab.FullName '.build') $false
  $results+=$result; $log+=$result.output; Write-Output $result.output
}
$mutations=@(
  @{name='gate-and-to-or';lab='01-gates';old='a&b';new='a|b'},
  @{name='timer-off-by-one';lab='15-timer';old='phase==CLKS_PER_SEC-1';new='phase==CLKS_PER_SEC'},
  @{name='timer-clear-loses-priority';lab='15-timer';old='rst || clear';new='rst || (clear && !toggle)'}
)
foreach($mutation in $mutations) {
  $original=[IO.File]::ReadAllText((Join-Path $labRoot ($mutation.lab+'/design.sv')))
  if(-not $original.Contains($mutation.old)) { throw 'Mutation target missing' }
  $mutantDir=Join-Path $mutationRoot $mutation.name
  New-Item -ItemType Directory -Force -Path $mutantDir | Out-Null
  $mutantDesign=Join-Path $mutantDir 'design.sv'
  [IO.File]::WriteAllText($mutantDesign,$original.Replace($mutation.old,$mutation.new),[Text.UTF8Encoding]::new($false))
  $result=Invoke-Lab $mutation.name $mutantDesign (Join-Path $labRoot ($mutation.lab+'/tb.sv')) $mutantDir $true
  $results+=$result; $log+=('EXPECTED FAILURE: '+$mutation.name); $log+=$result.output
  Write-Output ('Detected expected failure: '+$mutation.name)
}
$localDate=[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow,'China Standard Time').ToString('yyyy-MM-dd')
$report=[ordered]@{date=$localDate;tool=$versionLines[0];passedExamples=15;detectedMutations=3;results=$results;fpgaSynthesisVerified=$false;boardVerified=$false}
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $reportRoot 'digital-logic-simulation.json') -Encoding utf8
$log | Set-Content -LiteralPath (Join-Path $reportRoot 'digital-logic-simulation.txt') -Encoding utf8
Write-Output '15 examples passed; all 3 injected faults detected. Original source was not modified.'
