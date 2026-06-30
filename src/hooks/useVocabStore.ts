'use client';

import { useState, useEffect } from 'react';

export interface QuizRecord {
  date: string;
  correct: number;
  total: number;
}

export function useVocabStore() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [memorized, setMemorized] = useState<string[]>([]);
  const [needsReview, setNeedsReview] = useState<string[]>([]);
  const [recentViews, setRecentViews] = useState<string[]>([]);
  const [quizHistory, setQuizHistory] = useState<QuizRecord[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // localStorage에서 데이터를 로드
  useEffect(() => {
    try {
      const storedFav = localStorage.getItem('vocab_favorites');
      const storedMem = localStorage.getItem('vocab_memorized');
      const storedRev = localStorage.getItem('vocab_needsReview');
      const storedRec = localStorage.getItem('vocab_recentViews');
      const storedQuiz = localStorage.getItem('vocab_quizHistory');

      if (storedFav) setFavorites(JSON.parse(storedFav));
      if (storedMem) setMemorized(JSON.parse(storedMem));
      if (storedRev) setNeedsReview(JSON.parse(storedRev));
      if (storedRec) setRecentViews(JSON.parse(storedRec));
      if (storedQuiz) setQuizHistory(JSON.parse(storedQuiz));
    } catch (e) {
      console.error('Failed to load vocab store from localStorage:', e);
    }
    setIsInitialized(true);
  }, []);

  // 상태가 변경될 때마다 localStorage에 저장
  const saveToLocal = (key: string, data: any) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        console.error(`Failed to save ${key} to localStorage:`, e);
      }
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveToLocal('vocab_favorites', next);
      return next;
    });
  };

  const toggleMemorized = (id: string) => {
    setMemorized((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveToLocal('vocab_memorized', next);
      // 외웠어요로 체크되면 자동으로 복습 대상(헷갈려요 등)에서 제외
      if (next.includes(id)) {
        setNeedsReview((rev) => {
          const updatedRev = rev.filter((x) => x !== id);
          saveToLocal('vocab_needsReview', updatedRev);
          return updatedRev;
        });
      }
      return next;
    });
  };

  const addToReview = (id: string) => {
    setNeedsReview((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveToLocal('vocab_needsReview', next);
      return next;
    });
    // 복습 대상이 되면 외운 상태에서는 당연히 해제됨
    setMemorized((mem) => {
      const nextMem = mem.filter((x) => x !== id);
      saveToLocal('vocab_memorized', nextMem);
      return nextMem;
    });
  };

  const removeFromReview = (id: string) => {
    setNeedsReview((prev) => {
      const next = prev.filter((x) => x !== id);
      saveToLocal('vocab_needsReview', next);
      return next;
    });
  };

  const addToRecent = (id: string) => {
    setRecentViews((prev) => {
      // 이미 있으면 앞으로 순서만 옮김
      const filtered = prev.filter((x) => x !== id);
      const next = [id, ...filtered].slice(0, 10); // 최대 10개 제한
      saveToLocal('vocab_recentViews', next);
      return next;
    });
  };

  const addQuizRecord = (correct: number, total: number) => {
    const newRecord: QuizRecord = {
      date: new Date().toLocaleDateString('ko-KR'),
      correct,
      total,
    };
    setQuizHistory((prev) => {
      const next = [newRecord, ...prev].slice(0, 50); // 최근 50개 퀴즈 이력 관리
      saveToLocal('vocab_quizHistory', next);
      return next;
    });
  };

  const resetAll = () => {
    setFavorites([]);
    setMemorized([]);
    setNeedsReview([]);
    setRecentViews([]);
    setQuizHistory([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vocab_favorites');
      localStorage.removeItem('vocab_memorized');
      localStorage.removeItem('vocab_needsReview');
      localStorage.removeItem('vocab_recentViews');
      localStorage.removeItem('vocab_quizHistory');
    }
  };

  return {
    favorites,
    memorized,
    needsReview,
    recentViews,
    quizHistory,
    isInitialized,
    toggleFavorite,
    toggleMemorized,
    addToReview,
    removeFromReview,
    addToRecent,
    addQuizRecord,
    resetAll,
  };
}
