'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useVocabStore } from 'src/hooks/useVocabStore';
import vocabData from 'src/data/vocab.json';
import { createInterviewPractice, getCategories, getCategoryLabel, getRelatedItems, shuffle, type VocabItem } from 'src/lib/study';

type PracticeTarget = 'all' | 'review' | 'unsure' | 'dontknow' | 'favorite';

const targetLabels: Record<PracticeTarget, string> = {
  all: '전체 단어',
  review: '복습 대상',
  unsure: '헷갈려요',
  dontknow: '몰라요',
  favorite: '북마크',
};

const typedVocabData = vocabData as VocabItem[];

function normalizeAnswer(text: string) {
  return text.toLowerCase().replace(/\s+/g, '');
}

export default function InterviewPracticePage() {
  const store = useVocabStore();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTarget, setSelectedTarget] = useState<PracticeTarget>('all');
  const [practiceItems, setPracticeItems] = useState<VocabItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);

  const categories = useMemo(() => getCategories(typedVocabData), []);

  const filteredItems = useMemo(() => {
    return typedVocabData.filter((item) => {
      const schedule = store.reviewSchedules[item.id];
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesTarget =
        selectedTarget === 'all' ||
        (selectedTarget === 'review' && store.needsReview.includes(item.id)) ||
        (selectedTarget === 'unsure' && schedule?.lastResult === 'unsure') ||
        (selectedTarget === 'dontknow' && (schedule?.lastResult === 'dontknow' || schedule?.lastResult === 'incorrect')) ||
        (selectedTarget === 'favorite' && store.favorites.includes(item.id));

      return matchesCategory && matchesTarget;
    });
  }, [selectedCategory, selectedTarget, store.favorites, store.needsReview, store.reviewSchedules]);

  const currentItem = practiceItems[currentIndex];
  const relatedItems = currentItem ? getRelatedItems(currentItem, typedVocabData, 4) : [];
  const practice = currentItem ? createInterviewPractice(currentItem, relatedItems) : null;
  const normalizedAnswer = normalizeAnswer(answer);
  const checkedKeywords =
    practice?.answerKeywords.map((keyword) => ({
      keyword,
      matched: normalizedAnswer.includes(normalizeAnswer(keyword)),
    })) ?? [];
  const matchedKeywordCount = checkedKeywords.filter((entry) => entry.matched).length;

  const startSession = () => {
    if (filteredItems.length === 0) {
      alert('선택한 조건에 맞는 단어가 없습니다.');
      return;
    }

    const shuffled = shuffle(filteredItems).slice(0, 10);
    setPracticeItems(shuffled);
    setCurrentIndex(0);
    setAnswer('');
    setShowAnswer(false);
    setSessionStarted(true);
  };

  const moveNext = () => {
    if (currentIndex < practiceItems.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setAnswer('');
      setShowAnswer(false);
    } else {
      setSessionStarted(false);
      setPracticeItems([]);
      setCurrentIndex(0);
      setAnswer('');
      setShowAnswer(false);
    }
  };

  const handleSelfReview = (result: 'know' | 'unsure' | 'dontknow') => {
    if (!currentItem) return;
    store.markStudyResult(currentItem.id, result);
    store.addToRecent(currentItem.id);
    moveNext();
  };

  if (!store.isInitialized) {
    return (
      <main className="flex-grow bg-slate-50 dark:bg-slate-900 p-5 space-y-4 pb-24 min-h-screen">
        <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
        <div className="h-80 w-full bg-slate-200 dark:bg-slate-700 rounded-3xl animate-pulse"></div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 p-5 space-y-4 pb-24 min-h-screen justify-between">
      {!sessionStarted && (
        <div className="flex-grow flex flex-col justify-center space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">면접 질문 연습</h1>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 max-w-[240px] mx-auto leading-relaxed">배운 용어를 직접 설명해보며 면접 답변 실력을 점검해보세요.</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 space-y-5">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900 rounded-2xl p-1 border border-slate-100 dark:border-slate-700">
              <Link href="/quiz" className="text-slate-500 dark:text-slate-400 rounded-xl py-2.5 text-xs font-black text-center active:scale-95 transition-all">
                객관식 퀴즈
              </Link>
              <button className="bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm rounded-xl py-2.5 text-xs font-black">면접 질문</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">카테고리</span>
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="w-full text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl px-3 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">전체</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">연습 대상</span>
                <select
                  value={selectedTarget}
                  onChange={(event) => setSelectedTarget(event.target.value as PracticeTarget)}
                  className="w-full text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl px-3 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(targetLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="bg-blue-50/60 dark:bg-blue-950/40 rounded-2xl p-4 border border-blue-100 dark:border-blue-800/60">
              <p className="text-xs font-black text-blue-600 dark:text-blue-400">선택된 단어 {filteredItems.length}개</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">한 번에 최대 10개씩 면접 질문 카드로 연습합니다.</p>
            </div>

            <button onClick={startSession} className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-black py-4 rounded-2xl shadow-md transition-all active:scale-[0.98] text-sm">
              면접 연습 시작하기
            </button>
          </div>
        </div>
      )}

      {sessionStarted && currentItem && practice && (
        <section className="flex-grow flex flex-col space-y-4">
          <div className="flex justify-between items-center text-xs font-black text-slate-400 dark:text-slate-500 pt-3 px-1">
            <span>
              질문 {currentIndex + 1} / {practiceItems.length}
            </span>
            <span className="text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded-lg">{getCategoryLabel(currentItem)}</span>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] font-extrabold text-blue-500 dark:text-blue-400 uppercase tracking-widest">Q.</p>
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 leading-relaxed break-keep">{practice.question}</h2>
            </div>

            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              rows={7}
              placeholder="내 답변을 적어보세요."
              className="w-full resize-none bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-300 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button onClick={() => setShowAnswer((prev) => !prev)} className="w-full bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-black py-3.5 rounded-2xl transition-all active:scale-[0.98] text-sm">
              {showAnswer ? '모범 답변 접기' : '모범 답변 보기'}
            </button>

            {showAnswer && (
              <div className="space-y-3">
                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-slate-600 dark:text-slate-300">핵심 키워드 체크리스트</p>
                      <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                        답변 채점이 아니라, 이 단어들을 언급했는지만 확인하는 참고용이에요.
                      </p>
                    </div>
                    <p className="text-[11px] font-black text-blue-500 dark:text-blue-400 flex-shrink-0">
                      {matchedKeywordCount} / {checkedKeywords.length}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {checkedKeywords.map((entry) => (
                      <span
                        key={entry.keyword}
                        className={`text-[11px] font-bold px-2.5 py-1.5 rounded-full border ${entry.matched ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/60' : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-700'}`}
                      >
                        {entry.matched ? '✓' : ''}
                        {entry.keyword}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl p-4 border border-indigo-100 dark:border-indigo-800/60">
                  <p className="text-[10px] font-extrabold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-2">모범 답변</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{practice.modelAnswer}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-black text-slate-500 dark:text-slate-400">꼬리 질문</p>
                  {practice.followUpQuestions.map((question) => (
                    <div key={question} className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">{question}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => handleSelfReview('know')} className="bg-emerald-500 text-white font-black text-xs py-3.5 rounded-2xl active:scale-95 transition-all">
              잘 답변함
            </button>
            <button onClick={() => handleSelfReview('unsure')} className="bg-orange-500 text-white font-black text-xs py-3.5 rounded-2xl active:scale-95 transition-all">
              조금 부족함
            </button>
            <button onClick={() => handleSelfReview('dontknow')} className="bg-rose-500 text-white font-black text-xs py-3.5 rounded-2xl active:scale-95 transition-all">
              다시 봐야 함
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
