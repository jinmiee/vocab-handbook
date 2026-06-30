'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useVocabStore } from 'src/hooks/useVocabStore';
import vocabData from 'src/data/vocab.json';

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
        )
      )}
    </span>
  );
}

export default function List() {
  const store = useVocabStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [learningFilter, setLearningFilter] = useState<'all' | 'memorized' | 'review'>('all');

  // 전체 카테고리 수집
  const categories = useMemo(() => {
    const set = new Set(vocabData.map((item) => item.category));
    return Array.from(set).filter(Boolean);
  }, []);

  // 필터링된 단어 목록
  const filteredVocab = useMemo(() => {
    return vocabData.filter((item) => {
      // 1. 검색어 매치
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const inKeyword = item.keyword.toLowerCase().includes(query);
        const inSummary = item.summary.toLowerCase().includes(query);
        if (!inKeyword && !inSummary) return false;
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

      return true;
    });
  }, [searchQuery, selectedCategories, showOnlyFavorites, learningFilter, store.favorites, store.memorized]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat]
    );
  };

  if (!store.isInitialized) {
    return (
      <div className="flex-1 bg-slate-50 p-5 space-y-4 pb-24 min-h-screen">
        <div className="h-8 w-24 bg-slate-200 rounded animate-pulse"></div>
        <div className="h-12 w-full bg-slate-200 rounded-xl animate-pulse"></div>
        <div className="h-10 w-full bg-slate-200 rounded-xl animate-pulse"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 w-full bg-slate-200 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-slate-50 p-5 space-y-4 pb-24">
      {/* 상단 타이틀 */}
      <div className="pt-3">
        <h1 className="text-2xl font-black text-slate-800">단어장 목록</h1>
        <p className="text-xs font-semibold text-slate-400 mt-0.5">
          원하는 용어를 쉽게 검색하고 상태별로 공부해보세요
        </p>
      </div>

      {/* 검색 바 */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="단어 또는 한줄 설명을 검색해 보세요..."
          className="w-full bg-white text-slate-800 text-sm font-medium pl-10 pr-4 py-3 rounded-2xl border border-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="#94a3b8"
          className="w-5 h-5 absolute left-3.5 top-3.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z"
          />
        </svg>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-3 text-xs text-slate-400 font-bold bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg"
          >
            지우기
          </button>
        )}
      </div>

      {/* 카테고리 접기/펼치기 필터 */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-200">
        <button
          onClick={() => setIsCategoryExpanded(!isCategoryExpanded)}
          className="w-full flex justify-between items-center px-4 py-3.5 hover:bg-slate-50/50"
        >
          <span className="text-xs font-bold text-slate-600 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 mr-1.5 text-blue-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            카테고리 필터 {selectedCategories.length > 0 && `(${selectedCategories.length})`}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="#94a3b8"
            className={`w-4 h-4 transition-transform duration-200 ${isCategoryExpanded ? 'rotate-180' : ''}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {isCategoryExpanded && (
          <div className="border-t border-slate-100 p-4 bg-slate-50/30 flex flex-wrap gap-2">
            {categories.map((cat) => {
              const isSelected = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all border ${
                    isSelected
                      ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
            {selectedCategories.length > 0 && (
              <button
                onClick={() => setSelectedCategories([])}
                className="text-xs text-rose-500 font-bold border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-full transition-all"
              >
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
          className={`text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0 transition-all border flex items-center space-x-1 ${
            showOnlyFavorites
              ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={showOnlyFavorites ? 'currentColor' : 'none'}
            stroke={showOnlyFavorites ? 'currentColor' : '#94a3b8'}
            strokeWidth={1.5}
            className="w-3.5 h-3.5"
          >
            <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
          </svg>
          <span>즐겨찾기만</span>
        </button>

        {/* 학습 필터 그룹 */}
        <div className="h-6 w-[1px] bg-slate-200 flex-shrink-0"></div>

        <button
          onClick={() => setLearningFilter('all')}
          className={`text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0 transition-all border ${
            learningFilter === 'all'
              ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          전체 보기
        </button>

        <button
          onClick={() => setLearningFilter('memorized')}
          className={`text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0 transition-all border ${
            learningFilter === 'memorized'
              ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          외운 단어
        </button>

        <button
          onClick={() => setLearningFilter('review')}
          className={`text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0 transition-all border ${
            learningFilter === 'review'
              ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          미외운 단어
        </button>
      </div>

      {/* 개수 및 정렬 */}
      <div className="flex justify-between items-center text-xs font-bold text-slate-500 px-1 pt-1">
        <span>검색 결과: {filteredVocab.length}개</span>
      </div>

      {/* 단어 카드 목록 */}
      <div className="flex-1 flex flex-col space-y-3">
        {filteredVocab.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 border border-slate-100 flex flex-col items-center justify-center text-center my-8 shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="#cbd5e1"
              className="w-12 h-12 mb-3"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <h3 className="font-bold text-slate-700 text-base">검색 결과가 없습니다</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              검색어를 변경하거나 필터를 리셋하여<br />
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
                className="mt-5 text-xs text-blue-500 font-bold bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
              >
                필터 초기화하기
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredVocab.map((item) => {
              const isFav = store.favorites.includes(item.id);
              const isMem = store.memorized.includes(item.id);

              return (
                <Link
                  key={item.id}
                  href={`/vocab/${item.id}`}
                  onClick={() => store.addToRecent(item.id)}
                  className="block bg-white rounded-2xl p-4.5 shadow-sm hover:shadow-md border border-slate-100 transition-all active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md">
                      {item.category}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      {isFav && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f59e0b" className="w-4 h-4">
                          <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                        </svg>
                      )}
                      {isMem && (
                        <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          학습완료
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-lg font-black text-slate-800 mt-2 tracking-tight">
                    <HighlightText text={item.keyword} query={searchQuery} />
                  </h3>

                  <p className="text-slate-500 text-xs font-semibold mt-1.5 line-clamp-2 leading-relaxed">
                    <HighlightText text={item.summary} query={searchQuery} />
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
