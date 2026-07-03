/* eslint-disable @typescript-eslint/no-require-imports */
// public/sw.js의 CACHE_NAME은 배포 때마다 값이 바뀌어야 한다. 값이 고정돼 있으면
// activate 핸들러의 "cache !== CACHE_NAME" 정리 로직이 절대 참이 되지 않아서,
// 새 버전을 배포해도 이전 빌드의 캐시된 정적 파일이 계속 남아 최신 배포와 뒤섞인다.
// 이 스크립트는 매 빌드 전(prebuild)에 실행되어 CACHE_NAME에 현재 시각 기반 값을 새로 찍는다.
const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '..', 'public', 'sw.js');
const buildId = Date.now().toString(36);
const cacheNamePattern = /const CACHE_NAME = '[^']*';/;

const content = fs.readFileSync(swPath, 'utf-8');

if (!cacheNamePattern.test(content)) {
  console.warn(`[stamp-sw] CACHE_NAME 선언을 ${swPath}에서 찾지 못했습니다. 건너뜁니다.`);
  process.exit(0);
}

const stamped = content.replace(cacheNamePattern, `const CACHE_NAME = 'vocab-handbook-${buildId}';`);
fs.writeFileSync(swPath, stamped, 'utf-8');
console.log(`[stamp-sw] Service worker cache name stamped: vocab-handbook-${buildId}`);
