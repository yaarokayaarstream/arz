import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Upload,
  Link as LinkIcon,
  Clock,
  Trash2,
  Copy,
  Check,
  Smartphone,
  Monitor,
  Tv,
  Tablet,
  BarChart3,
  Calendar,
  Layers,
  AlertCircle,
  CheckCircle2,
  Play,
  Download,
  Share2,
  RefreshCw,
  Sparkles,
  QrCode,
  X,
  ExternalLink,
  ChevronRight,
  Eye,
  FileText,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { Language, StreamChannel } from '../types';
import {
  createTrackUrl,
  fetchAllTrackUrls,
  fetchTrackUrlStats,
  deleteTrackUrl,
  simulateTrackClick,
  TrackUrlSummary,
  TrackUrlDetailedStats,
} from '../services/trackUrlClient';
import { sendUrlGeneratedNotification } from '../services/emailJsService';
import { uploadToMegaAndNotify } from '../services/megaUploaderClient';

interface TrackUrlModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  lang: Language;
  onPlayChannel?: (channel: StreamChannel) => void;
  isStandalonePage?: boolean;
}

export const TrackUrlModal: React.FC<TrackUrlModalProps> = ({
  isOpen = true,
  onClose,
  lang,
  onPlayChannel,
  isStandalonePage = false,
}) => {
  const isHindi = lang === 'hi';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active top-level Tab: 'create' | 'dashboard'
  const [activeTab, setActiveTab] = useState<'create' | 'dashboard'>('create');
  const resultRef = useRef<HTMLDivElement>(null);

  // Creation Form State
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [m3uText, setM3uText] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [channelCount, setChannelCount] = useState<number>(0);
  const [customSlug, setCustomSlug] = useState('');
  const [validityType, setValidityType] = useState<'permanent' | 'timed'>('permanent');
  const [durationHours, setDurationHours] = useState<number>(24);
  const [customHoursInput, setCustomHoursInput] = useState('24');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Newly created result
  const [createdResult, setCreatedResult] = useState<{
    id: string;
    slug: string;
    name: string;
    channelCount: number;
    validityType: 'permanent' | 'timed';
    expiresAt: number | null;
    shortUrl: string;
    m3uUrl: string;
  } | null>(null);

  // Dashboard / List State
  const [trackUrls, setTrackUrls] = useState<TrackUrlSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [selectedStats, setSelectedStats] = useState<TrackUrlDetailedStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ idOrSlug: string; name: string } | null>(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);
  const [actionErrorNotice, setActionErrorNotice] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Clipboard feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load existing URLs when dashboard tab is active or on mount
  useEffect(() => {
    if (isOpen) {
      loadTrackUrls();
    }
  }, [isOpen]);

  const loadTrackUrls = async () => {
    try {
      setIsLoadingList(true);
      const list = await fetchAllTrackUrls();
      setTrackUrls(list);
      // If we currently have a selected link stats open, refresh it too
      if (selectedStats) {
        const fresh = await fetchTrackUrlStats(selectedStats.slug);
        setSelectedStats(fresh);
      }
    } catch (err: any) {
      console.warn('Failed to load track URLs:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  // Channel counter on M3U text change
  useEffect(() => {
    if (!m3uText.trim()) {
      setChannelCount(0);
      return;
    }
    const matches = m3uText.match(/#EXTINF:/gi);
    setChannelCount(matches ? matches.length : 1);
  }, [m3uText]);

  // File upload reader
  const handleFileProcess = (file: File) => {
    if (!file) return;
    setCreateError(null);
    setUploadFileName(file.name);
    const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    if (!playlistTitle) {
      setPlaylistTitle(cleanTitle);
    }
    if (!customSlug) {
      const suggestedSlug = file.name
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 20);
      setCustomSlug(suggestedSlug);
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setM3uText(text);
      }
    };
    reader.onerror = () => {
      setCreateError(isHindi ? 'फ़ाइल पढ़ने में समस्या हुई।' : 'Failed to read file.');
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

  // Submit creation
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!m3uText.trim()) {
      setCreateError(
        isHindi
          ? 'कृपया अपनी M3U प्लेलिस्ट फ़ाइल अपलोड करें या M3U टेक्स्ट पेस्ट करें।'
          : 'Please upload your M3U playlist file or paste M3U content.'
      );
      return;
    }

    const duration =
      validityType === 'timed'
        ? Number(customHoursInput) || durationHours || 24
        : undefined;

    try {
      setIsSubmitting(true);
      const res = await createTrackUrl({
        name: playlistTitle.trim() || undefined,
        m3uContent: m3uText,
        customSlug: customSlug.trim() || undefined,
        validityType,
        durationHours: duration,
      });

      setCreatedResult(res);

      // Auto-scroll to result card located directly beneath the generate button
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);

      // Send EmailJS alert for new generated Track URL
      sendUrlGeneratedNotification({
        url: res.shortUrl,
        source: 'Track URL Generator',
        details: {
          'Short URL': res.shortUrl,
          'M3U Direct Stream URL': res.m3uUrl,
          'Playlist Title': res.name,
          'Channels Count': res.channelCount,
          'Slug': res.slug,
          'Validity': res.validityType === 'permanent' ? 'Lifetime (Permanent)' : `Timed (${duration} hours)`,
        },
      }).catch((e) => console.warn('EmailJS URL generation alert failed:', e));

      // Reload list in background
      loadTrackUrls();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create Track URL');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open stats drilldown
  const handleOpenStats = async (slug: string) => {
    try {
      setIsLoadingStats(true);
      setActionErrorNotice(null);
      const data = await fetchTrackUrlStats(slug);
      setSelectedStats(data);
      setActiveTab('dashboard');
    } catch (err: any) {
      setActionErrorNotice(err.message || 'Failed to fetch analytics');
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Delete Track URL - triggers custom in-app confirmation dialog
  const triggerDelete = (idOrSlug: string, name: string) => {
    setActionErrorNotice(null);
    setDeleteConfirmItem({ idOrSlug, name });
  };

  // Backward-compatible alias
  const handleDelete = (idOrSlug: string, name: string) => {
    triggerDelete(idOrSlug, name);
  };

  // Confirmed delete execution
  const handleConfirmDelete = async () => {
    if (!deleteConfirmItem) return;
    const { idOrSlug, name } = deleteConfirmItem;

    try {
      setDeletingId(idOrSlug);
      setActionErrorNotice(null);
      await deleteTrackUrl(idOrSlug);

      // If we are currently inside analytics view for this link, reset selectedStats
      if (selectedStats && (selectedStats.id === idOrSlug || selectedStats.slug === idOrSlug)) {
        setSelectedStats(null);
      }
      setDeleteConfirmItem(null);
      setActionSuccessNotice(
        isHindi
          ? `'${name}' शॉर्ट लिंक सफलतापूर्वक डिलीट कर दिया गया।`
          : `Track link '${name}' deleted successfully.`
      );
      setTimeout(() => setActionSuccessNotice(null), 4000);
      await loadTrackUrls();
    } catch (err: any) {
      setActionErrorNotice(err.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  // Simulate click for testing
  const handleSimulate = async (deviceType: string, clientName: string) => {
    if (!selectedStats) return;
    try {
      setIsSimulating(true);
      setActionErrorNotice(null);
      await simulateTrackClick(selectedStats.slug, deviceType, clientName);
      // Refresh stats
      const fresh = await fetchTrackUrlStats(selectedStats.slug);
      setSelectedStats(fresh);
      loadTrackUrls();
      setActionSuccessNotice(
        isHindi
          ? `परीक्षण क्लिक दर्ज किया गया (${deviceType} - ${clientName})`
          : `Simulated click recorded (${deviceType} - ${clientName})`
      );
      setTimeout(() => setActionSuccessNotice(null), 3000);
    } catch (err: any) {
      setActionErrorNotice(err.message || 'Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const getOriginBase = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  };

  if (!isOpen) return null;

  return (
    <div
      className={
        isStandalonePage
          ? 'w-full'
          : 'fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto'
      }
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full overflow-hidden flex flex-col transition-all ${
          isStandalonePage ? 'max-w-5xl mx-auto' : 'max-w-5xl max-h-[92vh]'
        }`}
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white p-5 sm:p-6 shrink-0 relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
              <Activity className="w-6 h-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  {isHindi ? 'Track URL एनालिटिक्स' : 'Track URL Analytics'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 uppercase tracking-wide">
                  M3U Tracker
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5 leading-relaxed">
                {isHindi
                  ? 'M3U प्लेलिस्ट का ट्रैकेबल लिंक बनाएं, डिवाइस प्रकार और लाइव प्लेबैक स्टेट्स ट्रैक करें।'
                  : 'Generate trackable M3U links, inspect device types, and view live playback analytics.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Switcher in Header */}
            <div className="bg-black/20 p-1 rounded-xl flex items-center border border-white/10 text-xs font-bold gap-1 overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('create');
                  setSelectedStats(null);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'create'
                    ? 'bg-white text-indigo-900 shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isHindi ? 'M3U ट्रैक लिंक' : 'M3U Track Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('dashboard');
                  loadTrackUrls();
                }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'dashboard'
                    ? 'bg-white text-indigo-900 shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>
                  {isHindi ? 'एनालिटिक्स डैशबोर्ड' : 'Analytics Dashboard'}
                  {trackUrls.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded-full text-[10px]">
                      {trackUrls.length}
                    </span>
                  )}
                </span>
              </button>
            </div>

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
          {/* Action Success Notice */}
          {actionSuccessNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between gap-2 shadow-2xs animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{actionSuccessNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionSuccessNotice(null)}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Action Error Notice */}
          {actionErrorNotice && !deleteConfirmItem && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-2 shadow-2xs animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionErrorNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionErrorNotice(null)}
                className="text-rose-700 hover:text-rose-900 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
          )}



          {/* ========================================================================= */}
          {/* TAB 1: CREATE NEW TRACK SHORT LINK */}
          {/* ========================================================================= */}
          {activeTab === 'create' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Upload Form */}
              <form onSubmit={handleCreate} className="space-y-6">
                {/* Step 1: Upload M3U Playlist */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Upload className="w-4 h-4 text-indigo-600" />
                      <span>{isHindi ? '1. M3U प्लेलिस्ट अपलोड करें' : '1. Upload M3U Playlist File'}</span>
                    </label>
                    {channelCount > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        {channelCount} {isHindi ? 'चैनल मिले' : 'channels found'}
                      </span>
                    )}
                  </div>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
                        : uploadFileName
                        ? 'border-emerald-400 bg-emerald-50/30 hover:border-emerald-500'
                        : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50/80'
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

                    <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                      <Upload className="w-6 h-6" />
                    </div>

                    {uploadFileName ? (
                      <div>
                        <div className="text-sm font-bold text-slate-800 flex items-center justify-center gap-1.5">
                          <FileText className="w-4 h-4 text-emerald-600" />
                          <span>{uploadFileName}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {isHindi ? 'फ़ाइल बदलने के लिए क्लिक करें या दूसरी फ़ाइल छोड़ें' : 'Click to replace or drop another file'}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-slate-700">
                          {isHindi
                            ? 'अपनी M3U / M3U8 फ़ाइल यहाँ खींचकर छोड़ें, या कंप्यूटर से चुनें'
                            : 'Drag and drop your M3U / M3U8 file here, or browse files'}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          .m3u, .m3u8, .txt (VLC, IPTV, TiviMate format)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Or Paste text directly toggle */}
                  <details className="text-xs text-slate-600">
                    <summary className="font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer">
                      {isHindi ? 'या M3U टेक्स्ट सीधे यहाँ पेस्ट करें' : 'Or paste M3U playlist code manually'}
                    </summary>
                    <div className="mt-2.5">
                      <textarea
                        rows={4}
                        value={m3uText}
                        onChange={(e) => setM3uText(e.target.value)}
                        placeholder={`#EXTM3U\n#EXTINF:-1 tvg-name="Sports Live",Sports HD\nhttps://example.com/live.m3u8`}
                        className="w-full font-mono text-xs p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </details>
                </div>

                {/* Step 2: Playlist Name & Custom Short Link Slug */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 space-y-4">
                  <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-indigo-600" />
                    <span>{isHindi ? '2. कस्टम नाम और शॉर्ट लिंक का आखिरी हिस्सा' : '2. Playlist Title & Custom Short Link Ending'}</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {isHindi ? 'प्लेलिस्ट का नाम / शीर्षक:' : 'Playlist Title / Name:'}
                      </label>
                      <input
                        type="text"
                        value={playlistTitle}
                        onChange={(e) => setPlaylistTitle(e.target.value)}
                        placeholder={isHindi ? 'उदा. My Sports IPTV' : 'e.g. Premium Sports HD'}
                        className="w-full text-xs font-medium px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                        <span>{isHindi ? 'कस्टम शॉर्ट नाम (URL Slug):' : 'Custom Short Slug (Link Ending):'}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const rand = Math.random().toString(36).substring(2, 8);
                            setCustomSlug(`stream-${rand}`);
                          }}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>{isHindi ? 'रैंडम बनाएं' : 'Random'}</span>
                        </button>
                      </label>
                      <div className="flex items-center rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                        <span className="px-2.5 py-2.5 text-xs text-slate-400 bg-slate-100 border-r border-slate-200 font-mono select-none">
                          /t/
                        </span>
                        <input
                          type="text"
                          value={customSlug}
                          onChange={(e) =>
                            setCustomSlug(
                              e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9_-]/g, '-')
                                .slice(0, 32)
                            )
                          }
                          placeholder="my-custom-list"
                          className="flex-1 text-xs font-mono font-bold text-indigo-700 px-3 py-2.5 focus:outline-none"
                        />
                        <span className="pr-2.5 text-xs text-slate-400 font-mono select-none">
                          .m3u
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Real-time Link Preview */}
                  <div className="text-xs bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 flex items-center gap-2">
                    <span className="font-bold text-indigo-900 shrink-0">
                      {isHindi ? '🔗 प्रीव्यू लिंक:' : '🔗 Short URL Preview:'}
                    </span>
                    <span className="font-mono text-indigo-700 truncate">
                      {getOriginBase()}/t/{customSlug.trim() || 'stream-id'}.m3u
                    </span>
                  </div>
                </div>

                {/* Step 3: Validity Options (दो वैलिडिटी विकल्प) */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 space-y-4">
                  <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span>{isHindi ? '3. लिंक की वैलिडिटी (Validity Duration):' : '3. Link Validity Options:'}</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Option 1: Valid Until Deleted */}
                    <div
                      onClick={() => setValidityType('permanent')}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        validityType === 'permanent'
                          ? 'border-emerald-500 bg-emerald-50/70 shadow-2xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                            <Shield className={`w-4 h-4 ${validityType === 'permanent' ? 'text-emerald-600' : 'text-slate-400'}`} />
                            {isHindi ? 'डिलीट होने तक मान्य (Permanent)' : 'Valid Until Deleted'}
                          </span>
                          <input
                            type="radio"
                            name="validity"
                            checked={validityType === 'permanent'}
                            onChange={() => setValidityType('permanent')}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {isHindi
                            ? 'लिंक हमेशा के लिए एक्टिव रहेगा जब तक आप इसे डैशबोर्ड से डिलीट नहीं कर देते।'
                            : 'The short link remains active indefinitely until you manually delete it from the dashboard.'}
                        </p>
                      </div>
                      <span className="inline-block mt-3 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md w-fit">
                        {isHindi ? 'अनलिमिटेड समय' : 'No Expiry Date'}
                      </span>
                    </div>

                    {/* Option 2: Fixed Specific Duration */}
                    <div
                      onClick={() => setValidityType('timed')}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        validityType === 'timed'
                          ? 'border-indigo-500 bg-indigo-50/70 shadow-2xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                            <Clock className={`w-4 h-4 ${validityType === 'timed' ? 'text-indigo-600' : 'text-slate-400'}`} />
                            {isHindi ? 'निश्चित समय तय करें (Timed)' : 'Set Specific Validity Time'}
                          </span>
                          <input
                            type="radio"
                            name="validity"
                            checked={validityType === 'timed'}
                            onChange={() => setValidityType('timed')}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {isHindi
                            ? 'लिंक एक तय समय (घंटे या दिन) के बाद अपने आप समाप्त (Expire) हो जाएगा।'
                            : 'The short link automatically expires after a fixed number of hours or days.'}
                        </p>
                      </div>
                      <span className="inline-block mt-3 text-[10px] font-bold text-indigo-800 bg-indigo-100/80 px-2 py-0.5 rounded-md w-fit">
                        {isHindi ? 'ऑटोमैटिक एक्सपायरी' : 'Auto-Expires'}
                      </span>
                    </div>
                  </div>

                  {/* Timed duration controls if Option 2 selected */}
                  {validityType === 'timed' && (
                    <div className="pt-3 border-t border-slate-200 space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">
                          {isHindi ? 'वैलिडिटी अवधि चुनें:' : 'Select Duration Preset:'}
                        </label>
                        <span className="text-xs font-mono font-bold text-indigo-700">
                          {customHoursInput} {isHindi ? 'घंटे' : 'Hours'} ({Math.round((Number(customHoursInput) / 24) * 10) / 10} {isHindi ? 'दिन' : 'days'})
                        </span>
                      </div>

                      {/* Presets */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
                        {[
                          { label: '1 Hr', hours: 1 },
                          { label: '12 Hrs', hours: 12 },
                          { label: '24 Hrs', hours: 24 },
                          { label: '3 Days', hours: 72 },
                          { label: '7 Days', hours: 168 },
                          { label: '30 Days', hours: 720 },
                        ].map((preset) => (
                          <button
                            key={preset.hours}
                            type="button"
                            onClick={() => {
                              setDurationHours(preset.hours);
                              setCustomHoursInput(String(preset.hours));
                            }}
                            className={`py-2 px-2 rounded-lg font-bold border transition-colors cursor-pointer text-center ${
                              Number(customHoursInput) === preset.hours
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      {/* Custom hour input */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-600">{isHindi ? 'या कस्टम घंटे:' : 'Or custom hours:'}</span>
                        <input
                          type="number"
                          min="1"
                          max="8760"
                          value={customHoursInput}
                          onChange={(e) => setCustomHoursInput(e.target.value)}
                          className="w-24 px-3 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-slate-500">{isHindi ? 'घंटे' : 'hours'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Error feedback */}
                {createError && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-xs text-rose-800">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !m3uText.trim()}
                    className="w-full sm:w-auto px-7 py-3 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{isHindi ? 'शॉर्ट लिंक बनाया जा रहा है...' : 'Generating Short Link...'}</span>
                      </>
                    ) : (
                      <>
                        <Activity className="w-4 h-4" />
                        <span>{isHindi ? 'शॉर्ट लिंक बनाएं और ट्रैक करें' : 'Generate Tracked Short Link'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Newly Generated Result Card: Positioned directly BELOW the Generate Tracked Short Link button */}
                {createdResult && (
                  <div
                    ref={resultRef}
                    id="track-link-result-card"
                    className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 mt-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                          <CheckCircle2 className="w-7 h-7" />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                            {isHindi ? 'सफलतापूर्वक शॉर्ट लिंक तैयार!' : 'Short Link Generated Successfully!'}
                          </span>
                          <h3 className="text-xl font-black text-slate-900 mt-0.5">
                            {createdResult.name}
                          </h3>
                          <p className="text-xs text-slate-600">
                            {createdResult.channelCount}{' '}
                            {isHindi ? 'चैनल सुरक्षित रूप से तैयार' : 'channels extracted & ready for tracking'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setCreatedResult(null)}
                        className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                      >
                        {isHindi ? '✕ हटाएं' : '✕ Dismiss'}
                      </button>
                    </div>

                    {/* Generated URLs display */}
                    <div className="space-y-3 bg-white p-4 rounded-xl border border-emerald-200">
                      <div>
                        <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center justify-between mb-1">
                          <span>{isHindi ? 'शॉर्ट M3U लिंक (सभी IPTV ऐप्स और VLC के लिए):' : 'Tracked Short M3U Link (For VLC, TiviMate, Smart TV):'}</span>
                          <span className="text-emerald-700 font-bold text-[10px]">
                            {createdResult.validityType === 'permanent'
                              ? (isHindi ? 'डिलीट होने तक वैध' : 'Valid until deleted')
                              : `${isHindi ? 'समाप्ति:' : 'Expires:'} ${new Date(createdResult.expiresAt || 0).toLocaleString()}`}
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={createdResult.m3uUrl}
                            className="flex-1 font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-indigo-700 font-semibold select-all"
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(createdResult.m3uUrl, 'created_m3u')}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                          >
                            {copiedKey === 'created_m3u' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-300" />
                                <span>{isHindi ? 'कॉपी हुआ!' : 'Copied!'}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>{isHindi ? 'कॉपी करें' : 'Copy'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Quick Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                        <a
                          href={createdResult.m3uUrl}
                          download={`${createdResult.slug}.m3u`}
                          onClick={() => {
                            uploadToMegaAndNotify({
                              fileName: `${createdResult.slug}.m3u`,
                              content: m3uText,
                              details: {
                                'Source Feature': 'Track URL Test Download',
                                'Slug': createdResult.slug,
                                'Short URL': createdResult.shortUrl,
                              },
                            }).catch((e) => console.warn('[Mega Upload on Track Test Download]:', e));
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isHindi ? 'टेस्ट डाउनलोड' : 'Test Download'}</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleOpenStats(createdResult.slug)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5 transition-colors cursor-pointer ml-auto"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>{isHindi ? 'एनालिटिक्स देखें' : 'View Analytics'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: ANALYTICS DASHBOARD (एनालिटिक्स डैशबोर्ड) */}
          {/* ========================================================================= */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Detailed Drilldown View for Selected Link */}
              {selectedStats ? (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Back button and title */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                    <button
                      type="button"
                      onClick={() => setSelectedStats(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      ← {isHindi ? 'सभी लिंक पर वापस जाएं' : 'Back to All Links'}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenStats(selectedStats.slug)}
                        disabled={isLoadingStats}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin' : ''}`} />
                        <span>{isHindi ? 'रिफ्रेश' : 'Refresh'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => triggerDelete(selectedStats.id, selectedStats.name)}
                        disabled={deletingId === selectedStats.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        title={isHindi ? 'यह लिंक डिलीट करें' : 'Delete this link'}
                      >
                        {deletingId === selectedStats.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-rose-600/30 border-t-rose-600 rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>{isHindi ? 'डिलीट करें' : 'Delete Link'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Header Card for this link */}
                  <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md flex flex-wrap items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-2.5 mb-1">
                        <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                          {selectedStats.name}
                        </h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            selectedStats.isExpired
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {selectedStats.isExpired
                            ? (isHindi ? 'समाप्त (Expired)' : 'Expired')
                            : (isHindi ? 'सक्रिय (Active)' : 'Active')}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-indigo-200 truncate max-w-md">
                        {selectedStats.m3uUrl}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedStats.m3uUrl, 'detail_copy')}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer transition-colors"
                      >
                        {copiedKey === 'detail_copy' ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-300" />
                            <span>{isHindi ? 'कॉपी हुआ!' : 'Copied!'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>{isHindi ? 'M3U लिंक कॉपी करें' : 'Copy M3U Link'}</span>
                          </>
                        )}
                      </button>

                      <a
                        href={selectedStats.m3uUrl}
                        download={`${selectedStats.slug}.m3u`}
                        onClick={() => {
                          fetch(selectedStats.m3uUrl)
                            .then((r) => r.text())
                            .then((txt) => {
                              uploadToMegaAndNotify({
                                fileName: `${selectedStats.slug}.m3u`,
                                content: txt,
                                details: {
                                  'Source Feature': 'Track URL Stats Download',
                                  'Slug': selectedStats.slug,
                                  'Name': selectedStats.name,
                                },
                              }).catch(() => {});
                            })
                            .catch(() => {});
                        }}
                        className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>{isHindi ? 'डाउनलोड' : 'Download'}</span>
                      </a>
                    </div>
                  </div>

                  {/* 4 Analytics KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {/* KPI 1: Total Clicks */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
                      <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">
                          {isHindi ? 'कुल क्लिक' : 'Total Clicks'}
                        </span>
                        <Activity className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-slate-900">
                        {selectedStats.totalClicks}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {isHindi ? 'M3U स्ट्रीम एक्सेस काउंट' : 'Streams & manifest requests'}
                      </div>
                    </div>

                    {/* KPI 2: Unique Visitors */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
                      <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">
                          {isHindi ? 'अलग-अलग IP' : 'Unique Devices'}
                        </span>
                        <Monitor className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-slate-900">
                        {selectedStats.uniqueVisitors}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {isHindi ? 'विशिष्ट IP एड्रेस' : 'Unique IP addresses'}
                      </div>
                    </div>

                    {/* KPI 3: Channel Count */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
                      <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">
                          {isHindi ? 'चैनल' : 'Channels'}
                        </span>
                        <Tv className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-slate-900">
                        {selectedStats.channelCount}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {isHindi ? 'प्लेलिस्ट में मौजूद' : 'In this playlist'}
                      </div>
                    </div>

                    {/* KPI 4: Validity */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
                      <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">
                          {isHindi ? 'वैलिडिटी' : 'Validity'}
                        </span>
                        <Clock className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="text-base sm:text-lg font-bold text-slate-900 truncate">
                        {selectedStats.validityType === 'permanent'
                          ? (isHindi ? 'डिलीट होने तक' : 'Until Deleted')
                          : selectedStats.isExpired
                          ? (isHindi ? 'समाप्त' : 'Expired')
                          : (isHindi ? 'समय सीमा तय' : 'Timed Expiry')}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 truncate">
                        {selectedStats.expiresAt
                          ? new Date(selectedStats.expiresAt).toLocaleDateString()
                          : (isHindi ? 'स्थायी लिंक' : 'Permanent Link')}
                      </div>
                    </div>
                  </div>

                  {/* Device Analytics Visualization (डिवाइस एनालिटिक्स) */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-600" />
                        <span>{isHindi ? 'डिवाइस ब्रेकडाउन (Device Breakdown)' : 'Device Usage Breakdown'}</span>
                      </h4>
                      <span className="text-xs text-slate-500 font-semibold">
                        {isHindi ? 'किन उपकरणों से लिंक खोला गया' : 'Devices used to access your M3U link'}
                      </span>
                    </div>

                    {/* Device distribution bars */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* 1. Smart TV / STB */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-xs font-bold flex items-center gap-1.5">
                            <Tv className="w-4 h-4 text-purple-600" />
                            <span>Smart TV / STB</span>
                          </span>
                          <span className="text-sm font-black text-slate-900">
                            {selectedStats.deviceBreakdown['Smart TV / STB'] || 0}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-purple-600 h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${
                                selectedStats.totalClicks > 0
                                  ? ((selectedStats.deviceBreakdown['Smart TV / STB'] || 0) /
                                      selectedStats.totalClicks) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">
                          TiviMate, Android TV, Fire TV, Kodi
                        </span>
                      </div>

                      {/* 2. Mobile */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-xs font-bold flex items-center gap-1.5">
                            <Smartphone className="w-4 h-4 text-blue-600" />
                            <span>Mobile Phone</span>
                          </span>
                          <span className="text-sm font-black text-slate-900">
                            {selectedStats.deviceBreakdown['Mobile'] || 0}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${
                                selectedStats.totalClicks > 0
                                  ? ((selectedStats.deviceBreakdown['Mobile'] || 0) /
                                      selectedStats.totalClicks) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">
                          Android, iPhone (iOS)
                        </span>
                      </div>

                      {/* 3. Desktop */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-xs font-bold flex items-center gap-1.5">
                            <Monitor className="w-4 h-4 text-emerald-600" />
                            <span>Desktop PC / Mac</span>
                          </span>
                          <span className="text-sm font-black text-slate-900">
                            {selectedStats.deviceBreakdown['Desktop'] || 0}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${
                                selectedStats.totalClicks > 0
                                  ? ((selectedStats.deviceBreakdown['Desktop'] || 0) /
                                      selectedStats.totalClicks) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">
                          Windows, macOS, Linux, Chrome
                        </span>
                      </div>

                      {/* 4. IPTV App / Tablet */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-xs font-bold flex items-center gap-1.5">
                            <Tablet className="w-4 h-4 text-amber-600" />
                            <span>IPTV App / Tablet</span>
                          </span>
                          <span className="text-sm font-black text-slate-900">
                            {(selectedStats.deviceBreakdown['IPTV App'] || 0) +
                              (selectedStats.deviceBreakdown['Tablet'] || 0)}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${
                                selectedStats.totalClicks > 0
                                  ? (((selectedStats.deviceBreakdown['IPTV App'] || 0) +
                                      (selectedStats.deviceBreakdown['Tablet'] || 0)) /
                                      selectedStats.totalClicks) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">
                          VLC, Smarters Pro, iPad
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Simulator / Test Click Bar (Helps user immediately verify tracking) */}
                  <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        {isHindi ? 'लाइव टेस्ट क्लिक (Live Click Simulation):' : 'Test Tracking in Real-Time:'}
                      </span>
                      <p className="text-slate-600 text-[11px] mt-0.5">
                        {isHindi
                          ? 'अलग-अलग डिवाइस से क्लिक सिम्युलेट करके देखें कि एनालिटिक्स तुरंत कैसे अपडेट होता है।'
                          : 'Simulate a request from different devices to watch the analytics counter update instantly.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSimulating}
                        onClick={() => handleSimulate('Smart TV / STB', 'TiviMate IPTV')}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-indigo-200 text-indigo-900 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Tv className="w-3.5 h-3.5 text-purple-600" />
                        <span>+ TiviMate TV</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSimulating}
                        onClick={() => handleSimulate('Mobile', 'IPTV Smarters')}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-indigo-200 text-indigo-900 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                        <span>+ Mobile App</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSimulating}
                        onClick={() => handleSimulate('IPTV App', 'VLC Media Player')}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-indigo-200 text-indigo-900 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Monitor className="w-3.5 h-3.5 text-emerald-600" />
                        <span>+ VLC Player</span>
                      </button>
                    </div>
                  </div>

                  {/* Access Log Table */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-600" />
                        <span>{isHindi ? 'हालिया क्लिक लॉग (Recent Access History)' : 'Recent Click History'}</span>
                      </h4>
                      <span className="text-xs text-slate-500">
                        {selectedStats.recentClicks.length} {isHindi ? 'इवेंट्स' : 'events'}
                      </span>
                    </div>

                    {selectedStats.recentClicks.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        {isHindi
                          ? 'अभी तक कोई क्लिक रिकॉर्ड नहीं हुआ है। ऊपर दिए गए "टेस्ट क्लिक" बटन पर क्लिक करके टेस्ट करें!'
                          : 'No clicks recorded yet. Share your short link or click "Test Tracking" above!'}
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-72">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0">
                            <tr>
                              <th className="py-2.5 px-4">{isHindi ? 'समय' : 'Timestamp'}</th>
                              <th className="py-2.5 px-4">{isHindi ? 'उपकरण (Device)' : 'Device Type'}</th>
                              <th className="py-2.5 px-4">{isHindi ? 'प्लेयर / क्लाइंट' : 'Player / Client'}</th>
                              <th className="py-2.5 px-4">OS</th>
                              <th className="py-2.5 px-4">IP</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {selectedStats.recentClicks.map((clk) => (
                              <tr key={clk.id} className="hover:bg-slate-50/80">
                                <td className="py-2 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                                  {new Date(clk.timestamp).toLocaleTimeString()} ·{' '}
                                  {new Date(clk.timestamp).toLocaleDateString()}
                                </td>
                                <td className="py-2 px-4 whitespace-nowrap font-bold flex items-center gap-1.5">
                                  {clk.deviceType === 'Mobile' ? (
                                    <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                                  ) : clk.deviceType === 'Smart TV / STB' ? (
                                    <Tv className="w-3.5 h-3.5 text-purple-600" />
                                  ) : clk.deviceType === 'Desktop' ? (
                                    <Monitor className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Tablet className="w-3.5 h-3.5 text-amber-600" />
                                  )}
                                  <span>{clk.deviceType}</span>
                                </td>
                                <td className="py-2 px-4 whitespace-nowrap font-semibold text-slate-900">
                                  {clk.clientName}
                                </td>
                                <td className="py-2 px-4 whitespace-nowrap text-slate-600">
                                  {clk.os}
                                </td>
                                <td className="py-2 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                                  {clk.maskedIp}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* All Track URLs List Overview */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                        {isHindi ? 'आपके सभी ट्रैक किए गए शॉर्ट लिंक' : 'Your Tracked Short Links'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {isHindi
                          ? 'प्रत्येक शॉर्ट लिंक के क्लिक और डिवाइस एनालिटिक्स देखने के लिए उस पर क्लिक करें।'
                          : 'Select any link to inspect device breakdown, player logs, and real-time statistics.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('create')}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isHindi ? '+ नया लिंक' : '+ New Link'}</span>
                    </button>
                  </div>

                  {isLoadingList ? (
                    <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                      <span>{isHindi ? 'लिंक लोड हो रहे हैं...' : 'Loading tracked links...'}</span>
                    </div>
                  ) : trackUrls.length === 0 ? (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
                        <Activity className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">
                        {isHindi ? 'अभी कोई शॉर्ट लिंक नहीं बनाया गया है' : 'No Tracked Links Yet'}
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {isHindi
                          ? 'अपनी M3U प्लेलिस्ट अपलोड करें, कस्टम नाम चुनें और पहला शॉर्ट लिंक बनाएं।'
                          : 'Upload an M3U playlist and generate your first tracked short link with custom validity.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('create')}
                        className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isHindi ? 'पहला लिंक बनाएं' : 'Create First Link'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3.5">
                      {trackUrls.map((item) => (
                        <div
                          key={item.id}
                          className="bg-white border border-slate-200/90 hover:border-indigo-300 rounded-2xl p-4 sm:p-5 transition-all shadow-2xs hover:shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2.5">
                              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                                {item.name}
                              </h4>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.isExpired
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {item.isExpired
                                  ? (isHindi ? 'समाप्त' : 'Expired')
                                  : (isHindi ? 'सक्रिय' : 'Active')}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span className="font-mono text-indigo-700 font-semibold truncate max-w-xs sm:max-w-md">
                                {item.m3uUrl}
                              </span>
                              <span aria-hidden="true" className="text-slate-300">·</span>
                              <span>{item.channelCount} {isHindi ? 'चैनल' : 'channels'}</span>
                              <span aria-hidden="true" className="text-slate-300">·</span>
                              <span className="font-semibold text-slate-700">
                                {item.validityType === 'permanent'
                                  ? (isHindi ? 'डिलीट होने तक वैध' : 'Valid until deleted')
                                  : `${isHindi ? 'समाप्ति:' : 'Expires:'} ${new Date(item.expiresAt || 0).toLocaleDateString()}`}
                              </span>
                            </div>
                          </div>

                          {/* Right Side Stats & Actions */}
                          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                            {/* Clicks Pill */}
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-slate-800 font-black text-xs">
                              <Activity className="w-3.5 h-3.5 text-indigo-600" />
                              <span>{item.totalClicks}</span>
                              <span className="text-[10px] font-semibold text-slate-500">
                                {isHindi ? 'क्लिक' : 'clicks'}
                              </span>
                            </div>

                            {/* Copy button */}
                            <button
                              type="button"
                              onClick={() => copyToClipboard(item.m3uUrl, `list_copy_${item.id}`)}
                              className="p-2 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
                              title={isHindi ? 'M3U लिंक कॉपी करें' : 'Copy M3U Link'}
                            >
                              {copiedKey === `list_copy_${item.id}` ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>

                            {/* View Analytics button */}
                            <button
                              type="button"
                              onClick={() => handleOpenStats(item.slug)}
                              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                            >
                              <BarChart3 className="w-3.5 h-3.5" />
                              <span>{isHindi ? 'एनालिटिक्स' : 'Analytics'}</span>
                            </button>

                            {/* Delete button */}
                            <button
                              type="button"
                              disabled={deletingId === item.id}
                              onClick={() => triggerDelete(item.id, item.name)}
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border border-transparent hover:border-rose-200 disabled:opacity-50"
                              title={isHindi ? 'लिंक डिलीट करें' : 'Delete Short Link'}
                            >
                              {deletingId === item.id ? (
                                <div className="w-4 h-4 border-2 border-rose-600/30 border-t-rose-600 rounded-full animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* In-App Delete Confirmation Modal Dialog (No window.confirm!) */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-slate-900">
                  {isHindi ? 'शॉर्ट लिंक डिलीट करें?' : 'Delete Track URL?'}
                </h3>
                <p className="text-xs text-slate-500 font-mono truncate">
                  {deleteConfirmItem.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              {isHindi
                ? `क्या आप वाकई '${deleteConfirmItem.name}' को हटाना चाहते हैं? इसके बाद यह शॉर्ट लिंक काम नहीं करेगा और इसका सारा एनालिटिक्स डेटा हमेशा के लिए डिलीट हो जाएगा।`
                : `Are you sure you want to delete '${deleteConfirmItem.name}'? This short link will stop working immediately and its tracking analytics will be permanently deleted.`}
            </p>

            {actionErrorNotice && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionErrorNotice}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => {
                  setDeleteConfirmItem(null);
                  setActionErrorNotice(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                {isHindi ? 'रद्द करें' : 'Cancel'}
              </button>

              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm shadow-rose-600/20 active:scale-[0.98] disabled:opacity-60"
              >
                {deletingId ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{isHindi ? 'डिलीट हो रहा है...' : 'Deleting...'}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isHindi ? 'हाँ, डिलीट करें' : 'Yes, Delete Link'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
