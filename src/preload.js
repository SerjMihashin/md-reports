const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('mdReports', {
  chooseFile: () => ipcRenderer.invoke('dialog:open'),
  chooseSavePath: (suggestedName) => ipcRenderer.invoke('dialog:save-as', suggestedName),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('file:write', filePath, content),
  exportPdf: (suggestedName) => ipcRenderer.invoke('file:export-pdf', suggestedName),
  listRecent: () => ipcRenderer.invoke('recent:list'),
  removeRecent: (filePaths) => ipcRenderer.invoke('recent:remove', filePaths),
  exportZip: (filePaths) => ipcRenderer.invoke('files:export-zip', filePaths),
  readFiles: (filePaths) => ipcRenderer.invoke('files:read-many', filePaths),
  printHtml: (html) => ipcRenderer.invoke('window:print-html', html),
  openExternal: (url) => ipcRenderer.invoke('link:open-external', url),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  print: () => ipcRenderer.invoke('window:print'),
  droppedFilePath: (file) => webUtils.getPathForFile(file),
  onOpenPath: (callback) => ipcRenderer.on('file:open-path', (_event, filePath) => callback(filePath))
});
