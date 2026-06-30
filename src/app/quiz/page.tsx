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

interface Question {
  correctItem: VocabItem;
  type: 'keywordToSummary' | 'summaryToKeyword';
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
  }[];
}

export default function Quiz() {
  const store = useVocabStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [quizStarted, setQuizStarted] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [incorrectItems, setIncorrectItems] = useState<VocabItem[]>([]);
  const [quizFinished, setQuizFinished] = useState(false);

  const categories = useMemo(() => {
    const set = new Set(vocabData.map((item) => item.category));
    return Array.from(set).filter(Boolean);
  }, []);

  // 퀴즈 생성 로직 (10문항)
  const generateQuiz = () => {
    let pool = [...vocabData];
    if (selectedCategory !== 'all') {
      pool = pool.filter((item) => item.category === selectedCategory);
    }

    if (pool.length < 4) {
      alert('선택한 카테고리의 단어가 너무 적어 퀴즈를 출제할 수 없습니다. (최소 4개 필요)');
      return;
    }

    // 10문제 랜덤 추출 (단어 개수가 10개보다 작으면 그 크기만큼)
    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
    const quizItems = shuffledPool.slice(0, Math.min(10, shuffledPool.length));

    const generatedQuestions: Question[] = quizItems.map((correctItem) => {
      // 퀴즈 문제 유형 랜덤 결정
      const type = Math.random() > 0.5 ? 'keywordToSummary' : 'summaryToKeyword';
      
      // 오답 보기 3개 추출 (전체 단어 중 중복 제외)
      const distractors = vocabData
        .filter((item) => item.id !== correctItem.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      
      const options = [correctItem, ...distractors]
        .sort(() => Math.random() - 0.5)
        .map((item) => ({
          id: item.id,
          text: type === 'keywordToSummary' ? item.summary : item.keyword,
          isCorrect: item.id === correctItem.id,
        }));

      return {
        correctItem,
        type,
        options,
      };
    });

    setQuestions(generatedQuestions);
    setCurrentQuestionIndex(0);
    setSelectedOptionId(null);
    setIsAnswered(false);
    setScore(0);
    setIncorrectItems([]);
    setQuizFinished(false);
    setQuizStarted(true);
  };

  const handleOptionSelect = (optionId: string, isCorrect: boolean) => {
    if (isAnswered) return;
    
    setSelectedOptionId(optionId);
    setIsAnswered(true);

    const currentQuestion = questions[currentQuestionIndex];

    if (isCorrect) {
      setScore((prev) => prev + 1);
    } else {
      setIncorrectItems((prev) => [...prev, currentQuestion.correctItem]);
      // 오답은 로컬 저장소 오답노트(needsReview)에 자동 추가
      store.addToReview(currentQuestion.correctItem.id);
    }

    // 퀴즈 진행에 따라 최근 본 단어로 저장
    store.addToRecent(currentQuestion.correctItem.id);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOptionId(null);
      setIsAnswered(false);
    } else {
      // 퀴즈 종료
      setQuizFinished(true);
      // 통계기록 추가
      store.addQuizRecord(score + (selectedOptionId && questions[currentQuestionIndex].options.find(o => o.id === selectedOptionId)?.isCorrect ? 1 : 0), questions.length);
    }
  };

  const restartQuiz = () => {
    generateQuiz();
  };

  const currentQuestion = questions[currentQuestionIndex];

  if (!store.isInitialized) {
    return (
      <div className="flex-grow bg-slate-50 p-5 space-y-4 pb-24 min-h-screen">
        <div className="h-8 w-24 bg-slate-200 rounded animate-pulse"></div>
        <div className="h-64 w-full bg-slate-200 rounded-3xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-slate-50 p-5 space-y-4 pb-24 min-h-screen justify-between">
      {/* 1. 시작 대기 화면 */}
      {!quizStarted && (
        <div className="flex-grow flex flex-col justify-center space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black text-slate-800">데일리 개발 용어 퀴즈</h1>
            <p className="text-xs font-semibold text-slate-400 max-w-[240px] mx-auto leading-relaxed">
              4지선다형 객관식 퀴즈를 통해 오늘 배운 개발 용어 지식을 점검해보세요.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase">출제 카테고리 선택</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full text-sm font-bold text-slate-600 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체 카테고리</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={generateQuiz}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-black py-4 rounded-2xl shadow-md transition-all active:scale-[0.98] text-sm"
            >
              퀴즈 시작하기
            </button>
          </div>
        </div>
      )}

      {/* 2. 퀴즈 진행 중 화면 */}
      {quizStarted && !quizFinished && currentQuestion && (
        <div className="flex-grow flex flex-col justify-between space-y-5">
          {/* 퀴즈 헤더 */}
          <div className="flex justify-between items-center text-xs font-black text-slate-400 pt-3 px-1">
            <span>문제 {currentQuestionIndex + 1} / {questions.length}</span>
            <span className="text-blue-500 bg-blue-50 px-2 py-0.5 rounded">
              {currentQuestion.correctItem.category}
            </span>
          </div>

          {/* 문제 카드 */}
          <div className="bg-white rounded-3xl p-6.5 shadow-sm border border-slate-100 flex-grow flex flex-col justify-center my-2 min-h-[160px]">
            <span className="text-[10px] font-extrabold text-blue-500 uppercase tracking-widest text-center block mb-3">
              {currentQuestion.type === 'keywordToSummary' ? 'Q. 다음 용어의 올바른 설명은?' : 'Q. 다음 설명에 알맞은 용어는?'}
            </span>
            <h2 className="text-xl font-black text-slate-800 text-center leading-relaxed break-keep">
              {currentQuestion.type === 'keywordToSummary'
                ? currentQuestion.correctItem.keyword
                : currentQuestion.correctItem.summary}
            </h2>
          </div>

          {/* 4지선다 보기 리스트 */}
          <div className="space-y-2.5">
            {currentQuestion.options.map((option) => {
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

          {/* 다음 문제 버튼 */}
          <div className="pt-2">
            {isAnswered ? (
              <button
                onClick={handleNextQuestion}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center space-x-1"
              >
                <span>{currentQuestionIndex === questions.length - 1 ? '퀴즈 결과 보기' : '다음 문제'}</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            ) : (
              <div className="h-[52px]"></div> // 레이아웃 흔들림 방지용 공백
            )}
          </div>
        </div>
      )}

      {/* 3. 퀴즈 완료 리포트 화면 */}
      {quizFinished && (
        <div className="flex-grow flex flex-col justify-center space-y-6">
          <div className="text-center space-y-1 pt-3">
            <h2 className="text-2xl font-black text-slate-800">퀴즈 결과 리포트</h2>
            <p className="text-xs font-semibold text-slate-400">학습 성과를 한 눈에 파악해 보세요</p>
          </div>

          {/* 점수 요약 */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-center space-y-3">
            <span className="text-[10px] font-extrabold text-blue-500 uppercase tracking-widest">최종 점수</span>
            <div className="text-5xl font-black text-slate-800">
              {score} <span className="text-lg text-slate-400 font-bold">/ {questions.length}</span>
            </div>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              {score === questions.length
                ? '🎉 완벽합니다! 모든 용어를 완벽하게 파악하셨네요!'
                : score >= 7
                ? '👍 아주 훌륭합니다! 조금만 더 공부하면 만점이에요.'
                : '📚 오답 단어를 집중적으로 복습해 볼까요?'}
            </p>
          </div>

          {/* 오답 단어 목록 */}
          {incorrectItems.length > 0 && (
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              <h3 className="text-xs font-black text-slate-400 uppercase px-1">틀린 단어 오답노트 저장 목록 ({incorrectItems.length})</h3>
              <div className="space-y-2">
                {incorrectItems.map((item) => (
                  <div key={item.id} className="bg-white rounded-xl p-3 border border-slate-100 flex justify-between items-center shadow-xs">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{item.keyword}</h4>
                      <p className="text-[10px] text-slate-400 truncate max-w-[200px] mt-0.5">{item.summary}</p>
                    </div>
                    <Link
                      href={`/vocab/${item.id}`}
                      className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2.5 py-1.5 rounded-lg active:scale-95 transition-all"
                    >
                      상세 보기
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 하단 제어 버튼 */}
          <div className="flex flex-col space-y-2.5 pt-2">
            <button
              onClick={restartQuiz}
              className="bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl shadow-md transition-all active:scale-[0.98] text-sm"
            >
              다시 도전하기
            </button>
            <Link
              href="/"
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-4 rounded-2xl transition-all active:scale-[0.98] text-center text-sm"
            >
              홈 화면으로 가기
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
