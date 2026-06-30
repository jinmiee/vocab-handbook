'use client';

import { useState, useEffect, useMemo } from 'react';
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

// 피셔-예이츠 셔플 알고리즘
function shuffle(array: VocabItem[]) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function CardStudy() {
  const store = useVocabStore();
  const [isRandom, setIsRandom] = useState(false);
  const [cards, setCards] = useState<VocabItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyFinished, setStudyFinished] = useState(false);

  // 카테고리 필터링 추가
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const set = new Set(vocabData.map((item) => item.category));
    return Array.from(set).filter(Boolean);
  }, []);

  // 카드 목록 세팅 (필터 및 정렬 방식 기준)
  const initializeCards = () => {
    let list = [...vocabData];
    if (selectedCategory !== 'all') {
      list = list.filter((item) => item.category === selectedCategory);
    }
    
    if (isRandom) {
      list = shuffle(list);
    }
    
    setCards(list);
    setCurrentIndex(0);
    setIsFlipped(false);
    setStudyFinished(false);
  };

  useEffect(() => {
    if (store.isInitialized) {
      initializeCards();
    }
  }, [isRandom, selectedCategory, store.isInitialized]);

  const currentCard = cards[currentIndex];

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    } else {
      setStudyFinished(true);
    }
  };

  const handleAction = (type: 'know' | 'unsure' | 'dontknow') => {
    if (!currentCard) return;

    // 카드를 강제로 뒤집어 정답을 보여주고 넘어가거나, 바로 넘어감
    if (type === 'know') {
      store.toggleMemorized(currentCard.id); // 외운 단어 추가
      store.removeFromReview(currentCard.id); // 복습대상 제거
    } else {
      // 헷갈려요, 몰라요
      store.addToReview(currentCard.id); // 복습대상 추가
    }

    // 최근 본 단어 추가
    store.addToRecent(currentCard.id);

    // 다음 카드로
    setTimeout(() => {
      handleNext();
    }, 200);
  };

  if (!store.isInitialized) {
    return (
      <div className="flex-1 bg-slate-50 p-5 space-y-4 pb-24 min-h-screen">
        <div className="h-8 w-24 bg-slate-200 rounded animate-pulse"></div>
        <div className="h-80 w-full bg-slate-200 rounded-3xl animate-pulse"></div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex-grow flex flex-col bg-slate-50 p-5 pb-24 justify-center items-center text-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#cbd5e1" className="w-16 h-16 mb-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <h3 className="font-extrabold text-slate-700 text-lg">카드가 존재하지 않습니다</h3>
        <p className="text-xs text-slate-400 mt-1">카테고리를 변경해보세요.</p>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="mt-4 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-4 py-2.5 rounded-xl"
        >
          <option value="all">전체 카테고리</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-slate-50 p-5 space-y-4 pb-24 min-h-screen">
      {/* 상단 헤더 */}
      <div className="pt-3 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-800">암기 플래시카드</h1>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">단어를 보고 아는지 맞춰보세요</p>
        </div>

        {/* 셔플 토글 */}
        <button
          onClick={() => setIsRandom(!isRandom)}
          className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
            isRandom
              ? 'bg-indigo-500 border-indigo-500 text-white shadow-sm'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          랜덤 {isRandom ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* 카테고리 선택 셀렉트 박스 */}
      <div className="flex space-x-2 items-center">
        <span className="text-xs font-bold text-slate-400 uppercase">분류:</span>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="text-xs font-bold text-slate-600 bg-white border border-slate-100 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 flex-grow"
        >
          <option value="all">전체</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {studyFinished ? (
        // 학습 종료 화면
        <div className="flex-1 flex flex-col justify-center items-center bg-white rounded-3xl p-8 border border-slate-100 shadow-sm text-center my-6 space-y-6">
          <div className="bg-indigo-50 p-4 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#6366f1" className="w-12 h-12">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-extrabold text-slate-800">오늘의 카드 학습 완료!</h3>
            <p className="text-xs font-semibold text-slate-400 max-w-[240px] leading-relaxed mx-auto">
              모든 단어 카드를 한 번씩 검토했습니다.<br />
              틀리거나 헷갈린 단어는 복습노트에서 계속 확인할 수 있어요.
            </p>
          </div>
          <div className="flex flex-col space-y-2.5 w-full pt-4">
            <button
              onClick={initializeCards}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-md active:scale-95 text-sm"
            >
              처음부터 다시 학습하기
            </button>
            <Link
              href="/"
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 px-6 rounded-2xl transition-all active:scale-95 text-center text-sm"
            >
              홈 화면으로 돌아가기
            </Link>
          </div>
        </div>
      ) : (
        // 플래시 카드 영역
        <div className="flex-1 flex flex-col space-y-6 my-2">
          {/* 카드 진행 정보 */}
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 px-1">
            <span>진행률: {currentIndex + 1} / {cards.length}</span>
            <span className="text-indigo-500">{selectedCategory === 'all' ? '전체' : selectedCategory}</span>
          </div>

          {/* 3D 플립 카드 컴포넌트 */}
          <div
            onClick={handleFlip}
            className="w-full h-80 [perspective:1000px] cursor-pointer touch-manipulation"
          >
            <div
              className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${
                isFlipped ? '[transform:rotateY(180deg)]' : ''
              }`}
            >
              {/* 앞면: 키워드만 표시 */}
              <div className="absolute w-full h-full bg-white rounded-3xl p-6.5 shadow-sm border border-slate-100 flex flex-col items-center justify-center [backface-visibility:hidden]">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest absolute top-6">
                  TAP TO FLIP
                </span>
                
                <h2 className="text-3xl font-black text-slate-800 text-center tracking-tight leading-tight px-4 break-keep">
                  {currentCard.keyword}
                </h2>
                
                <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full absolute bottom-6">
                  {currentCard.category}
                </span>
              </div>

              {/* 뒷면: 설명 + 상세 설명 표시 */}
              <div className="absolute w-full h-full bg-white rounded-3xl p-6.5 shadow-sm border border-slate-100 flex flex-col justify-between [backface-visibility:hidden] [transform:rotateY(180deg)] overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                    <h3 className="text-lg font-black text-slate-800 leading-tight">
                      {currentCard.keyword}
                    </h3>
                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">
                      {currentCard.category}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100/50">
                      <span className="text-[9px] font-extrabold text-indigo-500">한줄설명</span>
                      <p className="text-slate-700 text-xs font-bold leading-relaxed mt-0.5">
                        {currentCard.summary}
                      </p>
                    </div>

                    <div className="max-h-[140px] overflow-y-auto pr-1">
                      <span className="text-[9px] font-extrabold text-slate-400">상세설명</span>
                      <p className="text-slate-600 text-xs font-medium leading-relaxed mt-0.5 whitespace-pre-line">
                        {currentCard.detail}
                      </p>
                    </div>
                  </div>
                </div>

                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest text-center block pt-2">
                  TAP TO FLIP BACK
                </span>
              </div>
            </div>
          </div>

          {/* 알아요 / 헷갈려요 / 몰라요 버튼 */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAction('dontknow');
              }}
              className="bg-rose-500 hover:bg-rose-600 text-white font-black text-xs py-4 px-3 rounded-2xl transition-all shadow-sm active:scale-95 flex flex-col items-center justify-center space-y-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>몰라요</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAction('unsure');
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs py-4 px-3 rounded-2xl transition-all shadow-sm active:scale-95 flex flex-col items-center justify-center space-y-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75" />
              </svg>
              <span>헷갈려요</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAction('know');
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-4 px-3 rounded-2xl transition-all shadow-sm active:scale-95 flex flex-col items-center justify-center space-y-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span>알아요</span>
            </button>
          </div>

          {/* 수동 컨트롤 (이전/다음 화살표) */}
          <div className="flex justify-between items-center px-1 pt-1">
            <button
              onClick={() => {
                if (currentIndex > 0) {
                  setCurrentIndex((prev) => prev - 1);
                  setIsFlipped(false);
                }
              }}
              disabled={currentIndex === 0}
              className={`text-xs font-bold flex items-center space-x-1 ${
                currentIndex === 0 ? 'text-slate-300' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              <span>이전 카드</span>
            </button>

            <button
              onClick={handleNext}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center space-x-1"
            >
              <span>건너뛰기</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
