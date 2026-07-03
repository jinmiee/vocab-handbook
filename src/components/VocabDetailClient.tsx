'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useVocabStore } from 'src/hooks/useVocabStore';
import vocabData from 'src/data/vocab.json';
import { createInterviewPractice, getCategoryLabel, getRelatedItems, getTodayKey, type VocabItem } from 'src/lib/study';

interface VocabDetailClientProps {
  currentVocab: VocabItem;
  prevVocab: VocabItem | null;
  nextVocab: VocabItem | null;
  vocabIndex: number;
  totalCount: number;
}

// 텍스트를 구조화하여 가독성 있게 렌더링하는 헬퍼 함수
function renderDetailContent(detailText: string) {
  if (!detailText) return null;

  const lines = detailText.split('\n');
  return lines.map((line, index) => {
    const trimmed = line.trim();

    // == 헤더 == 매칭
    if (trimmed.startsWith('==') && trimmed.endsWith('==')) {
      const title = trimmed.replace(/==/g, '').trim();
      return (
        <h4 key={index} className="text-base font-extrabold text-slate-800 dark:text-slate-100 mt-6 mb-3 flex items-center border-b border-slate-100 dark:border-slate-700 pb-1">
          <span className="w-1.5 h-4 bg-blue-500 rounded-full mr-2"></span>
          {title}
        </h4>
      );
    }

    // - 리스트 매칭
    if (trimmed.startsWith('-')) {
      const content = trimmed.substring(1).trim();
      return (
        <li key={index} className="text-slate-600 dark:text-slate-300 text-sm font-medium ml-3 list-none mb-2 leading-relaxed flex items-start">
          <span className="text-blue-400 mr-2 select-none">•</span>
          <span className="flex-1">{content}</span>
        </li>
      );
    }

    // 숫자 리스트 매칭 (예: 1. 배포)
    const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
    if (numMatch) {
      const num = numMatch[1];
      const content = numMatch[2];
      return (
        <div key={index} className="text-slate-600 dark:text-slate-300 text-sm font-medium ml-3 mb-2 leading-relaxed flex items-start">
          <span className="text-blue-500 dark:text-blue-400 font-bold mr-2 select-none">{num}.</span>
          <span className="flex-1">{content}</span>
        </div>
      );
    }

    // 빈 줄
    if (trimmed === '') {
      return <div key={index} className="h-3"></div>;
    }

    // 일반 문장
    return (
      <p key={index} className="text-slate-600 dark:text-slate-300 text-sm font-medium leading-relaxed mb-2.5">
        {line}
      </p>
    );
  });
}

export default function VocabDetailClient({ currentVocab, prevVocab, nextVocab, vocabIndex, totalCount }: VocabDetailClientProps) {
  const router = useRouter();
  const store = useVocabStore();
  const [noteDraft, setNoteDraft] = useState('');

  // 최근 조회에 추가
  useEffect(() => {
    if (currentVocab && store.isInitialized) {
      store.addToRecent(currentVocab.id);
    }
    // store functions are recreated by the lightweight localStorage hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVocab.id, store.isInitialized]);

  // 단어를 이동할 때마다 그 단어에 저장된 내 메모로 입력창 내용을 맞춘다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNoteDraft(store.notes[currentVocab.id] ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVocab.id, store.isInitialized]);

  if (!store.isInitialized) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
        <div className="animate-pulse flex flex-col items-center w-full space-y-4">
          <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-64 w-full bg-slate-200 dark:bg-slate-700 rounded-3xl"></div>
          <div className="h-10 w-full bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const isFavorite = store.favorites.includes(currentVocab.id);
  const isMemorized = store.memorized.includes(currentVocab.id);
  const isNeedReview = store.needsReview.includes(currentVocab.id);
  const schedule = store.reviewSchedules[currentVocab.id];
  const relatedItems = getRelatedItems(currentVocab, vocabData);
  const interviewPractice = createInterviewPractice(currentVocab, relatedItems);
  const nextReviewText = schedule ? (schedule.nextReviewAt <= getTodayKey() ? '오늘 다시 복습' : `${schedule.nextReviewAt} 복습`) : '학습 상태를 선택하면 자동 계산';

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 min-h-dvh pb-24 relative overflow-visible">
      {/* 상단 네비게이션 헤더 */}
      <div className="bg-white dark:bg-slate-800 px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center sticky top-0 z-30">
        <button onClick={() => router.back()} className="flex items-center space-x-1 text-slate-600 dark:text-slate-300 hover:text-slate-800 transition-colors py-1.5 pr-3 active:scale-95 duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          <span className="text-sm font-bold">뒤로</span>
        </button>

        <span className="text-xs font-black text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full uppercase tracking-wider">{getCategoryLabel(currentVocab)}</span>

        {/* 즐겨찾기 버튼 */}
        <button
          onClick={() => store.toggleFavorite(currentVocab.id)}
          aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          aria-pressed={isFavorite}
          className="p-2 -mr-2 rounded-full text-slate-400 dark:text-slate-500 hover:text-amber-500 transition-colors active:scale-90 duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isFavorite ? '#f59e0b' : 'none'} stroke={isFavorite ? '#f59e0b' : 'currentColor'} strokeWidth={2} className="w-6 h-6">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499c.172-.375.666-.375.838 0l2.14 4.341 4.786.695c.41.06.574.56.278.852l-3.466 3.38.818 4.767c.07.411-.362.724-.724.53l-4.28-2.25-4.28 2.25c-.362.194-.794-.12-.724-.53l.818-4.767-3.467-3.38c-.296-.292-.132-.792.278-.853l4.786-.695 2.14-4.34z"
            />
          </svg>
        </button>
      </div>

      {/* 단어 상세 카드 */}
      <div className="p-5 flex flex-col space-y-5">
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6.5 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col min-h-[400px] h-auto overflow-visible">
          <div className="space-y-4">
            {/* 키워드 */}
            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-tight">{currentVocab.keyword}</h2>

            {/* 한줄 설명 */}
            <div className="bg-blue-50/50 dark:bg-blue-950/40 rounded-2xl p-4.5 border border-blue-100/30 dark:border-blue-800/60">
              <span className="text-[10px] font-extrabold text-blue-500 dark:text-blue-400 uppercase tracking-wide">한줄설명</span>
              <p className="text-slate-700 dark:text-slate-300 text-sm font-bold leading-relaxed mt-1">{currentVocab.summary}</p>
            </div>

            {/* 복습 스케줄 */}
            <div className="bg-orange-50/60 dark:bg-orange-950/40 rounded-2xl p-4 border border-orange-100 dark:border-orange-800/60">
              <div className="flex justify-between items-center gap-3">
                <div>
                  <span className="text-[10px] font-extrabold text-orange-500 dark:text-orange-400 uppercase tracking-wide">다음 복습 추천</span>
                  <p className="text-slate-700 dark:text-slate-300 text-sm font-black mt-1">{nextReviewText}</p>
                </div>
                <div className="text-right text-[10px] font-bold text-orange-700 dark:text-orange-300">
                  <p>연속 정답 {schedule?.correctStreak ?? 0}회</p>
                  <p>오답 {schedule?.wrongCount ?? 0}회</p>
                </div>
              </div>
            </div>

            {/* 상세 설명 */}
            <div className="pt-2 text-slate-600 dark:text-slate-300 leading-relaxed font-medium overflow-visible">
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide">상세설명</span>
              <div className="mt-1 space-y-1 whitespace-pre-line break-words overflow-visible">{renderDetailContent(currentVocab.detail)}</div>
            </div>
          </div>

          {/* 학습 상태 제어 버튼 영역 (하단 배치) */}
          <div className="grid grid-cols-3 gap-2 mt-10 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={() => store.markStudyResult(currentVocab.id, 'dontknow')}
              className={`py-3.5 px-2 rounded-2xl font-black text-xs transition-all duration-200 active:scale-95 flex items-center justify-center shadow-sm ${schedule?.lastResult === 'dontknow' ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300'}`}
            >
              몰라요
            </button>

            <button
              onClick={() => store.markStudyResult(currentVocab.id, 'know')}
              className={`py-3.5 px-2 rounded-2xl font-black text-xs transition-all duration-200 active:scale-95 flex items-center justify-center space-x-1.5 shadow-sm ${isMemorized ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300'}`}
            >
              {isMemorized ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>외웠어요</span>
                </>
              ) : (
                <span>외웠어요</span>
              )}
            </button>

            <button
              onClick={() => store.markStudyResult(currentVocab.id, 'unsure')}
              className={`py-3.5 px-2 rounded-2xl font-black text-xs transition-all duration-200 active:scale-95 flex items-center justify-center space-x-1.5 shadow-sm ${isNeedReview ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300'}`}
            >
              {isNeedReview ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span>헷갈려요</span>
                </>
              ) : (
                <span>헷갈려요</span>
              )}
            </button>
          </div>
        </div>

        {/* 내 메모 */}
        <section className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 space-y-3">
          <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">내 메모</h3>
          <textarea
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            onBlur={() => store.updateNote(currentVocab.id, noteDraft)}
            rows={3}
            placeholder="이 단어에 대한 나만의 메모를 남겨보세요. (예: 실무에서 겪었던 예시, 헷갈리는 포인트)"
            className="w-full resize-none bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </section>

        {/* 면접 모드 */}
        <section className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">면접 모드</h3>
            <Link href="/interview" className="text-[11px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/60 px-3 py-2 rounded-xl active:scale-95 transition-all">
              연습하기
            </Link>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
            <p className="text-xs font-black text-slate-700 dark:text-slate-300 leading-relaxed">{interviewPractice.question}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {interviewPractice.answerKeywords.slice(0, 6).map((keyword) => (
              <span key={keyword} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 px-2.5 py-1.5 rounded-full">
                {keyword}
              </span>
            ))}
          </div>
        </section>

        {/* 관련 단어 */}
        {relatedItems.length > 0 && (
          <section className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 space-y-3">
            <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">관련 단어</h3>
            <div className="flex flex-wrap gap-2">
              {relatedItems.map((item) => (
                <Link key={item.id} href={`/vocab/${item.id}`} className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/60 px-3 py-2 rounded-xl active:scale-95 transition-all">
                  {item.keyword}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 이전 / 다음 단어 네비게이션 */}
        <div className="flex justify-between items-center px-1">
          {prevVocab ? (
            <Link href={`/vocab/${prevVocab.id}`} className="flex items-center space-x-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 transition-colors py-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              <span className="truncate max-w-[120px]">이전: {prevVocab.keyword}</span>
            </Link>
          ) : (
            <span className="text-xs text-slate-300 dark:text-slate-600 font-bold select-none py-2">처음 단어</span>
          )}

          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 select-none">
            {vocabIndex + 1} / {totalCount}
          </span>

          {nextVocab ? (
            <Link href={`/vocab/${nextVocab.id}`} className="flex items-center space-x-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 transition-colors py-2">
              <span className="truncate max-w-[120px]">다음: {nextVocab.keyword}</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ) : (
            <span className="text-xs text-slate-300 dark:text-slate-600 font-bold select-none py-2">마지막 단어</span>
          )}
        </div>
      </div>
    </div>
  );
}
