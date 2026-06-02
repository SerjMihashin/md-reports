const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

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

function addRecentFile(filePath) {
  const files = [filePath, ...readRecentFiles().filter((file) => file !== filePath)].slice(0, 8);
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(recentFilePath(), JSON.stringify(files, null, 2), 'utf8');
  return files;
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
ipcMain.handle('window:print', () => state.mainWindow.webContents.print({ printBackground: true }));
