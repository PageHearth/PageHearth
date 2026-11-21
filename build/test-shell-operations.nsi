Unicode true
RequestExecutionLevel user
SilentInstall silent
!include LogicLib.nsh
!include pagehearth-shell.nsh
OutFile "..\.acceptance\winshell-replacement\shell-test.exe"
Section
  SetOutPath "$EXEDIR"
  CreateShortCut "$EXEDIR\synthetic-shell-test.lnk" "$SYSDIR\cmd.exe" "/c exit 0" "$SYSDIR\cmd.exe" 0 "" "" "Synthetic shell test"
  StrCpy $0 "register-sentinel"
  !insertmacro PH_SetLnkAUMI "$EXEDIR\synthetic-shell-test.lnk" "PageHearth.Disposable.WinShellReplacement.Test"
  StrCmp $0 "register-sentinel" +2
    SetErrorLevel 41
  !insertmacro PH_UninstShortcut "$EXEDIR\synthetic-shell-test.lnk"
  !insertmacro PH_UninstAppUserModelId "PageHearth.Disposable.WinShellReplacement.Test"
SectionEnd
