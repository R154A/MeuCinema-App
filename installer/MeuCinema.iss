; ==========================================================
;  MEU CINEMA - instalador (Inno Setup 6)
;  Gera:  installer\Output\MeuCinemaSetup.exe
;  Normalmente você NÃO precisa abrir este arquivo:
;  basta dar dois cliques em  criar_instalador.bat
; ==========================================================
#define AppName    "Meu Cinema"
#define AppVersion "2.2.0"
#define AppExe     "MeuCinema.exe"

[Setup]
AppId={{57124E3D-6FA9-463C-9B40-63A0EF2AA1EB}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppName}
VersionInfoVersion={#AppVersion}

; instala só para o usuário atual: não pede senha de administrador
PrivilegesRequired=lowest
DefaultDirName={autopf}\{#AppName}
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
UsePreviousAppDir=yes

; aparência moderna
WizardStyle=modern
WizardImageFile=wizard_big.bmp
WizardSmallImageFile=wizard_small.bmp
SetupIconFile=..\icon.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}

; um único arquivo de instalação, bem compactado
OutputDir=Output
OutputBaseFilename=MeuCinemaSetup
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no

[Languages]
#if FileExists(CompilerPath + "Languages\BrazilianPortuguese.isl")
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
#else
Name: "english"; MessagesFile: "compiler:Default.isl"
#endif

[Messages]
WelcomeLabel1=Bem-vindo ao Meu Cinema
WelcomeLabel2=Este assistente vai instalar o [name] no seu computador.%n%nSeu cinema pessoal: filmes, séries, listas e estatísticas só para você.%n%nClique em Avançar para continuar.

[Tasks]
Name: "desktopicon"; Description: "Criar um atalho na Área de Trabalho"

[Files]
; o app (já com Python e bibliotecas embutidos)
Source: "..\dist\MeuCinema\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
; componente de exibição da Microsoft - só é copiado/instalado se o computador não tiver
Source: "MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Check: NeedsWebView2

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Instalando componente de exibição (WebView2)..."; Flags: waituntilterminated; Check: NeedsWebView2
Filename: "{app}\{#AppExe}"; Description: "Abrir o {#AppName} agora"; Flags: nowait postinstall skipifsilent

[Code]
const
  WebView2Key = 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

function HasWebView2Version(Root: Integer; const Key: String): Boolean;
var
  V: String;
begin
  Result := RegQueryStringValue(Root, Key, 'pv', V) and (V <> '') and (V <> '0.0.0.0');
end;

function NeedsWebView2: Boolean;
begin
  Result := not (HasWebView2Version(HKLM32, WebView2Key)
              or HasWebView2Version(HKLM64, WebView2Key)
              or HasWebView2Version(HKCU, WebView2Key));
end;

{ Ao desinstalar, pergunta se quer apagar também os dados pessoais }
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if (CurUninstallStep = usPostUninstall) and (not UninstallSilent) then
    if MsgBox('Deseja apagar também seus dados (biblioteca, listas, resenhas e perfil)?' + #13#10 +
              'Se escolher "Não", eles continuam salvos caso você reinstale o app.',
              mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
      DelTree(ExpandConstant('{userappdata}\MeuCinema'), True, True, True);
end;
