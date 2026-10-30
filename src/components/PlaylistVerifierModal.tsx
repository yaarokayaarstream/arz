import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Upload,
  Download,
  Play,
  RotateCcw,
  AlertCircle,
  FileText,
  Search,
  Filter,
  Activity,
  Layers,
  Clock,
  Sparkles,
  X,
  Tv,
  Check,
  Copy,
  Pause,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Language, StreamChannel } from '../types';
import {
  VerifiedChannel,
  startPlaylistVerification,
  downloadActiveM3uFile,
} from '../services/playlistVerifierClient';
import { parseM3uFast } from '../server/playlistVerifierService';

interface PlaylistVerifierModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  lang: Language;
  onPlayChannel?: (channel: StreamChannel) => void;
  onLoadChannelsToApp?: (channels: StreamChannel[]) => void;
  isStandalonePage?: boolean;
}

export const PlaylistVerifierModal: React.FC<PlaylistVerifierModalProps> = ({
  isOpen = true,
  onClose,
  lang,
  onPlayChannel,
  onLoadChannelsToApp,
  isStandalonePage = false,
}) => {
  const isHindi = lang === 'hi';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Upload & parse states
  const [m3uText, setM3uText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSizeText, setFileSizeText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [parsingStatus, setParsingStatus] = useState<{
    parsed: boolean;
    totalChannels: number;
    categories: string[];
    sampleName?: string;
  } | null>(null);

  // Verification states
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live progress metrics
  const [checkedCount, setCheckedCount] = useState(0);
  const [totalToVerify, setTotalToVerify] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [deadCount, setDeadCount] = useState(0);
  const [channels, setChannels] = useState<VerifiedChannel[]>([]);
  const [activeM3uContent, setActiveM3uContent] = useState('');

  // Filtering & Pagination
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'dead'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Reliability settings: 10-15s timeout & 2-3x retries to prevent false dead streams
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(12); // Default 12s (between 10-15s)
  const [maxRetries, setMaxRetries] = useState<number>(3); // Default 3 retries (at least 2-3 retries)

  // Abort on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Quick file processor
  const handleFileProcess = (file: File) => {
    if (!file) return;
    setError(null);
    setFileName(file.name);
    setFileSizeText(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setM3uText(text);
        try {
          const parsed = parseM3uFast(text);
          setParsingStatus({
            parsed: true,
            totalChannels: parsed.totalChannels,
            categories: parsed.categories,
            sampleName: file.name,
          });
          setChannels(parsed.channels);
          setTotalToVerify(parsed.totalChannels);
          setCheckedCount(0);
          setProgressPercent(0);
          setActiveCount(0);
          setDeadCount(0);
          setIsCompleted(false);
          setActiveM3uContent('');
        } catch (err: any) {
          setError(err.message || 'Error parsing uploaded M3U file');
        }
      }
    };
    reader.onerror = () => {
      setError(isHindi ? 'फ़ाइल पढ़ने में त्रुटि हुई।' : 'Error reading file.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  // Sample quick load for testing
  const handleLoadSample = (sampleText: string, sampleTitle: string) => {
    setError(null);
    setFileName(`${sampleTitle.toLowerCase().replace(/\s+/g, '_')}.m3u`);
    setFileSizeText('4.2 KB');
    setM3uText(sampleText);
    const parsed = parseM3uFast(sampleText);
    setParsingStatus({
      parsed: true,
      totalChannels: parsed.totalChannels,
      categories: parsed.categories,
      sampleName: sampleTitle,
    });
    setChannels(parsed.channels);
    setTotalToVerify(parsed.totalChannels);
    setCheckedCount(0);
    setProgressPercent(0);
    setActiveCount(0);
    setDeadCount(0);
    setIsCompleted(false);
    setActiveM3uContent('');
  };

  // Start Real-Time Verification
  const handleStartVerification = async () => {
    if (!m3uText.trim()) {
      setError(
        isHindi
          ? 'कृपया पहले एक M3U प्लेलिस्ट फ़ाइल अपलोड करें।'
          : 'Please upload an M3U playlist file first.'
      );
      return;
    }

    try {
      setIsVerifying(true);
      setError(null);
      setIsCompleted(false);
      setCheckedCount(0);
      setActiveCount(0);
      setDeadCount(0);
      setProgressPercent(0);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      await startPlaylistVerification(
        m3uText,
        {
          onParsed: (data) => {
            setTotalToVerify(data.totalChannels);
          },
          onProgress: (prog) => {
            setCheckedCount(prog.checked);
            setTotalToVerify(prog.total);
            setProgressPercent(prog.percent);
            setActiveCount(prog.activeCount);
            setDeadCount(prog.deadCount);

            // Update channel status in state
            setChannels((prev) => {
              const updated = [...prev];
              const idx = updated.findIndex((c) => c.streamUrl === prog.channel.streamUrl);
              if (idx !== -1) {
                updated[idx] = { ...updated[idx], ...prog.channel };
              }
              return updated;
            });
          },
          onComplete: (complete) => {
            setIsVerifying(false);
            setIsCompleted(true);
            setActiveCount(complete.activeCount);
            setDeadCount(complete.deadCount);
            setProgressPercent(100);
            setActiveM3uContent(complete.activeM3u);
            if (complete.activeChannels) {
              setChannels(complete.activeChannels);
            }
          },
          onError: (err) => {
            setError(err.message || 'Stream verification failed.');
            setIsVerifying(false);
          },
        },
        {
          concurrency: 8,
          timeoutMs: timeoutSeconds * 1000,
          maxRetries: maxRetries,
          abortSignal: controller.signal,
        }
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Verification failed');
      }
    } finally {
      setIsVerifying(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopVerification = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsVerifying(false);
    }
  };

  // Download Active Playlist
  const handleDownloadActive = () => {
    if (!activeM3uContent) {
      // If not yet complete, build from active channels in state
      const currentActive = channels.filter((c) => c.active === true);
      if (currentActive.length === 0) {
        setError(isHindi ? 'कोई सक्रिय चैनल उपलब्ध नहीं है।' : 'No active channels found.');
        return;
      }
      let fallbackM3u = '#EXTM3U\r\n';
      currentActive.forEach((ch) => {
        fallbackM3u += `#EXTINF:-1 tvg-id="${ch.tvgId || ''}" tvg-name="${ch.tvgName || ch.name}" tvg-logo="${ch.logo || ''}" group-title="${ch.category || 'Live TV'}",${ch.name}\r\n`;
        fallbackM3u += `${ch.streamUrl}\r\n`;
      });
      const name = fileName ? `${fileName.replace(/\.m3u8?$/i, '')}_active_only.m3u` : 'active_playlist.m3u';
      downloadActiveM3uFile(fallbackM3u, name);
      return;
    }
    const name = fileName ? `${fileName.replace(/\.m3u8?$/i, '')}_active_only.m3u` : 'active_playlist.m3u';
    downloadActiveM3uFile(activeM3uContent, name);
  };

  const handleCopyActiveM3u = () => {
    const content = activeM3uContent || channels.filter((c) => c.active).map((c) => c.streamUrl).join('\n');
    navigator.clipboard.writeText(content);
    setCopiedKey('active_m3u');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handlePlayInApp = (ch: VerifiedChannel) => {
    if (!onPlayChannel) return;
    const streamChannel: StreamChannel = {
      num: ch.num,
      name: ch.name,
      stream_type: 'live',
      stream_id: ch.id,
      stream_icon: ch.logo || undefined,
      category_id: ch.category.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'verified',
      category_name: ch.category,
      direct_source: ch.streamUrl,
    };
    onPlayChannel(streamChannel);
  };

  // Filtered & Paginated Channels
  const filteredChannels = useMemo(() => {
    return channels.filter((ch) => {
      // Status tab filter
      if (filterTab === 'active' && ch.active !== true) return false;
      if (filterTab === 'dead' && ch.active !== false) return false;

      // Category filter
      if (selectedCategory !== 'all' && ch.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = ch.name.toLowerCase().includes(query);
        const matchesCat = ch.category.toLowerCase().includes(query);
        const matchesUrl = ch.streamUrl.toLowerCase().includes(query);
        return matchesName || matchesCat || matchesUrl;
      }

      return true;
    });
  }, [channels, filterTab, selectedCategory, searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab, selectedCategory, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredChannels.length / pageSize));
  const paginatedChannels = useMemo(() => {
    const validPage = Math.min(Math.max(currentPage, 1), totalPages);
    const start = (validPage - 1) * pageSize;
    return filteredChannels.slice(start, start + pageSize);
  }, [filteredChannels, currentPage, pageSize, totalPages]);

  if (!isOpen) return null;

  return (
    <div
      className={
        isStandalonePage
          ? 'w-full'
          : 'fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto'
      }
    >
      <div
        className={`bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full overflow-hidden flex flex-col transition-all ${
          isStandalonePage ? 'max-w-5xl mx-auto' : 'max-w-5xl max-h-[92vh]'
        }`}
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-indigo-800 text-white p-5 sm:p-6 shrink-0 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
              <ShieldCheck className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  {isHindi ? 'प्लेलिस्ट सत्यापन एवं सक्रिय चैनल फ़िल्टर' : 'M3U Stream Verifier & Active Playlist'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400 text-slate-950 uppercase tracking-wide">
                  Live Health Probe
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5 leading-relaxed">
                {isHindi
                  ? 'M3U प्लेलिस्ट अपलोड करें, हर स्ट्रीम URL की लाइव जाँच करें और केवल सक्रिय चैनलों की नई प्लेलिस्ट डाउनलोड करें।'
                  : 'Upload an M3U playlist, probe live stream health concurrently, and download active-only channels.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isStandalonePage && onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6">
          {/* Section 1: File Upload & Parsing Status Indicator */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>{isHindi ? '1. M3U प्लेलिस्ट फ़ाइल अपलोड करें' : '1. Upload M3U Playlist File'}</span>
              </label>

              {/* Sample test playlist picker */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">{isHindi ? 'परीक्षण डेमो:' : 'Demo samples:'}</span>
                <button
                  type="button"
                  onClick={() =>
                    handleLoadSample(
                      `#EXTM3U\n#EXTINF:-1 tvg-name="9X Jalwa Live HD",9X Jalwa Live HD\nhttps://wiselp.wiseplayout.com/9X_Jalwa/master.m3u8\n#EXTINF:-1 tvg-name="Action Sports Mux",Action Sports HD\nhttps://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8\n#EXTINF:-1 tvg-name="Broken Offline Channel",Dead Channel 404\nhttps://example.com/dead/stream.m3u8\n#EXTINF:-1 tvg-name="Apple BipBop Master",Apple BipBop 1080p\nhttps://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8\n#EXTINF:-1 tvg-name="Timeout Test Stream",Timeout Server 408\nhttp://10.255.255.1:8080/live/timeout.m3u8\n#EXTINF:-1 tvg-name="Akamai Test Live",Akamai Live HD\nhttps://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8`,
                      'Demo Mixed Playlist (Active & Dead)'
                    )
                  }
                  className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold shadow-2xs transition-colors cursor-pointer text-[11px] flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>{isHindi ? 'डेमो टेस्ट लोड करें' : 'Load Mixed Demo'}</span>
                </button>
              </div>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                  : parsingStatus
                  ? 'border-emerald-400 bg-emerald-50/20'
                  : 'border-slate-300 bg-white hover:border-emerald-400 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".m3u,.m3u8,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
              />

              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2 shadow-2xs">
                <Upload className="w-6 h-6" />
              </div>

              {fileName ? (
                <div>
                  <div className="text-sm font-bold text-slate-900 flex items-center justify-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>{fileName}</span>
                    <span className="text-xs text-slate-500 font-mono">({fileSizeText})</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {isHindi ? 'फ़ाइल बदलने के लिए क्लिक करें या दूसरी फ़ाइल छोड़ें' : 'Click to replace or drop another playlist'}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {isHindi
                      ? 'अपनी M3U / M3U8 फ़ाइल यहाँ छोड़ें या फ़ाइल चुनने के लिए क्लिक करें'
                      : 'Drop your M3U / M3U8 playlist here or click to browse'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    .m3u, .m3u8, .txt (VLC, IPTV, TiviMate formats)
                  </p>
                </div>
              )}
            </div>

            {/* Parsing Status Indicator & Reliability Controls */}
            {parsingStatus && (
              <div className="space-y-3">
                {/* Reliability Settings (10-15s Timeout & 2-3x Retries) */}
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-700" />
                      <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                        {isHindi ? 'सत्यापन विश्वसनीयता सेटिंग्स (False-Dead Protection):' : 'Reliability Settings (False-Dead Protection):'}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>{isHindi ? 'री-ट्राई सुरक्षा सक्रिय' : 'Retries Guard Active'}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Setting 1: Timeout Duration (10s, 12s, 15s) */}
                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-700 text-[11px]">
                        {isHindi ? 'टाइमआउट अवधि (स्लो लोडिंग स्ट्रीम्स हेतु):' : 'Timeout Duration (For slow-loading streams):'}
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[10, 12, 15].map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            disabled={isVerifying}
                            onClick={() => setTimeoutSeconds(sec)}
                            className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-[11px] border transition-all cursor-pointer ${
                              timeoutSeconds === sec
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                            }`}
                          >
                            {sec}s {sec === 12 && (isHindi ? '(अनुशंसित)' : '(Rec)')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Setting 2: Retry Mechanism (2x, 3x retries) */}
                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-700 text-[11px]">
                        {isHindi ? 'री-ट्राई प्रयास (विफलता पर कम से कम 2-3 बार):' : 'Retry Attempts (On failure before declaring dead):'}
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[2, 3].map((retries) => (
                          <button
                            key={retries}
                            type="button"
                            disabled={isVerifying}
                            onClick={() => setMaxRetries(retries)}
                            className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-[11px] border transition-all cursor-pointer ${
                              maxRetries === retries
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                            }`}
                          >
                            {retries}x {isHindi ? 'री-ट्राई' : 'Retries'} {retries === 3 && (isHindi ? '(अनुशंसित)' : '(Rec)')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-indigo-900/80 bg-white/70 p-2 rounded-lg border border-indigo-100 flex items-start gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <span>
                      {isHindi
                        ? `प्रत्येक स्ट्रीम को ${timeoutSeconds} सेकंड तक रिस्पॉन्स का समय मिलेगा। स्ट्रीम फेल होने पर ${maxRetries} बार अलग-अलग प्रोटोकॉल से री-ट्राई किया जाएगा। केवल तभी डेड मार्क होगा जब सभी री-ट्राई पूरी तरह फेल हों।`
                        : `Each stream gets ${timeoutSeconds}s to respond. If a stream fails, it will be retried ${maxRetries} times with fallback protocols before being declared dead.`}
                    </span>
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-150">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{isHindi ? 'प्लेलिस्ट पार्स स्थिति:' : 'Parsing Status:'}</span>
                        <span className="text-emerald-700 font-black">
                          {isHindi ? 'सफलतापूर्वक पार्स हुआ' : 'Successfully Parsed'}
                        </span>
                      </span>
                      <p className="text-[11px] text-slate-500">
                        {parsingStatus.totalChannels} {isHindi ? 'चैनल मिले' : 'channels found'} ·{' '}
                        {parsingStatus.categories.length} {isHindi ? 'श्रेणियां' : 'categories'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleStartVerification}
                      disabled={isVerifying || parsingStatus.totalChannels === 0}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <Activity className="w-4 h-4 animate-pulse" />
                      <span>
                        {isVerifying
                          ? (isHindi ? 'सत्यापन जारी...' : 'Verifying Streams...')
                          : (isHindi ? `सत्यापन शुरू करें (${timeoutSeconds}s Timeout + ${maxRetries}x Retries)` : `Start Verification (${timeoutSeconds}s Timeout + ${maxRetries}x Retries)`)}
                      </span>
                    </button>

                    {isVerifying && (
                      <button
                        type="button"
                        onClick={handleStopVerification}
                        className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Pause className="w-4 h-4" />
                        <span>{isHindi ? 'रोकें' : 'Stop'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Real-Time Verification Progress Bar & KPIs */}
          {(isVerifying || checkedCount > 0 || isCompleted) && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    <span>{isHindi ? 'लाइव स्ट्रीम सत्यापन प्रगति' : 'Real-Time Verification Progress'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isCompleted
                      ? (isHindi ? 'सत्यापन पूर्ण! केवल सक्रिय चैनल नीचे फ़िल्टर कर दिए गए हैं।' : 'Verification Complete! Only active streams ready for download.')
                      : (isHindi ? 'प्रत्येक स्ट्रीम की लाइव HTTP स्थिति और लेटेंसी जांची जा रही है...' : 'Probing live stream health concurrently with HTTP response codes...')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-black font-mono px-3 py-1 bg-slate-100 rounded-lg text-slate-800">
                    {progressPercent}% ({checkedCount}/{totalToVerify})
                  </span>
                </div>
              </div>

              {/* Real-Time Progress Bar */}
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 h-full rounded-full transition-all duration-300 relative"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>

              {/* 3 Live KPI Counter Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Active Streams */}
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                      {isHindi ? 'सक्रिय स्ट्रीम्स (Active)' : 'Active Streams'}
                    </span>
                    <div className="text-2xl font-black text-emerald-950 mt-0.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>{activeCount}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {checkedCount > 0 ? `${Math.round((activeCount / checkedCount) * 100)}%` : '0%'}
                  </span>
                </div>

                {/* 2. Dead / Offline Streams */}
                <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">
                      {isHindi ? 'अक्रिय / मृत (Dead)' : 'Dead / Offline'}
                    </span>
                    <div className="text-2xl font-black text-rose-950 mt-0.5 flex items-center gap-1.5">
                      <XCircle className="w-5 h-5 text-rose-600" />
                      <span>{deadCount}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                    {checkedCount > 0 ? `${Math.round((deadCount / checkedCount) * 100)}%` : '0%'}
                  </span>
                </div>

                {/* 3. Download Action Banner */}
                <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide">
                      {isHindi ? 'फ़िल्टर की गई प्लेलिस्ट' : 'Verified Output'}
                    </span>
                    <div className="text-xs text-indigo-950 font-bold mt-1">
                      {activeCount} {isHindi ? 'सक्रिय चैनल तैयार' : 'Active channels ready'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadActive}
                    disabled={activeCount === 0}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-[0.98]"
                    title="Download active-only M3U playlist"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isHindi ? 'डाउनलोड करें' : 'Download Active'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Prominent 'Download Active Playlist' Action Bar */}
          {activeCount > 0 && (
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-2xl p-5 sm:p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-200">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full inline-block">
                  {isHindi ? 'सत्यापित प्लेलिस्ट तैयार' : 'Active Playlist Ready'}
                </span>
                <h4 className="text-xl font-black">
                  {isHindi ? `केवल सक्रिय प्लेलिस्ट डाउनलोड करें (${activeCount} चैनल)` : `Download Active Playlist (${activeCount} Channels)`}
                </h4>
                <p className="text-xs text-emerald-100 max-w-lg">
                  {isHindi
                    ? 'सभी अक्रिय/मृत चैनल हटा दिए गए हैं। VLC, TiviMate, Smart TV और IPTV ऐप्स में 100% सुचारू रूप से चलेगी।'
                    : 'All dead, 404, and timed-out streams removed. Ready for instant import into VLC, TiviMate & Smart TVs.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Main Download Button */}
                <button
                  type="button"
                  onClick={handleDownloadActive}
                  className="px-5 py-3 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl text-xs sm:text-sm font-extrabold shadow-md flex items-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <Download className="w-4 h-4 text-emerald-700" />
                  <span>{isHindi ? 'Download Active Playlist (.m3u)' : 'Download Active Playlist (.m3u)'}</span>
                </button>

                {/* Copy Active M3U */}
                <button
                  type="button"
                  onClick={handleCopyActiveM3u}
                  className="px-3.5 py-3 bg-black/20 hover:bg-black/30 border border-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedKey === 'active_m3u' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>{isHindi ? 'कॉपी हुआ' : 'Copied'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>{isHindi ? 'M3U कॉपी' : 'Copy'}</span>
                    </>
                  )}
                </button>

                {/* Load Active channels to App */}
                {onLoadChannelsToApp && (
                  <button
                    type="button"
                    onClick={() => {
                      const activeOnly = channels.filter((c) => c.active === true);
                      const streamChannels: StreamChannel[] = activeOnly.map((c) => ({
                        num: c.num,
                        name: c.name,
                        stream_type: 'live',
                        stream_id: c.id,
                        stream_icon: c.logo || undefined,
                        category_id: c.category.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'verified',
                        category_name: c.category,
                        direct_source: c.streamUrl,
                      }));
                      onLoadChannelsToApp(streamChannels);
                      if (onClose) onClose();
                    }}
                    className="px-3.5 py-3 bg-emerald-800 hover:bg-emerald-900 border border-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Tv className="w-4 h-4" />
                    <span>{isHindi ? 'ऐप में चलाएं' : 'Play in App'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Section 4: Channel Verification Results Table with Filter Tabs */}
          {channels.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Filter Tabs: All vs Active Only vs Dead Only */}
                <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    className={`py-1.5 px-3 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                      filterTab === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{isHindi ? 'सभी चैनल' : 'All Channels'}</span>
                    <span className="px-1.5 py-0.2 bg-slate-200 rounded-full text-[10px]">
                      {channels.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterTab('active')}
                    className={`py-1.5 px-3 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                      filterTab === 'active'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isHindi ? 'केवल सक्रिय' : 'Active Only'}</span>
                    <span className="px-1.5 py-0.2 bg-emerald-700/80 rounded-full text-[10px] text-white">
                      {activeCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterTab('dead')}
                    className={`py-1.5 px-3 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                      filterTab === 'dead'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-rose-700 hover:text-rose-900'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{isHindi ? 'मृत / ऑफ़लाइन' : 'Dead Only'}</span>
                    <span className="px-1.5 py-0.2 bg-rose-700/80 rounded-full text-[10px] text-white">
                      {deadCount}
                    </span>
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isHindi ? 'चैनल खोजें...' : 'Search channels...'}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Table of channels */}
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-[360px] overflow-y-auto shadow-2xs">
                {paginatedChannels.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    {isHindi ? 'इस फ़िल्टर में कोई चैनल नहीं मिला।' : 'No channels match the selected filter.'}
                  </div>
                ) : (
                  paginatedChannels.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Status Icon */}
                        <div className="shrink-0">
                          {item.active === true ? (
                            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          ) : item.active === false ? (
                            <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
                              <XCircle className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-mono text-[10px]">
                              {item.num}
                            </div>
                          )}
                        </div>

                        {/* Logo */}
                        {item.logo ? (
                          <img
                            src={item.logo}
                            alt=""
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                            className="w-8 h-8 rounded-lg object-contain bg-slate-50 border border-slate-200 shrink-0 p-0.5"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center text-xs shrink-0">
                            <Tv className="w-3.5 h-3.5" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {item.name}
                            </h4>
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.2 rounded-full border border-slate-200">
                              {item.category}
                            </span>
                          </div>
                          <p className="font-mono text-[11px] text-slate-400 truncate max-w-sm mt-0.5" title={item.streamUrl}>
                            {item.streamUrl}
                          </p>
                        </div>
                      </div>

                      {/* Right: Latency & Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {item.active === true && (
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                            <Zap className="w-3 h-3 text-emerald-600" />
                            <span>{item.latencyMs}ms</span>
                            <span className="text-emerald-600 font-bold ml-1">200 OK</span>
                            {item.attempts && item.attempts > 1 && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-1.5 py-0.2 rounded border border-emerald-300 ml-1">
                                {isHindi ? `री-ट्राई #${item.attempts - 1} पर पास` : `Saved on Retry #${item.attempts - 1}`}
                              </span>
                            )}
                          </div>
                        )}

                        {item.active === false && (
                          <div className="text-[11px] font-mono text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-rose-500 shrink-0" />
                            <span>{item.reason || `HTTP ${item.statusCode || 'Dead'}`}</span>
                          </div>
                        )}

                        {/* Test Play */}
                        {item.active === true && onPlayChannel && (
                          <button
                            type="button"
                            onClick={() => handlePlayInApp(item)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                            title="Play channel"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <span className="text-slate-500">
                    {isHindi
                      ? `${filteredChannels.length} में से ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredChannels.length)} चैनल`
                      : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredChannels.length)} of ${filteredChannels.length}`}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-200 rounded-lg font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>{isHindi ? 'पिछला' : 'Prev'}</span>
                    </button>

                    <span className="font-mono text-xs font-bold text-slate-700 px-2">
                      {currentPage} / {totalPages}
                    </span>

                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-200 rounded-lg font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
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
      </div>
    </div>
  );
};
