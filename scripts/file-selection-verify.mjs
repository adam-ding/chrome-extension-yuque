import assert from 'node:assert/strict';

import {
  applyFileSelection,
  getSelectableFileIndexes,
  getSelectedFiles,
  normalizeSelectedFileIndexes,
} from '../src/core/file-selection.js';

const files = [
  { id: 101, title: '单篇收藏', status: 'pending' },
  { id: 101, title: '收藏知识库内的同一文档', status: 'pending' },
  { id: 202, title: '已导出文档', status: 'success' },
  { id: 303, title: '失败待重试文档', status: 'failed' },
];

assert.deepEqual(getSelectableFileIndexes(files), [0, 1, 3]);
assert.deepEqual(normalizeSelectedFileIndexes(files), [0, 1, 3]);
assert.deepEqual(normalizeSelectedFileIndexes(files, [1, 1, 2, 99, -1]), [1]);

const updated = applyFileSelection(files, [0, 3]);
assert.deepEqual(updated.map(file => file.selected), [true, false, false, true]);
assert.deepEqual(files.map(file => file.selected), [undefined, undefined, undefined, undefined]);

const selectedFiles = getSelectedFiles(files, [1]);
assert.equal(selectedFiles.length, 1);
assert.equal(selectedFiles[0].title, '收藏知识库内的同一文档');
assert.equal(selectedFiles[0].selected, true);

console.log('File selection verification passed.');
