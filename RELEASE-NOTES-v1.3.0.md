# MD Отчёты 1.3.0

Добавлена кроссплатформенная сборка через GitHub Actions.

## Новое

- Windows остаётся основным клиентским релизом: `MD-Reports-Setup-1.3.0.exe`;
- добавлена Linux-сборка:
  - `AppImage`;
  - `.deb`;
- добавлена macOS-сборка:
  - `.dmg`;
  - `.zip`;
- добавлен workflow `.github/workflows/release.yml`;
- релизные артефакты для Windows, Linux и macOS собираются автоматически при публикации тега `v*`;
- локальные команды сборки разделены на `build:win`, `build:linux` и `build:mac`.

## Важно

- Windows setup регистрирует `.md`, `.markdown` и `.txt`.
- Linux-пакеты публикуются как обычные неподписанные desktop-сборки.
- macOS-сборки пока unsigned и не notarized. Для нормального клиентского macOS-релиза понадобится Apple Developer ID и notarization.

## Что скачать

- **Windows:** `MD-Reports-Setup-1.3.0.exe`;
- **Linux:** `MD-Reports-1.3.0-Linux-x64.AppImage` или `MD-Reports-1.3.0-Linux-x64.deb`;
- **macOS:** `MD-Reports-1.3.0-macOS-x64.dmg` / `arm64.dmg` или `.zip`.
