'use client';

import { useMemo } from 'react';
import { useVocabStore } from 'src/hooks/useVocabStore';
import vocabData from 'src/data/vocab.json';

export default function Stats() {
  const store = useVocabStore();

  const totalCount = vocabData.length;
  const memorizedCount = store.memorized.length;
  const needsReviewCount = store.needsReview.length;
  const favoriteCount = store.favorites.length;

  // 전체 진행률
  const progressPercent = totalCount > 0 ? Math.round((memorizedCount / totalCount) * 100) : 0;

  // 카테고리별 통계 계산
  const categoryStats = useMemo(() => {
    const stats: { [key: string]: { total: number; memorized: number } } = {};
    vocabData.forEach((item) => {
      const cat = item.category || '기타';
      if (!stats[cat]) {
        stats[cat] = { total: 0, memorized: 0 };
      }
      stats[cat].total += 1;
      if (store.memorized.includes(item.id)) {
        stats[cat].memorized += 1;
      }
    });

    return Object.entries(stats).map(([name, data]) => ({
      name,
      total: data.total,
      memorized: data.memorized,
      percent: data.total > 0 ? Math.round((data.memorized / data.total) * 100) : 0,
    }));
  }, [store.memorized]);

  // 최근 학습 날짜
  const lastStudyDate = useMemo(() => {
    if (store.quizHistory.length > 0) {
      return store.quizHistory[0].date;
    }
    return '학습 이력 없음';
  }, [store.quizHistory]);

  if (!store.isInitialized) {
    return (
      <div className="flex-grow bg-slate-50 p-5 space-y-4 pb-24 min-h-screen">
        <div className="h-8 w-24 bg-slate-200 rounded animate-pulse"></div>
        <div className="h-44 w-full bg-slate-200 rounded-3xl animate-pulse"></div>
        <div className="h-64 w-full bg-slate-200 rounded-3xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-slate-50 p-5 space-y-5 pb-24 min-h-screen">
      {/* 상단 타이틀 */}
      <div className="pt-3">
        <h1 className="text-2xl font-black text-slate-800">학습 통계 리포트</h1>
        <p className="text-xs font-semibold text-slate-400 mt-0.5">
          매일 차곡차곡 쌓여가는 지식을 시각적으로 확인하세요
        </p>
      </div>

      {/* 종합 현황 카드 */}
      <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-extrabold text-blue-500 uppercase tracking-widest">종합 학습 진행 현황</span>
          <span className="text-xs font-bold text-slate-400">최근 학습: {lastStudyDate}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100/50">
            <span className="text-[10px] text-slate-400 font-extrabold block">외운 단어</span>
            <span className="text-xl font-black text-emerald-600 block mt-1">{memorizedCount}개</span>
          </div>

          <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100/50">
            <span className="text-[10px] text-slate-400 font-extrabold block">오답/복습</span>
            <span className="text-xl font-black text-rose-500 block mt-1">{needsReviewCount}개</span>
          </div>

          <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100/50">
            <span className="text-[10px] text-slate-400 font-extrabold block">북마크</span>
            <span className="text-xl font-black text-amber-500 block mt-1">{favoriteCount}개</span>
          </div>
        </div>

        <div className="space-y-1.5 border-t border-slate-100 pt-3">
          <div className="flex justify-between text-xs font-black text-slate-600">
            <span>총 단어 학습 완료율</span>
            <span className="text-blue-500">{progressPercent}% ({memorizedCount}/{totalCount})</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </section>

      {/* 카테고리별 진행 상황 */}
      <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
        <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">시트 카테고리별 학습률</h2>
        <div className="space-y-3.5">
          {categoryStats.map((cat) => (
            <div key={cat.name} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <span className="truncate pr-4">{cat.name}</span>
                <span className="text-slate-500 text-[11px] flex-shrink-0">
                  {cat.percent}% ({cat.memorized}/{cat.total})
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-400 to-blue-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${cat.percent}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 최근 퀴즈 기록 */}
      <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-3 flex-1 min-h-[160px] overflow-hidden flex flex-col justify-between">
        <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">최근 퀴즈 풀이 이력</h2>
        
        {store.quizHistory.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6 text-slate-400 space-y-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-slate-300">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
            <p className="text-xs font-bold">아직 퀴즈 이력이 없습니다.</p>
            <p className="text-[10px]">용어를 공부한 뒤 퀴즈에 도전해 보세요!</p>
          </div>
        ) : (
          <div className="flex-grow overflow-y-auto max-h-[180px] space-y-2 mt-2 pr-1">
            {store.quizHistory.map((record, index) => {
              const quizPercent = record.total > 0 ? Math.round((record.correct / record.total) * 100) : 0;
              return (
                <div key={index} className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-extrabold text-slate-700 block">학습 퀴즈 세션</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">{record.date}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-800 text-sm block">
                      {record.correct} / {record.total}
                    </span>
                    <span className={`text-[10px] font-bold block mt-0.5 ${
                      quizPercent >= 80 ? 'text-emerald-600' : quizPercent >= 50 ? 'text-orange-500' : 'text-rose-500'
                    }`}>
                      정답률 {quizPercent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
