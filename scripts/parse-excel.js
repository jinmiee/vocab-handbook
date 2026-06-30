const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');

const excelFileName = '단어장_진미경.xlsx';
const excelFilePath = path.join(__dirname, '..', excelFileName);
const outputDir = path.join(__dirname, '..', 'src', 'data');
const outputFilePath = path.join(outputDir, 'vocab.json');

const normalizeHeader = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const KEYWORD_ALIASES = ['zr', '단어', '용어', '키워드', 'term', 'word', 'name', 'key', 'keyword'];
const SUMMARY_ALIASES = ['한줄설명', '한줄 설명', '요약', 'summary', 'shortdescription', 'short description'];
const DETAIL_ALIASES = ['상세설명', '상세 설명', 'detail', 'description', 'detaileddescription', 'detailed description', '상세내용'];
const DETAIL_FALLBACK_ALIASES = ['설명'];
const CATEGORY_ALIASES = ['카테고리', '구분', 'category', 'sheet', 'classification'];

function findExactMappedKey(row, aliases) {
  const exactAliases = aliases.map(normalizeHeader);
  return Object.keys(row).find((key) => exactAliases.includes(normalizeHeader(key))) ?? null;
}

function findPartialMappedKey(row, aliases) {
  const partialAliases = aliases.map(normalizeHeader);

  return (
    Object.keys(row).find((key) => {
      const cleanKey = normalizeHeader(key);
      return partialAliases.some((alias) => alias && cleanKey.includes(alias));
    }) ?? null
  );
}

function findMappedKey(row, aliases, fallbackAliases = []) {
  const exactMatch = findExactMappedKey(row, aliases);
  if (exactMatch) return exactMatch;

  const partialMatch = findPartialMappedKey(row, aliases);
  if (partialMatch) return partialMatch;

  if (fallbackAliases.length === 0) return null;
  return findPartialMappedKey(row, fallbackAliases);
}

function getCellValue(sheet, rowIndex, columnIndex) {
  const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
  return cell && cell.v !== undefined ? String(cell.v).trim() : '';
}

function parseExcel() {
  console.log(`Loading Excel file from: ${excelFilePath}`);
  if (!fs.existsSync(excelFilePath)) {
    console.error(`Excel file not found at ${excelFilePath}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(excelFilePath);
  const vocabularyList = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) {
      console.log(`Sheet [${sheetName}]: empty sheet. Skipping.`);
      return;
    }

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const headers = [];
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      headers.push(getCellValue(sheet, range.s.r, col) || `COLUMN_${col}`);
    }
    console.log(`[Sheet: ${sheetName}] headers:`, headers);

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    console.log(`Parsing sheet [${sheetName}]: found ${rows.length} rows`);
    if (rows.length === 0) return;

    const firstRow = rows[0];
    let keywordCol = findMappedKey(firstRow, KEYWORD_ALIASES);
    const summaryCol = findMappedKey(firstRow, SUMMARY_ALIASES);
    let detailCol = findMappedKey(firstRow, DETAIL_ALIASES, DETAIL_FALLBACK_ALIASES);
    const categoryCol = findMappedKey(firstRow, CATEGORY_ALIASES);

    if (!keywordCol) {
      keywordCol = Object.keys(firstRow)[0] ?? null;
    }

    const cColumnHeader = headers[2] ?? null;
    if (normalizeHeader(cColumnHeader) === normalizeHeader('상세 설명')) {
      detailCol = cColumnHeader;
    }

    console.log(`[Sheet: ${sheetName}] mapped columns:`, {
      keyword: keywordCol,
      summary: summaryCol,
      detail: detailCol,
      category: categoryCol,
    });

    rows.forEach((row) => {
      const rawKeyword = keywordCol ? String(row[keywordCol] ?? '').trim() : '';
      const rawSummary = summaryCol ? String(row[summaryCol] ?? '').trim() : '';
      const rawDetail = detailCol ? String(row[detailCol] ?? '').trim() : '';

      let category = sheetName.trim();
      if (categoryCol && row[categoryCol]) {
        category = String(row[categoryCol]).trim();
      }

      if (!rawKeyword) return;

      const id = crypto.createHash('md5').update(`${category}::${rawKeyword}`).digest('hex').substring(0, 12);

      vocabularyList.push({
        id,
        keyword: rawKeyword,
        summary: rawSummary || `${rawKeyword}에 대한 한줄설명입니다.`,
        detail: rawDetail || `${rawKeyword}에 대한 상세 설명이 없습니다.`,
        category,
      });
    });
  });

  console.log(`Parsing complete. Total valid terms: ${vocabularyList.length}`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFilePath, JSON.stringify(vocabularyList, null, 2), 'utf-8');
  console.log(`Saved vocab data to: ${outputFilePath}`);

  const sdlcItem = vocabularyList.find((item) => item.keyword && item.keyword.includes('SDLC'));
  if (sdlcItem) {
    console.log('\n==================================================');
    console.log('=== SDLC validation ===');
    console.log(`keyword: ${sdlcItem.keyword.replace(/\n/g, ' ')}`);
    console.log(`summary (${sdlcItem.summary.length} chars): ${sdlcItem.summary}`);
    console.log(`detail (${sdlcItem.detail.length} chars):\n${sdlcItem.detail}`);
    console.log(`summary/detail identical: ${sdlcItem.summary === sdlcItem.detail}`);
    console.log('==================================================\n');
  } else {
    console.log('\n[Warning] SDLC item was not found.\n');
  }
}

parseExcel();
