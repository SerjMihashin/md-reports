const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('mdReports', {
  chooseFile: () => ipcRenderer.invoke('dialog:open'),
  chooseSavePath: (suggestedName) => ipcRenderer.invoke('dialog:save-as', suggestedName),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('file:write', filePath, content),
  exportPdf: (suggestedName) => ipcRenderer.invoke('file:export-pdf', suggestedName),
  listRecent: () => ipcRenderer.invoke('recent:list'),
  print: () => ipcRenderer.invoke('window:print'),
  droppedFilePath: (file) => webUtils.getPathForFile(file),
  onOpenPath: (callback) => ipcRenderer.on('file:open-path', (_event, filePath) => callback(filePath))
});
