#define MyAppName "MD Reports"
#define MyAppVersion "1.0.1"
#define MyAppPublisher "MD Reports"
#define MyAppExeName "MD-Reports.exe"
#define MyAppId "{{7C9A6E65-B5B6-4A4B-A43D-786A5A6B0E51}"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\MD Reports
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=output
OutputBaseFilename=MD-Reports-Setup-1.0.1
SetupIconFile=..\MDReports.Wpf\Resources\app.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
ChangesAssociations=yes

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[Tasks]
Name: "desktopicon"; Description: "Создать ярлык на рабочем столе"; GroupDescription: "Ярлыки:"; Flags: checkedonce
Name: "associate"; Description: "Открывать файлы .md и .markdown в MD Reports"; GroupDescription: "Файлы Markdown:"; Flags: checkedonce

[Files]
Source: "app\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "redist\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Classes\MDReports.Markdown"; ValueType: string; ValueName: ""; ValueData: "Markdown-документ"; Flags: uninsdeletekey; Tasks: associate
Root: HKCU; Subkey: "Software\Classes\MDReports.Markdown\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"",0"; Tasks: associate
Root: HKCU; Subkey: "Software\Classes\MDReports.Markdown\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: associate
Root: HKCU; Subkey: "Software\Classes\.md"; ValueType: string; ValueName: ""; ValueData: "MDReports.Markdown"; Tasks: associate
Root: HKCU; Subkey: "Software\Classes\.md\OpenWithProgids"; ValueType: none; ValueName: "MDReports.Markdown"; Tasks: associate
Root: HKCU; Subkey: "Software\Classes\.markdown"; ValueType: string; ValueName: ""; ValueData: "MDReports.Markdown"; Tasks: associate
Root: HKCU; Subkey: "Software\Classes\.markdown\OpenWithProgids"; ValueType: none; ValueName: "MDReports.Markdown"; Tasks: associate

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Проверка компонента просмотра документов..."; Flags: runhidden waituntilterminated; Check: not IsWebView2Installed
Filename: "{app}\{#MyAppExeName}"; Description: "Открыть {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\{#MyAppExeName}.WebView2"

[Code]
const
  WebViewClient = 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

function HasWebViewVersion(RootKey: Integer; const SubKey: String): Boolean;
var
  Version: String;
begin
  Result :=
    RegQueryStringValue(RootKey, SubKey, 'pv', Version) and
    (Version <> '') and
    (Version <> '0.0.0.0');
end;

function IsWebView2Installed: Boolean;
begin
  Result :=
    HasWebViewVersion(HKLM32, WebViewClient) or
    HasWebViewVersion(HKCU, WebViewClient);
end;
