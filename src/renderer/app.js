const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const content = document.getElementById('content');
const fileName = document.getElementById('fileName');
const filePathLabel = document.getElementById('filePath');
const saveState = document.getElementById('saveState');
const recentList = document.getElementById('recentList');
const dropOverlay = document.getElementById('dropOverlay');
const toast = document.getElementById('toast');

let currentPath = null;
let dirty = false;
let toastTimer = null;

marked.setOptions({ gfm: true, breaks: false });

function render() {
  const unsafeHtml = marked.parse(editor.value || '');
  preview.innerHTML = DOMPurify.sanitize(unsafeHtml, { USE_PROFILES: { html: true } });
  preview.querySelectorAll('a').forEach((link) => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
}

function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle('toast--error', isError);
  toast.classList.add('is-visible');
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

function setDirty(value) {
  dirty = value;
  saveState.textContent = value ? 'Есть изменения' : 'Сохранено';
  saveState.classList.toggle('save-state--dirty', value);
}

function updateFileLabels() {
  if (currentPath) {
    const parts = currentPath.split(/[\\/]/);
    fileName.textContent = parts[parts.length - 1];
    filePathLabel.textContent = currentPath;
  } else {
    fileName.textContent = 'Новый отчёт';
    filePathLabel.textContent = 'Документ ещё не сохранён';
  }
}

async function renderRecent(files) {
  if (!files) files = await window.mdReports.listRecent();
  recentList.replaceChildren();
  if (!files.length) {
    const empty = document.createElement('div');
    empty.className = 'recent-list__empty';
    empty.textContent = 'Здесь появятся открытые отчёты.';
    recentList.append(empty);
    return;
  }
  files.forEach((path) => {
    const button = document.createElement('button');
    button.className = 'recent-file';
    button.type = 'button';
    const parts = path.split(/[\\/]/);
    const name = parts[parts.length - 1];
    button.innerHTML = `<strong>${escapeHtml(name)}</strong><span>${escapeHtml(path)}</span>`;
    button.addEventListener('click', () => openFile(path));
    recentList.append(button);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

async function openFile(path) {
  if (!path) return;
  if (dirty && !confirm('В документе есть несохранённые изменения. Открыть другой файл?')) return;
  try {
    const result = await window.mdReports.readFile(path);
    currentPath = result.filePath;
    editor.value = result.content;
    updateFileLabels();
    render();
    setDirty(false);
    await renderRecent(result.recent);
    showToast('Документ открыт');
  } catch (error) {
    showToast(error.message || 'Не удалось открыть файл', true);
  }
}

async function chooseAndOpen() {
  openFile(await window.mdReports.chooseFile());
}

async function save(saveAs = false) {
  try {
    let path = currentPath;
    if (!path || saveAs) {
      path = await window.mdReports.chooseSavePath(currentPath || 'report.md');
      if (!path) return;
    }
    const result = await window.mdReports.writeFile(path, editor.value);
    currentPath = result.filePath;
    updateFileLabels();
    setDirty(false);
    await renderRecent(result.recent);
    showToast('Документ сохранён');
  } catch (error) {
    showToast(error.message || 'Не удалось сохранить файл', true);
  }
}

async function exportPdf() {
  try {
    const sourceName = currentPath ? currentPath.split(/[\\/]/).pop() : 'report.md';
    const suggestedName = sourceName.replace(/\.(md|markdown|txt)$/i, '') + '.pdf';
    const savedPath = await window.mdReports.exportPdf(suggestedName);
    if (savedPath) showToast('PDF сохранён');
  } catch (error) {
    showToast(error.message || 'Не удалось сохранить PDF', true);
  }
}

function newDocument() {
  if (dirty && !confirm('В документе есть несохранённые изменения. Создать новый файл?')) return;
  currentPath = null;
  editor.value = '# Новый отчёт\n\n';
  updateFileLabels();
  render();
  setDirty(false);
}

function setMode(mode) {
  content.className = `content mode-${mode}`;
  document.querySelectorAll('.view-switcher__button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.mode === mode);
  });
}

document.getElementById('openButton').addEventListener('click', chooseAndOpen);
document.getElementById('sidebarOpenButton').addEventListener('click', chooseAndOpen);
document.getElementById('newButton').addEventListener('click', newDocument);
document.getElementById('saveButton').addEventListener('click', () => save(false));
document.getElementById('pdfButton').addEventListener('click', exportPdf);
document.getElementById('printButton').addEventListener('click', () => window.mdReports.print());
document.getElementById('themeButton').addEventListener('click', () => {
  document.body.classList.toggle('theme-dark');
  localStorage.setItem('theme', document.body.classList.contains('theme-dark') ? 'dark' : 'light');
});
document.querySelectorAll('.view-switcher__button').forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

editor.addEventListener('input', () => {
  render();
  setDirty(true);
});

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 's') {
    event.preventDefault();
    save(event.shiftKey);
  }
  if (event.ctrlKey && event.key.toLowerCase() === 'o') {
    event.preventDefault();
    chooseAndOpen();
  }
  if (event.ctrlKey && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    newDocument();
  }
});

window.addEventListener('beforeunload', (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = '';
  }
});

['dragenter', 'dragover'].forEach((name) => {
  document.addEventListener(name, (event) => {
    event.preventDefault();
    dropOverlay.classList.add('is-visible');
  });
});
['dragleave', 'drop'].forEach((name) => {
  document.addEventListener(name, (event) => {
    event.preventDefault();
    dropOverlay.classList.remove('is-visible');
  });
});
document.addEventListener('drop', (event) => {
  const file = event.dataTransfer.files[0];
  if (file) openFile(window.mdReports.droppedFilePath(file));
});

if (localStorage.getItem('theme') === 'dark') document.body.classList.add('theme-dark');
window.mdReports.onOpenPath(openFile);
newDocument();
renderRecent();
