import { getSelectableFileIndexes, normalizeSelectedFileIndexes } from '../core/file-selection.js';
import { domRefs } from './dom.js';
import { i18n } from './i18n.js';

let currentFiles = [];
let selectedFileIndexes = new Set();
let lastFocusedElement = null;

export function initDocumentSelection() {
  const {
    fileSelectTrigger, fileSelectModal, fileSelectModalClose,
    fileSelectDone, fileSelectSearch, fileSelectAll
  } = domRefs;
  if (!fileSelectTrigger || !fileSelectModal || fileSelectModal._bound) return;

  fileSelectModal._bound = true;
  fileSelectTrigger.addEventListener('click', openDocumentSelection);
  fileSelectModalClose?.addEventListener('click', closeDocumentSelection);
  fileSelectDone?.addEventListener('click', closeDocumentSelection);
  fileSelectSearch?.addEventListener('input', renderDocumentList);
  fileSelectAll?.addEventListener('change', () => {
    const selectableIndexes = getSelectableFileIndexes(currentFiles);
    if (fileSelectAll.checked) selectedFileIndexes = new Set(selectableIndexes);
    else selectedFileIndexes.clear();
    syncRenderedCheckboxes();
    persistDocumentSelection();
  });
  fileSelectModal.addEventListener('click', event => {
    if (event.target === fileSelectModal) closeDocumentSelection();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && fileSelectModal.classList.contains('is-visible')) {
      closeDocumentSelection();
    }
  });
}

export function syncDocumentSelection(files = [], isExporting = false) {
  const { fileSelectGroup, fileSelectTrigger } = domRefs;
  currentFiles = Array.isArray(files) ? files : [];
  selectedFileIndexes = new Set(normalizeSelectedFileIndexes(currentFiles));

  const selectableIndexes = getSelectableFileIndexes(currentFiles);
  const shouldShow = selectableIndexes.length > 0 && !isExporting;
  if (fileSelectGroup) fileSelectGroup.style.display = shouldShow ? 'block' : 'none';
  if (fileSelectTrigger) fileSelectTrigger.disabled = !shouldShow;
  if (!shouldShow) {
    closeDocumentSelection();
    updateSelectionSummary();
    return;
  }

  renderDocumentList();
}

export function getSelectedDocumentIndexes() {
  return normalizeSelectedFileIndexes(currentFiles, Array.from(selectedFileIndexes));
}

function openDocumentSelection() {
  const { fileSelectModal, fileSelectSearch, fileSelectTrigger, mainContainer } = domRefs;
  if (!fileSelectModal) return;
  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  fileSelectModal.removeAttribute('inert');
  fileSelectModal.classList.add('is-visible');
  fileSelectTrigger?.setAttribute('aria-expanded', 'true');
  mainContainer?.setAttribute('inert', '');
  document.body.classList.add('modal-open');
  setTimeout(() => fileSelectSearch?.focus(), 50);
}

function closeDocumentSelection() {
  const { fileSelectModal, fileSelectTrigger, mainContainer } = domRefs;
  if (!fileSelectModal?.classList.contains('is-visible')) return;
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && fileSelectModal.contains(activeElement)) {
    activeElement.blur();
  }
  fileSelectModal.classList.remove('is-visible');
  fileSelectModal.setAttribute('inert', '');
  fileSelectTrigger?.setAttribute('aria-expanded', 'false');
  mainContainer?.removeAttribute('inert');
  document.body.classList.remove('modal-open');
  lastFocusedElement?.focus?.();
}

function renderDocumentList() {
  const { fileSelectList, fileSelectSearch } = domRefs;
  if (!fileSelectList) return;

  const query = (fileSelectSearch?.value || '').trim().toLocaleLowerCase();
  const visibleIndexes = getSelectableFileIndexes(currentFiles).filter(index => {
    if (!query) return true;
    const file = currentFiles[index];
    return [file.title, file.bookName, file.folderPath, file.docType]
      .filter(Boolean)
      .some(value => String(value).toLocaleLowerCase().includes(query));
  });

  fileSelectList.innerHTML = '';
  if (!visibleIndexes.length) {
    const empty = document.createElement('div');
    empty.className = 'file-selection-empty';
    empty.textContent = i18n('noDocumentsMatch') || '没有匹配的文档';
    fileSelectList.appendChild(empty);
    updateSelectionSummary();
    return;
  }

  const groups = new Map();
  visibleIndexes.forEach(index => {
    const file = currentFiles[index];
    const groupName = file.bookName || i18n('unclassifiedDocuments') || '未分类文档';
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(index);
  });

  groups.forEach((indexes, groupName) => {
    fileSelectList.appendChild(createDocumentGroup(groupName, indexes));
  });
  syncRenderedCheckboxes();
}

function createDocumentGroup(groupName, indexes) {
  const section = document.createElement('section');
  section.className = 'file-selection-group';
  section._fileIndexes = indexes;

  const header = document.createElement('label');
  header.className = 'file-selection-group-header';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'file-selection-group-checkbox';
  const title = document.createElement('span');
  title.className = 'file-selection-group-title';
  title.textContent = groupName;
  const count = document.createElement('span');
  count.className = 'file-selection-group-count';
  count.textContent = String(indexes.length);
  header.appendChild(checkbox);
  header.appendChild(title);
  header.appendChild(count);
  section.appendChild(header);

  checkbox.addEventListener('change', () => {
    indexes.forEach(index => {
      if (checkbox.checked) selectedFileIndexes.add(index);
      else selectedFileIndexes.delete(index);
    });
    syncRenderedCheckboxes();
    persistDocumentSelection();
  });

  indexes.forEach(index => section.appendChild(createDocumentOption(index)));
  return section;
}

function createDocumentOption(index) {
  const file = currentFiles[index];
  const label = document.createElement('label');
  label.className = 'file-selection-item';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'file-selection-item-checkbox';
  checkbox.setAttribute('data-file-index', String(index));
  checkbox.checked = selectedFileIndexes.has(index);
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) selectedFileIndexes.add(index);
    else selectedFileIndexes.delete(index);
    syncRenderedCheckboxes();
    persistDocumentSelection();
  });

  const info = document.createElement('span');
  info.className = 'file-selection-item-info';
  const title = document.createElement('span');
  title.className = 'file-selection-item-title';
  title.textContent = file.title || i18n('unnamedDocument') || '未命名文档';
  const meta = document.createElement('span');
  meta.className = 'file-selection-item-meta';
  meta.textContent = [file.folderPath, getDocumentTypeLabel(file.docType)].filter(Boolean).join(' · ');
  info.appendChild(title);
  info.appendChild(meta);
  label.appendChild(checkbox);
  label.appendChild(info);
  return label;
}

function getDocumentTypeLabel(docType) {
  const keyByType = {
    Doc: 'documentTypeDoc',
    Sheet: 'documentTypeSheet',
    Board: 'documentTypeBoard',
    Table: 'documentTypeTable',
  };
  const key = keyByType[docType];
  return key ? i18n(key) : (docType || '');
}

function syncRenderedCheckboxes() {
  const { fileSelectList, fileSelectAll } = domRefs;
  fileSelectList?.querySelectorAll('.file-selection-item-checkbox').forEach(checkbox => {
    checkbox.checked = selectedFileIndexes.has(Number(checkbox.getAttribute('data-file-index')));
  });

  fileSelectList?.querySelectorAll('.file-selection-group').forEach(section => {
    const indexes = section._fileIndexes || [];
    const selectedCount = indexes.filter(index => selectedFileIndexes.has(index)).length;
    const checkbox = section.querySelector('.file-selection-group-checkbox');
    if (!checkbox) return;
    checkbox.checked = indexes.length > 0 && selectedCount === indexes.length;
    checkbox.indeterminate = selectedCount > 0 && selectedCount < indexes.length;
  });

  if (fileSelectAll) {
    const selectableIndexes = getSelectableFileIndexes(currentFiles);
    const selectedCount = selectableIndexes.filter(index => selectedFileIndexes.has(index)).length;
    fileSelectAll.checked = selectableIndexes.length > 0 && selectedCount === selectableIndexes.length;
    fileSelectAll.indeterminate = selectedCount > 0 && selectedCount < selectableIndexes.length;
  }
  updateSelectionSummary();
}

function updateSelectionSummary() {
  const { fileSelectLabel, fileSelectSummary, startBtn } = domRefs;
  const total = getSelectableFileIndexes(currentFiles).length;
  const selected = getSelectedDocumentIndexes().length;
  const summary = i18n('documentSelectionSummary', [String(selected), String(total)]) || `已选 ${selected} / ${total} 篇`;
  if (fileSelectLabel) fileSelectLabel.textContent = summary;
  if (fileSelectSummary) fileSelectSummary.textContent = summary;
  if (startBtn) startBtn.disabled = total === 0 || selected === 0;
}

function persistDocumentSelection() {
  chrome.runtime.sendMessage({
    action: 'setFileSelection',
    data: { selectedFileIndexes: getSelectedDocumentIndexes() }
  }).catch(() => {});
}
