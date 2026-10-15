# Headless screenshot + console log of a page (2D path only). Start tools/serve.ps1 first.
#   pwsh -NoProfile -File tools/shot.ps1 -Url "http://localhost:8796/?lesson=atom" -Out shot.png
# Console messages (errors included) are written next to the PNG as <Out>.log.
param([string]$Url, [string]$Out = 'shot.png', [int]$Budget = 8000, [string]$Size = '1600,900')
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$prof = Join-Path ([IO.Path]::GetTempPath()) ("stemlab-shot-" + [guid]::NewGuid())
$Out = [IO.Path]::GetFullPath($Out)
$log = "$Out.log"
$args = @('--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', "--user-data-dir=$prof",
  "--window-size=$Size", "--virtual-time-budget=$Budget", '--enable-logging=stderr', '--v=0', "--screenshot=$Out", $Url)
$p = Start-Process -FilePath $edge -ArgumentList $args -Wait -PassThru -RedirectStandardError $log -WindowStyle Hidden
Remove-Item -Recurse -Force $prof -ErrorAction SilentlyContinue
Select-String -Path $log -Pattern 'CONSOLE|Uncaught|Error' | ForEach-Object { $_.Line } | Select-Object -First 40
