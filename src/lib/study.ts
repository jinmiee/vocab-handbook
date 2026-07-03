import type { ReviewSchedule, StudyEvent, StudyResult } from 'src/hooks/useVocabStore';

export interface VocabItem {
  id: string;
  keyword: string;
  summary: string;
  detail: string;
  category: string;
  subCategory?: string;
}

export interface InterviewPractice {
  question: string;
  modelAnswer: string;
  followUpQuestions: string[];
  answerKeywords: string[];
}

export function getCategoryLabel(item: VocabItem) {
  return item.subCategory ? `${item.category} · ${item.subCategory}` : item.category;
}

// toISOString()은 UTC 기준 날짜를 반환하기 때문에, UTC보다 시간이 빠른 시간대
// (한국 등 UTC+)에서는 자정~시차만큼의 새벽 시간에 "어제" 날짜로 계산되는 버그가 있었다.
// 항상 로컬 달력 기준 날짜를 써야 스트릭/복습일 계산이 실제 사용자 하루와 맞는다.
function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayKey() {
  return formatDateKey(new Date());
}

export function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

// 다음 복습일, 연속 정답, 오답 횟수를 계산하는 spaced-repetition 핵심 로직.
// useVocabStore와 vitest 단위 테스트 양쪽에서 재사용한다.
export function calculateNextReview(result: StudyResult, previous?: ReviewSchedule): ReviewSchedule {
  const today = getTodayKey();
  const wasCorrect = result === 'know' || result === 'correct';
  const correctStreak = wasCorrect ? (previous?.correctStreak ?? 0) + 1 : 0;
  const wrongCount = wasCorrect ? previous?.wrongCount ?? 0 : (previous?.wrongCount ?? 0) + 1;
  const reviewCount = (previous?.reviewCount ?? 0) + 1;

  let delayDays = 0;
  if (result === 'unsure') {
    delayDays = 1;
  } else if (wasCorrect) {
    if (correctStreak >= 3) delayDays = 14;
    else if (correctStreak === 2) delayDays = 7;
    else delayDays = 3;
  }

  return {
    nextReviewAt: addDays(today, delayDays),
    lastStudiedAt: today,
    lastResult: result,
    correctStreak,
    wrongCount,
    reviewCount,
  };
}

// 피셔-예이츠 셔플. quiz/interview/incorrect/card 화면에서 공용으로 사용해
// `array.sort(() => Math.random() - 0.5)`의 편향된 셔플을 대체한다.
export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getCategories(items: VocabItem[]) {
  return Array.from(new Set(items.map((item) => item.category))).filter(Boolean);
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  // 오답 해설에 쓰기 위한 원본 단어 참조. ox 문제처럼 보기가 단어와 직접
  // 대응되지 않는 경우도 있어 선택적으로 둔다.
  item?: VocabItem;
}

// 정답과 함께 보여줄 오답 보기를 전체 단어 풀에서 무작위로 뽑는다.
// quiz/incorrect 화면에서 4지선다 문제를 만들 때 공용으로 사용한다.
export function pickDistractors(correctItem: VocabItem, pool: VocabItem[], count = 3): VocabItem[] {
  return shuffle(pool.filter((item) => item.id !== correctItem.id)).slice(0, count);
}

// 정답 + 오답 보기를 섞어 4지선다 옵션 배열로 만든다. textOf로 "키워드를 보여줄지
// 한줄설명을 보여줄지"를 문제 유형에 맞게 주입받는다.
export function buildQuizOptions(correctItem: VocabItem, distractors: VocabItem[], textOf: (item: VocabItem) => string): QuizOption[] {
  return shuffle([correctItem, ...distractors]).map((item) => ({
    id: item.id,
    text: textOf(item),
    isCorrect: item.id === correctItem.id,
    item,
  }));
}

export type VocabSortOption = 'default' | 'alphabetical' | 'recentlyAdded' | 'mostWrong';

export function sortVocabItems(
  items: VocabItem[],
  sortOption: VocabSortOption,
  context: { reviewSchedules?: Record<string, ReviewSchedule>; newWordIds?: string[] } = {},
): VocabItem[] {
  if (sortOption === 'alphabetical') {
    return [...items].sort((a, b) => a.keyword.localeCompare(b.keyword, 'ko'));
  }
  if (sortOption === 'recentlyAdded') {
    const newSet = new Set(context.newWordIds ?? []);
    return [...items].sort((a, b) => Number(newSet.has(b.id)) - Number(newSet.has(a.id)));
  }
  if (sortOption === 'mostWrong') {
    const schedules = context.reviewSchedules ?? {};
    return [...items].sort(
      (a, b) => (schedules[b.id]?.wrongCount ?? 0) - (schedules[a.id]?.wrongCount ?? 0),
    );
  }
  return items;
}

export function getDueReviewItems(
  items: VocabItem[],
  schedules: Record<string, ReviewSchedule>,
  needsReview: string[],
) {
  const today = getTodayKey();
  const needsReviewSet = new Set(needsReview);

  return items
    .filter((item) => {
      const schedule = schedules[item.id];
      return needsReviewSet.has(item.id) || (!!schedule && schedule.nextReviewAt <= today);
    })
    .sort((a, b) => {
      const aDate = schedules[a.id]?.nextReviewAt ?? today;
      const bDate = schedules[b.id]?.nextReviewAt ?? today;
      return aDate.localeCompare(bDate);
    });
}

export function getNewItems(items: VocabItem[], newWordIds: string[]) {
  const newSet = new Set(newWordIds);
  return items.filter((item) => newSet.has(item.id));
}

export function getRelatedItems(current: VocabItem, items: VocabItem[], limit = 5) {
  const tokens = new Set(
    `${current.keyword} ${current.summary}`
      .toLowerCase()
      .split(/[^a-z0-9가-힣+#.]+/)
      .filter((token) => token.length >= 2),
  );

  return items
    .filter((item) => item.id !== current.id)
    .map((item) => {
      const haystack = `${item.keyword} ${item.summary} ${item.detail}`.toLowerCase();
      const tokenScore = Array.from(tokens).reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
      const categoryScore = item.category === current.category ? 3 : 0;
      const subCategoryScore = item.subCategory && item.subCategory === current.subCategory ? 3 : 0;
      return {
        item,
        score: categoryScore + subCategoryScore + tokenScore,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.keyword.localeCompare(b.item.keyword))
    .slice(0, limit)
    .map((entry) => entry.item);
}

const ANSWER_KEYWORD_STOP_WORDS = new Set([
  '그리고',
  '또는',
  '이를',
  '통해',
  '위해',
  '대한',
  '있는',
  '없는',
  '한다',
  '합니다',
  '사용',
  '경우',
  '방식',
  '설명',
  '개념',
  '기반',
  '구성',
  '관리',
  '처리',
  '시스템',
]);

function cleanInterviewText(text: string) {
  return text
    .replace(/==/g, '')
    .replace(/^\s*[-•]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentences(text: string, limit = 3) {
  const cleaned = cleanInterviewText(text);
  const sentences = cleaned.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [cleaned];
  return sentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, limit)
    .join(' ');
}

// 영문/숫자 뒤에 공백 없이 조사가 붙은 경우("Buffers를", "2와")만 조사를 떼어낸다.
// 한글 단어 자체의 어미까지 잘라내면 단어가 훼손될 수 있어, 영문/숫자로 끝나는
// 토큰으로만 범위를 한정한다.
const TRAILING_PARTICLE = /^([a-zA-Z0-9+#.]+)(으로써|으로서|에게서|한테서|까지는|부터는|처럼|보다|에게|한테|까지|부터|와|과|은|는|이|가|을|를|의|에|로|도|만)$/;

function stripAttachedParticle(token: string): string {
  const match = token.match(TRAILING_PARTICLE);
  return match ? match[1] : token;
}

function extractAnswerKeywords(item: VocabItem, limit = 8) {
  // 키워드 전체(괄호 안 풀네임 포함)는 질문 문장에 이미 그대로 노출되므로,
  // 체크리스트에는 괄호 앞 핵심어만 남기고 나머지는 summary/detail에서 뽑는다.
  const keywordHead = item.keyword.split(/[\r\n(]/)[0].trim();

  const source = `${item.summary} ${item.detail}`;
  const tokens = source
    .split(/[^a-zA-Z0-9가-힣+#.]+/)
    .map((token) => stripAttachedParticle(token.trim()))
    .filter((token) => {
      const normalized = token.toLowerCase();
      return token.length >= 2 && !ANSWER_KEYWORD_STOP_WORDS.has(normalized) && !ANSWER_KEYWORD_STOP_WORDS.has(token);
    });

  const uniqueTokens = Array.from(new Set(tokens));

  return Array.from(new Set([keywordHead, ...uniqueTokens])).slice(0, limit);
}

// 관련 단어를 최대 2개까지 활용해 꼬리질문을 만든다. 관련 단어가 하나뿐이거나
// 없는 경우(예: 카테고리가 매우 작은 경우)에는 기존처럼 일반적인 질문으로 대체해,
// 같은 단어를 반복 연습해도 질문이 완전히 똑같지는 않도록 한다.
export function createInterviewPractice(item: VocabItem, relatedItems: VocabItem[] = []): InterviewPractice {
  const [firstRelated, secondRelated] = relatedItems;
  const modelAnswer = firstSentences(item.detail || item.summary, 4) || item.summary;

  const comparisonQuestion = firstRelated
    ? `${item.keyword}와 ${firstRelated.keyword}의 차이는 무엇인가요?`
    : `${item.keyword}와 비슷한 개념 하나를 고르고 차이를 설명한다면?`;

  const thirdQuestion = secondRelated
    ? `${item.keyword}와 ${secondRelated.keyword}를 함께 쓴다면 각각 어떤 역할을 맡기겠어요?`
    : `${item.keyword}를 사용할 때 주의할 점이나 한계는 무엇인가요?`;

  return {
    question: `${item.keyword}가 무엇인지 면접에서 설명해보세요.`,
    modelAnswer,
    followUpQuestions: [`${item.keyword}가 실제 프로젝트에서 필요한 상황은 언제인가요?`, comparisonQuestion, thirdQuestion],
    answerKeywords: extractAnswerKeywords(item),
  };
}

export function createInterviewPrompts(item: VocabItem) {
  return createInterviewPractice(item).followUpQuestions;
}

export function countTodayEvents(events: StudyEvent[]) {
  const today = getTodayKey();
  return events.filter((event) => event.date === today).length;
}

export function getSevenDayActivity(events: StudyEvent[]) {
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = formatDateKey(date);
    return {
      date: key,
      count: events.filter((event) => event.date === key).length,
    };
  });
}

export function getStudyStreak(events: StudyEvent[]) {
  const eventDates = new Set(events.map((event) => event.date));
  let streak = 0;
  const cursor = new Date(`${getTodayKey()}T00:00:00`);

  while (eventDates.has(formatDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export interface CategoryTrend {
  name: string;
  total: number;
  correct: number;
  accuracy: number;
}

// 최근 N일간 카테고리별 학습 시도/정답률 추이. stats 화면의 "최근 추세" 섹션에서 사용.
export function getCategoryTrend(events: StudyEvent[], days = 7): CategoryTrend[] {
  const cutoff = new Date(`${getTodayKey()}T00:00:00`);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffKey = formatDateKey(cutoff);

  const byCategory: Record<string, { correct: number; total: number }> = {};
  events
    .filter((event) => event.date >= cutoffKey && event.category)
    .forEach((event) => {
      const category = event.category as string;
      if (!byCategory[category]) byCategory[category] = { correct: 0, total: 0 };
      byCategory[category].total += 1;
      if (event.result === 'know' || event.result === 'correct') {
        byCategory[category].correct += 1;
      }
    });

  return Object.entries(byCategory)
    .map(([name, data]) => ({
      name,
      total: data.total,
      correct: data.correct,
      accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
