# Keeps Day Planner running on Windows: starts it now and every time you sign
# in, and restarts it if it stops. In PowerShell, from the day-planner folder:
#   powershell -ExecutionPolicy Bypass -File install\install-windows.ps1
# Remove with:
#   powershell -ExecutionPolicy Bypass -File install\install-windows.ps1 -Uninstall
param([switch]$Uninstall, [int]$Port = 4321)

$ErrorActionPreference = "Stop"
$TaskName = "DayPlanner"
$AppDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Launcher = Join-Path $AppDir "data\start-hidden.vbs"

if ($Uninstall) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  # Stop the launcher first so it doesn't restart the server.
  Get-CimInstance Win32_Process -Filter "Name = 'wscript.exe'" |
    Where-Object { $_.CommandLine -like "*start-hidden.vbs*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -like "*$AppDir*server.mjs*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Write-Host "Day Planner will no longer start automatically. Your data is still in $AppDir\data"
  exit 0
}

$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) {
  Write-Host "Node.js isn't installed. Get it from https://nodejs.org (LTS), then run this again." -ForegroundColor Red
  exit 1
}

Write-Host "Installing dependencies..."
Push-Location $AppDir
npm install --omit=dev --no-audit --no-fund
Pop-Location
New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "data") | Out-Null

# A tiny launcher that runs the server with no console window and restarts it
# if it exits.
$Log = Join-Path $AppDir "data\server.log"
@"
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$AppDir"
sh.Environment("PROCESS")("PORT") = "$Port"
Do
  sh.Run "cmd /c """"$Node"" ""$AppDir\server.mjs"" >> ""$Log"" 2>&1""", 0, True
  WScript.Sleep 3000
Loop
"@ | Set-Content -Path $Launcher -Encoding ASCII

$Action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$Launcher`"" -WorkingDirectory $AppDir
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Day Planner at http://localhost:$Port" -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Start-Sleep -Seconds 3
try {
  Invoke-WebRequest -UseBasicParsing "http://localhost:$Port/api/health" | Out-Null
  Write-Host "Day Planner is running at http://localhost:$Port and will start every time you sign in." -ForegroundColor Green
  Start-Process "http://localhost:$Port"
} catch {
  Write-Host "Installed, but it didn't answer yet. Check $Log"
}
