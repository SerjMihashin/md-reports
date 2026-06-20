const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const content = document.getElementById('content');
const workspace = document.getElementById('workspace');
const fileName = document.getElementById('fileName');
const filePathLabel = document.getElementById('filePath');
const saveState = document.getElementById('saveState');
const saveStateText = document.getElementById('saveStateText');
const statusDot = document.getElementById('statusDot');
const recentList = document.getElementById('recentList');
const dropOverlay = document.getElementById('dropOverlay');
const toast = document.getElementById('toast');
const toastIcon = document.querySelector('.toast__icon');
const toastText = document.querySelector('.toast__text');
const selectAllRecent = document.getElementById('selectAllRecent');
const selectedRecentCount = document.getElementById('selectedRecentCount');
const zipRecentButton = document.getElementById('zipRecentButton');
const printRecentButton = document.getElementById('printRecentButton');
const removeRecentButton = document.getElementById('removeRecentButton');

let currentPath = null;
let dirty = false;
let toastTimer = null;
let sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
let recentFiles = [];
const selectedRecent = new Set();

marked.setOptions({ gfm: true, breaks: false });

function render() {
  const unsafeHtml = marked.parse(editor.value || '');
  preview.innerHTML = DOMPurify.sanitize(unsafeHtml, { USE_PROFILES: { html: true } });
  preview.querySelectorAll('a').forEach((link) => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (/^https?:\/\//i.test(link.href)) {
      link.title = 'Открыть в браузере';
      link.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
          await window.mdReports.openExternal(link.href);
        } catch (error) {
          showToast(error.message || 'Не удалось открыть ссылку', true);
        }
      });
    }
  });
  enhanceCodeBlocks();
}

async function copyCode(text, successMessage = 'Код скопирован') {
  try {
    await window.mdReports.copyText(text);
    showToast(successMessage);
  } catch (error) {
    showToast(error.message || 'Не удалось скопировать текст', true);
  }
}

function enhanceCodeBlocks() {
  preview.querySelectorAll('pre').forEach((pre) => {
    const code = pre.querySelector(':scope > code');
    if (!code) return;
    const source = code.textContent;
    const languageClass = [...code.classList].find((name) => name.startsWith('language-'));
    const language = languageClass ? languageClass.replace('language-', '').toUpperCase() : 'Код';
    const frame = document.createElement('div');
    frame.className = 'code-block';
    const toolbar = document.createElement('div');
    toolbar.className = 'code-block__toolbar';
    const label = document.createElement('span');
    label.textContent = language;
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'code-block__copy';
    copyButton.title = 'Копировать код';
    copyButton.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg><span>Копировать</span>';
    copyButton.addEventListener('click', () => copyCode(source));
    toolbar.append(label, copyButton);
    pre.before(frame);
    frame.append(toolbar, pre);
  });

  preview.querySelectorAll('code:not(pre code)').forEach((code) => {
    code.classList.add('inline-code--copyable');
    code.tabIndex = 0;
    code.title = 'Нажмите, чтобы скопировать';
    const copy = () => copyCode(code.textContent, 'Команда скопирована');
    code.addEventListener('click', copy);
    code.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        copy();
      }
    });
  });
}

function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  toastText.textContent = message;
  toast.classList.remove('toast--success', 'toast--error');
  if (isError) {
    toast.classList.add('toast--error');
    toastIcon.innerHTML = '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>';
  } else {
    toast.classList.add('toast--success');
    toastIcon.innerHTML = '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';
  }
  toast.classList.add('is-visible');
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

function setDirty(value) {
  dirty = value;
  saveStateText.textContent = value ? 'Есть изменения' : 'Сохранено';
  saveState.classList.toggle('save-state--dirty', value);
  statusDot.classList.toggle('document-title__dot--dirty', value);
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

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  workspace.classList.toggle('workspace--sidebar-collapsed', sidebarCollapsed);
  localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
  updateSidebarToggleLabel();
}

function updateSidebarToggleLabel() {
  const button = document.getElementById('sidebarToggle');
  const label = sidebarCollapsed ? 'Развернуть панель' : 'Свернуть панель';
  button.title = label;
  button.setAttribute('aria-label', label);
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('theme-dark', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  const themeButton = document.getElementById('themeButton');
  const label = isDark ? 'Включить светлую тему' : 'Включить тёмную тему';
  themeButton.title = label;
  themeButton.setAttribute('aria-label', label);
}

async function renderRecent(files) {
  if (!files) files = await window.mdReports.listRecent();
  recentFiles = files;
  [...selectedRecent].forEach((filePath) => {
    if (!recentFiles.includes(filePath)) selectedRecent.delete(filePath);
  });
  recentList.replaceChildren();
  if (!files.length) {
    const empty = document.createElement('div');
    empty.className = 'recent-list__empty';
    empty.textContent = 'Здесь появятся открытые отчёты.';
    recentList.append(empty);
    updateRecentTools();
    return;
  }
  files.forEach((path) => {
    const row = document.createElement('div');
    row.className = 'recent-file';
    const isActive = path === currentPath;
    row.classList.toggle('is-active', isActive);
    const parts = path.split(/[\\/]/);
    const name = parts[parts.length - 1];
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'recent-file__checkbox';
    checkbox.checked = selectedRecent.has(path);
    checkbox.setAttribute('aria-label', `Выбрать ${name}`);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedRecent.add(path);
      else selectedRecent.delete(path);
      row.classList.toggle('is-selected', checkbox.checked);
      updateRecentTools();
    });
    const openButton = document.createElement('button');
    openButton.className = 'recent-file__open';
    openButton.type = 'button';
    openButton.innerHTML = `<strong>${escapeHtml(name)}</strong><span>${escapeHtml(path)}</span>`;
    if (isActive) openButton.setAttribute('aria-current', 'page');
    openButton.addEventListener('click', () => openFile(path));
    row.classList.toggle('is-selected', checkbox.checked);
    row.append(checkbox, openButton);
    recentList.append(row);
  });
  updateRecentTools();
}

function selectedRecentPaths() {
  return recentFiles.filter((filePath) => selectedRecent.has(filePath));
}

function updateRecentTools() {
  const selectedCount = selectedRecentPaths().length;
  const hasFiles = recentFiles.length > 0;
  selectAllRecent.checked = hasFiles && selectedCount === recentFiles.length;
  selectAllRecent.indeterminate = selectedCount > 0 && selectedCount < recentFiles.length;
  selectAllRecent.disabled = !hasFiles;
  selectedRecentCount.textContent = selectedCount ? `${selectedCount} выбрано` : 'Все';
  zipRecentButton.disabled = selectedCount === 0;
  printRecentButton.disabled = selectedCount === 0;
  removeRecentButton.disabled = selectedCount === 0;
}

async function exportSelectedZip() {
  try {
    const savedPath = await window.mdReports.exportZip(selectedRecentPaths());
    if (savedPath) showToast('ZIP-архив сохранён');
  } catch (error) {
    showToast(error.message || 'Не удалось создать ZIP-архив', true);
  }
}

async function printSelectedFiles() {
  try {
    const documents = await window.mdReports.readFiles(selectedRecentPaths());
    const html = documents.map((document) => {
      const body = DOMPurify.sanitize(marked.parse(document.content || ''), { USE_PROFILES: { html: true } });
      return `<section class="print-document"><div class="print-source">${escapeHtml(document.filePath)}</div>${body}</section>`;
    }).join('');
    await window.mdReports.printHtml(html);
  } catch (error) {
    showToast(error.message || 'Не удалось распечатать документы', true);
  }
}

async function removeSelectedRecent() {
  const paths = selectedRecentPaths();
  if (!paths.length || !confirm(`Убрать выбранные документы из списка (${paths.length})? Файлы на диске останутся.`)) return;
  try {
    const files = await window.mdReports.removeRecent(paths);
    selectedRecent.clear();
    await renderRecent(files);
    showToast('Список недавних документов обновлён');
  } catch (error) {
    showToast(error.message || 'Не удалось обновить список', true);
  }
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
  renderRecent(recentFiles);
}

function setMode(mode) {
  content.className = `content mode-${mode}`;
  document.querySelectorAll('.view-switcher__button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.mode === mode);
  });
}

// ─── Event listeners ───

document.getElementById('openButton').addEventListener('click', chooseAndOpen);
document.getElementById('sidebarOpenButton').addEventListener('click', chooseAndOpen);
document.getElementById('newButton').addEventListener('click', newDocument);
document.getElementById('saveButton').addEventListener('click', () => save(false));
document.getElementById('pdfButton').addEventListener('click', exportPdf);
document.getElementById('printButton').addEventListener('click', () => window.mdReports.print());
document.getElementById('themeButton').addEventListener('click', () => {
  applyTheme(document.body.classList.contains('theme-dark') ? 'light' : 'dark');
});
document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
selectAllRecent.addEventListener('change', () => {
  if (selectAllRecent.checked) recentFiles.forEach((filePath) => selectedRecent.add(filePath));
  else selectedRecent.clear();
  renderRecent(recentFiles);
});
zipRecentButton.addEventListener('click', exportSelectedZip);
printRecentButton.addEventListener('click', printSelectedFiles);
removeRecentButton.addEventListener('click', removeSelectedRecent);
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

// ─── Init ───

const savedTheme = localStorage.getItem('theme');
const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
applyTheme(savedTheme || preferredTheme);
if (sidebarCollapsed) workspace.classList.add('workspace--sidebar-collapsed');
updateSidebarToggleLabel();

window.mdReports.onOpenPath(openFile);
newDocument();
renderRecent();
