!macro customInit
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{7C9A6E65-B5B6-4A4B-A43D-786A5A6B0E51}_is1" "UninstallString"
  ${If} $0 != ""
    DetailPrint "Removing old MD Reports installation..."
    ExecWait '$0 /VERYSILENT /SUPPRESSMSGBOXES /NORESTART'
  ${EndIf}
!macroend
