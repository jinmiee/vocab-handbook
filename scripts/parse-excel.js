const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');

// 엑셀 파일 경로
const excelFilePath = path.join(__dirname, '../단어장_진미경.xlsx');
const outputDir = path.join(__dirname, '../src/data');
const outputFilePath = path.join(outputDir, 'vocab.json');

// 컬럼명 매핑 룰 (소문자로 변환하여 비교)
const KEYWORD_ALIASES = ['키워드', '단어', '용어', 'term', 'word', 'name', 'key', 'keyword', 'zr'];
const SUMMARY_ALIASES = ['한줄설명', '요약', '정의', 'summary', 'description', 'define', 'definition', '한 줄 설명'];
const DETAIL_ALIASES = ['상세설명', '상세 설명', '설명', '상세', 'detail', 'explanation', 'content', '상세내용'];
const CATEGORY_ALIASES = ['카테고리', '구분', 'category', 'sheet', 'classification'];

function findMappedKey(row, aliases) {
  const keys = Object.keys(row);
  for (const key of keys) {
    const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '');
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().replace(/\s+/g, '');
      if (cleanKey === cleanAlias || cleanKey.includes(cleanAlias)) {
        return key;
      }
    }
  }
  return null;
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
      console.log(`Sheet [${sheetName}]: Empty sheet (no cells). Skipping.`);
      return;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    console.log(`Parsing sheet [${sheetName}]: Found ${rows.length} rows`);

    rows.forEach((row, index) => {
      const keys = Object.keys(row);
      if (keys.length === 0) return;

      // 키워드, 한줄설명, 상세설명 컬럼 매핑 찾기
      let keywordCol = findMappedKey(row, KEYWORD_ALIASES);
      
      // 만약 키워드 매핑을 찾지 못했다면 첫 번째 컬럼을 키워드로 폴백
      if (!keywordCol && keys.length > 0) {
        keywordCol = keys[0];
      }

      const summaryCol = findMappedKey(row, SUMMARY_ALIASES);
      const detailCol = findMappedKey(row, DETAIL_ALIASES);
      const categoryCol = findMappedKey(row, CATEGORY_ALIASES);

      const rawKeyword = keywordCol ? String(row[keywordCol]).trim() : '';
      const rawSummary = summaryCol ? String(row[summaryCol]).trim() : '';
      const rawDetail = detailCol ? String(row[detailCol]).trim() : '';
      
      // 시트명 또는 별도 카테고리 컬럼 사용
      let category = sheetName.trim();
      if (categoryCol && row[categoryCol]) {
        category = String(row[categoryCol]).trim();
      }

      // 키워드가 비어있는 행은 건너뜀
      if (!rawKeyword) {
        return;
      }

      // 안정적인 ID 생성 (카테고리 + 키워드 기반 MD5 해시의 앞 12자리)
      const inputStr = `${category}::${rawKeyword}`;
      const id = crypto.createHash('md5').update(inputStr).digest('hex').substring(0, 12);

      vocabularyList.push({
        id,
        keyword: rawKeyword,
        summary: rawSummary || `${rawKeyword}에 대한 설명입니다.`,
        detail: rawDetail || rawSummary || `${rawKeyword}에 대한 상세 설명이 없습니다.`,
        category: category,
      });
    });
  });

  console.log(`Parsing complete. Total valid terms: ${vocabularyList.length}`);

  // 출력 폴더 생성
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // JSON 파일로 저장
  fs.writeFileSync(outputFilePath, JSON.stringify(vocabularyList, null, 2), 'utf-8');
  console.log(`Saved vocab data to: ${outputFilePath}`);
}

parseExcel();
