import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  FolderDown,
  Globe,
  Upload,
  FileText,
  Search,
  Download,
  Play,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  AlertCircle,
  X,
  Tv,
  CheckCircle2,
  Sliders,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  FileCode,
  Radio,
  Zap,
} from 'lucide-react';
import { Language, StreamChannel } from '../types';
import {
  ImportedChannel,
  ParsePlaylistResult,
  SAMPLE_IMPORT_PLAYLISTS,
  fetchRemoteM3uPlaylist,
  parseM3uContent,
  downloadSingleItemM3u,
  downloadFullM3uPlaylist,
} from '../services/playlistImportService';
import { DEFAULT_IPTV_USER_AGENT, USER_AGENT_PRESETS } from '../services/linkMasterClient';
import { BrandLogoIcon } from './BrandLogo';

interface ImportPlaylistModalProps {
  isOpen?: boolean;
  onClose: () => void;
  lang: Language;
  onPlayChannel?: (channel: StreamChannel) => void;
  onLoadChannelsToApp?: (channels: StreamChannel[]) => void;
}

export const ImportPlaylistModal: React.FC<ImportPlaylistModalProps> = ({
  isOpen = true,
  onClose,
  lang,
  onPlayChannel,
  onLoadChannelsToApp,
}) => {
  const isHindi = lang === 'hi';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Input states
  const [inputTab, setInputTab] = useState<'url' | 'upload' | 'paste'>('url');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [customUserAgent, setCustomUserAgent] = useState(DEFAULT_IPTV_USER_AGENT);
  const [selectedUaPreset, setSelectedUaPreset] = useState('chrome');
  const [referer, setReferer] = useState('');
  const [showAdvancedHeaders, setShowAdvancedHeaders] = useState(false);

  // Status & results
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParsePlaylistResult | null>(null);

  // Filtering & search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Copy feedback
  const [copiedItemIndex, setCopiedItemIndex] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [downloadedItemId, setDownloadedItemId] = useState<string | null>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Pagination for fast non-blocking rendering (no freezing/wait dialog)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Handle URL Fetch & Parse
  const handleFetchUrl = async (urlToFetch?: string) => {
    const targetUrl = (urlToFetch || playlistUrl).trim();
    if (!targetUrl) {
      setError(
        isHindi
          ? 'कृपया एक वैध M3U प्लेलिस्ट URL लिंक दर्ज करें।'
          : 'Please enter a valid M3U playlist URL link.'
      );
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const result = await fetchRemoteM3uPlaylist(targetUrl, customUserAgent, referer);
      setParseResult(result);
      setSelectedCategory('all');
      setSearchQuery('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch and parse remote playlist.');
      setParseResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Text Parsing
  const handleParseText = () => {
    if (!pastedText.trim()) {
      setError(
        isHindi
          ? 'कृपया पहले M3U कोड पेस्ट करें।'
          : 'Please paste M3U playlist text first.'
      );
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const result = parseM3uContent(pastedText);
      if (!result.success || result.channels.length === 0) {
        throw new Error('No valid streams or #EXTINF tags found in the provided text.');
      }
      setParseResult(result);
      setSelectedCategory('all');
      setSearchQuery('');
    } catch (err: any) {
      setError(err.message || 'Failed to parse M3U text.');
      setParseResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle File Upload
  const handleFileUpload = (file: File) => {
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setPastedText(content);
        try {
          setIsLoading(true);
          const result = parseM3uContent(content);
          if (result.channels.length > 0) {
            setParseResult(result);
            setSelectedCategory('all');
            setSearchQuery('');
          } else {
            setError(
              isHindi
                ? 'फ़ाइल में कोई मान्य M3U चैनल नहीं मिले।'
                : 'No valid M3U channels found in the uploaded file.'
            );
          }
        } catch (err: any) {
          setError(err.message || 'Error parsing file.');
        } finally {
          setIsLoading(false);
        }
      }
    };
    reader.onerror = () => {
      setError(isHindi ? 'फ़ाइल पढ़ने में त्रुटि हुई।' : 'Failed to read file.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleReset = () => {
    setPlaylistUrl('');
    setPastedText('');
    setParseResult(null);
    setError(null);
    setSearchQuery('');
    setSelectedCategory('all');
  };

  // Filtered channels
  const filteredChannels = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.channels.filter((ch) => {
      const matchesSearch =
        searchQuery === '' ||
        ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ch.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ch.streamUrl.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === 'all' || ch.category.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesCategory;
    });
  }, [parseResult, searchQuery, selectedCategory]);

  // Reset page when search or category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, parseResult]);

  // Paginated channels slice for ultra-fast 60fps rendering without freezing browser
  const totalPages = Math.max(1, Math.ceil(filteredChannels.length / pageSize));
  const paginatedChannels = useMemo(() => {
    const validPage = Math.min(Math.max(currentPage, 1), totalPages);
    const start = (validPage - 1) * pageSize;
    return filteredChannels.slice(start, start + pageSize);
  }, [filteredChannels, currentPage, pageSize, totalPages]);

  // Copy Single URL
  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedItemIndex(id);
    setTimeout(() => setCopiedItemIndex(null), 2000);
  };

  // Copy All URLs
  const handleCopyAllUrls = () => {
    if (!parseResult) return;
    const allUrls = filteredChannels.map((c) => c.streamUrl).join('\n');
    navigator.clipboard.writeText(allUrls);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  // Download Single Item M3U
  const handleDownloadSingle = (item: ImportedChannel) => {
    downloadSingleItemM3u(item);
    setDownloadedItemId(item.id);
    setTimeout(() => setDownloadedItemId(null), 2000);
  };

  // Asynchronously download entire playlist without freezing UI
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const handleDownloadAllPlaylist = async () => {
    if (!parseResult) return;
    try {
      setIsDownloadingAll(true);
      await downloadFullM3uPlaylist(parseResult.channels, 'imported_playlist.m3u', parseResult.rawM3u);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  // Play Channel in App
  const handlePlayInApp = (item: ImportedChannel) => {
    if (!onPlayChannel) return;
    const streamChannel: StreamChannel = {
      num: item.num,
      name: item.name,
      stream_type: 'live',
      stream_id: item.id,
      stream_icon: item.logo || undefined,
      category_id: item.category.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'imported',
      category_name: item.category,
      direct_source: item.streamUrl,
    };
    onPlayChannel(streamChannel);
  };

  // Load All Channels into the App
  const handleLoadAllToApp = () => {
    if (!parseResult || !onLoadChannelsToApp) return;
    const streamChannels: StreamChannel[] = parseResult.channels.map((ch, idx) => ({
      num: idx + 1,
      name: ch.name,
      stream_type: 'live',
      stream_id: ch.id,
      stream_icon: ch.logo || undefined,
      category_id: ch.category.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'imported',
      category_name: ch.category,
      direct_source: ch.streamUrl,
    }));
    onLoadChannelsToApp(streamChannels);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/90 flex items-center justify-between gap-3 bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
              <FolderDown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  {isHindi ? 'प्लेलिस्ट इम्पोर्ट (Import Playlist)' : 'Import Playlist & Streams'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wide">
                  M3U / M3U8
                </span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-1">
                {isHindi
                  ? 'M3U लिंक दर्ज करें, सभी स्ट्रीम्स एक्सट्रैक्ट करें और हर चैनल के लिए सीधा डाउनलोड लिंक प्राप्त करें।'
                  : 'Enter M3U URL, systematically parse all streams, and access direct download links per item.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title={isHindi ? 'बंद करें' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Top Quick Actions: Presets & Reset */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{isHindi ? 'त्वरित टेस्ट प्लेलिस्ट:' : 'Quick Sample Playlists:'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {SAMPLE_IMPORT_PLAYLISTS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPlaylistUrl(sample.url);
                    setInputTab('url');
                    handleFetchUrl(sample.url);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Radio className="w-3 h-3 text-blue-600" />
                  <span>{sample.name.split('(')[0].trim()}</span>
                </button>
              ))}
              {(playlistUrl || parseResult || pastedText) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-2.5 py-1 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                  title={isHindi ? 'साफ़ करें' : 'Clear Form'}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                  <span>{isHindi ? 'रीसेट' : 'Reset'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Input Method Selector Tabs */}
          <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold shadow-2xs">
            <button
              type="button"
              onClick={() => setInputTab('url')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                inputTab === 'url' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>{isHindi ? 'प्लेलिस्ट URL' : 'Playlist URL'}</span>
            </button>

            <button
              type="button"
              onClick={() => setInputTab('upload')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                inputTab === 'upload' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>{isHindi ? 'फ़ाइल अपलोड (.m3u)' : 'Upload File'}</span>
            </button>

            <button
              type="button"
              onClick={() => setInputTab('paste')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                inputTab === 'paste' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>{isHindi ? 'M3U टेक्स्ट पेस्ट' : 'Paste Text'}</span>
            </button>
          </div>

          {/* Tab 1: URL Input */}
          {inputTab === 'url' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                {isHindi ? 'M3U / M3U8 प्लेलिस्ट वेब लिंक:' : 'M3U / M3U8 Playlist Web URL:'}
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Globe className="w-4 h-4 text-blue-600" />
                  </div>
                  <input
                    type="url"
                    value={playlistUrl}
                    onChange={(e) => setPlaylistUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFetchUrl();
                    }}
                    placeholder="https://example.com/playlist.m3u or http://server.com:8080/get.php?..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs sm:text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                  />
                  {playlistUrl && (
                    <button
                      type="button"
                      onClick={() => setPlaylistUrl('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleFetchUrl()}
                  disabled={isLoading || !playlistUrl.trim()}
                  className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer shrink-0 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {isLoading ? (
                    <>
                      <Zap className="w-4 h-4 text-amber-300 animate-bounce" />
                      <span>{isHindi ? 'तुरंत लोड हो रहा है...' : 'Fast Loading...'}</span>
                    </>
                  ) : (
                    <>
                      <FolderDown className="w-4 h-4" />
                      <span>{isHindi ? 'फेच व पार्स करें' : 'Fetch & Parse'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Upload File Drag & Drop */}
          {inputTab === 'upload' && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-blue-600 bg-blue-50/50'
                  : 'border-slate-200 hover:border-blue-400 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".m3u,.m3u8,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto mb-3 shadow-2xs">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800 mb-1">
                {isHindi ? 'M3U या M3U8 फ़ाइल यहाँ ड्रैग करें या क्लिक करके चुनें' : 'Click to browse or drag & drop M3U / M3U8 file here'}
              </p>
              <p className="text-xs text-slate-500">
                {isHindi ? 'सपोर्टेड फ़ॉर्मेट: .m3u, .m3u8, .txt' : 'Supported: .m3u, .m3u8 text playlists'}
              </p>
            </div>
          )}

          {/* Tab 3: Paste Text */}
          {inputTab === 'paste' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {isHindi ? 'M3U डेटा टेक्स्ट पेस्ट करें:' : 'Paste Raw M3U Content:'}
                </label>
                {pastedText && (
                  <span className="text-[11px] font-mono text-slate-500">
                    {pastedText.split(/\r?\n/).filter((l) => l.trim().startsWith('#EXTINF')).length} channels found
                  </span>
                )}
              </div>
              <textarea
                rows={5}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-name=&quot;Channel 1&quot; group-title=&quot;News&quot;,Channel 1&#10;https://example.com/live/ch1.m3u8"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs leading-relaxed"
              />
              <button
                type="button"
                onClick={handleParseText}
                disabled={isLoading || !pastedText.trim()}
                className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FolderDown className="w-4 h-4" />
                <span>{isHindi ? 'टेक्स्ट पार्स करें' : 'Parse Pasted Content'}</span>
              </button>
            </div>
          )}

          {/* Advanced HTTP Headers Toggle */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAdvancedHeaders(!showAdvancedHeaders)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span>{isHindi ? 'उन्नत HTTP हेडर सेटिंग्स (User-Agent व Referer)' : 'Advanced HTTP Headers (User-Agent & Referer)'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvancedHeaders ? 'rotate-180' : ''}`} />
            </button>

            {showAdvancedHeaders && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in duration-150 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    User-Agent:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
                    {USER_AGENT_PRESETS.slice(0, 3).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedUaPreset(p.id);
                          setCustomUserAgent(p.value);
                        }}
                        className={`p-1.5 rounded-lg text-left border transition-all cursor-pointer text-[11px] ${
                          selectedUaPreset === p.id
                            ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {p.label.split('/')[0].trim()}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={customUserAgent}
                    onChange={(e) => setCustomUserAgent(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    HTTP Referer (वैकल्पिक):
                  </label>
                  <input
                    type="text"
                    value={referer}
                    onChange={(e) => setReferer(e.target.value)}
                    placeholder="https://provider.com/"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Error Message Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{error}</div>
            </div>
          )}

          {/* Results View: Parsed Playlist & Per-Item Direct Download Links */}
          {parseResult && (
            <div className="space-y-4 pt-2 border-t border-slate-200 animate-in fade-in duration-200">
              {/* Summary Stats & Global Actions Bar */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-slate-50 border border-blue-100 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                      {isHindi ? 'सफलतापूर्वक पार्स की गई प्लेलिस्ट' : 'Systematically Parsed Playlist'}
                    </span>
                    <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-full text-xs font-extrabold shadow-2xs">
                      {parseResult.totalChannels} {isHindi ? 'चैनल' : 'Channels'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span className="flex items-center gap-1 font-medium">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>{parseResult.categories.length} {isHindi ? 'श्रेणियां' : 'Categories'}</span>
                    </span>
                    {parseResult.sourceUrl && (
                      <span className="font-mono text-[11px] text-slate-500 truncate max-w-xs" title={parseResult.sourceUrl}>
                        {parseResult.sourceUrl}
                      </span>
                    )}
                  </div>
                </div>

                {/* Global Actions: Download Full M3U & Load in App */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadAllPlaylist}
                    disabled={isDownloadingAll}
                    className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-60"
                    title="Download complete parsed .m3u file instantly"
                  >
                    {isDownloadingAll ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{isHindi ? 'डाउनलोड हो रहा है...' : 'Downloading...'}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>{isHindi ? 'पूरी प्लेलिस्ट डाउनलोड' : 'Download All (.m3u)'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyAllUrls}
                    className="py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Copy all channel stream URLs"
                  >
                    {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{copiedAll ? (isHindi ? 'कॉपी हो गया' : 'Copied!') : (isHindi ? 'सभी लिंक कॉपी' : 'Copy URLs')}</span>
                  </button>

                  {onLoadChannelsToApp && (
                    <button
                      type="button"
                      onClick={handleLoadAllToApp}
                      className="py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-blue-600/20 transition-all cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
                      title="Import all channels directly into the app"
                    >
                      <Tv className="w-3.5 h-3.5" />
                      <span>{isHindi ? 'ऐप में लोड करें' : 'Play in App'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Search & Category Filter Toolbar */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isHindi ? 'चैनल का नाम या श्रेणी खोजें...' : 'Search by channel name or group...'}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {parseResult.categories.length > 1 && (
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                  >
                    <option value="all">
                      {isHindi ? 'सभी श्रेणियां' : 'All Categories'} ({parseResult.totalChannels})
                    </option>
                    {parseResult.categories.map((cat, idx) => (
                      <option key={idx} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Items List Header */}
              <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-semibold">
                <span>
                  {filteredChannels.length > 0 ? (
                    isHindi
                      ? `${filteredChannels.length} में से ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredChannels.length)} चैनल प्रदर्शित`
                      : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredChannels.length)} of ${filteredChannels.length} streams`
                  ) : (
                    isHindi ? '0 चैनल' : '0 streams'
                  )}
                </span>
                <span className="text-[11px] text-blue-600 font-bold">
                  {isHindi ? 'सीधा डाउनलोड लिंक प्रत्येक आइटम के सामने उपलब्ध है' : 'Direct download link available per item'}
                </span>
              </div>

              {/* Channel Items Table / Card List */}
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-[360px] overflow-y-auto shadow-2xs">
                {paginatedChannels.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    {isHindi ? 'कोई मेल खाने वाला चैनल नहीं मिला।' : 'No matching channels found.'}
                  </div>
                ) : (
                  paginatedChannels.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Left: Logo, Name, Category & Extension */}
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono font-bold text-slate-400 w-6 text-right shrink-0">
                          {item.num}
                        </span>

                        {item.logo ? (
                          <img
                            src={item.logo}
                            alt={item.name}
                            onError={(e) => {
                              // Hide broken image and fallback to icon
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                            className="w-9 h-9 rounded-lg object-contain bg-slate-100 border border-slate-200 shrink-0 p-0.5"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            <Tv className="w-4 h-4" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {item.name}
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                              {item.category}
                            </span>
                            <span
                              className={`text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                                item.extension === 'm3u8'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : item.extension === 'ts'
                                  ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {item.extension.toUpperCase()}
                            </span>
                          </div>

                          <p className="text-[11px] font-mono text-slate-400 truncate max-w-sm sm:max-w-md mt-0.5" title={item.streamUrl}>
                            {item.streamUrl}
                          </p>
                        </div>
                      </div>

                      {/* Right: Direct Actions per item (Direct Download Link, Copy URL, Play in App) */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {/* 1. Direct Download Link (Individual .m3u file) */}
                        <button
                          type="button"
                          onClick={() => handleDownloadSingle(item)}
                          className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-[0.98] ${
                            downloadedItemId === item.id
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                          }`}
                          title={isHindi ? 'यह चैनल M3U फ़ाइल के रूप में डाउनलोड करें' : 'Download this single channel as an .m3u file'}
                        >
                          {downloadedItemId === item.id ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>{isHindi ? 'डाउनलोड हुआ' : 'Saved'}</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>{isHindi ? 'डाउनलोड M3U' : 'Download M3U'}</span>
                            </>
                          )}
                        </button>

                        {/* 2. Direct Stream URL Copy Button */}
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(item.streamUrl, item.id)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          title={isHindi ? 'स्ट्रीम URL कॉपी करें' : 'Copy direct stream URL'}
                        >
                          {copiedItemIndex === item.id ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        {/* 3. In-App Instant Test Play */}
                        {onPlayChannel && (
                          <button
                            type="button"
                            onClick={() => handlePlayInApp(item)}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                            title={isHindi ? 'ऐप में चलाएं' : 'Play now in app'}
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span className="hidden sm:inline">{isHindi ? 'चलाएं' : 'Play'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Ultra-Fast Non-Blocking Pagination Bar */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">
                      {isHindi ? 'प्रति पृष्ठ:' : 'Per page:'}
                    </span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold focus:outline-none shadow-2xs cursor-pointer"
                    >
                      <option value="50">50</option>
                      <option value="100">100</option>
                      <option value="250">250</option>
                    </select>
                    <span className="text-slate-500 font-mono text-[11px] ml-2">
                      {isHindi ? `पृष्ठ ${currentPage} / ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none border border-slate-200 rounded-lg font-bold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>{isHindi ? 'पिछला' : 'Prev'}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum = i + 1;
                        if (totalPages > 5 && currentPage > 3) {
                          pageNum = Math.min(totalPages - 4, Math.max(1, currentPage - 2)) + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-7 h-7 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none border border-slate-200 rounded-lg font-bold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                    >
                      <span>{isHindi ? 'अगला' : 'Next'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 text-center sm:text-left flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {isHindi
                ? 'सभी डाउनलोड किए गए M3U फ़ाइलें VLC, TiviMate, OTT Navigator और Smart TV में तुरंत चलती हैं।'
                : 'Downloaded .m3u files include complete IPTV header configs for VLC, TiviMate & Smart TVs.'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer"
          >
            {isHindi ? 'बंद करें' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
