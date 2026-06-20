const { app, BrowserWindow, clipboard, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { createZip } = require('./zip');

const isMarkdown = (filePath) => typeof filePath === 'string' && /\.(md|markdown|txt)$/i.test(filePath);
const state = { mainWindow: null, pendingFile: null };

function recentFilePath() {
  return path.join(app.getPath('userData'), 'recent-files.json');
}

function readRecentFiles() {
  try {
    const files = JSON.parse(fs.readFileSync(recentFilePath(), 'utf8'));
    return Array.isArray(files) ? files.filter((file) => fs.existsSync(file)).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function writeRecentFiles(files) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(recentFilePath(), JSON.stringify(files.slice(0, 8), null, 2), 'utf8');
  return files.slice(0, 8);
}

function addRecentFile(filePath) {
  const files = [filePath, ...readRecentFiles().filter((file) => file !== filePath)].slice(0, 8);
  return writeRecentFiles(files);
}

function validMarkdownFiles(filePaths) {
  if (!Array.isArray(filePaths)) return [];
  return filePaths.filter((filePath) => isMarkdown(filePath) && fs.existsSync(filePath));
}

async function printHtml(html) {
  const printWindow = new BrowserWindow({
    show: false,
    parent: state.mainWindow,
    webPreferences: { sandbox: true, contextIsolation: true }
  });
  const page = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 16mm; }
    body { margin: 0; color: #172033; font: 14px/1.6 "Segoe UI", Arial, sans-serif; }
    .print-document { break-after: page; }
    .print-document:last-child { break-after: auto; }
    .print-source { margin-bottom: 20px; padding-bottom: 8px; border-bottom: 1px solid #d8dee8; color: #667085; font-size: 11px; }
    h1, h2, h3 { line-height: 1.25; } h2 { margin-top: 28px; border-bottom: 1px solid #d8dee8; }
    table { width: 100%; border-collapse: collapse; } th, td { padding: 7px 9px; border: 1px solid #d8dee8; text-align: left; }
    pre { overflow: hidden; padding: 14px; background: #f3f5f8; white-space: pre-wrap; }
    code { font-family: Consolas, monospace; } img { max-width: 100%; }
  </style></head><body>${html}</body></html>`;
  await printWindow.loadURL(`data:text/html;base64,${Buffer.from(page).toString('base64')}`);
  return new Promise((resolve, reject) => {
    printWindow.webContents.print({ printBackground: true }, (success, failureReason) => {
      printWindow.close();
      if (success) resolve(true);
      else reject(new Error(failureReason || 'Не удалось распечатать документы.'));
    });
  });
}

function sendFile(filePath) {
  if (!state.mainWindow || !isMarkdown(filePath) || !fs.existsSync(filePath)) return;
  state.mainWindow.webContents.send('file:open-path', filePath);
}

function createWindow() {
  state.mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 640,
    title: 'MD Отчёты',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    backgroundColor: '#f4f6f8',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  state.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  state.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  state.mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });
  state.mainWindow.webContents.once('did-finish-load', () => {
    if (state.pendingFile) {
      sendFile(state.pendingFile);
      state.pendingFile = null;
    }
  });
  state.mainWindow.on('closed', () => {
    state.mainWindow = null;
  });
}

function initialMarkdownFromArgs(args) {
  return args.find((arg) => isMarkdown(arg) && fs.existsSync(arg)) || null;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = initialMarkdownFromArgs(argv);
    if (filePath) sendFile(filePath);
    if (state.mainWindow) {
      if (state.mainWindow.isMinimized()) state.mainWindow.restore();
      state.mainWindow.focus();
    }
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (state.mainWindow) sendFile(filePath);
    else state.pendingFile = filePath;
  });

  app.whenReady().then(() => {
    state.pendingFile = initialMarkdownFromArgs(process.argv);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('dialog:open', async () => {
  const result = await dialog.showOpenDialog(state.mainWindow, {
    title: 'Открыть Markdown-отчёт',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown и текст', extensions: ['md', 'markdown', 'txt'] },
      { name: 'Все файлы', extensions: ['*'] }
    ]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:save-as', async (_event, suggestedName) => {
  const result = await dialog.showSaveDialog(state.mainWindow, {
    title: 'Сохранить Markdown-отчёт',
    defaultPath: suggestedName || 'report.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('file:export-pdf', async (_event, suggestedName) => {
  const result = await dialog.showSaveDialog(state.mainWindow, {
    title: 'Экспортировать отчёт в PDF',
    defaultPath: suggestedName || 'report.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) return null;
  const pdf = await state.mainWindow.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { marginType: 'default' }
  });
  await fs.promises.writeFile(result.filePath, pdf);
  return result.filePath;
});

ipcMain.handle('file:read', async (_event, filePath) => {
  if (!isMarkdown(filePath)) throw new Error('Можно открывать только Markdown или текстовые файлы.');
  const content = await fs.promises.readFile(filePath, 'utf8');
  return { filePath, content, recent: addRecentFile(filePath) };
});

ipcMain.handle('file:write', async (_event, filePath, content) => {
  if (!isMarkdown(filePath)) throw new Error('Файл должен иметь расширение .md, .markdown или .txt.');
  await fs.promises.writeFile(filePath, content, 'utf8');
  return { filePath, recent: addRecentFile(filePath) };
});

ipcMain.handle('recent:list', () => readRecentFiles());
ipcMain.handle('recent:remove', (_event, filePaths) => {
  const selected = new Set(Array.isArray(filePaths) ? filePaths : []);
  return writeRecentFiles(readRecentFiles().filter((filePath) => !selected.has(filePath)));
});
ipcMain.handle('files:read-many', async (_event, filePaths) => Promise.all(validMarkdownFiles(filePaths).map(async (filePath) => ({
  filePath,
  name: path.basename(filePath),
  content: await fs.promises.readFile(filePath, 'utf8')
}))));
ipcMain.handle('files:export-zip', async (_event, filePaths) => {
  const files = validMarkdownFiles(filePaths);
  if (!files.length) throw new Error('Нет документов для экспорта.');
  const result = await dialog.showSaveDialog(state.mainWindow, {
    title: 'Сохранить выбранные отчёты в ZIP',
    defaultPath: 'MD-Reports.zip',
    filters: [{ name: 'ZIP-архив', extensions: ['zip'] }]
  });
  if (result.canceled || !result.filePath) return null;
  await fs.promises.writeFile(result.filePath, createZip(files));
  return result.filePath;
});
ipcMain.handle('window:print-html', (_event, html) => {
  if (typeof html !== 'string' || html.length > 20_000_000) throw new Error('Некорректные данные для печати.');
  return printHtml(html);
});
ipcMain.handle('link:open-external', (_event, url) => {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw new Error('Разрешены только веб-ссылки http/https.');
  return shell.openExternal(url);
});
ipcMain.handle('clipboard:write', (_event, text) => {
  clipboard.writeText(String(text));
  return true;
});
ipcMain.handle('window:print', () => state.mainWindow.webContents.print({ printBackground: true }));
