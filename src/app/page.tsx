'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useVocabStore } from 'src/hooks/useVocabStore';
import vocabData from 'src/data/vocab.json';

interface VocabItem {
  id: string;
  keyword: string;
  summary: string;
  detail: string;
  category: string;
}

export default function Home() {
  const store = useVocabStore();
  const [todaysWord, setTodaysWord] = useState<VocabItem | null>(null);

  // 오늘의 단어 설정 (매일 날짜 기준으로 다르게 표시되도록 설정)
  useEffect(() => {
    if (vocabData.length > 0) {
      const today = new Date();
      // 연, 월, 일을 조합해 매일 고유한 인덱스를 얻음
      const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
      const index = seed % vocabData.length;
      setTodaysWord(vocabData[index]);
    }
  }, []);

  if (!store.isInitialized || !todaysWord) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 min-h-screen">
        <div className="animate-pulse flex flex-col items-center w-full space-y-4">
          <div className="h-8 w-40 bg-slate-200 rounded"></div>
          <div className="h-40 w-full bg-slate-200 rounded-2xl"></div>
          <div className="h-32 w-full bg-slate-200 rounded-2xl"></div>
          <div className="h-48 w-full bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // 학습 진행률 계산
  const totalCount = vocabData.length;
  const memorizedCount = store.memorized.length;
  const progressPercent = totalCount > 0 ? Math.round((memorizedCount / totalCount) * 100) : 0;
  const reviewCount = store.needsReview.length;

  // 최근 본 단어 가져오기
  const recentWordList = store.recentViews
    .map((id) => vocabData.find((item) => item.id === id))
    .filter((item): item is VocabItem => !!item);

  // 이어서 공부하기 대상 찾기
  // 마지막으로 본 단어가 있으면 그것으로 가고, 없으면 memorized 되지 않은 첫 번째 단어로 이동
  const continueStudyId =
    store.recentViews[0] ||
    vocabData.find((item) => !store.memorized.includes(item.id))?.id ||
    vocabData[0]?.id;

  return (
    <main className="flex-1 flex flex-col bg-slate-50 p-5 space-y-6 pb-24">
      {/* 상단 타이틀 */}
      <div className="flex justify-between items-center pt-3">
        <div>
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
            개발 용어 핸드북
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 mt-1">진미경 개발 단어장</h1>
        </div>
        
        {/* 리셋 단추 */}
        <button
          onClick={() => {
            if (confirm('학습 기록을 모두 초기화할까요?')) {
              store.resetAll();
            }
          }}
          className="text-xs text-slate-400 hover:text-red-500 font-medium transition-colors p-1"
        >
          기록 초기화
        </button>
      </div>

      {/* 학습 현황 대시보드 */}
      <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col space-y-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">나의 학습 현황</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-xl p-3 flex flex-col justify-center">
            <span className="text-xs text-slate-500 font-medium">전체 단어</span>
            <span className="text-2xl font-black text-slate-800 mt-0.5">{totalCount}개</span>
          </div>
          <div className="bg-orange-50/50 rounded-xl p-3 flex flex-col justify-center border border-orange-100/50">
            <span className="text-xs text-orange-600 font-medium">오늘 복습할 단어</span>
            <span className="text-2xl font-black text-orange-600 mt-0.5">{reviewCount}개</span>
          </div>
        </div>

        {/* 게이지 바 */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-xs font-bold text-slate-600">
            <span>학습 완료 진행률</span>
            <span className="text-blue-600">{progressPercent}% ({memorizedCount}/{totalCount})</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </section>

      {/* 빠른 시작 버튼 그리드 */}
      <section className="grid grid-cols-2 gap-3">
        <Link
          href={`/vocab/${continueStudyId}`}
          className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl p-4 shadow-md flex flex-col justify-between h-28 transition-all duration-200 active:scale-95"
        >
          <div className="bg-white/15 p-2 rounded-lg w-9 h-9 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
          </div>
          <span className="font-bold text-sm tracking-tight text-white/95">이어서 공부하기</span>
        </Link>

        <Link
          href="/card"
          className="bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-2xl p-4 shadow-md flex flex-col justify-between h-28 transition-all duration-200 active:scale-95"
        >
          <div className="bg-white/15 p-2 rounded-lg w-9 h-9 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125V6.375c0-.621-.504-1.125-1.125-1.125H3.375zM3.375 11.25c-.621 0-1.125.504-1.125 1.125v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026c0-.621-.504-1.125-1.125-1.125H3.375z" />
            </svg>
          </div>
          <span className="font-bold text-sm tracking-tight text-white/95">랜덤 암기 카드</span>
        </Link>

        <Link
          href="/quiz"
          className="bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-2xl p-4 shadow-md flex flex-col justify-between h-28 transition-all duration-200 active:scale-95"
        >
          <div className="bg-white/15 p-2 rounded-lg w-9 h-9 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.375M9 18h3.375m7.5-12h-18c-.621 0-1.125.504-1.125 1.125v13.5c0 .621.504 1.125 1.125 1.125h18c.621 0 1.125-.504 1.125-1.125V7.125c0-.621-.504-1.125-1.125-1.125zM11.25 7.5h.008v.008h-.008V7.5z" />
            </svg>
          </div>
          <span className="font-bold text-sm tracking-tight text-white/95">데일리 퀴즈 풀기</span>
        </Link>

        <Link
          href="/incorrect"
          className="bg-gradient-to-br from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-2xl p-4 shadow-md flex flex-col justify-between h-28 transition-all duration-200 active:scale-95"
        >
          <div className="bg-white/15 p-2 rounded-lg w-9 h-9 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <span className="font-bold text-sm tracking-tight text-white/95">틀린 단어 오답노트</span>
        </Link>
      </section>

      {/* 오늘의 단어 추천 카드 */}
      <section className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        {/* 배경에 깔릴 희미한 코드 브래킷 데코레이션 */}
        <div className="absolute right-[-10px] bottom-[-20px] text-white/5 font-mono text-9xl font-black select-none pointer-events-none">
          &lt;/&gt;
        </div>

        <div className="flex justify-between items-start">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-white/10 px-2.5 py-1 rounded-full">
            오늘의 학습 추천 단어
          </span>
          <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full">
            {todaysWord.category}
          </span>
        </div>

        <div className="mt-4">
          <h3 className="text-2xl font-black tracking-tight">{todaysWord.keyword}</h3>
          <p className="text-slate-300 text-sm mt-2 font-medium leading-relaxed">
            {todaysWord.summary}
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <Link
            href={`/vocab/${todaysWord.id}`}
            className="text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 px-4 py-2.5 rounded-xl transition-all duration-200 inline-flex items-center space-x-1 shadow-sm active:scale-95"
          >
            <span>상세히 학습하기</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </div>
      </section>

      {/* 최근 본 단어 */}
      <section className="flex flex-col space-y-3">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">최근 본 단어</h2>
        {recentWordList.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-slate-100 flex flex-col items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#cbd5e1" className="w-8 h-8 mb-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-16.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-16.25v14.25" />
            </svg>
            <p className="text-xs font-semibold text-slate-400">아직 본 단어가 없습니다.</p>
            <p className="text-[10px] text-slate-400 mt-0.5">단어장에 들어가 학습을 시작해보세요!</p>
          </div>
        ) : (
          <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide -mx-5 px-5">
            {recentWordList.map((item) => (
              <Link
                key={item.id}
                href={`/vocab/${item.id}`}
                className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 min-w-[150px] max-w-[200px] flex flex-col justify-between space-y-3 flex-shrink-0 transition-transform active:scale-95"
              >
                <div>
                  <span className="text-[9px] font-extrabold text-blue-500 bg-blue-50 px-2 py-0.5 rounded">
                    {item.category}
                  </span>
                  <h4 className="text-sm font-bold text-slate-800 mt-1.5 truncate">{item.keyword}</h4>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                  {item.summary}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
