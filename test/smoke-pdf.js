const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('data:text/html;charset=utf-8,<h1>MD Reports PDF smoke test</h1><p>PDF export works.</p>');
  const pdf = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { marginType: 'default' }
  });
  fs.writeFileSync(path.join(__dirname, 'smoke-export.pdf'), pdf);
  app.quit();
});
