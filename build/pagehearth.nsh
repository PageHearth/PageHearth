; Keep the shell command valid when the installation directory contains spaces.
; Notify Explorer after all association values have been installed.
!include nsDialogs.nsh
!include pagehearth-experience.nsh
!ifndef BUILD_UNINSTALLER
Var PageHearthDesktopChoice
Var PageHearthDesktopCheckbox
!endif
!macro customPageAfterChangeDir
  Page custom PageHearthShortcutPage PageHearthShortcutLeave
  Function PageHearthShortcutPage
    !insertmacro MUI_HEADER_TEXT "Shortcuts" "Choose how to launch PageHearth."
    nsDialogs::Create 1018
    Pop $0
    ${NSD_CreateCheckbox} 0 20u 100% 14u "Create Desktop Shortcut"
    Pop $PageHearthDesktopCheckbox
    ${If} $PageHearthDesktopChoice == ""
      StrCpy $PageHearthDesktopChoice ${BST_CHECKED}
    ${EndIf}
    ${NSD_SetState} $PageHearthDesktopCheckbox $PageHearthDesktopChoice
    nsDialogs::Show
  FunctionEnd
  Function PageHearthShortcutLeave
    ${NSD_GetState} $PageHearthDesktopCheckbox $PageHearthDesktopChoice
  FunctionEnd
!macroend
!macro customInstall
  !insertmacro PageHearthInstallDocumentationShortcuts
  ${If} $PageHearthDesktopChoice == ${BST_UNCHECKED}
    ; Builder creates this install's shortcut before customInstall runs.
    Delete "$newDesktopLink"
  ${EndIf}
  WriteRegStr SHELL_CONTEXT "Software\Classes\PageHearth.Project\DefaultIcon" "" '$\"$INSTDIR\resources\PageHearth_File_Icon.ico$\",0'
  WriteRegStr SHELL_CONTEXT "Software\Classes\PageHearth.Project\shell\open\command" "" '$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\"'
  ; Explicit application identity for the Windows Open With chooser.
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}" "FriendlyAppName" "PageHearth"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\SupportedTypes" ".pagehearth" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\DefaultIcon" "" '$\"$INSTDIR\resources\branding\PageHearth_App_Icon.ico$\",0'
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\shell\open\command" "" '$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\"'
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x1000, p 0, p 0)'
!macroend

; Builder removes the ProgID but leaves the extension's default value behind.
; Remove only our own dangling default, never another application's choice.
!macro customUnInstallSection
Section "un.Remove PageHearth file associations"
  SectionIn RO
  ReadRegStr $0 SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\shell\open\command" ""
  ${If} $0 == '$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\"'
    DeleteRegKey SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}"
  ${EndIf}
  ReadRegStr $0 SHELL_CONTEXT "Software\Classes\.pagehearth" ""
  ${If} $0 == "PageHearth.Project"
    DeleteRegValue SHELL_CONTEXT "Software\Classes\.pagehearth" ""
    DeleteRegKey /ifempty SHELL_CONTEXT "Software\Classes\.pagehearth\OpenWithProgids"
    DeleteRegKey /ifempty SHELL_CONTEXT "Software\Classes\.pagehearth"
  ${EndIf}
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x1000, p 0, p 0)'
SectionEnd
!macroend
