import assert from 'node:assert/strict';
import domino from '@mixmark-io/domino';

const window = domino.createWindow(`<!doctype html><html><body>
  <main class="container">
    <div id="fileSelectGroup" style="display:none">
      <button id="fileSelectTrigger"><span id="fileSelectLabel"></span></button>
    </div>
    <button id="startExport" disabled></button>
  </main>
  <div id="fileSelectModal" inert>
    <button id="fileSelectModalClose"></button>
    <span id="fileSelectSummary"></span>
    <input id="fileSelectSearch">
    <input id="fileSelectAll" type="checkbox">
    <div id="fileSelectList"></div>
    <button id="fileSelectDone"></button>
  </div>
</body></html>`);

globalThis.window = window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;

const runtimeMessages = [];
globalThis.chrome = {
  i18n: {
    getMessage(key, substitutions) {
      if (key === 'documentSelectionSummary') return `已选 ${substitutions[0]} / ${substitutions[1]} 篇`;
      return {
        documentTypeDoc: '文档',
        documentTypeSheet: '表格',
        noDocumentsMatch: '没有匹配的文档',
      }[key] || key;
    },
  },
  runtime: {
    async sendMessage(message) {
      runtimeMessages.push(message);
      return { success: true };
    },
  },
};

const { cacheDomElements, domRefs } = await import('../src/ui/dom.js');
const {
  getSelectedDocumentIndexes,
  initDocumentSelection,
  syncDocumentSelection,
} = await import('../src/ui/document-selection.js');

cacheDomElements();
initDocumentSelection();
syncDocumentSelection([
  { id: 101, title: '单篇收藏', bookName: '个人空间/收藏/单篇收藏', docType: 'Doc', status: 'pending', selected: true },
  { id: 101, title: '同一文档', bookName: '个人空间/收藏/产品文档', docType: 'Doc', status: 'pending', selected: true },
  { id: 202, title: '已导出', bookName: '个人空间/收藏/产品文档', docType: 'Doc', status: 'success', selected: true },
  { id: 303, title: '数据表', bookName: '个人空间/收藏/产品文档', folderPath: '数据', docType: 'Sheet', status: 'pending', selected: true },
]);

assert.equal(domRefs.fileSelectGroup.style.display, 'block');
assert.equal(domRefs.fileSelectLabel.textContent, '已选 3 / 3 篇');
assert.deepEqual(getSelectedDocumentIndexes(), [0, 1, 3]);
assert.equal(domRefs.fileSelectList.querySelectorAll('.file-selection-item').length, 3);
assert.equal(domRefs.fileSelectList.querySelectorAll('.file-selection-group').length, 2);

domRefs.fileSelectTrigger.click();
assert.equal(domRefs.fileSelectModal.classList.contains('is-visible'), true);
assert.equal(domRefs.fileSelectTrigger.getAttribute('aria-expanded'), 'true');
domRefs.fileSelectDone.click();
assert.equal(domRefs.fileSelectModal.classList.contains('is-visible'), false);

const duplicateBookmark = domRefs.fileSelectList.querySelector('[data-file-index="1"]');
duplicateBookmark.checked = false;
duplicateBookmark.dispatchEvent(new window.Event('change', { bubbles: true }));
assert.deepEqual(getSelectedDocumentIndexes(), [0, 3]);
assert.deepEqual(runtimeMessages.at(-1).data.selectedFileIndexes, [0, 3]);

domRefs.fileSelectSearch.value = '单篇';
domRefs.fileSelectSearch.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(domRefs.fileSelectList.querySelectorAll('.file-selection-item').length, 1);

domRefs.fileSelectAll.checked = false;
domRefs.fileSelectAll.dispatchEvent(new window.Event('change', { bubbles: true }));
assert.deepEqual(getSelectedDocumentIndexes(), []);
assert.equal(domRefs.startBtn.disabled, true);

syncDocumentSelection([{ id: 404, title: '已导出', status: 'success', selected: true }]);
assert.equal(domRefs.fileSelectGroup.style.display, 'none');
assert.equal(domRefs.startBtn.disabled, true);

console.log('Document selection UI verification passed.');
