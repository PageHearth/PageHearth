; SPDX-License-Identifier: MPL-2.0
; Windows shell operations for the pinned builder templates. No third-party DLL.
!ifndef PAGEHEARTH_SHELL_INCLUDED
!define PAGEHEARTH_SHELL_INCLUDED
!include "Win\COM.nsh"
!include "Win\Propkey.nsh"

!macro PH_ShellBegin
  System::Store S
  System::Call 'ole32::CoInitializeEx(p 0, i 2)i.r9'
!macroend
!macro PH_ShellEnd
  ${If} $9 >= 0
    System::Call 'ole32::CoUninitialize()'
  ${EndIf}
  System::Store L
!macroend

!macro PH_SetLnkAUMI link appId
  !insertmacro PH_ShellBegin
  !insertmacro ComHlpr_CreateInProcInstance ${CLSID_ShellLink} ${IID_IShellLink} r0 ""
  ${If} $0 P<> 0
    StrCpy $1 0
    ${IUnknown::QueryInterface} $0 '("${IID_IPersistFile}",.r1)'
    ${If} $1 P<> 0
      ${IPersistFile::Load} $1 '("${link}",2).r6'
      ${If} $6 >= 0
        StrCpy $2 0
        ${IUnknown::QueryInterface} $0 '("${IID_IPropertyStore}",.r2)'
        ${If} $2 P<> 0
          System::Call '*${SYSSTRUCT_PROPERTYKEY}(${PKEY_AppUserModel_ID})p.r3'
          ; This installer is x86 Unicode. A VT_LPWSTR PROPVARIANT has an
          ; eight-byte header followed by the string pointer and union padding.
          System::Call '*(&w${NSIS_MAX_STRLEN} "${appId}")p.r5'
          System::Call '*(&i2 ${VT_LPWSTR}, &i6 0, p r5, &i4 0)p.r4'
          ${If} $4 P<> 0
          ${AndIf} $5 P<> 0
            ${IPropertyStore::SetValue} $2 '($3,$4).r6'
            ${If} $6 >= 0
              ${IPropertyStore::Commit} $2 '().r6'
              ${If} $6 >= 0
                ${IPersistFile::Save} $1 '("${link}",1).r6'
              ${EndIf}
            ${EndIf}
          ${EndIf}
          System::Free $4
          System::Free $5
          System::Free $3
          ${IUnknown::Release} $2 ""
        ${EndIf}
      ${EndIf}
      ${IUnknown::Release} $1 ""
    ${EndIf}
    ${IUnknown::Release} $0 ""
  ${EndIf}
  !insertmacro PH_ShellEnd
!macroend

!macro PH_UninstShortcut link
  !insertmacro PH_ShellBegin
  ; IStartMenuPinnedList::RemoveFromList, same operation as WinShell.
  !insertmacro ComHlpr_CreateInProcInstance {A2A9545D-A0C2-42B4-9708-A0B2BADD77C8} ${IID_IStartMenuPinnedList} r0 ""
  ${If} $0 P<> 0
    StrCpy $1 0
    System::Call 'shell32::SHCreateItemFromParsingName(w "${link}",p 0,g "${IID_IShellItem}",*p .r1)i.r6'
    ${If} $1 P<> 0
      ${IStartMenuPinnedList::RemoveFromList} $0 '($1).r6'
      ${IUnknown::Release} $1 ""
    ${EndIf}
    ${IUnknown::Release} $0 ""
  ${EndIf}
  !insertmacro PH_ShellEnd
!macroend

!macro PH_UninstAppUserModelId appId
  !insertmacro PH_ShellBegin
  ; ICustomDestinationList::DeleteList (slot 10).
  !insertmacro ComHlpr_CreateInProcInstance {77F10CF0-3DB5-4966-B520-B7C54FD35ED6} {6332DEBF-87B5-4670-90C0-5E57B408A49E} r0 ""
  ${If} $0 P<> 0
    System::Call '$0->10(w "${appId}")i.r6'
    ${IUnknown::Release} $0 ""
  ${EndIf}
  ; IApplicationDestinations::SetAppID / RemoveAllDestinations (slots 3 / 5).
  !insertmacro ComHlpr_CreateInProcInstance {86C14003-4D6B-4EF3-A7B4-0506663B2E68} {12337D35-94C6-48A0-BCE7-6A9C69D4D600} r0 ""
  ${If} $0 P<> 0
    System::Call '$0->3(w "${appId}")i.r6'
    ${If} $6 >= 0
      System::Call '$0->5()i.r6'
    ${EndIf}
    ${IUnknown::Release} $0 ""
  ${EndIf}
  !insertmacro PH_ShellEnd
!macroend
!endif
