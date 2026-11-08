import React, { useState, useMemo, useRef } from 'react';
import { Search, Play, Heart, Download, ArrowLeft, Tv, LayoutGrid, List, RotateCcw, Zap, Database } from 'lucide-react';
import { Category, StreamChannel, Language } from '../types';
import { useVirtualizer } from '../hooks/useVirtualizer';
import { t } from '../services/translations';

interface ChannelListProps {
  channels: StreamChannel[];
  categories: Category[];
  selectedCategoryId: string;
  onSelectCategory: (catId: string) => void;
  onSelectChannel: (channel: StreamChannel) => void;
  onBackToChoice: () => void;
  onGoToDownload: () => void;
  isLoading: boolean;
  lang: Language;
  onRefreshCatalog?: () => void;
  catalogStats?: {
    isCached: boolean;
    parseTimeMs?: number;
    timestamp?: number;
  } | null;
}

export const ChannelList: React.FC<ChannelListProps> = ({
  channels,
  categories,
  selectedCategoryId,
  onSelectCategory,
  onSelectChannel,
  onBackToChoice,
  onGoToDownload,
  isLoading,
  lang,
  onRefreshCatalog,
  catalogStats,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('streamhub_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

  const toggleFavorite = (streamId: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    const idStr = String(streamId);
    let updated: string[];
    if (favoriteIds.includes(idStr)) {
      updated = favoriteIds.filter((id) => id !== idStr);
    } else {
      updated = [...favoriteIds, idStr];
    }
    setFavoriteIds(updated);
    try {
      localStorage.setItem('streamhub_favorites', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Find category map
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.category_id, c.category_name));
    return map;
  }, [categories]);

  // Filter channels
  const filteredChannels = useMemo(() => {
    return channels.filter((ch) => {
      // Category filter
      if (selectedCategoryId !== 'all' && String(ch.category_id) !== String(selectedCategoryId)) {
        return false;
      }
      // Favorites filter
      if (showOnlyFavorites && !favoriteIds.includes(String(ch.stream_id))) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = ch.name.toLowerCase().includes(query);
        const matchCategory = (categoryMap.get(String(ch.category_id)) || '').toLowerCase().includes(query);
        return matchName || matchCategory;
      }
      return true;
    });
  }, [channels, selectedCategoryId, showOnlyFavorites, favoriteIds, searchQuery, categoryMap]);

  // Virtualization hook for zero-lag smooth scrolling
  const { startIndex, endIndex, topOffset, bottomOffset } = useVirtualizer({
    totalItems: filteredChannels.length,
    layoutMode,
    containerRef,
    overscan: 2,
  });

  const visibleChannels = useMemo(() => {
    return filteredChannels.slice(startIndex, endIndex);
  }, [filteredChannels, startIndex, endIndex]);

  return (
    <div ref={containerRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBackToChoice}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('back_to_choices', lang)}</span>
          </button>

          <button
            onClick={onGoToDownload}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('download', lang)}</span>
          </button>

          {onRefreshCatalog && (
            <button
              onClick={onRefreshCatalog}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
              title={t('refresh_catalog', lang)}
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="hidden sm:inline">{t('resync', lang)}</span>
            </button>
          )}
        </div>

        {/* Performance & Count indicators */}
        <div className="flex items-center gap-3">
          {catalogStats && (
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-2xs">
              {catalogStats.isCached ? (
                <>
                  <Database className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Instant Cache</span>
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span>Web Worker {catalogStats.parseTimeMs}ms</span>
                </>
              )}
            </div>
          )}

          <div className="text-xs text-slate-500 font-mono">
            <span className="text-slate-900 font-bold">{filteredChannels.length}</span>
            <span> / {channels.length} {t('channel_unit', lang)}</span>
          </div>

          <div className="flex items-center bg-slate-100 border border-slate-200 p-0.5 rounded-lg shadow-2xs">
            <button
              onClick={() => setLayoutMode('grid')}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                layoutMode === 'grid' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Virtual Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayoutMode('list')}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                layoutMode === 'list' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Virtual List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Heading & Subtitle */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-1">
          {t('channel_directory_title', lang)}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          {t('channel_directory_desc', lang)}
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 mb-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_channels', lang)}
              className="w-full pl-10 pr-8 py-2 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 text-xs sm:text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Favorites toggle */}
          <button
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-2xs ${
              showOnlyFavorites
                ? 'bg-rose-50 border border-rose-300 text-rose-700'
                : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${showOnlyFavorites ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
            <span>{t('favorites', lang)} ({favoriteIds.length})</span>
          </button>
        </div>

        {/* Category Tabs (Interactive Filter Buttons) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => onSelectCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shadow-2xs ${
              selectedCategoryId === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            {t('all_categories', lang)}
          </button>

          {categories.map((cat) => (
            <button
              key={cat.category_id}
              onClick={() => onSelectCategory(cat.category_id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shadow-2xs ${
                selectedCategoryId === cat.category_id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              {cat.category_name}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state with Worker progress */}
      {isLoading && (
        <div className="py-20 text-center">
          <div className="w-9 h-9 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800 mb-1">
            {t('fetching_channels', lang)}
          </p>
          <p className="text-xs text-slate-500">
            {t('parsing_bg_worker', lang)}
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredChannels.length === 0 && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <Tv className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {t('no_channels_found', lang)}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            {searchQuery
              ? `"${searchQuery}" — ${t('no_channels_found', lang)}`
              : t('no_streams_category', lang)}
          </p>
          {(searchQuery || showOnlyFavorites || selectedCategoryId !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setShowOnlyFavorites(false);
                onSelectCategory('all');
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
            >
              {t('reset_filters', lang)}
            </button>
          )}
        </div>
      )}

      {/* Virtualized Channels Grid View */}
      {!isLoading && layoutMode === 'grid' && filteredChannels.length > 0 && (
        <div>
          {/* Top spacer for virtual window */}
          <div style={{ height: `${topOffset}px` }} />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {visibleChannels.map((channel) => {
              const isFav = favoriteIds.includes(String(channel.stream_id));
              const categoryName = categoryMap.get(String(channel.category_id)) || 'Live TV';

              return (
                <div
                  key={channel.stream_id}
                  onClick={() => onSelectChannel(channel)}
                  className="group relative bg-white hover:bg-slate-50/70 border border-slate-200/90 hover:border-indigo-400 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] hover:shadow-md flex flex-col justify-between"
                  style={{ minHeight: '200px' }}
                >
                  <div>
                    {/* Channel Header: Logo + Favorite Button */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                        {channel.stream_icon ? (
                          <img
                            src={channel.stream_icon}
                            alt={channel.name}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Tv className="w-6 h-6 text-slate-400" />
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(channel.stream_id, e)}
                        className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer ${
                          isFav ? 'text-rose-500' : 'text-slate-400 hover:text-slate-600'
                        }`}
                        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500' : ''}`} />
                      </button>
                    </div>

                    {/* Channel Title */}
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-1.5">
                      {channel.name}
                    </h3>

                    {/* Clean unboxed metadata with typographic separator */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-4">
                      <span className="truncate max-w-[130px] font-medium">{categoryName}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="font-mono text-slate-500 font-semibold">ID #{channel.stream_id}</span>
                    </div>
                  </div>

                  {/* Play Full Screen CTA */}
                  <button
                    type="button"
                    className="w-full py-2 px-3 bg-slate-100 group-hover:bg-indigo-600 text-slate-700 group-hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{t('play_fullscreen', lang)}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Bottom spacer for virtual window */}
          <div style={{ height: `${bottomOffset}px` }} />
        </div>
      )}

      {/* Virtualized Channels List View */}
      {!isLoading && layoutMode === 'list' && filteredChannels.length > 0 && (
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-xs">
          {/* Top spacer for virtual window */}
          <div style={{ height: `${topOffset}px` }} />

          {visibleChannels.map((channel) => {
            const isFav = favoriteIds.includes(String(channel.stream_id));
            const categoryName = categoryMap.get(String(channel.category_id)) || 'Live TV';

            return (
              <div
                key={channel.stream_id}
                onClick={() => onSelectChannel(channel)}
                className="group flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/80 transition-colors cursor-pointer gap-4"
                style={{ height: '76px' }}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                    {channel.stream_icon ? (
                      <img
                        src={channel.stream_icon}
                        alt={channel.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Tv className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                      {channel.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className="font-medium">{categoryName}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="font-mono text-slate-500 font-semibold">ID #{channel.stream_id}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(channel.stream_id, e)}
                    className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer ${
                      isFav ? 'text-rose-500' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500' : ''}`} />
                  </button>

                  <button
                    type="button"
                    className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span className="hidden sm:inline">{t('fullscreen', lang)}</span>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Bottom spacer for virtual window */}
          <div style={{ height: `${bottomOffset}px` }} />
        </div>
      )}
    </div>
  );
};
