# MD Отчёты 1.3.1

Исправленный кроссплатформенный релиз.

## Новое

- Windows остаётся основным клиентским релизом: `MD-Reports-Setup-1.3.1.exe`;
- добавлена Linux-сборка:
  - `AppImage`;
  - `.deb`;
- добавлена macOS-сборка:
  - `.dmg`;
  - `.zip`;
- релизные артефакты для Windows, Linux и macOS собираются через GitHub Actions;
- локальные команды сборки разделены на `build:win`, `build:linux` и `build:mac`.

## Исправлено после 1.3.0

- отключена встроенная публикация `electron-builder`, чтобы публикацией управлял отдельный GitHub Actions job;
- Linux file associations разделены по одному расширению на запись, чтобы AppImage собирался корректно;
- CI переведён на Node.js 24;
- macOS-сборка явно запрашивает x64 и arm64.

## Важно

- Windows setup регистрирует `.md`, `.markdown` и `.txt`.
- Linux-пакеты публикуются как обычные неподписанные desktop-сборки.
- macOS-сборки пока unsigned и не notarized. Для нормального клиентского macOS-релиза понадобится Apple Developer ID и notarization.

## Что скачать

- **Windows:** `MD-Reports-Setup-1.3.1.exe`;
- **Linux:** `AppImage` или `.deb` из assets релиза;
- **macOS:** `.dmg` или `.zip` для нужной архитектуры.
