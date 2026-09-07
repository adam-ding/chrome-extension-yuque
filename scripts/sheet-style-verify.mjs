import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx-js-style');

const workbookPaths = process.argv.slice(2);
assert.ok(workbookPaths.length > 0, 'Usage: node scripts/sheet-style-verify.mjs <workbook.xlsx> [...]');

let failed = false;

for (const workbookPath of workbookPaths) {
  const workbook = XLSX.readFile(workbookPath, {
    bookFiles: true,
    cellFormula: true,
    cellStyles: true,
    sheetStubs: true,
  });
  const stylesXml = decodeFile(workbook, 'xl/styles.xml');
  const cellFormats = xmlRecords(stylesXml, 'cellXfs', 'xf');
  const borders = xmlRecords(stylesXml, 'borders', 'border');
  let multilineCells = 0;
  let multilineCellsWithoutWrap = 0;
  let cellsWithVisibleBorders = 0;

  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    const sheet = workbook.Sheets[sheetName];
    const sheetXml = decodeFile(workbook, `xl/worksheets/sheet${sheetIndex + 1}.xml`);
    const styleByAddress = cellStyleIndexes(sheetXml);

    for (const [address, cell] of Object.entries(sheet)) {
      if (address.startsWith('!')) continue;
      const cellFormat = cellFormats[styleByAddress.get(address) || 0] || '';

      if (typeof cell.v === 'string' && /[\r\n]/.test(cell.v)) {
        multilineCells += 1;
        if (!/<alignment[^>]*wrapText="(?:1|true)"/.test(cellFormat)) {
          multilineCellsWithoutWrap += 1;
        }
      }

      const borderId = Number(cellFormat.match(/\bborderId="(\d+)"/)?.[1] || 0);
      const border = borders[borderId] || '';
      if (/<(?:top|right|bottom|left)\b[^>]*\bstyle=/.test(border)) {
        cellsWithVisibleBorders += 1;
      }
    }
  });

  console.log(JSON.stringify({
    workbookPath,
    multilineCells,
    multilineCellsWithoutWrap,
    cellsWithVisibleBorders,
  }));

  if (multilineCellsWithoutWrap > 0 || cellsWithVisibleBorders === 0) {
    failed = true;
  }
}

if (failed) {
  throw new Error('Sheet style verification failed: multiline wrapping or visible borders are missing.');
}

console.log('Sheet style verification passed.');

function decodeFile(workbook, path) {
  const file = workbook.files?.[path];
  assert.ok(file?.content, `Workbook entry is missing: ${path}`);
  return new TextDecoder().decode(file.content);
}

function xmlRecords(xml, containerName, recordName) {
  const container = xml.match(new RegExp(`<${containerName}\\b[^>]*>([\\s\\S]*?)<\\/${containerName}>`))?.[1] || '';
  return container.match(new RegExp(
    `<${recordName}\\b[^>]*\\/>|<${recordName}\\b[^>]*>[\\s\\S]*?<\\/${recordName}>`,
    'g',
  )) || [];
}

function cellStyleIndexes(sheetXml) {
  const result = new Map();
  for (const match of sheetXml.matchAll(/<c\b([^>]*)>/g)) {
    const attributes = match[1];
    const address = attributes.match(/\br="([^"]+)"/)?.[1];
    if (!address) continue;
    result.set(address, Number(attributes.match(/\bs="(\d+)"/)?.[1] || 0));
  }
  return result;
}
