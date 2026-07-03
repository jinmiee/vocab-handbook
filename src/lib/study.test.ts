import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { ReviewSchedule, StudyEvent } from 'src/hooks/useVocabStore';
import {
  buildQuizOptions,
  calculateNextReview,
  createInterviewPractice,
  getCategories,
  getCategoryTrend,
  getDueReviewItems,
  getNewItems,
  getRelatedItems,
  getSevenDayActivity,
  getStudyStreak,
  pickDistractors,
  shuffle,
  sortVocabItems,
  type VocabItem,
} from 'src/lib/study';

function makeItem(overrides: Partial<VocabItem> & { id: string; keyword: string }): VocabItem {
  return {
    summary: '',
    detail: '',
    category: '공통',
    ...overrides,
  };
}

describe('calculateNextReview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-03T00:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('처음 "외웠어요"를 누르면 3일 뒤로 복습일이 잡힌다', () => {
    const schedule = calculateNextReview('know');
    expect(schedule.nextReviewAt).toBe('2026-07-06');
    expect(schedule.correctStreak).toBe(1);
    expect(schedule.wrongCount).toBe(0);
    expect(schedule.reviewCount).toBe(1);
  });

  it('연속 정답 2회째는 7일 뒤, 3회째부터는 14일 뒤로 늘어난다', () => {
    const first = calculateNextReview('know');
    const second = calculateNextReview('correct', first);
    const third = calculateNextReview('know', second);

    expect(second.correctStreak).toBe(2);
    expect(second.nextReviewAt).toBe('2026-07-10');
    expect(third.correctStreak).toBe(3);
    expect(third.nextReviewAt).toBe('2026-07-17');
  });

  it('"헷갈려요"는 다음날로만 미루고 연속 정답을 초기화한다', () => {
    const known = calculateNextReview('know');
    const unsure = calculateNextReview('unsure', known);

    expect(unsure.nextReviewAt).toBe('2026-07-04');
    expect(unsure.correctStreak).toBe(0);
    expect(unsure.wrongCount).toBe(1);
  });

  it('"몰라요"는 오답 횟수를 늘리고 연속 정답을 0으로 되돌린다', () => {
    const known = calculateNextReview('know');
    const dontKnow = calculateNextReview('dontknow', known);

    expect(dontKnow.correctStreak).toBe(0);
    expect(dontKnow.wrongCount).toBe(1);
    expect(dontKnow.nextReviewAt).toBe('2026-07-03');
  });

  it('reviewCount는 결과와 무관하게 매번 누적된다', () => {
    let schedule: ReviewSchedule | undefined;
    schedule = calculateNextReview('know', schedule);
    schedule = calculateNextReview('dontknow', schedule);
    schedule = calculateNextReview('unsure', schedule);

    expect(schedule.reviewCount).toBe(3);
  });
});

describe('shuffle', () => {
  it('원본 배열을 변경하지 않고 같은 원소 구성을 유지한다', () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    const shuffled = shuffle(original);

    expect(original).toEqual(copy);
    expect(shuffled).toHaveLength(original.length);
    expect([...shuffled].sort()).toEqual([...original].sort());
  });
});

describe('getCategories', () => {
  it('중복과 빈 값을 제거한 카테고리 목록을 반환한다', () => {
    const items = [
      makeItem({ id: '1', keyword: 'a', category: 'FE' }),
      makeItem({ id: '2', keyword: 'b', category: 'BE' }),
      makeItem({ id: '3', keyword: 'c', category: 'FE' }),
      makeItem({ id: '4', keyword: 'd', category: '' }),
    ];

    expect(getCategories(items)).toEqual(['FE', 'BE']);
  });
});

describe('sortVocabItems', () => {
  const items = [
    makeItem({ id: '1', keyword: '다람쥐' }),
    makeItem({ id: '2', keyword: '가나다' }),
    makeItem({ id: '3', keyword: '나비' }),
  ];

  it('alphabetical은 가나다순으로 정렬한다', () => {
    const sorted = sortVocabItems(items, 'alphabetical');
    expect(sorted.map((item) => item.id)).toEqual(['2', '3', '1']);
  });

  it('recentlyAdded는 newWordIds에 포함된 항목을 앞으로 보낸다', () => {
    const sorted = sortVocabItems(items, 'recentlyAdded', { newWordIds: ['3'] });
    expect(sorted[0].id).toBe('3');
  });

  it('mostWrong은 오답 횟수가 많은 순으로 정렬한다', () => {
    const reviewSchedules: Record<string, ReviewSchedule> = {
      '1': { nextReviewAt: '', lastStudiedAt: '', lastResult: 'incorrect', correctStreak: 0, wrongCount: 5, reviewCount: 5 },
      '3': { nextReviewAt: '', lastStudiedAt: '', lastResult: 'incorrect', correctStreak: 0, wrongCount: 2, reviewCount: 2 },
    };
    const sorted = sortVocabItems(items, 'mostWrong', { reviewSchedules });
    expect(sorted.map((item) => item.id)).toEqual(['1', '3', '2']);
  });

  it('default는 입력 순서를 그대로 유지한다', () => {
    const sorted = sortVocabItems(items, 'default');
    expect(sorted.map((item) => item.id)).toEqual(['1', '2', '3']);
  });
});

describe('getDueReviewItems / getNewItems', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-03T00:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const items = [
    makeItem({ id: 'overdue', keyword: 'overdue' }),
    makeItem({ id: 'future', keyword: 'future' }),
    makeItem({ id: 'flagged', keyword: 'flagged' }),
    makeItem({ id: 'untouched', keyword: 'untouched' }),
  ];

  const baseSchedule = { lastStudiedAt: '2026-07-01', lastResult: 'know' as const, correctStreak: 1, wrongCount: 0, reviewCount: 1 };

  it('복습일이 지났거나 needsReview에 있는 단어만 골라 날짜순으로 정렬한다', () => {
    const schedules: Record<string, ReviewSchedule> = {
      overdue: { ...baseSchedule, nextReviewAt: '2026-07-02' },
      future: { ...baseSchedule, nextReviewAt: '2026-07-10' },
    };
    const due = getDueReviewItems(items, schedules, ['flagged']);

    expect(due.map((item) => item.id)).toEqual(['overdue', 'flagged']);
  });

  it('newWordIds에 속한 항목만 신규 단어로 반환한다', () => {
    const newItems = getNewItems(items, ['flagged', 'untouched']);
    expect(newItems.map((item) => item.id).sort()).toEqual(['flagged', 'untouched']);
  });
});

describe('getRelatedItems', () => {
  it('같은 카테고리/세부분류와 키워드 겹침 점수가 높은 순으로 반환하고 자기 자신은 제외한다', () => {
    const current = makeItem({ id: 'react', keyword: 'React', summary: 'UI 라이브러리', category: 'FE', subCategory: '프레임워크' });
    const items = [
      current,
      makeItem({ id: 'vue', keyword: 'Vue', summary: 'UI 라이브러리', category: 'FE', subCategory: '프레임워크' }),
      makeItem({ id: 'node', keyword: 'Node', summary: '서버 런타임', category: 'BE' }),
      makeItem({ id: 'unrelated', keyword: 'Unrelated', summary: '전혀 다른 설명', category: '기타' }),
    ];

    const related = getRelatedItems(current, items);
    expect(related.map((item) => item.id)).not.toContain('react');
    expect(related[0].id).toBe('vue');
  });
});

describe('getSevenDayActivity / getStudyStreak', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-03T00:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('최근 7일 각 날짜별 학습 이벤트 수를 센다', () => {
    const events: StudyEvent[] = [
      { id: 'a', date: '2026-07-03', result: 'know' },
      { id: 'b', date: '2026-07-03', result: 'know' },
      { id: 'c', date: '2026-06-28', result: 'know' },
    ];

    const activity = getSevenDayActivity(events);
    expect(activity).toHaveLength(7);
    expect(activity[activity.length - 1]).toEqual({ date: '2026-07-03', count: 2 });
  });

  it('오늘부터 거꾸로 연속 학습한 날짜 수를 센다', () => {
    const events: StudyEvent[] = [
      { id: 'a', date: '2026-07-03', result: 'know' },
      { id: 'b', date: '2026-07-02', result: 'know' },
      { id: 'c', date: '2026-06-30', result: 'know' },
    ];

    expect(getStudyStreak(events)).toBe(2);
  });

  it('오늘 기록이 없으면 스트릭은 0이다', () => {
    const events: StudyEvent[] = [{ id: 'a', date: '2026-07-01', result: 'know' }];
    expect(getStudyStreak(events)).toBe(0);
  });
});

describe('getCategoryTrend', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T00:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('최근 N일 범위 밖의 이벤트는 제외하고 카테고리별 정답률을 계산한다', () => {
    const events: StudyEvent[] = [
      { id: '1', date: '2026-07-10', result: 'know', category: 'FE' },
      { id: '2', date: '2026-07-09', result: 'dontknow', category: 'FE' },
      { id: '3', date: '2026-07-01', result: 'know', category: 'FE' }, // 7일 범위 밖
      { id: '4', date: '2026-07-08', result: 'correct', category: 'BE' },
    ];

    const trend = getCategoryTrend(events, 7);
    const fe = trend.find((t) => t.name === 'FE');
    const be = trend.find((t) => t.name === 'BE');

    expect(fe).toEqual({ name: 'FE', total: 2, correct: 1, accuracy: 50 });
    expect(be).toEqual({ name: 'BE', total: 1, correct: 1, accuracy: 100 });
  });
});

describe('pickDistractors / buildQuizOptions', () => {
  const correct = makeItem({ id: 'react', keyword: 'React', summary: 'UI 라이브러리' });
  const pool = [
    correct,
    makeItem({ id: 'vue', keyword: 'Vue', summary: '반응형 프레임워크' }),
    makeItem({ id: 'node', keyword: 'Node', summary: '서버 런타임' }),
    makeItem({ id: 'go', keyword: 'Go', summary: '컴파일 언어' }),
    makeItem({ id: 'rust', keyword: 'Rust', summary: '시스템 언어' }),
  ];

  it('정답을 제외한 오답 보기를 요청한 개수만큼 뽑는다', () => {
    const distractors = pickDistractors(correct, pool, 3);
    expect(distractors).toHaveLength(3);
    expect(distractors.every((item) => item.id !== correct.id)).toBe(true);
  });

  it('오답 풀이 부족하면 있는 만큼만 반환한다', () => {
    const smallPool = [correct, pool[1]];
    expect(pickDistractors(correct, smallPool, 3)).toHaveLength(1);
  });

  it('정답 하나와 오답 보기를 합쳐 정답 표시가 정확한 옵션 목록을 만든다', () => {
    const distractors = pickDistractors(correct, pool, 3);
    const options = buildQuizOptions(correct, distractors, (item) => item.keyword);

    expect(options).toHaveLength(4);
    expect(options.filter((option) => option.isCorrect)).toEqual([{ id: correct.id, text: correct.keyword, isCorrect: true, item: correct }]);
    expect(new Set(options.map((option) => option.id)).size).toBe(4);
  });

  it('textOf로 넘긴 필드를 옵션 텍스트로 사용한다', () => {
    const distractors = pickDistractors(correct, pool, 1);
    const options = buildQuizOptions(correct, distractors, (item) => item.summary);

    const correctOption = options.find((option) => option.isCorrect);
    expect(correctOption?.text).toBe(correct.summary);
  });
});

describe('createInterviewPractice', () => {
  const current = makeItem({ id: 'react', keyword: 'React', summary: 'UI 라이브러리', detail: 'React는 UI를 구성하는 라이브러리다.' });
  const related1 = makeItem({ id: 'vue', keyword: 'Vue' });
  const related2 = makeItem({ id: 'svelte', keyword: 'Svelte' });

  it('관련 단어가 없으면 일반적인 꼬리질문으로 대체한다', () => {
    const practice = createInterviewPractice(current, []);
    expect(practice.followUpQuestions).toHaveLength(3);
    expect(practice.followUpQuestions[1]).toContain('비슷한 개념 하나를 고르고');
    expect(practice.followUpQuestions[2]).toContain('주의할 점이나 한계');
  });

  it('관련 단어가 하나면 비교 질문 하나만 관련 단어를 활용한다', () => {
    const practice = createInterviewPractice(current, [related1]);
    expect(practice.followUpQuestions[1]).toBe('React와 Vue의 차이는 무엇인가요?');
    expect(practice.followUpQuestions[2]).toContain('주의할 점이나 한계');
  });

  it('관련 단어가 둘 이상이면 두 번째 관련 단어로 세 번째 질문도 다양화한다', () => {
    const practice = createInterviewPractice(current, [related1, related2]);
    expect(practice.followUpQuestions[1]).toBe('React와 Vue의 차이는 무엇인가요?');
    expect(practice.followUpQuestions[2]).toBe('React와 Svelte를 함께 쓴다면 각각 어떤 역할을 맡기겠어요?');
  });
});
