# MD Отчёты Compact

Компактная Windows-версия просмотрщика Markdown-отчётов на C# WPF + WebView2.

## Возможности

- просмотр, редактирование и разделённый режим;
- открытие `.md`, `.markdown` и `.txt`;
- drag-and-drop и список недавних документов;
- сохранение Markdown в UTF-8;
- прямой экспорт оформленного отчёта в PDF;
- печать через системное окно;
- светлая и тёмная темы;
- кнопка регистрации приложения для `.md` и `.markdown` текущего пользователя Windows.

## Требования

- Windows 10 или Windows 11 x64;
- Microsoft .NET Desktop Runtime 8 x64;
- Microsoft Edge WebView2 Runtime.

## Сборка

Из корня репозитория:

```powershell
.\.dotnet\dotnet.exe publish .\compact-wpf\MDReports.Wpf\MDReports.Wpf.csproj `
  -c Release -r win-x64 --self-contained false `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  -o .\compact-wpf\release
```

## Автоматическая проверка PDF

```powershell
.\compact-wpf\release\MD-Reports-Compact.exe .\report.md `
  --smoke-pdf .\compact-wpf\release\smoke-report.pdf
```

Успешное завершение возвращает код `0`.
