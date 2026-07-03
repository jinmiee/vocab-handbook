'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from 'react';
import vocabData from 'src/data/vocab.json';
import { calculateNextReview, getTodayKey } from 'src/lib/study';

export interface QuizRecord {
  date: string;
  correct: number;
  total: number;
}

export type StudyResult = 'know' | 'unsure' | 'dontknow' | 'correct' | 'incorrect';

export interface ReviewSchedule {
  nextReviewAt: string;
  lastStudiedAt: string;
  lastResult: StudyResult;
  correctStreak: number;
  wrongCount: number;
  reviewCount: number;
}

export interface StudyEvent {
  id: string;
  date: string;
  result: StudyResult;
  category?: string;
}

export interface BackupPayload {
  version: 2;
  exportedAt: string;
  favorites: string[];
  memorized: string[];
  needsReview: string[];
  recentViews: string[];
  quizHistory: QuizRecord[];
  reviewSchedules: Record<string, ReviewSchedule>;
  studyEvents: StudyEvent[];
  knownDataIds: string[];
  notes: Record<string, string>;
}

const vocabIds = vocabData.map((item) => item.id);
const vocabIdSet = new Set(vocabIds);

function safeParseArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function safeParseQuizHistory(value: string | null): QuizRecord[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is QuizRecord => (
      typeof item?.date === 'string' &&
      typeof item?.correct === 'number' &&
      typeof item?.total === 'number'
    )) : [];
  } catch {
    return [];
  }
}

function safeParseSchedules(value: string | null): Record<string, ReviewSchedule> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, ReviewSchedule] => {
        const [id, schedule] = entry;
        return (
          typeof id === 'string' &&
          !!schedule &&
          typeof schedule === 'object' &&
          typeof (schedule as ReviewSchedule).nextReviewAt === 'string' &&
          typeof (schedule as ReviewSchedule).lastStudiedAt === 'string' &&
          typeof (schedule as ReviewSchedule).lastResult === 'string' &&
          typeof (schedule as ReviewSchedule).correctStreak === 'number' &&
          typeof (schedule as ReviewSchedule).wrongCount === 'number' &&
          typeof (schedule as ReviewSchedule).reviewCount === 'number'
        );
      })
    );
  } catch {
    return {};
  }
}

function safeParseStudyEvents(value: string | null): StudyEvent[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is StudyEvent => (
      typeof item?.id === 'string' &&
      typeof item?.date === 'string' &&
      typeof item?.result === 'string'
    )) : [];
  } catch {
    return [];
  }
}

function safeParseNotes(value: string | null): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  } catch {
    return {};
  }
}

export function useVocabStore() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [memorized, setMemorized] = useState<string[]>([]);
  const [needsReview, setNeedsReview] = useState<string[]>([]);
  const [recentViews, setRecentViews] = useState<string[]>([]);
  const [quizHistory, setQuizHistory] = useState<QuizRecord[]>([]);
  const [reviewSchedules, setReviewSchedules] = useState<Record<string, ReviewSchedule>>({});
  const [studyEvents, setStudyEvents] = useState<StudyEvent[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [knownDataIds, setKnownDataIds] = useState<string[]>([]);
  const [newWordIds, setNewWordIds] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // localStorage에서 데이터를 로드
  useEffect(() => {
    try {
      const storedFav = localStorage.getItem('vocab_favorites');
      const storedMem = localStorage.getItem('vocab_memorized');
      const storedRev = localStorage.getItem('vocab_needsReview');
      const storedRec = localStorage.getItem('vocab_recentViews');
      const storedQuiz = localStorage.getItem('vocab_quizHistory');
      const storedSchedules = localStorage.getItem('vocab_reviewSchedules');
      const storedEvents = localStorage.getItem('vocab_studyEvents');
      const storedNotes = localStorage.getItem('vocab_notes');
      const storedKnownIds = localStorage.getItem('vocab_knownDataIds');

      setFavorites(safeParseArray(storedFav).filter((id) => vocabIdSet.has(id)));
      setMemorized(safeParseArray(storedMem).filter((id) => vocabIdSet.has(id)));
      setNeedsReview(safeParseArray(storedRev).filter((id) => vocabIdSet.has(id)));
      setRecentViews(safeParseArray(storedRec).filter((id) => vocabIdSet.has(id)));
      setQuizHistory(safeParseQuizHistory(storedQuiz));
      setReviewSchedules(safeParseSchedules(storedSchedules));
      setStudyEvents(safeParseStudyEvents(storedEvents).filter((event) => vocabIdSet.has(event.id)).slice(0, 500));
      setNotes(
        Object.fromEntries(
          Object.entries(safeParseNotes(storedNotes)).filter(([id]) => vocabIdSet.has(id)),
        ),
      );

      const parsedKnownIds = safeParseArray(storedKnownIds).filter((id) => vocabIdSet.has(id));
      if (storedKnownIds && parsedKnownIds.length > 0) {
        setKnownDataIds(parsedKnownIds);
        setNewWordIds(vocabIds.filter((id) => !parsedKnownIds.includes(id)));
      } else {
        setKnownDataIds(vocabIds);
        setNewWordIds([]);
        localStorage.setItem('vocab_knownDataIds', JSON.stringify(vocabIds));
      }
    } catch (e) {
      console.error('Failed to load vocab store from localStorage:', e);
    }
    setIsInitialized(true);
  }, []);

  // 상태가 변경될 때마다 localStorage에 저장
  const saveToLocal = (key: string, data: unknown) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        console.error(`Failed to save ${key} to localStorage:`, e);
      }
    }
  };

  const recordStudyEvent = (id: string, result: StudyResult) => {
    const category = vocabData.find((item) => item.id === id)?.category;
    const event: StudyEvent = {
      id,
      date: getTodayKey(),
      result,
      category,
    };

    setStudyEvents((prev) => {
      const next = [event, ...prev].slice(0, 500);
      saveToLocal('vocab_studyEvents', next);
      return next;
    });
  };

  const updateReviewSchedule = (id: string, result: StudyResult) => {
    const nextSchedule = calculateNextReview(result, reviewSchedules[id]);
    setReviewSchedules((prev) => {
      const next = { ...prev, [id]: nextSchedule };
      saveToLocal('vocab_reviewSchedules', next);
      return next;
    });
    recordStudyEvent(id, result);
    return nextSchedule;
  };

  const markStudyResult = (id: string, result: StudyResult) => {
    const schedule = updateReviewSchedule(id, result);
    const isCorrectResult = result === 'know' || result === 'correct';

    setMemorized((prev) => {
      const shouldMemorize = isCorrectResult && (schedule?.correctStreak ?? 0) >= 1;
      const next = shouldMemorize
        ? Array.from(new Set([...prev, id]))
        : prev.filter((x) => x !== id);
      saveToLocal('vocab_memorized', next);
      return next;
    });

    setNeedsReview((prev) => {
      const shouldReview = !isCorrectResult || (schedule?.nextReviewAt ?? getTodayKey()) <= getTodayKey();
      const next = shouldReview
        ? Array.from(new Set([...prev, id]))
        : prev.filter((x) => x !== id);
      saveToLocal('vocab_needsReview', next);
      return next;
    });
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveToLocal('vocab_favorites', next);
      return next;
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

  const updateNote = (id: string, text: string) => {
    setNotes((prev) => {
      const trimmed = text.trim();
      const next = { ...prev };
      if (trimmed) {
        next[id] = trimmed;
      } else {
        delete next[id];
      }
      saveToLocal('vocab_notes', next);
      return next;
    });
  };

  const addQuizRecord = (correct: number, total: number) => {
    const newRecord: QuizRecord = {
      date: getTodayKey(),
      correct,
      total,
    };
    setQuizHistory((prev) => {
      const next = [newRecord, ...prev].slice(0, 50); // 최근 50개 퀴즈 이력 관리
      saveToLocal('vocab_quizHistory', next);
      return next;
    });
  };

  const acknowledgeNewWords = () => {
    setKnownDataIds(vocabIds);
    setNewWordIds([]);
    saveToLocal('vocab_knownDataIds', vocabIds);
  };

  const exportBackup = (): BackupPayload => ({
    version: 2,
    exportedAt: new Date().toISOString(),
    favorites,
    memorized,
    needsReview,
    recentViews,
    quizHistory,
    reviewSchedules,
    studyEvents,
    knownDataIds,
    notes,
  });

  const importBackup = (payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('백업 파일 형식이 올바르지 않습니다.');
    }

    const data = payload as Partial<BackupPayload>;
    const nextFavorites = Array.isArray(data.favorites) ? data.favorites.filter((id) => vocabIdSet.has(id)) : [];
    const nextMemorized = Array.isArray(data.memorized) ? data.memorized.filter((id) => vocabIdSet.has(id)) : [];
    const nextNeedsReview = Array.isArray(data.needsReview) ? data.needsReview.filter((id) => vocabIdSet.has(id)) : [];
    const nextRecentViews = Array.isArray(data.recentViews) ? data.recentViews.filter((id) => vocabIdSet.has(id)).slice(0, 10) : [];
    const nextQuizHistory = Array.isArray(data.quizHistory) ? data.quizHistory.slice(0, 50) : [];
    const nextSchedules = data.reviewSchedules && typeof data.reviewSchedules === 'object' ? data.reviewSchedules : {};
    const nextEvents = Array.isArray(data.studyEvents) ? data.studyEvents.filter((event) => vocabIdSet.has(event.id)).slice(0, 500) : [];
    const nextKnownIds = Array.isArray(data.knownDataIds) ? data.knownDataIds.filter((id) => vocabIdSet.has(id)) : vocabIds;
    const nextNotes =
      data.notes && typeof data.notes === 'object'
        ? Object.fromEntries(
            Object.entries(data.notes).filter(
              (entry): entry is [string, string] => vocabIdSet.has(entry[0]) && typeof entry[1] === 'string',
            ),
          )
        : {};

    setFavorites(nextFavorites);
    setMemorized(nextMemorized);
    setNeedsReview(nextNeedsReview);
    setRecentViews(nextRecentViews);
    setQuizHistory(nextQuizHistory);
    setReviewSchedules(nextSchedules);
    setStudyEvents(nextEvents);
    setKnownDataIds(nextKnownIds);
    setNewWordIds(vocabIds.filter((id) => !nextKnownIds.includes(id)));
    setNotes(nextNotes);

    saveToLocal('vocab_favorites', nextFavorites);
    saveToLocal('vocab_memorized', nextMemorized);
    saveToLocal('vocab_needsReview', nextNeedsReview);
    saveToLocal('vocab_recentViews', nextRecentViews);
    saveToLocal('vocab_quizHistory', nextQuizHistory);
    saveToLocal('vocab_reviewSchedules', nextSchedules);
    saveToLocal('vocab_studyEvents', nextEvents);
    saveToLocal('vocab_knownDataIds', nextKnownIds);
    saveToLocal('vocab_notes', nextNotes);
  };

  const resetAll = () => {
    setFavorites([]);
    setMemorized([]);
    setNeedsReview([]);
    setRecentViews([]);
    setQuizHistory([]);
    setReviewSchedules({});
    setStudyEvents([]);
    setNotes({});
    setKnownDataIds(vocabIds);
    setNewWordIds([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vocab_favorites');
      localStorage.removeItem('vocab_memorized');
      localStorage.removeItem('vocab_needsReview');
      localStorage.removeItem('vocab_recentViews');
      localStorage.removeItem('vocab_quizHistory');
      localStorage.removeItem('vocab_reviewSchedules');
      localStorage.removeItem('vocab_studyEvents');
      localStorage.removeItem('vocab_notes');
      localStorage.setItem('vocab_knownDataIds', JSON.stringify(vocabIds));
    }
  };

  return {
    favorites,
    memorized,
    needsReview,
    recentViews,
    quizHistory,
    reviewSchedules,
    studyEvents,
    notes,
    newWordIds,
    isInitialized,
    toggleFavorite,
    removeFromReview,
    addToRecent,
    addQuizRecord,
    markStudyResult,
    updateNote,
    acknowledgeNewWords,
    exportBackup,
    importBackup,
    resetAll,
  };
}
