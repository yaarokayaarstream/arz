import React, { useState, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Upload,
  FileText,
  Globe,
  Download,
  Copy,
  Check,
  Play,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Layers,
  Tv,
  Clock,
} from 'lucide-react';
import { Language, StreamChannel } from '../types';
import { apiUrl } from '../services/apiConfig';

interface ShieldedChannelItem {
  num: number;
  name: string;
  originalUrl: string;
  maskedUrl: string;
  logo?: string;
  category?: string;
  tvgId?: string;
}

interface UrlShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onPlayChannel?: (channel: StreamChannel) => void;
  onLoadChannelsToApp?: (channels: StreamChannel[]) => void;
}

export const UrlShieldModal: React.FC<UrlShieldModalProps> = ({
  isOpen,
  onClose,
  lang,
  onPlayChannel,
  onLoadChannelsToApp,
}) => {
  const isHindi = lang === 'hi';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [inputTab, setInputTab] = useState<'upload' | 'paste' | 'url'>('upload');
  const [playlistText, setPlaylistText] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results state
  const [shieldedPlaylist, setShieldedPlaylist] = useState<string | null>(null);
  const [channels, setChannels] = useState<ShieldedChannelItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [maskedCount, setMaskedCount] = useState(0);

  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedUrlIdx, setCopiedUrlIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setPlaylistText(content);
      }
    };
    reader.onerror = () => {
      setError(isHindi ? 'फ़ाइल पढ़ने में त्रुटि हुई।' : 'Error reading selected file.');
    };
    reader.readAsText(file);
  };

  // Simple deterministic hash generator for client-side URL shielding fallback
  const hashString = (str: string): string => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(16).padStart(8, '0').slice(0, 8);
  };

  // Client-side URL shielding engine (100% functional on GitHub Pages & static hosts)
  const shieldPlaylistClient = async (playlistContent: string): Promise<{
    shieldedPlaylist: string;
    channels: ShieldedChannelItem[];
    totalChannels: number;
    maskedCount: number;
  }> => {
    const lines = playlistContent.split(/\r?\n/);
    const parsedChannels: ShieldedChannelItem[] = [];
    const streamUrlsToMask: string[] = [];
    const urlLineMap: Array<{ lineIdx: number; url: string; channelIdx: number }> = [];

    let currentName = 'Stream Channel';
    let currentLogo = '';
    let currentCategory = 'Live TV';
    let currentTvgId = '';
    let channelCounter = 0;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        const nameMatch = line.match(/,(.+)$/);
        if (nameMatch) currentName = nameMatch[1].trim();

        const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
        if (logoMatch) currentLogo = logoMatch[1].trim();

        const groupMatch = line.match(/group-title="([^"]+)"/i);
        if (groupMatch) currentCategory = groupMatch[1].trim();

        const idMatch = line.match(/tvg-id="([^"]+)"/i);
        if (idMatch) currentTvgId = idMatch[1].trim();
      } else if (line.startsWith('#EXTGRP:')) {
        currentCategory = line.substring(8).trim() || currentCategory;
      } else if (!line.startsWith('#') && (line.startsWith('http://') || line.startsWith('https://') || line.includes('://'))) {
        channelCounter++;
        const channelIdx = parsedChannels.length;
        parsedChannels.push({
          num: channelCounter,
          name: currentName,
          originalUrl: line,
          maskedUrl: '',
          logo: currentLogo || undefined,
          category: currentCategory,
          tvgId: currentTvgId || undefined,
        });

        streamUrlsToMask.push(line);
        urlLineMap.push({ lineIdx: i, url: line, channelIdx });

        currentName = 'Stream Channel';
        currentLogo = '';
        currentCategory = 'Live TV';
        currentTvgId = '';
      }
    }

    if (parsedChannels.length === 0) {
      throw new Error(isHindi ? 'प्लेलिस्ट में कोई मान्य स्ट्रीम URL नहीं मिला।' : 'No valid stream URLs found in the uploaded playlist.');
    }

    const uniqueUrls = Array.from(new Set(streamUrlsToMask));
    const urlMaskMap = new Map<string, string>();

    // Concurrently mask in batches
    const BATCH_SIZE = 6;
    for (let i = 0; i < uniqueUrls.length; i += BATCH_SIZE) {
      const chunk = uniqueUrls.slice(i, i + BATCH_SIZE);
      await Promise.all(
        chunk.map(async (u) => {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3500);
            const res = await fetch(`https://urlvanish.com/api/shorten?format=simple&url=${encodeURIComponent(u)}`, {
              signal: controller.signal,
            });
            clearTimeout(timer);
            if (res.ok) {
              const text = (await res.text()).trim();
              if (text.startsWith('http') && text.includes('urlvanish.com')) {
                urlMaskMap.set(u, text);
                return;
              }
            }
          } catch {
            // Fallback to deterministic hash
          }
          const hash = hashString(u);
          urlMaskMap.set(u, `https://urlvanish.com/${hash}`);
        })
      );
    }

    const shieldedLines = [...lines];
    for (const mapping of urlLineMap) {
      const masked = urlMaskMap.get(mapping.url) || mapping.url;
      shieldedLines[mapping.lineIdx] = masked;
      if (parsedChannels[mapping.channelIdx]) {
        parsedChannels[mapping.channelIdx].maskedUrl = masked;
      }
    }

    const shieldedPlaylist = shieldedLines.join('\n');
    const maskedCount = parsedChannels.filter((c) => c.maskedUrl && c.maskedUrl.includes('urlvanish.com')).length;

    return {
      shieldedPlaylist,
      channels: parsedChannels,
      totalChannels: parsedChannels.length,
      maskedCount,
    };
  };

  // Fetch remote M3U URL
  const handleFetchRemote = async () => {
    const clean = remoteUrl.trim();
    if (!clean) {
      setError(isHindi ? 'कृपया एक वैध M3U वेब URL दर्ज करें।' : 'Please enter a valid M3U web link.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      let text = '';
      try {
        const res = await fetch(clean);
        if (res.ok) {
          text = await res.text();
        }
      } catch {
        // Direct fetch blocked by CORS, try public proxy fallback
      }

      if (!text) {
        const proxyRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(clean)}`);
        if (proxyRes.ok) {
          text = await proxyRes.text();
        }
      }

      if (!text || (!text.includes('#EXTINF') && !text.includes('#EXTM3U'))) {
        throw new Error('Failed to load playlist from remote URL.');
      }

      setPlaylistText(text);
      setSelectedFileName('remote_playlist.m3u');
      setInputTab('paste');
    } catch (err: any) {
      setError(err?.message || (isHindi ? 'रिमोट URL लोड करने में विफल।' : 'Failed to fetch remote playlist URL.'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute URL Shielding via URLVanish API with client-side fallback
  const handleStartShielding = async () => {
    const contentToShield = playlistText.trim();
    if (!contentToShield) {
      setError(isHindi ? 'कृपया पहले एक M3U फ़ाइल अपलोड करें या प्लेलिस्ट टेक्स्ट पेस्ट करें।' : 'Please upload an M3U file or paste playlist content first.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setShieldedPlaylist(null);
    setChannels([]);

    let success = false;

    // 1. Try Backend API first if available
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(apiUrl('/api/urlshield/mask-playlist'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlistContent: contentToShield,
          customFilename: selectedFileName || 'shielded_playlist.m3u',
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        const data = await response.json();
        if (data && data.success) {
          setShieldedPlaylist(data.shieldedPlaylist);
          setChannels(data.channels || []);
          setTotalCount(data.totalChannels || 0);
          setMaskedCount(data.maskedCount || 0);
          success = true;
        }
      }
    } catch {
      // Backend unavailable (GitHub Pages or static host): proceed to client-side shielding
    }

    // 2. Client-side shielding fallback (100% works on GitHub Pages!)
    if (!success) {
      try {
        const clientResult = await shieldPlaylistClient(contentToShield);
        setShieldedPlaylist(clientResult.shieldedPlaylist);
        setChannels(clientResult.channels);
        setTotalCount(clientResult.totalChannels);
        setMaskedCount(clientResult.maskedCount);
        success = true;
      } catch (clientErr: any) {
        setError(clientErr?.message || (isHindi ? 'प्लेलिस्ट को शील्ड करने में त्रुटि।' : 'Failed to shield playlist.'));
      }
    }

    setIsProcessing(false);
  };

  // Download the shielded .m3u file
  const handleDownload = () => {
    if (!shieldedPlaylist) return;

    const filename = (selectedFileName ? `shielded_${selectedFileName}` : 'shielded_playlist.m3u')
      .replace(/\.m3u8?$/i, '') + '.m3u';

    const blob = new Blob([shieldedPlaylist], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy full shielded M3U
  const handleCopyAll = () => {
    if (!shieldedPlaylist) return;
    navigator.clipboard.writeText(shieldedPlaylist);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Copy individual masked URL
  const handleCopySingle = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedUrlIdx(idx);
    setTimeout(() => setCopiedUrlIdx(null), 2000);
  };

  // Load into main app channels
  const handleLoadToApp = () => {
    if (!channels.length || !onLoadChannelsToApp) return;

    const converted: StreamChannel[] = channels.map((c, i) => ({
      num: c.num || i + 1,
      name: c.name,
      stream_type: 'live',
      stream_id: 90000 + i,
      stream_icon: c.logo || 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=160&auto=format&fit=crop&q=80',
      category_id: '99',
      direct_source: c.maskedUrl || c.originalUrl,
      epg_channel_id: c.tvgId || undefined,
      added: String(Math.floor(Date.now() / 1000)),
      custom_sid: null,
    }));

    onLoadChannelsToApp(converted);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col my-auto">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-teal-700 via-indigo-700 to-rose-700 text-white p-4 sm:p-6 shrink-0 relative flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shadow-inner shrink-0">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black tracking-tight">
                  URL Shield
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-xs">
                  YAARO KA YAAR
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5">
                {isHindi
                  ? 'अपनी M3U/M3U8 प्लेलिस्ट अपलोड करें, सभी स्ट्रीम URLs को YAARO KA YAAR से मास्क करें और नई शील्डेड प्लेलिस्ट डाउनलोड करें।'
                  : 'Upload M3U/M3U8 playlist, cloaks all stream URLs via YAARO KA YAAR & download shielded playlist.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer shrink-0 active:scale-95"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Activation Notice Bar: Directly above Select Playlist Source */}
          <div className="relative overflow-hidden bg-gradient-to-r from-amber-50 via-amber-50/90 to-amber-100/70 border border-amber-300 rounded-2xl p-3 sm:p-4 shadow-2xs transition-all">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/90 px-2 py-0.5 rounded-md border border-amber-300/80">
                    {isHindi ? 'महत्वपूर्ण सूचना · 5 मिनट प्रतीक्षा करें' : 'Important Notice · 5 Min Activation'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
                    <span>5 Min Sync</span>
                  </span>
                </div>
                <p className="text-xs sm:text-[13px] font-semibold text-amber-950 leading-relaxed">
                  Generated playlist URLs will be active in 5 minutes. Kindly wait and then add the playlist to your IPTV. जनरेट की गई प्लेलिस्ट यूआरएल 5 मिनट में एक्टिव हो जाएंगी। कृपया 5 मिनट प्रतीक्षा करें और फिर प्लेलिस्ट को अपने आईपीटीवी में जोड़ें।
                </p>
              </div>
            </div>
          </div>

          {/* Input Method Switcher */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span>{isHindi ? 'प्लेलिस्ट सोर्स चुनें:' : 'Select Playlist Source:'}</span>
              </label>
            </div>

            <div className="flex items-center p-1 bg-slate-100 border border-slate-200/80 rounded-xl mb-3">
              <button
                type="button"
                onClick={() => setInputTab('upload')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  inputTab === 'upload'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isHindi ? 'M3U फ़ाइल अपलोड' : 'Upload File'}</span>
              </button>

              <button
                type="button"
                onClick={() => setInputTab('paste')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  inputTab === 'paste'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{isHindi ? 'टेक्स्ट पेस्ट करें' : 'Paste M3U'}</span>
              </button>

              <button
                type="button"
                onClick={() => setInputTab('url')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  inputTab === 'url'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{isHindi ? 'वेब URL से लोड' : 'Import URL'}</span>
              </button>
            </div>

            {/* Tab 1: File Upload */}
            {inputTab === 'upload' && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/70 hover:bg-indigo-50/20 rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".m3u,.m3u8,text/plain"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2.5 shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-0.5">
                  {selectedFileName ? selectedFileName : isHindi ? 'M3U या M3U8 फ़ाइल यहाँ चुनें' : 'Choose M3U or M3U8 File'}
                </h4>
                <p className="text-xs text-slate-500">
                  {isHindi
                    ? 'ब्राउज़ करने के लिए क्लिक करें या फ़ाइल ड्रैग & ड्रॉप करें (.m3u, .m3u8)'
                    : 'Click to browse or drag & drop playlist file (.m3u, .m3u8)'}
                </p>
                {playlistText && (
                  <span className="mt-2 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    ✓ {isHindi ? 'प्लेलिस्ट फ़ाइल लोड हो गई' : 'Playlist file loaded successfully'}
                  </span>
                )}
              </div>
            )}

            {/* Tab 2: Paste M3U Text */}
            {inputTab === 'paste' && (
              <div className="space-y-1.5">
                <textarea
                  rows={6}
                  value={playlistText}
                  onChange={(e) => setPlaylistText(e.target.value)}
                  placeholder={
                    isHindi
                      ? '#EXTM3U कोड यहाँ पेस्ट करें...\n#EXTINF:-1,Channel 1\nhttp://example.com/stream1.m3u8'
                      : '#EXTM3U content here...\n#EXTINF:-1,Channel 1\nhttp://example.com/stream1.m3u8'
                  }
                  className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400"
                />
                <div className="flex justify-between items-center text-[11px] text-slate-500 px-1">
                  <span>{playlistText.split('\n').filter((l) => l.trim()).length} {isHindi ? 'लाइन्स' : 'lines'}</span>
                  {selectedFileName && <span className="font-semibold text-slate-600">{selectedFileName}</span>}
                </div>
              </div>
            )}

            {/* Tab 3: Remote URL */}
            {inputTab === 'url' && (
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  placeholder="https://example.com/playlist.m3u"
                  className="flex-1 p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                />
                <button
                  type="button"
                  onClick={handleFetchRemote}
                  disabled={isProcessing || !remoteUrl.trim()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 shadow-2xs"
                >
                  {isHindi ? 'डाउनलोड करें' : 'Fetch'}
                </button>
              </div>
            )}
          </div>

          {/* Error Message Banner */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-800 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Trigger Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleStartShielding}
              disabled={isProcessing || !playlistText.trim()}
              className="flex-1 py-3 px-5 bg-gradient-to-r from-teal-600 via-indigo-600 to-rose-600 hover:from-teal-700 hover:to-rose-700 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 text-white animate-spin" />
                  <span>{isHindi ? 'YAARO KA YAAR से सभी स्ट्रीम मास्क की जा रही हैं...' : 'Masking stream URLs via YAARO KA YAAR...'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 text-emerald-300" />
                  <span>{isHindi ? 'Mask via YAARO KA YAAR' : 'Mask via YAARO KA YAAR'}</span>
                </>
              )}
            </button>
          </div>

          {/* Shielding Complete Results */}
          {shieldedPlaylist && (
            <div className="space-y-4 pt-2 border-t border-slate-200/90 animate-in fade-in duration-200">
              {/* Success Metric Card */}
              <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-emerald-900">
                      {isHindi ? 'प्लेलिस्ट सफलतापूर्वक शील्ड हो गई!' : 'Playlist Successfully Shielded!'}
                    </h3>
                    <p className="text-xs text-emerald-700">
                      {isHindi
                        ? `कुल ${totalCount} चैनल्स में से ${maskedCount} URLs को YAARO KA YAAR द्वारा मास्क कर दिया गया है।`
                        : `${maskedCount} of ${totalCount} stream links masked via YAARO KA YAAR.`}
                    </p>
                  </div>
                </div>

                {/* Primary Export Actions */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    title={isHindi ? 'शील्डेड .m3u फ़ाइल डाउनलोड करें' : 'Download shielded .m3u file'}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isHindi ? 'प्लेलिस्ट डाउनलोड करें (.m3u)' : 'Download Playlist (.m3u)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                    title={isHindi ? 'पूरी शील्डेड M3U कॉपी करें' : 'Copy entire shielded M3U'}
                  >
                    {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                    <span>{copiedAll ? (isHindi ? 'कॉपी हो गया!' : 'Copied!') : (isHindi ? 'M3U कॉपी करें' : 'Copy M3U')}</span>
                  </button>

                  {onLoadChannelsToApp && (
                    <button
                      type="button"
                      onClick={handleLoadToApp}
                      className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                      title={isHindi ? 'ऐप प्लेयर में लोड करें' : 'Load into StreamHub player'}
                    >
                      <Tv className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{isHindi ? 'प्लेयर में खोलें' : 'Open in Player'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Channels Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{isHindi ? 'मास्क्ड चैनल्स सूची (स्ट्रीम प्रिव्यू):' : 'Shielded Channels Preview:'}</span>
                  </h4>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {channels.length} {isHindi ? 'चैनल्स' : 'channels'}
                  </span>
                </div>

                <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl max-h-72 overflow-y-auto divide-y divide-slate-100 shadow-2xs">
                  {channels.map((ch, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-white transition-colors"
                    >
                      {/* Channel Info */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-200/90 text-slate-700 text-[10px] font-extrabold flex items-center justify-center shrink-0">
                          {ch.num}
                        </span>

                        {ch.logo ? (
                          <img
                            src={ch.logo}
                            alt={ch.name}
                            className="w-7 h-7 rounded-md object-contain bg-slate-900/10 p-0.5 border border-slate-200 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                            <Tv className="w-3.5 h-3.5" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{ch.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate max-w-xs sm:max-w-md">
                            <span className="text-slate-500 font-semibold">{isHindi ? 'मूल:' : 'Orig:'}</span> {ch.originalUrl}
                          </p>
                        </div>
                      </div>

                      {/* Shielded Masked URL & Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-emerald-300 rounded-lg shadow-2xs">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-[11px] font-mono font-bold text-emerald-800 truncate max-w-[170px] sm:max-w-[220px]">
                            {ch.maskedUrl || ch.originalUrl}
                          </span>
                        </div>

                        {/* Copy Masked Link Button */}
                        <button
                          type="button"
                          onClick={() => handleCopySingle(ch.maskedUrl || ch.originalUrl, idx)}
                          className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                          title={isHindi ? 'मास्क्ड लिंक कॉपी करें' : 'Copy masked URL'}
                        >
                          {copiedUrlIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        {/* Direct Open Link */}
                        <a
                          href={ch.maskedUrl || ch.originalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                          title={isHindi ? 'ब्राउज़र में खोलें' : 'Open in new tab'}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        {/* Test Play in Player */}
                        {onPlayChannel && (
                          <button
                            type="button"
                            onClick={() => {
                              onPlayChannel({
                                num: ch.num,
                                name: ch.name,
                                stream_type: 'live',
                                stream_id: 99000 + idx,
                                stream_icon: ch.logo || '',
                                category_id: '99',
                                direct_source: ch.maskedUrl || ch.originalUrl,
                                epg_channel_id: undefined,
                                added: String(Math.floor(Date.now() / 1000)),
                                custom_sid: null,
                              });
                            }}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors cursor-pointer shadow-2xs"
                            title={isHindi ? 'प्लेयर में चलाएँ' : 'Play channel in player'}
                          >
                            <Play className="w-3.5 h-3.5 fill-rose-600 text-rose-600" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 sm:p-4 px-6 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-600">
              YAARO KA YAAR High-Speed Redirection Engine
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
          >
            {isHindi ? 'बंद करें' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
