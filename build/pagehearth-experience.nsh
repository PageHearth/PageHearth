; Standard Modern UI pages; Windows keeps ownership of buttons and native chrome.
!define MUI_BGCOLOR "FFF8E9"
!define MUI_TEXTCOLOR "302C29"
!define MUI_HEADER_TRANSPARENT_TEXT

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to PageHearth"
  !define MUI_WELCOMEPAGE_TEXT "A place for your next book.$\r$\n$\r$\nThis wizard installs PageHearth and its offline guides on your computer.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Uninstall PageHearth"
  !define MUI_WELCOMEPAGE_TEXT "This wizard removes PageHearth and its installed guides.$\r$\n$\r$\nYour project folders are not removed."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend

!macro customFinishPage
  Var PageHearthGuidePath
  Var PageHearthGuidePathLabel
  Function PageHearthStartApp
    IfSilent done
    ${If} ${isUpdated}
      StrCpy $1 "--updated"
    ${Else}
      StrCpy $1 ""
    ${EndIf}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    done:
  FunctionEnd

  Function PageHearthOpenGuide
    IfSilent done
    IfFileExists "$INSTDIR\resources\documentation\PageHearth_Quick_Start_Guide.pdf" 0 unavailable
    ; Match Builder's normal-user launch mechanism; never fall back to elevated ExecShell.
    ${StdUtils.ExecShellAsUser} $0 "$INSTDIR\resources\documentation\PageHearth_Quick_Start_Guide.pdf" "open" ""
    StrCmp $0 "ok" done
    StrCmp $0 "fallback" done
    unavailable:
      MessageBox MB_OK|MB_ICONINFORMATION "PageHearth was installed successfully. The guide could not be opened automatically. Choose a default PDF application, then use PageHearth Quick Start Guide in your Start menu.$\r$\n$\r$\nDocumentation folder:$\r$\n$INSTDIR\resources\documentation"
    done:
    ClearErrors
    SetErrorLevel 0
  FunctionEnd

  Function PageHearthOpenDocumentationFolder
    Pop $0
    IfSilent done
    ${StdUtils.ExecShellAsUser} $0 "$INSTDIR\resources\documentation" "open" ""
    done:
    ClearErrors
  FunctionEnd

  !define MUI_FINISHPAGE_TITLE "PageHearth is ready"
  !define MUI_FINISHPAGE_TEXT "Your guides are available anytime in the PageHearth folder in your Start menu."
  !define MUI_FINISHPAGE_TEXT_LARGE
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "Run PageHearth"
  !define MUI_FINISHPAGE_RUN_FUNCTION PageHearthStartApp
  !define MUI_FINISHPAGE_SHOWREADME
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Open the Quick Start Guide now"
  !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION PageHearthOpenGuide
  !define MUI_FINISHPAGE_LINK "Open installed documentation folder"
  !define MUI_FINISHPAGE_LINK_LOCATION "$INSTDIR\resources\documentation"
  !define MUI_FINISHPAGE_LINK_COLOR "8D4829"
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW PageHearthFinishShow
  !insertmacro MUI_PAGE_FINISH

  Function PageHearthFinishShow
    ; Use a normal-user shell launch for the optional folder link too.
    ${NSD_OnClick} $mui.FinishPage.Link PageHearthOpenDocumentationFolder
    ; Dialog units scale with the native dialog font/DPI. Keep this within the
    ; reserved finish-text area, above the unchanged checkboxes at 110u/130u.
    ${IfNot} ${RebootFlag}
      ; The stock 60u label would paint over the path field. Replace it with
      ; a shorter label while retaining MUI's checkbox spacing calculations.
      ${NSD_GetText} $mui.FinishPage.Text $0
      ShowWindow $mui.FinishPage.Text ${SW_HIDE}
      ${NSD_CreateLabel} 120u 45u 195u 22u "$0"
      Pop $mui.FinishPage.Text
      SetCtlColors $mui.FinishPage.Text "${MUI_TEXTCOLOR}" "${MUI_BGCOLOR}"
      ${NSD_CreateLabel} 120u 68u 195u 10u "&Quick Start Guide:"
      Pop $PageHearthGuidePathLabel
      SetCtlColors $PageHearthGuidePathLabel "${MUI_TEXTCOLOR}" "${MUI_BGCOLOR}"
      ; Wrapping, scrollable read-only text: long custom paths stay accessible
      ; and can be selected/copied without changing the actual installed path.
      nsDialogs::CreateControl "EDIT" ${WS_CHILD}|${WS_VISIBLE}|${WS_TABSTOP}|${WS_VSCROLL}|${ES_MULTILINE}|${ES_AUTOVSCROLL}|${ES_READONLY} ${WS_EX_CLIENTEDGE} 120u 79u 195u 29u "$INSTDIR\resources\documentation\PageHearth_Quick_Start_Guide.pdf"
      Pop $PageHearthGuidePath
      SetCtlColors $PageHearthGuidePath "${MUI_TEXTCOLOR}" "${MUI_BGCOLOR}"
    ${EndIf}
  FunctionEnd

!macroend

!macro PageHearthInstallDocumentationShortcuts
  CreateDirectory "$SMPROGRAMS\PageHearth"
  CreateShortCut "$SMPROGRAMS\PageHearth\PageHearth Quick Start Guide.lnk" "$INSTDIR\resources\documentation\PageHearth_Quick_Start_Guide.pdf" "" "$INSTDIR\resources\branding\PageHearth_App_Icon.ico" 0
  CreateShortCut "$SMPROGRAMS\PageHearth\PageHearth User Guide.lnk" "$INSTDIR\resources\documentation\user-guide\index.html" "" "$INSTDIR\resources\branding\PageHearth_App_Icon.ico" 0
!macroend

!macro customUnInstall
  ; Remove only our two explicit shortcuts. Builder owns the application shortcut.
  Delete "$SMPROGRAMS\PageHearth\PageHearth Quick Start Guide.lnk"
  Delete "$SMPROGRAMS\PageHearth\PageHearth User Guide.lnk"
  RMDir "$SMPROGRAMS\PageHearth"
!macroend
