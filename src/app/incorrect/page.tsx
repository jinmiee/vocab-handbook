'use client';

import { useState, useMemo } from 'react';
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

interface Question {
  correctItem: VocabItem;
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
  }[];
}

export default function IncorrectNote() {
  const store = useVocabStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // 오답 퀴즈 모드 상태
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // 복습할 단어 목록 조회
  const reviewList = useMemo(() => {
    return vocabData.filter((item) => store.needsReview.includes(item.id));
  }, [store.needsReview]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // 오답 퀴즈 시작 준비
  const startIncorrectQuiz = () => {
    if (reviewList.length < 2) {
      alert('오답노트에 최소 2개 이상의 단어가 들어있어야 퀴즈를 출제할 수 있습니다.');
      return;
    }

    const shuffledList = [...reviewList].sort(() => Math.random() - 0.5);
    const questionsPool = shuffledList.slice(0, 10); // 최대 10문제

    const generatedQuestions: Question[] = questionsPool.map((correctItem) => {
      // 오답 보기 3개 추출 (전체 vocabData 중 중복 제외)
      const distractors = vocabData
        .filter((item) => item.id !== correctItem.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(3, vocabData.length - 1));

      const options = [correctItem, ...distractors]
        .sort(() => Math.random() - 0.5)
        .map((item) => ({
          id: item.id,
          text: item.summary,
          isCorrect: item.id === correctItem.id,
        }));

      return {
        correctItem,
        options,
      };
    });

    setQuizQuestions(generatedQuestions);
    setQuizIndex(0);
    setSelectedOptionId(null);
    setIsAnswered(false);
    setQuizScore(0);
    setQuizFinished(false);
    setIsQuizMode(true);
  };

  const handleOptionSelect = (optionId: string, isCorrect: boolean) => {
    if (isAnswered) return;
    setSelectedOptionId(optionId);
    setIsAnswered(true);

    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
      // 오답노트 퀴즈 도중 맞히면 오답노트에서 자동 제거 처리
      store.removeFromReview(quizQuestions[quizIndex].correctItem.id);
    }
  };

  const handleNextQuestion = () => {
    if (quizIndex < quizQuestions.length - 1) {
      setQuizIndex((prev) => prev + 1);
      setSelectedOptionId(null);
      setIsAnswered(false);
    } else {
      setQuizFinished(true);
    }
  };

  if (!store.isInitialized) {
    return (
      <div className="flex-1 bg-slate-50 p-5 space-y-4 pb-24 min-h-screen">
        <div className="h-8 w-24 bg-slate-200 rounded animate-pulse"></div>
        <div className="h-64 w-full bg-slate-200 rounded-3xl animate-pulse"></div>
      </div>
    );
  }

  // 1. 오답 퀴즈 모드 화면
  if (isQuizMode && quizQuestions.length > 0) {
    const currentQ = quizQuestions[quizIndex];

    return (
      <main className="flex-1 flex flex-col bg-slate-50 p-5 space-y-4 pb-24 min-h-screen justify-between">
        {!quizFinished ? (
          <div className="flex-grow flex flex-col justify-between space-y-5">
            <div className="flex justify-between items-center text-xs font-black text-slate-400 pt-3">
              <span>오답 퀴즈 {quizIndex + 1} / {quizQuestions.length}</span>
              <button
                onClick={() => setIsQuizMode(false)}
                className="text-rose-500 hover:text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg font-bold"
              >
                퀴즈 중단
              </button>
            </div>

            <div className="bg-white rounded-3xl p-6.5 shadow-sm border border-slate-100 flex-grow flex flex-col justify-center my-2 min-h-[160px]">
              <span className="text-[10px] font-extrabold text-rose-500 uppercase tracking-widest text-center block mb-3">
                Q. 다음 단어의 알맞은 한줄설명은?
              </span>
              <h2 className="text-xl font-black text-slate-800 text-center leading-relaxed">
                {currentQ.correctItem.keyword}
              </h2>
            </div>

            <div className="space-y-2.5">
              {currentQ.options.map((option) => {
                const isSelected = selectedOptionId === option.id;
                const showCorrect = isAnswered && option.isCorrect;
                const showIncorrect = isAnswered && isSelected && !option.isCorrect;

                let btnClass = 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';
                if (showCorrect) {
                  btnClass = 'bg-emerald-500 border-emerald-500 text-white font-bold shadow-md';
                } else if (showIncorrect) {
                  btnClass = 'bg-rose-500 border-rose-500 text-white font-bold shadow-md';
                } else if (isAnswered) {
                  btnClass = 'bg-white border-slate-100 text-slate-300 opacity-60';
                }

                return (
                  <button
                    key={option.id}
                    onClick={() => handleOptionSelect(option.id, option.isCorrect)}
                    disabled={isAnswered}
                    className={`w-full text-left p-4 rounded-2xl border transition-all text-xs font-semibold leading-relaxed flex items-center justify-between active:scale-[0.99] ${btnClass}`}
                  >
                    <span className="flex-1 break-keep pr-3">{option.text}</span>
                    {showCorrect && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
                        <path fillRule="evenodd" d="M2.25 12a9.75 9.75 0 1119.5 0 9.75 9.75 0 01-19.5 0zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                      </svg>
                    )}
                    {showIncorrect && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
                        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              {isAnswered ? (
                <button
                  onClick={handleNextQuestion}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black py-4 rounded-2xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center space-x-1"
                >
                  <span>{quizIndex === quizQuestions.length - 1 ? '결과 보기' : '다음 문제'}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              ) : (
                <div className="h-[52px]"></div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-grow flex flex-col justify-center space-y-6 text-center">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-800 font-extrabold">오답 퀴즈 종료</h2>
              <p className="text-xs font-semibold text-slate-400">맞힌 단어는 오답노트에서 자동으로 제외되었습니다!</p>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-2">
              <span className="text-[10px] font-extrabold text-rose-500 uppercase tracking-widest">맞힌 문항</span>
              <div className="text-5xl font-black text-slate-800">
                {quizScore} <span className="text-lg text-slate-400 font-bold">/ {quizQuestions.length}</span>
              </div>
            </div>

            <div className="flex flex-col space-y-2 w-full pt-4">
              <button
                onClick={startIncorrectQuiz}
                className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-4 rounded-2xl shadow-md transition-all active:scale-[0.98] text-sm"
              >
                오답 퀴즈 다시 풀기
              </button>
              <button
                onClick={() => setIsQuizMode(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl transition-all active:scale-[0.98] text-sm"
              >
                오답 목록 보기
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }

  // 2. 기본 오답노트 목록 화면
  return (
    <main className="flex-1 flex flex-col bg-slate-50 p-5 space-y-4 pb-24 min-h-screen">
      {/* 상단 네비게이션 헤더 */}
      <div className="flex justify-between items-center pt-3">
        <Link
          href="/"
          className="flex items-center space-x-1 text-slate-600 hover:text-slate-800 transition-colors py-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          <span className="text-sm font-bold">홈으로</span>
        </Link>

        <h1 className="text-base font-extrabold text-slate-800">오답노트</h1>
        <div className="w-12"></div> {/* 균형 맞춤용 공백 */}
      </div>

      <div className="bg-rose-50/50 rounded-2xl p-4 border border-rose-100/50 flex justify-between items-center">
        <div>
          <h2 className="text-sm font-black text-rose-800">복습이 필요한 단어</h2>
          <p className="text-[11px] text-rose-600 font-semibold mt-0.5">
            퀴즈에서 틀렸거나 카드에서 모르는 단어들의 목록입니다.
          </p>
        </div>
        <span className="text-lg font-black text-rose-500 bg-white border border-rose-100 px-3 py-1 rounded-xl shadow-xs">
          {reviewList.length}개
        </span>
      </div>

      {reviewList.length > 0 && (
        <button
          onClick={startIncorrectQuiz}
          className="w-full bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-600 text-white font-black py-4 rounded-2xl shadow-md transition-all active:scale-[0.98] text-sm flex items-center justify-center space-x-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.375M9 18h3.375m7.5-12h-18c-.621 0-1.125.504-1.125 1.125v13.5c0 .621.504 1.125 1.125 1.125h18c.621 0 1.125-.504 1.125-1.125V7.125c0-.621-.504-1.125-1.125-1.125z" />
          </svg>
          <span>오답 단어로 퀴즈 풀기 ({reviewList.length})</span>
        </button>
      )}

      {/* 오답 단어 목록 */}
      <div className="flex-1 flex flex-col space-y-3">
        {reviewList.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 border border-slate-100 flex flex-col items-center justify-center text-center my-10 shadow-sm">
            <div className="bg-emerald-50 p-4 rounded-full mb-3 text-emerald-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-700 text-base">오답노트가 비어있습니다!</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              틀린 단어가 하나도 없네요.<br />
              완벽한 학습 상태를 유지하고 계십니다!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviewList.map((item) => {
              const isExpanded = expandedId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all"
                >
                  <div
                    onClick={() => toggleExpand(item.id)}
                    className="p-4 flex justify-between items-start cursor-pointer hover:bg-slate-50/20 active:bg-slate-50/50"
                  >
                    <div>
                      <span className="text-[9px] font-extrabold text-rose-500 bg-rose-50 px-2 py-0.5 rounded">
                        {item.category}
                      </span>
                      <h3 className="text-base font-bold text-slate-800 mt-1.5 tracking-tight">
                        {item.keyword}
                      </h3>
                      <p className="text-slate-500 text-xs font-semibold mt-1 line-clamp-1">
                        {item.summary}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2.5">
                      {/* 상세 보기 아코디언 토글 아이콘 */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="#94a3b8"
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-slate-50/30 border-t border-slate-100 p-4 space-y-4">
                      {/* 상세 설명 */}
                      <div>
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase">상세 설명</span>
                        <p className="text-slate-600 text-xs font-medium leading-relaxed mt-1 whitespace-pre-line">
                          {item.detail}
                        </p>
                      </div>

                      {/* 하단 제어 */}
                      <div className="flex justify-between items-center pt-2">
                        <Link
                          href={`/vocab/${item.id}`}
                          className="text-xs font-bold text-blue-500 hover:text-blue-600 bg-blue-50 px-3 py-2 rounded-xl transition-all"
                        >
                          전체 학습 상세 화면 가기
                        </Link>
                        
                        <button
                          onClick={() => store.removeFromReview(item.id)}
                          className="text-xs font-bold text-rose-500 hover:text-rose-600 bg-rose-50 px-3 py-2 rounded-xl transition-all"
                        >
                          오답노트에서 삭제
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
