'use client';

import { useEffect, useMemo, useState } from 'react';
import { useVocabStore } from 'src/hooks/useVocabStore';
import { disableReviewReminder, enableReviewReminder, isNotificationSupported, isReviewReminderEnabled } from 'src/hooks/useReviewReminder';
import vocabData from 'src/data/vocab.json';
import { countTodayEvents, getCategoryLabel, getCategoryTrend, getSevenDayActivity, getStudyStreak } from 'src/lib/study';

export default function Stats() {
  const store = useVocabStore();
  const [restoreMessage, setRestoreMessage] = useState('');
  const [notificationSupported, setNotificationSupported] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  useEffect(() => {
    // 알림 권한/설정은 브라우저 전역 상태라 SSR과 다를 수 있어, 마운트 이후에만 반영한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotificationSupported(isNotificationSupported());
    setNotificationEnabled(isReviewReminderEnabled());
  }, []);

  const handleToggleNotification = async () => {
    if (notificationEnabled) {
      disableReviewReminder();
      setNotificationEnabled(false);
      setNotificationMessage('복습 알림을 껐습니다.');
      return;
    }

    const granted = await enableReviewReminder();
    setNotificationEnabled(granted);
    setNotificationMessage(granted ? '복습 알림을 켰습니다. 오늘 복습할 단어가 있으면 알려드릴게요.' : '브라우저 알림 권한이 거부되었습니다.');
  };

  const totalCount = vocabData.length;
  const memorizedCount = store.memorized.length;
  const needsReviewCount = store.needsReview.length;
  const favoriteCount = store.favorites.length;
  const todayStudyCount = countTodayEvents(store.studyEvents);
  const sevenDayActivity = getSevenDayActivity(store.studyEvents);
  const maxSevenDayCount = Math.max(...sevenDayActivity.map((day) => day.count), 1);
  const studyStreak = getStudyStreak(store.studyEvents);

  // 전체 진행률
  const progressPercent = totalCount > 0 ? Math.round((memorizedCount / totalCount) * 100) : 0;

  // 카테고리별 통계 계산
  const categoryStats = useMemo(() => {
    const stats: { [key: string]: { total: number; memorized: number; review: number } } = {};
    vocabData.forEach((item) => {
      const cat = item.category || '기타';
      if (!stats[cat]) {
        stats[cat] = { total: 0, memorized: 0, review: 0 };
      }
      stats[cat].total += 1;
      if (store.memorized.includes(item.id)) {
        stats[cat].memorized += 1;
      }
      if (store.needsReview.includes(item.id)) {
        stats[cat].review += 1;
      }
    });

    return Object.entries(stats).map(([name, data]) => ({
      name,
      total: data.total,
      memorized: data.memorized,
      review: data.review,
      percent: data.total > 0 ? Math.round((data.memorized / data.total) * 100) : 0,
      weakScore: data.total > 0 ? data.review / data.total : 0,
    }));
  }, [store.memorized, store.needsReview]);

  const categoryTrend = useMemo(() => getCategoryTrend(store.studyEvents, 7), [store.studyEvents]);

  const weakCategories = useMemo(() => {
    return [...categoryStats]
      .filter((cat) => cat.review > 0)
      .sort((a, b) => b.weakScore - a.weakScore)
      .slice(0, 5);
  }, [categoryStats]);

  const topWrongWords = useMemo(() => {
    return vocabData
      .map((item) => ({
        item,
        wrongCount: store.reviewSchedules[item.id]?.wrongCount ?? 0,
        reviewCount: store.reviewSchedules[item.id]?.reviewCount ?? 0,
      }))
      .filter((entry) => entry.wrongCount > 0)
      .sort((a, b) => b.wrongCount - a.wrongCount || b.reviewCount - a.reviewCount)
      .slice(0, 10);
  }, [store.reviewSchedules]);

  // 최근 학습 날짜
  // quizHistory는 퀴즈를 끝까지 풀어야만 기록되므로, 카드/상세페이지/면접 모드에서만
  // 공부한 날은 반영되지 않는다. markStudyResult가 호출될 때마다 쌓이는 studyEvents가
  // 모든 학습 화면을 아우르는 더 정확한 신호라 이걸 최근 학습일 기준으로 삼는다.
  const lastStudyDate = useMemo(() => {
    return store.studyEvents[0]?.date ?? '학습 이력 없음';
  }, [store.studyEvents]);

  const handleExportBackup = () => {
    const backup = store.exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vocab-handbook-backup-${backup.exportedAt.slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      store.importBackup(JSON.parse(text));
      setRestoreMessage('학습 기록을 복원했습니다.');
    } catch (error) {
      console.error(error);
      setRestoreMessage('백업 파일을 읽지 못했습니다.');
    }
  };

  if (!store.isInitialized) {
    return (
      <div className="flex-grow bg-slate-50 dark:bg-slate-900 p-5 space-y-4 pb-24 min-h-screen">
        <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
        <div className="h-44 w-full bg-slate-200 dark:bg-slate-700 rounded-3xl animate-pulse"></div>
        <div className="h-64 w-full bg-slate-200 dark:bg-slate-700 rounded-3xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 p-5 space-y-5 pb-24 min-h-screen">
      {/* 상단 타이틀 */}
      <div className="pt-3">
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">학습 통계 리포트</h1>
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">매일 차곡차곡 쌓여가는 지식을 시각적으로 확인하세요</p>
      </div>

      {/* 종합 현황 카드 */}
      <section className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 space-y-4.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-extrabold text-blue-500 dark:text-blue-400 uppercase tracking-widest">종합 학습 진행 현황</span>
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500">최근 학습: {lastStudyDate}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-3 text-center border border-slate-100/50 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold block">외운 단어</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 block mt-1">{memorizedCount}개</span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-3 text-center border border-slate-100/50 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold block">오답/복습</span>
            <span className="text-xl font-black text-rose-500 dark:text-rose-400 block mt-1">{needsReviewCount}개</span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-3 text-center border border-slate-100/50 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold block">북마크</span>
            <span className="text-xl font-black text-amber-500 dark:text-amber-400 block mt-1">{favoriteCount}개</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 dark:bg-blue-950/40 rounded-2xl p-3 text-center border border-blue-100/60 dark:border-blue-800/60">
            <span className="text-[10px] text-blue-500 dark:text-blue-400 font-extrabold block">오늘 학습</span>
            <span className="text-xl font-black text-blue-700 dark:text-blue-300 block mt-1">{todayStudyCount}개</span>
          </div>
          <div className="bg-violet-50 dark:bg-violet-950/40 rounded-2xl p-3 text-center border border-violet-100/60 dark:border-violet-800/60">
            <span className="text-[10px] text-violet-500 dark:text-violet-400 font-extrabold block">연속 학습</span>
            <span className="text-xl font-black text-violet-700 dark:text-violet-300 block mt-1">{studyStreak}일</span>
          </div>
        </div>

        <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-700 pt-3">
          <div className="flex justify-between text-xs font-black text-slate-600 dark:text-slate-300">
            <span>총 단어 학습 완료율</span>
            <span className="text-blue-500 dark:text-blue-400">
              {progressPercent}% ({memorizedCount}/{totalCount})
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </section>

      {/* 최근 7일 학습량 */}
      <section className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 space-y-4">
        <h2 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">최근 7일 학습량</h2>
        <div className="grid grid-cols-7 gap-2 items-end h-28">
          {sevenDayActivity.map((day) => (
            <div key={day.date} className="flex flex-col items-center justify-end gap-2 h-full">
              <div className="w-full rounded-t-lg bg-blue-500 min-h-2 transition-all" style={{ height: `${Math.max(8, (day.count / maxSevenDayCount) * 80)}px` }}></div>
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{day.date.slice(5).replace('-', '/')}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 카테고리별 진행 상황 */}
      <section className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 space-y-4">
        <h2 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">시트 카테고리별 학습률</h2>
        <div className="space-y-3.5">
          {categoryStats.map((cat) => (
            <div key={cat.name} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="truncate pr-4">{cat.name}</span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] flex-shrink-0">
                  {cat.percent}% ({cat.memorized}/{cat.total})
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-400 to-blue-500 h-full rounded-full transition-all duration-300" style={{ width: `${cat.percent}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 최근 7일 카테고리별 학습 추세 */}
      <section className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 space-y-4">
        <h2 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">최근 7일 카테고리별 추세</h2>
        {categoryTrend.length === 0 ? (
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl p-3 text-center">최근 7일간 학습 기록이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {categoryTrend.map((trend) => (
              <div key={trend.name} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="truncate pr-4">{trend.name}</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] flex-shrink-0">
                    정답률 {trend.accuracy}% · 시도 {trend.total}회
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${trend.accuracy >= 80 ? 'bg-emerald-500' : trend.accuracy >= 50 ? 'bg-orange-500' : 'bg-rose-500'}`} style={{ width: `${trend.accuracy}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 취약 분류와 오답 TOP */}
      <section className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 space-y-4">
        <h2 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">취약 분류 / 오답 TOP</h2>
        <div className="space-y-2">
          {weakCategories.length === 0 ? (
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl p-3 text-center">아직 취약 분류 데이터가 없습니다.</p>
          ) : (
            weakCategories.map((cat) => (
              <div key={cat.name} className="flex justify-between items-center bg-rose-50/60 dark:bg-rose-950/40 rounded-xl px-3 py-2 border border-rose-100 dark:border-rose-800/60">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate pr-3">{cat.name}</span>
                <span className="text-[10px] font-black text-rose-500 dark:text-rose-400 flex-shrink-0">
                  복습 {cat.review}/{cat.total}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="space-y-2">
          {topWrongWords.length === 0 ? (
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl p-3 text-center">누적 오답 단어가 없습니다.</p>
          ) : (
            topWrongWords.map(({ item, wrongCount }) => (
              <div key={item.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-700">
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{item.keyword}</p>
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate">{getCategoryLabel(item)}</p>
                </div>
                <span className="text-[10px] font-black text-rose-500 dark:text-rose-400 flex-shrink-0">오답 {wrongCount}회</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 최근 퀴즈 기록 */}
      <section className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 space-y-3 flex-1 min-h-[160px] overflow-hidden flex flex-col justify-between">
        <h2 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">최근 퀴즈 풀이 이력</h2>

        {store.quizHistory.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6 text-slate-400 dark:text-slate-500 space-y-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-slate-300 dark:text-slate-600">
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
                <div key={index} className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-extrabold text-slate-700 dark:text-slate-300 block">학습 퀴즈 세션</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">{record.date}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-800 dark:text-slate-100 text-sm block">
                      {record.correct} / {record.total}
                    </span>
                    <span className={`text-[10px] font-bold block mt-0.5 ${quizPercent >= 80 ? 'text-emerald-600 dark:text-emerald-400' : quizPercent >= 50 ? 'text-orange-500 dark:text-orange-400' : 'text-rose-500 dark:text-rose-400'}`}>정답률 {quizPercent}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 복습 알림 */}
      <section className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">복습 알림</h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">오늘 복습할 단어가 있을 때 브라우저 알림으로 알려드려요. 앱을 열어둔 상태에서만 동작하는 로컬 알림이라, 앱이 완전히 꺼져 있으면 울리지 않아요.</p>
          </div>
          <button
            onClick={handleToggleNotification}
            disabled={!notificationSupported}
            aria-pressed={notificationEnabled}
            aria-label="복습 알림 켜기/끄기"
            className={`flex-shrink-0 text-xs font-black px-4 py-2.5 rounded-xl transition-all active:scale-[0.98] ${!notificationSupported ? 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-600' : notificationEnabled ? 'bg-blue-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
          >
            {notificationEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        {!notificationSupported && <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500">이 브라우저는 알림 기능을 지원하지 않습니다.</p>}
        {notificationMessage && <p className="text-[11px] font-bold text-blue-500 dark:text-blue-400">{notificationMessage}</p>}
      </section>

      {/* 학습 기록 관리 */}
      <section className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 space-y-3">
        <div>
          <h2 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">학습 기록 관리</h2>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">브라우저에 저장된 학습 상태를 JSON 파일로 내보내거나 다시 불러올 수 있습니다.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleExportBackup} className="bg-slate-900 dark:bg-slate-700 text-white text-xs font-black py-3 rounded-xl active:scale-[0.98] transition-all">
            기록 내보내기
          </button>
          <label className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black py-3 rounded-xl text-center active:scale-[0.98] transition-all">
            기록 불러오기
            <input type="file" accept="application/json" className="hidden" onChange={(event) => handleImportBackup(event.target.files?.[0] ?? null)} />
          </label>
        </div>
        {restoreMessage && <p className="text-[11px] font-bold text-blue-500 dark:text-blue-400">{restoreMessage}</p>}
      </section>
    </main>
  );
}
