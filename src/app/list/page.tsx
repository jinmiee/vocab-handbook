'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useVocabStore } from 'src/hooks/useVocabStore';
import vocabData from 'src/data/vocab.json';
import { getCategories, getCategoryLabel, sortVocabItems, type VocabSortOption } from 'src/lib/study';

const LIST_SCROLL_STORAGE_KEY = 'vocab_list_scroll_position';
// 단어 수가 많아질수록 필터링된 결과를 한 번에 전부 DOM에 렌더링하면 스크롤이 무거워지므로,
// 한 번에 이만큼만 렌더링하고 스크롤이 하단에 닿을 때마다 더 불러온다.
const PAGE_SIZE = 40;

// 검색 하이라이팅 컴포넌트
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;

  // 정규식을 활용해 대소문자 구분 없이 검색어 분리
  const regex = new RegExp(`(${query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-slate-950 rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </span>
  );
}

export default function List() {
  const store = useVocabStore();
  const didRestoreScroll = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [learningFilter, setLearningFilter] = useState<'all' | 'memorized' | 'review' | 'new'>('all');
  const [sortOption, setSortOption] = useState<VocabSortOption>('default');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  // 검색어/필터/정렬 조합이 바뀔 때마다 visibleCount를 PAGE_SIZE로 되돌리기 위한 시그니처.
  // useEffect에서 setState를 직접 부르는 대신, 렌더 중에 이전 값과 비교해 조정한다.
  const filterSignature = JSON.stringify([searchQuery, selectedCategories, showOnlyFavorites, learningFilter, sortOption]);
  const [prevFilterSignature, setPrevFilterSignature] = useState(filterSignature);
  if (filterSignature !== prevFilterSignature) {
    setPrevFilterSignature(filterSignature);
    setVisibleCount(PAGE_SIZE);
  }

  // 전체 카테고리 수집
  const categories = useMemo(() => getCategories(vocabData), []);

  // 필터링된 단어 목록
  const filteredVocab = useMemo(() => {
    const filtered = vocabData.filter((item) => {
      // 1. 검색어 매치 (키워드/한줄설명/상세설명/세부분류)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const inKeyword = item.keyword.toLowerCase().includes(query);
        const inSummary = item.summary.toLowerCase().includes(query);
        const inDetail = item.detail.toLowerCase().includes(query);
        const inSubCategory = item.subCategory?.toLowerCase().includes(query) ?? false;
        if (!inKeyword && !inSummary && !inDetail && !inSubCategory) return false;
      }

      // 2. 카테고리 필터
      if (selectedCategories.length > 0 && !selectedCategories.includes(item.category)) {
        return false;
      }

      // 3. 즐겨찾기 필터
      if (showOnlyFavorites && !store.favorites.includes(item.id)) {
        return false;
      }

      // 4. 학습 상태 필터
      if (learningFilter === 'memorized' && !store.memorized.includes(item.id)) {
        return false;
      }
      if (learningFilter === 'review' && store.memorized.includes(item.id)) {
        return false;
      }
      if (learningFilter === 'new' && !store.newWordIds.includes(item.id)) {
        return false;
      }

      return true;
    });

    return sortVocabItems(filtered, sortOption, {
      reviewSchedules: store.reviewSchedules,
      newWordIds: store.newWordIds,
    });
  }, [searchQuery, selectedCategories, showOnlyFavorites, learningFilter, sortOption, store.favorites, store.memorized, store.newWordIds, store.reviewSchedules]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat]));
  };

  useEffect(() => {
    if (!store.isInitialized || didRestoreScroll.current) return;

    const saved = sessionStorage.getItem(LIST_SCROLL_STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as { y?: number };
      if (typeof parsed.y !== 'number') return;

      didRestoreScroll.current = true;
      // 저장된 위치까지 스크롤하려면 그 지점까지의 항목이 전부 렌더링돼 있어야 한다.
      // sessionStorage를 읽어 스크롤을 복원하는 것 자체가 effect로만 할 수 있는 작업이라
      // 그 안에서 필요한 setState까지 함께 처리한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisibleCount(filteredVocab.length);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: parsed.y, left: 0, behavior: 'instant' });
        });
      });
    } catch (error) {
      console.error('Failed to restore list scroll position:', error);
    }
  }, [store.isInitialized, filteredVocab.length]);

  // 목록 하단의 sentinel이 보이면 다음 페이지 분량을 더 렌더링한다.
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredVocab.length));
        }
      },
      { rootMargin: '600px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredVocab.length]);

  const visibleVocab = filteredVocab.slice(0, visibleCount);

  const saveListScrollPosition = (id: string) => {
    sessionStorage.setItem(
      LIST_SCROLL_STORAGE_KEY,
      JSON.stringify({
        id,
        y: window.scrollY,
      }),
    );
  };

  if (!store.isInitialized) {
    return (
      <div className="flex-1 bg-slate-50 dark:bg-slate-900 p-5 space-y-4 pb-24 min-h-screen">
        <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
        <div className="h-12 w-full bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse"></div>
        <div className="h-10 w-full bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 w-full bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 p-5 space-y-4 pb-24">
      {/* 상단 타이틀 */}
      <div className="pt-3">
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">단어장 목록</h1>
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">원하는 용어를 쉽게 검색하고 상태별로 공부해보세요</p>
      </div>

      {/* 검색 바 */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="단어 또는 한줄 설명을 검색해 보세요..."
          aria-label="단어 검색"
          className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-medium pl-10 pr-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#94a3b8" className="w-5 h-5 absolute left-3.5 top-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
        </svg>
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-3 text-xs text-slate-400 dark:text-slate-500 font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 px-2 py-1 rounded-lg">
            지우기
          </button>
        )}
      </div>

      {/* 카테고리 접기/펼치기 필터 */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden transition-all duration-200">
        <button onClick={() => setIsCategoryExpanded(!isCategoryExpanded)} className="w-full flex justify-between items-center px-4 py-3.5 hover:bg-slate-50/50">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 mr-1.5 text-blue-500 dark:text-blue-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            카테고리 필터 {selectedCategories.length > 0 && `(${selectedCategories.length})`}
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#94a3b8" className={`w-4 h-4 transition-transform duration-200 ${isCategoryExpanded ? 'rotate-180' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {isCategoryExpanded && (
          <div className="border-t border-slate-100 dark:border-slate-700 p-4 bg-slate-50/30 dark:bg-slate-700/30 flex flex-wrap gap-2">
            {categories.map((cat) => {
              const isSelected = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  aria-pressed={isSelected}
                  className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all border ${isSelected ? 'bg-blue-500 border-blue-500 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                >
                  {cat}
                </button>
              );
            })}
            {selectedCategories.length > 0 && (
              <button onClick={() => setSelectedCategories([])} className="text-xs text-rose-500 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 px-3 py-1.5 rounded-full transition-all">
                전체 해제
              </button>
            )}
          </div>
        )}
      </div>

      {/* 즐겨찾기 & 학습상태 칩 필터 */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
        {/* 즐겨찾기 토글 칩 */}
        <button
          onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
          aria-pressed={showOnlyFavorites}
          className={`text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0 transition-all border flex items-center space-x-1 ${showOnlyFavorites ? 'bg-amber-500 border-amber-500 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={showOnlyFavorites ? 'currentColor' : 'none'} stroke={showOnlyFavorites ? 'currentColor' : '#94a3b8'} strokeWidth={1.5} className="w-3.5 h-3.5">
            <path
              fillRule="evenodd"
              d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
              clipRule="evenodd"
            />
          </svg>
          <span>즐겨찾기만</span>
        </button>

        {/* 학습 필터 그룹 */}
        <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 flex-shrink-0"></div>

        <button
          onClick={() => setLearningFilter('all')}
          aria-pressed={learningFilter === 'all'}
          className={`text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0 transition-all border ${learningFilter === 'all' ? 'bg-blue-500 border-blue-500 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
        >
          전체 보기
        </button>

        <button
          onClick={() => setLearningFilter('memorized')}
          aria-pressed={learningFilter === 'memorized'}
          className={`text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0 transition-all border ${learningFilter === 'memorized' ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
        >
          외운 단어
        </button>

        <button
          onClick={() => setLearningFilter('review')}
          aria-pressed={learningFilter === 'review'}
          className={`text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0 transition-all border ${learningFilter === 'review' ? 'bg-orange-500 border-orange-500 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
        >
          미외운 단어
        </button>

        <button
          onClick={() => setLearningFilter('new')}
          aria-pressed={learningFilter === 'new'}
          className={`text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0 transition-all border ${learningFilter === 'new' ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
        >
          NEW
        </button>
      </div>

      {/* 개수 및 정렬 */}
      <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 px-1 pt-1">
        <span>검색 결과: {filteredVocab.length}개</span>
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as VocabSortOption)}
          className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="default">기본 순서</option>
          <option value="alphabetical">가나다순</option>
          <option value="recentlyAdded">최근 추가순</option>
          <option value="mostWrong">오답 많은순</option>
        </select>
      </div>

      {/* 단어 카드 목록 */}
      <div className="flex-1 flex flex-col space-y-3">
        {filteredVocab.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-10 border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center text-center my-8 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#cbd5e1" className="w-12 h-12 mb-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <h3 className="font-bold text-slate-700 dark:text-slate-300 text-base">검색 결과가 없습니다</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
              검색어를 변경하거나 필터를 리셋하여
              <br />
              원하는 용어를 찾아보세요.
            </p>
            {(searchQuery || selectedCategories.length > 0 || showOnlyFavorites || learningFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategories([]);
                  setShowOnlyFavorites(false);
                  setLearningFilter('all');
                }}
                className="mt-5 text-xs text-blue-500 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
              >
                필터 초기화하기
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleVocab.map((item) => {
              const isFav = store.favorites.includes(item.id);
              const isMem = store.memorized.includes(item.id);
              const isNew = store.newWordIds.includes(item.id);
              const hasNote = Boolean(store.notes[item.id]);

              return (
                <Link
                  key={item.id}
                  href={`/vocab/${item.id}`}
                  onClick={() => {
                    saveListScrollPosition(item.id);
                    store.addToRecent(item.id);
                  }}
                  className="block bg-white dark:bg-slate-800 rounded-2xl p-4.5 shadow-sm hover:shadow-md border border-slate-100 dark:border-slate-700 transition-all active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-md">{getCategoryLabel(item)}</span>
                    <div className="flex items-center space-x-1.5">
                      {hasNote && (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#94a3b8" className="w-3.5 h-3.5">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"
                          />
                        </svg>
                      )}
                      {isFav && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f59e0b" className="w-4 h-4">
                          <path
                            fillRule="evenodd"
                            d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      {isMem && <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">학습완료</span>}
                      {isNew && <span className="text-[9px] font-extrabold text-white bg-emerald-500 px-2 py-0.5 rounded">NEW</span>}
                    </div>
                  </div>

                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mt-2 tracking-tight">
                    <HighlightText text={item.keyword} query={searchQuery} />
                  </h3>

                  <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1.5 line-clamp-2 leading-relaxed">
                    <HighlightText text={item.summary} query={searchQuery} />
                  </p>
                </Link>
              );
            })}
            {visibleCount < filteredVocab.length && (
              <div ref={loadMoreRef} className="py-4 flex justify-center">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">더 불러오는 중...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
