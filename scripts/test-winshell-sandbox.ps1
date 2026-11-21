# Run ONLY in a disposable Windows Sandbox; host execution is rejected.
param([string]$InputDirectory='C:\PageHearthTestInput',[string]$EvidenceDirectory='C:\PageHearthTestEvidence')
$ErrorActionPreference='Stop'
if($env:USERNAME -ne 'WDAGUtilityAccount'){throw 'Disposable Windows Sandbox only'}
$install='C:\PageHearthWinShellTest'
if(Test-Path -LiteralPath $install){throw 'Fresh disposable location required'}
$results=@()
function RunInstaller($file){
 $p=Start-Process -FilePath $file -ArgumentList @('/S','/currentuser',"/D=$install") -PassThru
 if(-not $p.WaitForExit(180000)){Stop-Process -Id $p.Id;throw 'Installer timeout'}
 if($p.ExitCode -ne 0){throw "Installer exit $($p.ExitCode)"}
}
function CheckShortcut($file){
 if(-not(Test-Path -LiteralPath $file)){throw "Missing shortcut $file"}
 $shell=New-Object -ComObject Shell.Application
 $item=$shell.Namespace((Split-Path $file)).ParseName((Split-Path $file -Leaf))
 $id=$item.ExtendedProperty('System.AppUserModel.ID')
 if($id -ne 'com.pagehearth.desktop'){throw "Incorrect AppUserModelID: $id"}
 $ws=New-Object -ComObject WScript.Shell
 if($ws.CreateShortcut($file).TargetPath -ne "$install\PageHearth.exe"){throw 'Wrong shortcut target'}
}
try{
 New-Item -ItemType Directory -Force $EvidenceDirectory | Out-Null
 $canary=Join-Path $EvidenceDirectory 'outside-install-canary.txt'
 Set-Content -LiteralPath $canary -Value 'Synthetic manuscript preservation canary'
 $start=Join-Path ([Environment]::GetFolderPath('Programs')) 'PageHearth\PageHearth.lnk'
 $desktop=Join-Path ([Environment]::GetFolderPath('Desktop')) 'PageHearth.lnk'
 RunInstaller (Join-Path $InputDirectory 'accepted.exe')
 CheckShortcut $start; CheckShortcut $desktop
 $results+='Accepted baseline installed; shortcut targets/identity PASS'
 RunInstaller (Join-Path $InputDirectory 'replacement.exe')
 CheckShortcut $start; CheckShortcut $desktop
 $results+='Upgrade to replacement; shortcut targets/identity PASS'
 RunInstaller (Join-Path $InputDirectory 'replacement.exe')
 CheckShortcut $start; CheckShortcut $desktop
 $results+='Same-version reinstall PASS'
 $p=Start-Process -FilePath "$install\Uninstall PageHearth.exe" -ArgumentList '/S' -PassThru
 if(-not $p.WaitForExit(90000)){Stop-Process -Id $p.Id;throw 'Uninstaller timeout'}
 if($p.ExitCode -ne 0){throw "Uninstaller exit $($p.ExitCode)"}
 Start-Sleep -Seconds 2
 if((Test-Path $start) -or (Test-Path $desktop) -or (Test-Path "$install\PageHearth.exe")){throw 'Uninstall left application/shortcuts'}
 if((Get-Content $canary -Raw).Trim() -ne 'Synthetic manuscript preservation canary'){throw 'Canary changed'}
 $results+='Uninstall shortcuts/application removal and external canary PASS'
 $results | ConvertTo-Json | Set-Content (Join-Path $EvidenceDirectory 'results.json')
}catch{
 @{completed=$results;error=$_.ToString()} | ConvertTo-Json | Set-Content (Join-Path $EvidenceDirectory 'failure.json')
 throw
}
