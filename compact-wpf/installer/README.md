# Установщик MD Отчёты Compact

Обычный Windows-установщик на Inno Setup.

## Что получает клиент

- единый `MD-Reports-Compact-Setup-1.0.0.exe`;
- мастер установки с выбором папки;
- ярлык в меню «Пуск»;
- опциональный ярлык на рабочем столе;
- опциональную привязку `.md` и `.markdown`;
- предложение открыть программу после установки.

Программа публикуется как self-contained .NET 8: отдельно устанавливать .NET клиенту не нужно.

Установщик содержит официальный WebView2 Evergreen Bootstrapper Microsoft. Если WebView2 Runtime отсутствует, bootstrapper устанавливает его автоматически в тихом режиме. Для первичной установки WebView2 требуется доступ в интернет.

## Сборка

```powershell
.\.dotnet\dotnet.exe publish .\compact-wpf\MDReports.Wpf\MDReports.Wpf.csproj `
  -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  -p:EnableCompressionInSingleFile=true `
  -o .\compact-wpf\installer\app

& "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" `
  .\compact-wpf\installer\MD-Reports-Setup.iss
```
