import { addLog, showStatus, syncUiWithState } from './ui.js';
import { i18n } from './i18n.js';

let encryptedQueue = [];
let currentItem = null;
let lastFocusedElement = null;
let unlockedFileCount = 0;

/**
 * Show password modal for a list of encrypted items.
 * Processes items one at a time.
 */
export function showPasswordModal(items) {
  encryptedQueue = [...items];
  unlockedFileCount = 0;
  showNextItem();
}

function showNextItem() {
  const modal = document.getElementById('passwordModal');
  if (!modal) return;

  if (encryptedQueue.length === 0) {
    hidePasswordModal();
    refreshDocumentSelection(unlockedFileCount > 0);
    unlockedFileCount = 0;
    return;
  }

  currentItem = encryptedQueue[0];
  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const titleEl = document.getElementById('passwordTitle');
  const nameEl = document.getElementById('passwordItemName');
  const inputEl = document.getElementById('passwordInput');
  const errorEl = document.getElementById('passwordError');
  const remainingEl = document.getElementById('passwordRemaining');

  titleEl.textContent = currentItem.type === 'book' ? '知识库需要密码' : '文档需要密码';
  nameEl.textContent = currentItem.title || '未命名';
  inputEl.value = '';
  errorEl.style.display = 'none';
  remainingEl.textContent = `还有 ${encryptedQueue.length} 个加密项`;

  // Show modal
  modal.removeAttribute('inert');
  modal.classList.add('is-visible');
  document.body.classList.add('modal-open');

  // Focus input
  setTimeout(() => inputEl.focus(), 100);

  // Bind events (only once)
  if (!modal._bound) {
    modal._bound = true;

    document.getElementById('passwordSubmitBtn').addEventListener('click', handleSubmit);
    document.getElementById('passwordSkipBtn').addEventListener('click', handleSkip);
    document.getElementById('passwordModalClose').addEventListener('click', handleCloseAll);

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSubmit();
    });

    // Auto-submit when 4 chars entered
    inputEl.addEventListener('input', () => {
      if (inputEl.value.length === 4) {
        handleSubmit();
      }
    });
  }
}

async function handleSubmit() {
  if (!currentItem) return;

  const inputEl = document.getElementById('passwordInput');
  const errorEl = document.getElementById('passwordError');
  const submitBtn = document.getElementById('passwordSubmitBtn');
  const password = inputEl.value.trim();

  if (!password) {
    errorEl.textContent = '请输入密码';
    errorEl.style.display = 'block';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '验证中...';
  errorEl.style.display = 'none';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'verifyPassword',
      data: {
        bookId: currentItem.type === 'book' ? currentItem.id : currentItem.bookId,
        docId: currentItem.type === 'doc' ? currentItem.id : null,
        password,
        itemType: currentItem.type,
        bookName: currentItem.bookName || currentItem.title,
        title: currentItem.title,
        slug: currentItem.slug,
        docType: currentItem.docType,
        bookSourceId: currentItem.bookSourceId,
        bookNamespace: currentItem.bookNamespace,
        updatedAt: currentItem.updatedAt,
        isBookmark: currentItem.isBookmark,
      }
    });

    if (response?.success) {
      addLog(`验证成功: ${currentItem.title}，新增 ${response.newFiles} 篇文档`);
      unlockedFileCount += Number(response.newFiles) || 0;
      encryptedQueue.shift();
      showNextItem();
    } else {
      errorEl.textContent = response?.error || '密码错误';
      errorEl.style.display = 'block';
      inputEl.value = '';
      inputEl.focus();
    }
  } catch (error) {
    errorEl.textContent = error.message || '验证失败';
    errorEl.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '确认';
  }
}

async function handleSkip() {
  if (!currentItem) return;

  try {
    await chrome.runtime.sendMessage({
      action: 'skipEncrypted',
      data: { id: currentItem.id, type: currentItem.type }
    });
    addLog(`已跳过: ${currentItem.title}`);
  } catch {}

  encryptedQueue.shift();
  showNextItem();
}

function handleCloseAll() {
  encryptedQueue = [];
  currentItem = null;
  hidePasswordModal();
  refreshDocumentSelection(false);
  unlockedFileCount = 0;
}

function hidePasswordModal() {
  const modal = document.getElementById('passwordModal');
  if (!modal) return;

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && modal.contains(activeElement)) {
    activeElement.blur();
  }

  const fallbackFocusTarget = resolveFallbackFocusTarget();
  fallbackFocusTarget?.focus?.();

  modal.setAttribute('inert', '');
  modal.classList.remove('is-visible');
  document.body.classList.remove('modal-open');
  currentItem = null;
}

function resolveFallbackFocusTarget() {
  if (lastFocusedElement instanceof HTMLElement && document.contains(lastFocusedElement)) {
    return lastFocusedElement;
  }

  const fallbackIds = ['startExport', 'getInfo', 'login-btn', 'settings-btn'];
  for (const id of fallbackIds) {
    const el = document.getElementById(id);
    if (el instanceof HTMLElement && !el.hasAttribute('disabled')) {
      return el;
    }
  }

  return document.body instanceof HTMLElement ? document.body : null;
}

async function refreshDocumentSelection(showUnlockedNotice) {
  try {
    const stateResp = await chrome.runtime.sendMessage({ action: 'getUiState' });
    if (!stateResp?.success) return;
    syncUiWithState(stateResp.data);
    if (showUnlockedNotice) {
      addLog(i18n('documentsUnlocked'));
      showStatus(i18n('documentsUnlocked'), 'success');
    }
  } catch {}
}
