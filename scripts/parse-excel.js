/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');

const excelFileName = '단어장.xlsx';
const excelFilePath = path.join(__dirname, '..', excelFileName);
const outputDir = path.join(__dirname, '..', 'src', 'data');
const outputFilePath = path.join(outputDir, 'vocab.json');
const readmeFilePath = path.join(__dirname, '..', 'README.md');
const shouldMerge = process.argv.includes('--merge');
const historyStartMarker = '<!-- VOCAB_UPDATE_HISTORY:START -->';
const historyEndMarker = '<!-- VOCAB_UPDATE_HISTORY:END -->';

const normalizeHeader = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const KEYWORD_ALIASES = ['zr', '단어', '용어', '키워드', 'term', 'word', 'name', 'key', 'keyword'];
const SUMMARY_ALIASES = ['한줄설명', '한줄 설명', '요약', 'summary', 'shortdescription', 'short description'];
const DETAIL_ALIASES = ['상세설명', '상세 설명', 'detail', 'description', 'detaileddescription', 'detailed description', '상세내용'];
const DETAIL_FALLBACK_ALIASES = ['설명'];
const SUB_CATEGORY_ALIASES = ['세부분류', '세부 분류', '소분류', '카테고리', '구분', 'category', 'classification'];

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

function loadExistingVocabulary() {
  if (!fs.existsSync(outputFilePath)) return [];

  try {
    const parsed = JSON.parse(fs.readFileSync(outputFilePath, 'utf-8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === 'string');
  } catch (error) {
    console.warn(`Could not read existing vocab data for merge mode: ${error.message}`);
    return [];
  }
}

// id는 `category::keyword`의 해시라서, 시트가 이번 실행에서 다시 파싱됐는데
// 기존 id가 parsedList에 더 이상 없다면 그 항목은 (삭제가 아니라) 키워드/카테고리
// 텍스트가 수정된 것으로 본다. 이 경우 옛 id를 그대로 살려두면 같은 단어가
// 수정 전/후 두 개로 중복 저장되므로 버려야 한다.
// 반대로 해당 카테고리(시트) 자체가 이번 실행 대상이 아니었다면(예: 부분 파싱),
// 기존 항목을 그대로 보존한다.
function mergeVocabulary(existingList, parsedList) {
  const parsedCategories = new Set(parsedList.map((item) => item.category));
  const parsedIds = new Set(parsedList.map((item) => item.id));

  const preservedExisting = existingList.filter((item) => {
    if (parsedIds.has(item.id)) return false; // parsedList 쪽 값으로 덮어써질 항목
    if (parsedCategories.has(item.category)) return false; // 같은 시트가 재파싱됐는데 사라진 id -> 수정/삭제된 것으로 간주
    return true;
  });

  const mergedById = new Map();

  preservedExisting.forEach((item) => {
    mergedById.set(item.id, item);
  });

  parsedList.forEach((item) => {
    mergedById.set(item.id, item);
  });

  return Array.from(mergedById.values());
}

function normalizeForComparison(item) {
  return {
    keyword: item.keyword ?? '',
    summary: item.summary ?? '',
    detail: item.detail ?? '',
    category: item.category ?? '',
    subCategory: item.subCategory ?? '',
  };
}

function isSameVocabularyItem(left, right) {
  return JSON.stringify(normalizeForComparison(left)) === JSON.stringify(normalizeForComparison(right));
}

function getUpdateStats(existingList, parsedList, outputList) {
  const existingById = new Map(existingList.map((item) => [item.id, item]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  parsedList.forEach((item) => {
    const existing = existingById.get(item.id);
    if (!existing) {
      added += 1;
      return;
    }

    if (isSameVocabularyItem(existing, item)) {
      unchanged += 1;
    } else {
      updated += 1;
    }
  });

  return {
    existing: existingList.length,
    parsed: parsedList.length,
    added,
    updated,
    unchanged,
    output: outputList.length,
  };
}

// id가 category::keyword 해시이기 때문에, 이번 출력에서 완전히 사라진 기존 id는
// 카테고리(시트명) 또는 키워드 텍스트가 바뀌었다는 뜻이다. 이 id를 즐겨찾기/외운 단어로
// 저장해둔 사용자의 localStorage 학습 기록은 다음 방문 시 조용히 사라지므로, 어떤 단어가
// 영향을 받는지 최소한 터미널에 남겨서 개발자가 인지할 수 있게 한다.
function warnPossiblyOrphanedProgress(existingList, outputList) {
  const outputIds = new Set(outputList.map((item) => item.id));
  const orphaned = existingList.filter((item) => !outputIds.has(item.id));
  if (orphaned.length === 0) return;

  console.log('\n==================================================');
  console.log(`[Warning] ${orphaned.length}개의 기존 단어 id가 이번 결과물에 없습니다.`);
  console.log('카테고리(시트명) 또는 키워드 텍스트가 바뀐 것으로 보이며,');
  console.log('사용자 브라우저에 저장된 이 단어들의 학습 기록(즐겨찾기/외운 단어/복습 스케줄)이 유실될 수 있습니다.');
  orphaned.slice(0, 30).forEach((item) => {
    console.log(`  - [${item.category}] ${item.keyword} (id: ${item.id})`);
  });
  if (orphaned.length > 30) {
    console.log(`  ... 외 ${orphaned.length - 30}개 더`);
  }
  console.log('==================================================\n');
}

function printUpdateStats(stats, mode) {
  console.log('\n==================================================');
  console.log(`=== Vocab update summary (${mode}) ===`);
  console.log(`existing vocab.json: ${stats.existing}`);
  console.log(`parsed from Excel: ${stats.parsed}`);
  console.log(`added: ${stats.added}`);
  console.log(`updated: ${stats.updated}`);
  console.log(`unchanged: ${stats.unchanged}`);
  console.log(`output total: ${stats.output}`);
  console.log('==================================================\n');
}

function getKoreanDateLabel() {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';

  return `${year}년 ${month} ${day}일`;
}

function createHistoryRow(stats, mode) {
  const modeLabel = mode === 'merge' ? '병합' : '교체';
  return `| ${getKoreanDateLabel()} | ${modeLabel} | ${stats.parsed} | ${stats.added} | ${stats.updated} | ${stats.unchanged} | ${stats.output} |`;
}

function createHistorySection(row) {
  return [
    '## 📌 단어장 업데이트 기록',
    '',
    '아래 표는 `npm run parse-excel` 또는 `npm run parse-excel:merge`를 실행할 때 자동으로 갱신됩니다.',
    '',
    historyStartMarker,
    '| 날짜 | 실행 모드 | 엑셀에서 읽은 단어 | 추가 | 수정 | 변경 없음 | 최종 전체 |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
    row,
    historyEndMarker,
  ].join('\n');
}

function updateReadmeHistory(stats, mode) {
  if (!fs.existsSync(readmeFilePath)) {
    console.warn('README.md was not found. Skipping update history.');
    return;
  }

  const readme = fs.readFileSync(readmeFilePath, 'utf-8');
  const row = createHistoryRow(stats, mode);

  if (readme.includes(historyStartMarker) && readme.includes(historyEndMarker)) {
    const startIndex = readme.indexOf(historyStartMarker);
    const endIndex = readme.indexOf(historyEndMarker);
    const before = readme.slice(0, startIndex);
    const section = readme.slice(startIndex, endIndex + historyEndMarker.length);
    const after = readme.slice(endIndex + historyEndMarker.length);
    const lines = section.split(/\r?\n/);
    const headerLines = lines.slice(0, 3);
    const existingRows = lines
      .slice(3)
      .filter((line) => line.trim().startsWith('|') && !line.includes('---'));
    const nextRows = [row, ...existingRows].slice(0, 20);
    const nextSection = [...headerLines, ...nextRows, historyEndMarker].join('\n');

    fs.writeFileSync(readmeFilePath, `${before}${nextSection}${after}`, 'utf-8');
    console.log('Updated README vocab update history.');
    return;
  }

  const section = createHistorySection(row);
  const insertBefore = '\n---\n\n## 📱 iPhone Safari 홈 화면에 추가하여 앱처럼 쓰는 방법';
  const nextReadme = readme.includes(insertBefore)
    ? readme.replace(insertBefore, `\n---\n\n${section}\n\n---\n\n## 📱 iPhone Safari 홈 화면에 추가하여 앱처럼 쓰는 방법`)
    : `${readme.trimEnd()}\n\n---\n\n${section}\n`;

  fs.writeFileSync(readmeFilePath, nextReadme, 'utf-8');
  console.log('Added README vocab update history section.');
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
    const subCategoryCol = findMappedKey(firstRow, SUB_CATEGORY_ALIASES);

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
      subCategory: subCategoryCol,
    });

    rows.forEach((row) => {
      const rawKeyword = keywordCol ? String(row[keywordCol] ?? '').trim() : '';
      const rawSummary = summaryCol ? String(row[summaryCol] ?? '').trim() : '';
      const rawDetail = detailCol ? String(row[detailCol] ?? '').trim() : '';

      const category = sheetName.trim();
      const subCategory = subCategoryCol ? String(row[subCategoryCol] ?? '').trim() : '';

      if (!rawKeyword) return;

      const id = crypto.createHash('md5').update(`${category}::${rawKeyword}`).digest('hex').substring(0, 12);

      vocabularyList.push({
        id,
        keyword: rawKeyword,
        summary: rawSummary || `${rawKeyword}에 대한 한줄설명입니다.`,
        detail: rawDetail || `${rawKeyword}에 대한 상세 설명이 없습니다.`,
        category,
        subCategory,
      });
    });
  });

  console.log(`Parsing complete. Total valid terms: ${vocabularyList.length}`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const existingList = loadExistingVocabulary();
  const outputList = shouldMerge ? mergeVocabulary(existingList, vocabularyList) : vocabularyList;
  const stats = getUpdateStats(existingList, vocabularyList, outputList);

  fs.writeFileSync(outputFilePath, JSON.stringify(outputList, null, 2), 'utf-8');
  console.log(`Saved vocab data to: ${outputFilePath}`);
  const mode = shouldMerge ? 'merge' : 'replace';
  printUpdateStats(stats, mode);
  warnPossiblyOrphanedProgress(existingList, outputList);
  updateReadmeHistory(stats, mode);

  const sdlcItem = outputList.find((item) => item.keyword && item.keyword.includes('SDLC'));
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
