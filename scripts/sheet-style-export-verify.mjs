import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import XLSX from 'xlsx-js-style';

import { convertLakeSheet } from '../src/core/sheet-converter.js';

const imageUrl = 'https://cdn.nlark.com/example/image.png';
const fileUrl = 'https://example.yuque.com/attachments/example.json';
const lakesheet = JSON.stringify({
  sheet: [{
    name: '样式验证',
    data: {
      0: {
        0: { v: '第一行\n第二行', s: 0 },
        1: { v: { class: 'checkbox', value: true }, s: 0 },
        2: { v: { class: 'image', src: imageUrl, name: 'image.png' }, s: 0 },
        3: { v: { class: 'file', src: fileUrl, name: 'example.json' }, s: 0 },
        4: { v: '', s: 0 },
      },
      1: {
        1: { v: { class: 'checkbox', value: false }, s: 0 },
        2: { v: true, s: 0 },
        4: { v: '范围终点', s: 0 },
      },
      2: {
        0: { v: '合并单元格', s: 0 },
        3: { v: null, s: 0 },
      },
    },
    mergeCells: {
      mergedHeader: { row: 2, col: 0, rowCount: 1, colCount: 3 },
    },
    rows: { 0: { size: 44 }, 1: { size: 28 }, 2: { size: 28 } },
    columns: {
      0: { size: 120 }, 1: { size: 80 }, 2: { size: 120 },
      3: { size: 120 }, 4: { size: 80 },
    },
    vStore: {
      style: ['z11w7h1b0'],
      style_color: [],
      style_backColor: ['#f4f5f5'],
    },
  }],
});

const result = convertLakeSheet(lakesheet, 'xlsx');
const bytes = await result.blob.arrayBuffer();
if (process.argv[2]) {
  await fs.writeFile(process.argv[2], new Uint8Array(bytes));
}
const workbook = XLSX.read(bytes, {
  type: 'array',
  bookFiles: true,
  cellStyles: true,
  sheetStubs: true,
});
const sheet = workbook.Sheets['样式验证'];
const stylesXml = new TextDecoder().decode(workbook.files['xl/styles.xml'].content);
const sheetXml = new TextDecoder().decode(workbook.files['xl/worksheets/sheet1.xml'].content);

assert.match(stylesXml, /<alignment[^>]*wrapText="true"/, '含换行符的单元格应启用自动换行');
for (const edge of ['left', 'right', 'top', 'bottom']) {
  assert.match(
    stylesXml,
    new RegExp(`<${edge} style="thin"><color rgb="D9E1F2"\\/><\\/${edge}>`),
    `应生成可见的 ${edge} 网格边框`,
  );
}
for (const address of ['A1', 'B1', 'C1', 'D1', 'E1', 'B2', 'C2', 'E2', 'A3', 'B3', 'C3', 'D3']) {
  assert.match(sheetXml, new RegExp(`<c r="${address}" s="[1-9][0-9]*"`), `${address} 应引用单元格样式`);
}
assert.match(sheetXml, /<mergeCell ref="A3:C3"\/>/, '合并区域应保持不变');

assert.equal(sheet.B1.t, 'b', 'checkbox 应保存为布尔类型');
assert.equal(sheet.B1.v, true, 'checkbox 应保留勾选值');
assert.equal(sheet.B2.t, 'b', '未勾选 checkbox 也应保存为布尔类型');
assert.equal(sheet.B2.v, false, 'checkbox 应保留未勾选值');
assert.equal(sheet.C2.t, 'b', '普通布尔值应保存为布尔类型');
assert.equal(sheet.C2.v, true, '普通布尔值不应转换为文本');
assert.equal(sheet.C1.v, 'image.png', 'image 应使用名称作为显示值');
assert.equal(sheet.C1.l?.Target, imageUrl, 'image 应保留可点击源链接');
assert.equal(sheet.D1.v, 'example.json', 'file 应使用名称作为显示值');
assert.equal(sheet.D1.l?.Target, fileUrl, 'file 应保留可点击源链接');

for (const format of ['csv', 'md', 'html']) {
  const converted = convertLakeSheet(lakesheet, format).text;
  assert.ok(!converted.includes('"class":"checkbox"'), `${format} 不应包含 checkbox JSON`);
  assert.ok(!converted.includes('"class":"image"'), `${format} 不应包含 image JSON`);
  assert.ok(!converted.includes('"class":"file"'), `${format} 不应包含 file JSON`);
  assert.ok(converted.includes('image.png'), `${format} 应保留 image 名称`);
  assert.ok(converted.includes('example.json'), `${format} 应保留 file 名称`);
}

console.log('Sheet style export verification passed.');
