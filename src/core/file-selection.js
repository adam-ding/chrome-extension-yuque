function getSelectableFileIndexes(files = []) {
  if (!Array.isArray(files)) return [];
  const indexes = [];
  files.forEach((file, index) => {
    if (file && file.status !== 'success') indexes.push(index);
  });
  return indexes;
}

function normalizeSelectedFileIndexes(files = [], selectedFileIndexes) {
  const selectableIndexes = getSelectableFileIndexes(files);
  const requestedIndexes = Array.isArray(selectedFileIndexes)
    ? selectedFileIndexes
    : selectableIndexes.filter(index => files[index].selected !== false);
  const requestedSet = new Set(
    requestedIndexes.filter(index => Number.isInteger(index) && index >= 0)
  );
  return selectableIndexes.filter(index => requestedSet.has(index));
}

function applyFileSelection(files = [], selectedFileIndexes) {
  if (!Array.isArray(files)) return [];
  const selectedSet = new Set(normalizeSelectedFileIndexes(files, selectedFileIndexes));
  return files.map((file, index) => ({
    ...file,
    selected: selectedSet.has(index),
  }));
}

function getSelectedFiles(files = [], selectedFileIndexes) {
  const selectedIndexes = normalizeSelectedFileIndexes(files, selectedFileIndexes);
  return selectedIndexes.map(index => ({ ...files[index], selected: true }));
}

export {
  applyFileSelection,
  getSelectableFileIndexes,
  getSelectedFiles,
  normalizeSelectedFileIndexes,
};
