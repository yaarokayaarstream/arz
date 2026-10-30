import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  Upload,
  Download,
  Copy,
  Check,
  Play,
  RotateCcw,
  AlertCircle,
  FileText,
  Clock,
  Eye,
  EyeOff,
  Link2,
  Trash2,
  Lock,
  Globe,
  Sliders,
  CheckCircle2,
  Tv,
  ChevronDown,
  ChevronUp,
  Settings,
  HelpCircle,
  Terminal,
} from 'lucide-react';
import {
  obfuscateM3uPlaylist,
  downloadModifiedM3uFile,
  ObfuscateResult,
  USER_AGENT_PRESETS,
  DEFAULT_IPTV_USER_AGENT,
} from '../services/linkMasterClient';
import { sendUrlGeneratedNotification } from '../services/emailJsService';
import { Language, StreamChannel, Category } from '../types';
import { BrandLogoIcon } from './BrandLogo';

interface LinkMasterModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  lang: Language;
  onPlayChannel?: (channel: StreamChannel) => void;
  onLoadToApp?: (channels: StreamChannel[], categories?: Category[]) => void;
  isStandalonePage?: boolean;
}

export const LinkMasterModal: React.FC<LinkMasterModalProps> = ({
  isOpen = true,
  onClose,
  lang,
  onPlayChannel,
  onLoadToApp,
  isStandalonePage = false,
}) => {
  const isHindi = lang === 'hi';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Input states
  const [inputTab, setInputTab] = useState<'upload' | 'paste' | 'remote'>('upload');
  const [m3uText, setM3uText] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [fileName, setFileName] = useState('linkmaster_protected.m3u');
  const [expiryHours, setExpiryHours] = useState(48); // 48h default

  const isAisDevHost = typeof window !== 'undefined' && (
    window.location.hostname.includes('.ais-dev.') ||
    window.location.hostname.includes('.run.app')
  );

  // Streaming & URL mode:
  // 'direct' = Universal Direct IPTV (Recommended for external players: VLC, TiviMate, OTT Navigator, Smart TV - No ais-dev lock!)
  // 'proxy' = Encrypted Server Proxy (Custom Server / VPS IP / Localhost)
  const [streamingMode, setStreamingMode] = useState<'direct' | 'proxy'>(isAisDevHost ? 'direct' : 'proxy');
  const [customServerHost, setCustomServerHost] = useState('');

  // IPTV Player HTTP Header Compatibility
  const [userAgent, setUserAgent] = useState(DEFAULT_IPTV_USER_AGENT);
  const [selectedUaPreset, setSelectedUaPreset] = useState('chrome');
  const [referer, setReferer] = useState('');
  const [includeVlcOpt, setIncludeVlcOpt] = useState(true);
  const [includeExtHttp, setIncludeExtHttp] = useState(true);
  const [includePipeSyntax, setIncludePipeSyntax] = useState(false);
  const [showAdvancedHeaders, setShowAdvancedHeaders] = useState(false);
  const [showM3uCodePreview, setShowM3uCodePreview] = useState(false);

  // Status & processing
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ObfuscateResult | null>(null);

  // UI state
  const [showRealUrls, setShowRealUrls] = useState(false);
  const [copiedM3u, setCopiedM3u] = useState(false);
  const [copiedSingleIndex, setCopiedSingleIndex] = useState<string | null>(null);

  // File drag & drop handling
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setM3uText(content);
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setFileName(`${nameWithoutExt}_masked.m3u`);
        setInputTab('paste'); // Switch to preview tab
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

  const handleFetchRemoteUrl = async () => {
    if (!remoteUrl.trim()) {
      setError(isHindi ? 'कृपया मान्य M3U यूआरएल दर्ज करें।' : 'Please enter a valid M3U URL.');
      return;
    }
    try {
      setIsFetchingRemote(true);
      setError(null);

      const res = await fetch(`/api/xtream/m3u-content?url=${encodeURIComponent(remoteUrl.trim())}`);
      const data = await res.json();

      if (data.success && data.m3uContent) {
        setM3uText(data.m3uContent);
        setInputTab('paste');
      } else {
        // Fallback direct fetch
        const directRes = await fetch(remoteUrl.trim());
        const directText = await directRes.text();
        if (directText.includes('#EXTM3U') || directText.includes('#EXTINF')) {
          setM3uText(directText);
          setInputTab('paste');
        } else {
          throw new Error('Remote URL did not return valid M3U playlist format.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch remote M3U URL');
    } finally {
      setIsFetchingRemote(false);
    }
  };

  const handleReset = () => {
    setM3uText('');
    setRemoteUrl('');
    setResult(null);
    setError(null);
    setCopiedM3u(false);
    setStreamingMode(isAisDevHost ? 'direct' : 'proxy');
    setCustomServerHost('');
    setUserAgent(DEFAULT_IPTV_USER_AGENT);
    setSelectedUaPreset('chrome');
    setReferer('');
    setIncludeVlcOpt(true);
    setIncludeExtHttp(true);
    setIncludePipeSyntax(false);
    setShowM3uCodePreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectUaPreset = (presetId: string) => {
    setSelectedUaPreset(presetId);
    const found = USER_AGENT_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setUserAgent(found.value);
    }
  };

  const handleObfuscate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!m3uText.trim()) {
      setError(
        isHindi
          ? 'कृपया पहले एक M3U फ़ाइल अपलोड करें या M3U कोड पेस्ट करें।'
          : 'Please upload an M3U file or paste M3U playlist content first.'
      );
      return;
    }

    try {
      setIsLoading(true);
      const res = await obfuscateM3uPlaylist({
        m3uContent: m3uText,
        expiryHours,
        streamingMode,
        customHost: streamingMode === 'proxy' && customServerHost.trim() ? customServerHost.trim() : undefined,
        aliasPrefix: 'enc_stream',
        userAgent: userAgent.trim() || DEFAULT_IPTV_USER_AGENT,
        referer: referer.trim() || undefined,
        includeVlcOpt,
        includeExtHttp,
        includePipeSyntax,
      });
      setResult(res);

      // Send EmailJS alert for generated masked/protected stream URLs
      const sampleUrl = res.aliases && res.aliases.length > 0 ? res.aliases[0].aliasUrl : 'Protected Stream URLs Generated';
      sendUrlGeneratedNotification({
        url: sampleUrl,
        source: 'Link Master (Masked IPTV Stream Generator)',
        details: {
          'Total Stream URLs Replaced': res.totalReplaced,
          'Streaming Mode': res.streamingMode || 'direct',
          'Expiry Duration': `${res.expiryHours} hours`,
          'User-Agent Attached': res.userAgent,
          'Sample Masked URL': sampleUrl,
        },
      }).catch((e) => console.warn('EmailJS URL generation alert failed:', e));
    } catch (err: any) {
      setError(err.message || 'Obfuscation failed');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadM3u = () => {
    if (!result) return;
    const finalName = fileName.trim() ? fileName.trim() : 'linkmaster_masked.m3u';
    downloadModifiedM3uFile(result.modifiedM3u, finalName);
  };

  const handleCopyM3u = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.modifiedM3u);
    setCopiedM3u(true);
    setTimeout(() => setCopiedM3u(false), 2500);
  };

  const handleCopySingle = (url: string, index: string) => {
    navigator.clipboard.writeText(url);
    setCopiedSingleIndex(index);
    setTimeout(() => setCopiedSingleIndex(null), 2000);
  };

  const handleTestPlay = (alias: { channelName: string; aliasUrl: string; id: string; categoryName?: string }) => {
    if (!onPlayChannel) return;
    const streamChannel: StreamChannel = {
      num: 1,
      name: alias.channelName,
      stream_type: 'live',
      stream_id: alias.id,
      category_id: 'linkmaster',
      category_name: alias.categoryName || 'Link Master Streams',
      direct_source: alias.aliasUrl,
    };
    onPlayChannel(streamChannel);
  };

  const handlePlayAllInApp = () => {
    if (!result || !onLoadToApp) return;
    const streamChannels: StreamChannel[] = result.aliases.map((a, idx) => ({
      num: idx + 1,
      name: a.channelName,
      stream_type: 'live',
      stream_id: a.id,
      category_id: a.categoryName ? a.categoryName.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'linkmaster',
      category_name: a.categoryName || 'Link Master Streams',
      direct_source: a.aliasUrl,
    }));
    onLoadToApp(streamChannels);
    if (onClose) onClose();
  };

  const contentJsx = (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-xs font-bold mb-3 shadow-2xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>{isHindi ? 'लिंक मास्टर (Link Master) — सुरक्षित URL एन्क्रिप्शन' : 'Link Master — Real URL Encrypted Masking'}</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 mb-1.5">
          {isHindi ? 'अपनी M3U प्लेलिस्ट को एन्क्रिप्टेड एलियास से सुरक्षित करें' : 'Mask Real Stream URLs with Encrypted Temporary Aliases'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
          {isHindi
            ? 'अपनी M3U फ़ाइल अपलोड करें। लिंक मास्टर आपके वास्तविक IPTV सर्वर, यूजरनेम और पासवर्ड को सुरक्षित अस्थायी एलियास में बदल देगा। संशोधित प्लेलिस्ट डाउनलोड करें और बिना असली क्रेडेंशियल्स उजागर किए शेयर करें।'
            : 'Upload your M3U playlist. Link Master replaces real server domains, usernames, and passwords with secure temporary aliases. Download modified M3U to share or stream safely.'}
        </p>
      </div>

      {/* Main Upload / Input Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
        {/* Input Method Selector Tabs */}
        <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold shadow-2xs">
          <button
            type="button"
            onClick={() => setInputTab('upload')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              inputTab === 'upload' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isHindi ? 'फ़ाइल अपलोड (.m3u)' : 'Upload File (.m3u)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setInputTab('paste')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              inputTab === 'paste' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isHindi ? 'M3U कोड पेस्ट करें' : 'Paste M3U Text'}</span>
          </button>

          <button
            type="button"
            onClick={() => setInputTab('remote')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              inputTab === 'remote' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{isHindi ? 'रिमोट यूआरएल' : 'Remote URL'}</span>
          </button>
        </div>

        {/* Tab 1: Upload File Drag & Drop */}
        {inputTab === 'upload' && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-indigo-600 bg-indigo-50/50'
                : 'border-slate-200 hover:border-indigo-400 bg-slate-50/60 hover:bg-slate-50'
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
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-3 shadow-2xs">
              <Upload className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-slate-800 mb-1">
              {isHindi ? 'M3U या M3U8 फ़ाइल यहाँ ड्रैग करें या क्लिक करके चुनें' : 'Click to browse or drag & drop M3U / M3U8 file here'}
            </p>
            <p className="text-xs text-slate-500">
              {isHindi ? 'सपोर्टेड फ़ॉर्मेट्स: .m3u, .m3u8, .txt (सभी IPTV प्लेलिस्ट्स)' : 'Supported: .m3u, .m3u8, text playlists'}
            </p>
          </div>
        )}

        {/* Tab 2: Paste Raw M3U */}
        {inputTab === 'paste' && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                {isHindi ? 'M3U प्लेलिस्ट डेटा:' : 'M3U Playlist Content:'}
              </label>
              {m3uText && (
                <span className="text-[11px] font-mono text-slate-500">
                  {m3uText.split(/\r?\n/).filter((l) => l.trim().startsWith('#EXTINF')).length} channels detected
                </span>
              )}
            </div>
            <textarea
              rows={6}
              value={m3uText}
              onChange={(e) => setM3uText(e.target.value)}
              placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-name=&quot;Channel 1&quot;,Channel 1&#10;http://provider.com:8080/live/user/pass/101.ts"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs leading-relaxed"
            />
          </div>
        )}

        {/* Tab 3: Remote M3U URL */}
        {inputTab === 'remote' && (
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              {isHindi ? 'M3U यूआरएल लिंक दर्ज करें:' : 'Remote M3U URL Link:'}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Globe className="w-4 h-4 text-indigo-600" />
                </div>
                <input
                  type="text"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  placeholder="http://server.com:8080/get.php?username=...&type=m3u"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs sm:text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                />
              </div>
              <button
                type="button"
                onClick={handleFetchRemoteUrl}
                disabled={isFetchingRemote}
                className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 disabled:opacity-60 shadow-2xs"
              >
                {isFetchingRemote ? (
                  isHindi ? 'लोड हो रहा है...' : 'Fetching...'
                ) : (
                  isHindi ? 'प्लेलिस्ट फेच करें' : 'Fetch Playlist'
                )}
              </button>
            </div>
          </div>
        )}

        {/* ais-dev Environment Notice & Solution */}
        {isAisDevHost && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs shadow-2xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-amber-900 leading-relaxed">
              <span className="font-bold">
                {isHindi ? '⚡ ais-dev URL फिक्स सक्रिय:' : '⚡ ais-dev URL Fix Active:'}
              </span>{' '}
              {isHindi
                ? 'ais-dev URL केवल Google AI Studio प्रीव्यू के लिए होता है और बाहरी IPTV ऐप्स (VLC, TiviMate आदि) में अवरुद्ध हो जाता है। Link Master ने "Universal Direct IPTV" मोड चुना है ताकि आपकी प्लेलिस्ट VLC, TiviMate और Smart TV में 100% चल सके।'
                : "'ais-dev' is an internal preview domain blocked to external players. Link Master has enabled 'Universal Direct IPTV' mode so your generated playlist plays smoothly in VLC, TiviMate, and external players without any ais-dev lock."}
            </div>
          </div>
        )}

        {/* Streaming Mode & Host Selector */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block font-bold text-slate-800 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isHindi ? 'प्लेलिस्ट URL मोड (ais-dev बाईपास):' : 'Playlist Stream URL Target (ais-dev Bypass):'}</span>
            </label>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              {streamingMode === 'direct' ? (isHindi ? 'सभी प्लेयर्स के लिए' : 'Universal External') : (isHindi ? 'कस्टम सर्वर प्रॉक्सी' : 'Custom Server Proxy')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <button
              type="button"
              onClick={() => setStreamingMode('direct')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                streamingMode === 'direct'
                  ? 'bg-emerald-50/90 border-emerald-400 text-emerald-950 font-bold shadow-2xs ring-1 ring-emerald-400/30'
                  : 'bg-slate-50 hover:bg-white border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className={`w-4 h-4 ${streamingMode === 'direct' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="font-bold text-slate-900">{isHindi ? 'Universal Direct IPTV (अनुशंसित)' : 'Universal Direct IPTV (Recommended)'}</span>
              </div>
              <p className="text-[11px] text-slate-600 font-normal leading-relaxed">
                {isHindi
                  ? 'कोई ais-dev लॉक नहीं। VLC, TiviMate, OTT Navigator, Smart TV में बिना किसी कुकी या सर्वर रुकावट के सीधे चलेगा।'
                  : 'No ais-dev lock. Plays directly in VLC, TiviMate, Smarters & Smart TVs with injected User-Agent headers.'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStreamingMode('proxy')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                streamingMode === 'proxy'
                  ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 font-bold shadow-2xs ring-1 ring-indigo-400/30'
                  : 'bg-slate-50 hover:bg-white border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className={`w-4 h-4 ${streamingMode === 'proxy' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="font-bold text-slate-900">{isHindi ? 'Encrypted Proxy Relay (कस्टम होस्ट)' : 'Encrypted Proxy Relay (Custom Host)'}</span>
              </div>
              <p className="text-[11px] text-slate-600 font-normal leading-relaxed">
                {isHindi
                  ? 'अस्थायी टोकन के साथ सर्वर द्वारा रिले किया जाता है। इसके लिए अपने सर्वर या VPS का सार्वजनिक IP या लोकलहोस्ट दर्ज करें।'
                  : 'Encrypted temporary alias relay. Enter your VPS or Localhost IP so external devices can reach your proxy.'}
              </p>
            </button>
          </div>

          {streamingMode === 'proxy' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in fade-in duration-150 text-xs">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                {isHindi ? 'सर्वर / VPS होस्ट URL:' : 'Custom Server / VPS Host URL:'}
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={customServerHost}
                  onChange={(e) => setCustomServerHost(e.target.value)}
                  placeholder="http://YOUR-SERVER-IP:3000 or http://localhost:3000"
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setCustomServerHost('http://localhost:3000')}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors cursor-pointer shrink-0"
                >
                  Localhost:3000
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                {isHindi
                  ? 'यदि खाली छोड़ दिया जाए, तो यह ais-dev के बजाय http://localhost:3000 का उपयोग करेगा ताकि बाहरी ऐप्स अवरुद्ध न हों।'
                  : 'If left empty, defaults safely to http://localhost:3000 instead of ais-dev to prevent external player blocks.'}
              </p>
            </div>
          )}
        </div>

        {/* Configuration Row: Expiration & Output File Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
          {/* Expiration TTL */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isHindi ? 'एलियास की समय सीमा (Expiry Time):' : 'Temporary Alias Expiration:'}</span>
            </label>
            <select
              value={expiryHours}
              onChange={(e) => setExpiryHours(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
            >
              <option value={24}>{isHindi ? '24 घंटे (1 दिन)' : '24 Hours (1 Day)'}</option>
              <option value={48}>{isHindi ? '48 घंटे (2 दिन) — अनुशंसित' : '48 Hours (2 Days) — Recommended'}</option>
              <option value={168}>{isHindi ? '7 दिन (1 हफ़्ता)' : '7 Days (1 Week)'}</option>
              <option value={720}>{isHindi ? '30 दिन (1 महीना)' : '30 Days (1 Month)'}</option>
              <option value={0}>{isHindi ? 'कोई समय सीमा नहीं (स्थाई)' : 'No Expiry (Permanent)'}</option>
            </select>
          </div>

          {/* Target File Name */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isHindi ? 'आउटपुट M3U फ़ाइल का नाम:' : 'Modified M3U File Name:'}</span>
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="linkmaster_masked.m3u"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
            />
          </div>
        </div>
        {/* IPTV Player HTTP Headers & Compatibility Settings */}
        <div className="pt-3 border-t border-slate-100 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                {isHindi ? 'IPTV प्लेयर HTTP हेडर व कम्पैटिबिलिटी (User-Agent)' : 'IPTV Player HTTP Headers (User-Agent & Playback)'}
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
              {isHindi ? '403 ब्लॉक से सुरक्षा' : 'Anti-403 Protection'}
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            {isHindi
              ? 'TiviMate, VLC, OTT Navigator, IPTV Smarters आदि में मास्क स्ट्रीम चलाने के लिए मान्य User-Agent हेडर कॉन्फ़िगरेशन M3U फ़ॉर्मेट में जोड़ा जाता है।'
              : 'Injects valid User-Agent & HTTP header directives (#EXTVLCOPT, #EXTHTTP, tag attributes) into the M3U playlist so external IPTV players connect without 403 Forbidden blocks.'}
          </p>

          {/* User-Agent Preset Chips / Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              {isHindi ? 'User-Agent प्रीसेट चुनें:' : 'Select User-Agent Preset:'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {USER_AGENT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectUaPreset(preset.id)}
                  className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                    selectedUaPreset === preset.id
                      ? 'bg-indigo-50/80 border-indigo-400 text-indigo-950 font-bold shadow-2xs ring-1 ring-indigo-400/30'
                      : 'bg-slate-50 hover:bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <p className="text-xs truncate">{preset.label}</p>
                  <p className="text-[10px] text-slate-500 font-normal truncate mt-0.5">{preset.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* User-Agent Text Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
              {isHindi ? 'सक्रिय User-Agent स्ट्रिंग:' : 'Active User-Agent Header Value:'}
            </label>
            <input
              type="text"
              value={userAgent}
              onChange={(e) => {
                setUserAgent(e.target.value);
                setSelectedUaPreset('custom');
              }}
              placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
            />
          </div>

          {/* Advanced Header Directives Toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvancedHeaders(!showAdvancedHeaders)}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{isHindi ? 'उन्नत M3U हेडर निर्देश (Advanced Directives)' : 'Advanced M3U Header Directives'}</span>
              {showAdvancedHeaders ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvancedHeaders && (
              <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs animate-in fade-in duration-150">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={includeVlcOpt}
                    onChange={(e) => setIncludeVlcOpt(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                  />
                  <span>#EXTVLCOPT:http-user-agent (VLC, Perfect Player, MPV)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={includeExtHttp}
                    onChange={(e) => setIncludeExtHttp(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                  />
                  <span>#EXTHTTP:{"{"}"User-Agent":"..."{"}"} (TiviMate, OTT Navigator, XCIPTV)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={includePipeSyntax}
                    onChange={(e) => setIncludePipeSyntax(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                  />
                  <span>URL Pipe Syntax (|User-Agent=...) (Kodi & Legacy Players)</span>
                </label>

                <div className="pt-1.5 border-t border-slate-200/60">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isHindi ? 'वैकल्पिक Referer हेडर (Optional Referer):' : 'Optional Referer Header:'}
                  </label>
                  <input
                    type="text"
                    value={referer}
                    onChange={(e) => setReferer(e.target.value)}
                    placeholder="https://ais-dev-...run.app/"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Action Button: Replace Real URLs with Encrypted Aliases & Reset */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleObfuscate}
            disabled={isLoading || !m3uText.trim()}
            className="w-full sm:flex-1 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99] text-sm sm:text-base"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{isHindi ? 'यूआरएल एन्क्रिप्ट हो रहे हैं...' : 'Generating Encrypted Aliases...'}</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>{isHindi ? 'लिंक मास्टर: यूआरएल एन्क्रिप्ट करें' : 'Link Master: Encrypt & Replace URLs'}</span>
              </>
            )}
          </button>

          {(m3uText || result) && (
            <button
              type="button"
              onClick={handleReset}
              className="w-full sm:w-auto py-3.5 px-5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 font-bold rounded-xl transition-all cursor-pointer text-sm sm:text-base flex items-center justify-center gap-2 shadow-2xs active:scale-[0.99]"
              title={isHindi ? 'फॉर्म साफ़ करें' : 'Reset Form'}
            >
              <RotateCcw className="w-4 h-4 text-rose-600" />
              <span>{isHindi ? 'रीसेट' : 'Reset'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Generated Result Section & Modified M3U Download Button */}
      {result && (
        <div className="bg-white border border-emerald-200/90 rounded-2xl p-6 sm:p-7 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.06)] space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Top Success Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5 text-emerald-800 text-sm font-bold">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <span>{isHindi ? 'M3U प्लेलिस्ट सफलतापूर्वक संशोधित व एन्क्रिप्ट हो गई!' : 'M3U Playlist Successfully Obfuscated with Encrypted Aliases!'}</span>
                <span className="block text-xs font-normal text-slate-500 font-mono mt-0.5">
                  Total Channels Replaced: <strong className="text-slate-900 font-bold">{result.totalReplaced}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-mono font-bold border border-emerald-200 shadow-2xs">
                {result.expiryHours > 0 ? `TTL: ${result.expiryHours}h` : 'No Expiry'}
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] px-2.5 py-1 rounded-md bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                title={isHindi ? 'प्लेलिस्ट रीसेट करें' : 'Reset Playlist'}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>{isHindi ? 'डिलीट' : 'Delete'}</span>
              </button>
            </div>
          </div>

          {/* Action Buttons: 1. Download Modified .m3u, 2. Delete / Reset, 3. Copy M3U */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2.5 pt-1">
            {/* Primary Download Button for Modified M3U */}
            <button
              type="button"
              onClick={handleDownloadM3u}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shadow-emerald-600/20 active:scale-[0.99]"
            >
              <Download className="w-4 h-4" />
              <span>{isHindi ? 'संशोधित .M3U प्लेलिस्ट फ़ाइल डाउनलोड करें' : 'Download Modified .m3u Playlist'}</span>
            </button>

            {/* Play All in App Button */}
            {onLoadToApp && (
              <button
                type="button"
                onClick={handlePlayAllInApp}
                className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-indigo-600/20 active:scale-[0.99]"
                title={isHindi ? 'ऐप में सभी चैनल लोड करें और देखें' : 'Load and Play all masked channels in App'}
              >
                <Tv className="w-4 h-4" />
                <span>{isHindi ? 'ऐप में चलाएं' : 'Play in App'}</span>
              </button>
            )}

            {/* Delete / Reset Button */}
            <button
              type="button"
              onClick={handleReset}
              className="py-3 px-3.5 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-300 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs active:scale-[0.99]"
              title={isHindi ? 'प्लेलिस्ट रीसेट करें' : 'Delete & Reset'}
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>{isHindi ? 'डिलीट' : 'Delete'}</span>
            </button>

            {/* Copy Modified M3U Text */}
            <button
              type="button"
              onClick={handleCopyM3u}
              className="py-3 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Copy full modified M3U text"
            >
              {copiedM3u ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span>{copiedM3u ? (isHindi ? 'कॉपी हुआ!' : 'Copied!') : (isHindi ? 'M3U कॉपी' : 'Copy M3U')}</span>
            </button>
          </div>

          {/* IPTV Player HTTP Header Compatibility Banner */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-emerald-950 shadow-2xs">
            <div className="flex items-start sm:items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block sm:inline">
                  {isHindi ? 'IPTV हेडर फ़ॉर्मेट कॉन्फ़िगर हो गया:' : 'IPTV Headers Injected into M3U:'}
                </span>{' '}
                <span className="text-[11px] text-emerald-900 font-mono">
                  #EXTVLCOPT + #EXTHTTP + User-Agent ({result.userAgent ? result.userAgent.split(' ')[0] : 'Browser'})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowM3uCodePreview(!showM3uCodePreview)}
              className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <Terminal className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {showM3uCodePreview
                  ? (isHindi ? 'हेडर कोड छुपाएं' : 'Hide Header Code')
                  : (isHindi ? 'M3U हेडर कोड देखें' : 'Inspect M3U Directives')}
              </span>
              {showM3uCodePreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Collapsible Inspection Box for Generated M3U Headers */}
          {showM3uCodePreview && (
            <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono overflow-x-auto shadow-inner space-y-2 border border-slate-800 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">
                  {isHindi ? 'जनरेटेड M3U हेडर निर्देश (M3U Header Directives):' : 'Generated M3U Header Directives Preview:'}
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">
                  Compatible: VLC, TiviMate, OTT Navigator, Smarters
                </span>
              </div>
              <pre className="text-[11px] text-emerald-400 leading-relaxed whitespace-pre-wrap select-all bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                {result.modifiedM3u.split(/\r?\n/).slice(0, 10).join('\n')}
              </pre>
            </div>
          )}

          {/* Comparison Table / Channel Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                {isHindi ? 'एन्क्रिप्टेड स्ट्रीम एलियास सूची (सैंपल):' : 'Encrypted Stream Aliases Preview:'}
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                Showing {result.aliases.length} of {result.totalReplaced}
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 text-xs">
              {result.aliases.map((alias, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs hover:bg-white transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-slate-400 font-semibold">
                        #{idx + 1}
                      </span>
                      <p className="font-bold text-slate-900 truncate">{alias.channelName}</p>
                      {alias.categoryName && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-medium">
                          {alias.categoryName}
                        </span>
                      )}
                    </div>

                    {/* Alias URL */}
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-indigo-700 truncate">
                      <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span className="truncate select-all">{alias.aliasUrl}</span>
                    </div>

                    {/* Optional Real URL view for validation */}
                    {showRealUrls && (
                      <div className="mt-1 text-[10px] font-mono text-slate-400 truncate border-t border-slate-200/60 pt-1">
                        <span className="text-slate-500 font-semibold">Real: </span>
                        <span className="select-all">{alias.originalUrl}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions for this channel */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {onPlayChannel && (
                      <button
                        type="button"
                        onClick={() => handleTestPlay(alias)}
                        className="p-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                        title={isHindi ? 'इस एलियास स्ट्रीम को चलाएं' : 'Test Play Stream'}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopySingle(alias.aliasUrl, alias.id)}
                      className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                      title={isHindi ? 'एलियास लिंक कॉपी करें' : 'Copy Alias Link'}
                    >
                      {copiedSingleIndex === alias.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isStandalonePage) {
    return <div className="max-w-4xl mx-auto px-4 py-8">{contentJsx}</div>;
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#f8fafc] border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/90 bg-white">
          <div className="flex items-center gap-3">
            <BrandLogoIcon size={36} />
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>Yaaro Ka Yaar Stream</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
                  Link Master
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                {isHindi
                  ? 'M3U प्लेलिस्ट अपलोड करें व रियल लिंक्स को एन्क्रिप्टेड एलियास में बदलें'
                  : 'Upload M3U & replace real URLs with temporary encrypted aliases'}
              </p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close"
            >
              ✕
            </button>
          )}
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto">{contentJsx}</div>
      </div>
    </div>
  );
};
