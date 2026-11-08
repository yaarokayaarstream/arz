import React, { useState, useEffect } from 'react';
import {
  Download,
  FileText,
  Code2,
  Copy,
  Check,
  ArrowLeft,
  HelpCircle,
  CheckCircle2,
  RotateCcw,
  Lock,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Server,
  Layers,
} from 'lucide-react';
import { StreamCredentials, StreamChannel, Language } from '../types';
import { downloadPlaylistFile } from '../services/api';
import { addBrowserDownload } from '../services/browserStorage';
import { t } from '../services/translations';
import { apiUrl } from '../services/apiConfig';
import { sendUrlGeneratedNotification } from '../services/emailJsService';

function fallbackCopyText(text: string): void {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  } catch {
    // ignore
  }
}

interface DownloadSectionProps {
  credentials: StreamCredentials;
  streams: StreamChannel[];
  isLoadingStreams?: boolean;
  isValidated?: boolean;
  isComplete?: boolean;
  validationStats?: {
    totalChannels?: number;
    validChannels?: number;
    integrityStatus?: string;
  };
  onFetchStreams?: () => void;
  onBackToChoice: () => void;
  onReset?: () => void;
  onGoToView?: () => void;
  lang: Language;
}

export const DownloadSection: React.FC<DownloadSectionProps> = ({
  credentials,
  streams,
  isLoadingStreams = false,
  isValidated = false,
  isComplete = false,
  validationStats,
  onFetchStreams,
  onBackToChoice,
  onReset,
  lang,
}) => {
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [downloadSuccessFormat, setDownloadSuccessFormat] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const isHindi = lang === 'hi';

  // Strict backend validation condition:
  // Must NOT be loading, must be confirmed by backend, complete, and have channels > 0
  const isFullyReady = Boolean(
    !isLoadingStreams &&
    isValidated &&
    isComplete &&
    streams &&
    streams.length > 0
  );

  // If streams are empty or unvalidated on mount, trigger fetching from server
  useEffect(() => {
    if (
      credentials &&
      credentials.serverUrl &&
      credentials.username &&
      (!streams || streams.length === 0 || !isValidated) &&
      !isLoadingStreams &&
      onFetchStreams
    ) {
      onFetchStreams();
    }
  }, [credentials, streams?.length, isValidated, isLoadingStreams, onFetchStreams]);

  // Generate direct M3U URL for external players
  const cleanServerUrl = credentials.serverUrl ? credentials.serverUrl.replace(/\/+$/, '') : '';
  const directM3uUrl = credentials.isDemo
    ? apiUrl('/api/xtream/download-playlist')
    : `${cleanServerUrl}/get.php?username=${encodeURIComponent(
        credentials.username || ''
      )}&password=${encodeURIComponent(credentials.password || '')}&type=m3u_plus&output=m3u8`;

  const handleDownload = async (format: 'm3u' | 'm3u_plus' | 'json') => {
    if (!isFullyReady) return;
    try {
      setDownloadingFormat(format);
      await downloadPlaylistFile(credentials, format, streams);
      setDownloadSuccessFormat(format);
      setTimeout(() => setDownloadSuccessFormat(null), 3500);

      addBrowserDownload({
        fileName: `playlist_${credentials.username || 'streamhub'}_${new Date().toISOString().slice(0, 10)}.${format === 'json' ? 'json' : 'm3u'}`,
        format: format === 'm3u_plus' ? 'M3U Plus (EPG)' : format === 'json' ? 'JSON Catalog' : 'Standard M3U',
        size: `${Math.max(12, Math.round(streams.length * 0.2 + 25))} KB`,
        url: directM3uUrl,
      });
    } catch {
      // ignore
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleCopyUrl = () => {
    if (!isFullyReady) return;
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(directM3uUrl).catch(() => {
          fallbackCopyText(directM3uUrl);
        });
      } else {
        fallbackCopyText(directM3uUrl);
      }
    } catch {
      fallbackCopyText(directM3uUrl);
    }
    setCopied(true);
    sendUrlGeneratedNotification({
      url: directM3uUrl,
      source: 'Direct M3U Live Stream URL',
      details: {
        Username: credentials.username || 'guest_demo',
        'Channels Count': streams.length,
        'Server Gateway': credentials.serverUrl || 'Default',
      },
    }).catch(() => {});
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="w-full min-h-[85vh] max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-200">
      {/* Top Navigation Bar with Back & Reset */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onBackToChoice}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
            title={isHindi ? 'वापस जाएँ' : 'Go back'}
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>{isHindi ? 'वापस जाएँ' : 'Back'}</span>
          </button>

          {/* Reset Button: Clears all fields and redirects to Home Page */}
          <button
            type="button"
            onClick={onReset || onBackToChoice}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 text-rose-700 hover:text-rose-800 rounded-xl text-xs font-extrabold shadow-2xs transition-all cursor-pointer active:scale-[0.98]"
            title={isHindi ? 'सभी फील्ड्स क्लियर करें और होम पेज पर वापस जाएँ' : 'Reset all fields and redirect to home page'}
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
            <span>{isHindi ? 'Reset (रीसेट करें)' : 'Reset'}</span>
          </button>
        </div>

        {/* Server & Session Badge */}
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-xl text-emerald-900 text-xs font-mono shadow-2xs">
          {!isFullyReady ? (
            <div className="w-3 h-3 border-2 border-emerald-600/40 border-t-emerald-700 rounded-full animate-spin shrink-0" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          )}
          <span className="font-bold truncate max-w-[220px] sm:max-w-xs">{cleanServerUrl || 'Stream Server'}</span>
          <span className="text-emerald-400">·</span>
          <span className="text-emerald-700 font-bold">{credentials.username || 'User'}</span>
        </div>
      </div>

      {/* Main Title Header (Conditioned on validation state) */}
      <div className="mb-8 text-center sm:text-left">
        {!isFullyReady ? (
          <>
            <div className="inline-flex items-center gap-2.5 px-3 py-1 bg-indigo-50 border border-indigo-200/80 rounded-full text-indigo-700 text-xs font-bold mb-3 shadow-2xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>{isHindi ? 'पूरी प्लेलिस्ट फ़ेच की जा रही है...' : 'Fetching Full Playlist...'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-2">
              {isHindi ? 'Fetching Full Playlist (पूरी प्लेलिस्ट लोड हो रही है)' : 'Fetching Full Playlist'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
              {isHindi
                ? 'बैकएंड सर्वर से सभी डेटा और चैनल पूरी तरह डाउनलोड होने का इंतज़ार किया जा रहा है। जब तक सभी चैनल लोड नहीं हो जाते, डाउनलोड विकल्प छिपा रहेगा।'
                : 'Waiting for all channels and playlist data to download completely from the server. Download options will appear only after complete validation.'}
            </p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center gap-2.5 px-3 py-1 bg-emerald-50 border border-emerald-200/80 rounded-full text-emerald-700 text-xs font-bold mb-3 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isHindi ? 'Xtream Codes डायरेक्ट डाउनलोड हब' : 'Xtream Codes Direct Download Hub'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-2">
              {t('download_page_title', lang)}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
              {isHindi
                ? 'पूरी प्लेलिस्ट सफलतापूर्वक लोड और वैलिडेट हो गई है। नीचे दिए गए 1-क्लिक बटन से पूरी प्लेलिस्ट डाउनलोड करें।'
                : 'Complete channel catalog successfully fetched and validated. Click below to download your playlist directly.'}
            </p>
          </>
        )}
      </div>

      {/* CONDITIONAL RENDER:
          If NOT fully ready: Show ONLY the 'Fetching Full Playlist' state and DO NOT render any download option.
          If fully ready: Show 'Full Playlist Ready to Download!' with active Hero Download Button and Format Cards.
      */}
      {!isFullyReady ? (
        /* STATE 1: MAINTAIN 'FETCHING FULL PLAYLIST' STATE - NO DOWNLOAD BUTTON */
        <div className="mb-8 p-6 sm:p-10 rounded-3xl text-white shadow-2xl relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 ring-4 ring-indigo-500/10">
          <div className="absolute -top-16 -right-16 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-7">
            {/* Top Status Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-900/80 border border-indigo-400/40 text-indigo-200 shadow-md">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                <span>
                  {isHindi ? 'Fetching Full Playlist (पूरी प्लेलिस्ट फ़ेच हो रही है...)' : 'Fetching Full Playlist'}
                </span>
              </div>

              <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-amber-300 bg-amber-950/70 border border-amber-500/40 px-3.5 py-1.5 rounded-xl shadow-xs">
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{isHindi ? 'डाउनलोड विकल्प छिपा है (100% सत्यापन आवश्यक)' : 'Download Option Hidden (100% Confirmation Required)'}</span>
              </div>
            </div>

            {/* Central Animated Status Radar */}
            <div className="space-y-3">
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
                <span>{isHindi ? 'सर्वर से पूरी प्लेलिस्ट फ़ेच की जा रही है...' : 'Fetching Full Playlist from Server...'}</span>
              </h2>
              <p className="text-xs sm:text-sm text-indigo-200/90 max-w-2xl font-medium leading-relaxed">
                {isHindi
                  ? '⚡ बैकएंड सर्वर पूरी प्लेलिस्ट डाउनलोड होने का इंतज़ार कर रहा है। जब तक सभी चैनल, ईपीजी डेटा और कैटेगरी ग्रुप्स 100% लोड और सत्यापित नहीं हो जाते, डाउनलोड विकल्प नहीं दिखाया जाएगा।'
                  : '⚡ The backend is currently waiting for the complete playlist to download. The download option remains strictly hidden and blocked until 100% of all channels and metadata are verified.'}
              </p>
            </div>

            {/* Realtime Checklist Stages */}
            <div className="bg-slate-950/70 border border-indigo-500/30 rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-5 shadow-inner">
              <div className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Server className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-white block">
                    {isHindi ? '1. सर्वर कनेक्शन' : '1. Server Handshake'}
                  </span>
                  <span className="text-[11px] text-emerald-300 font-semibold block mt-0.5">
                    {cleanServerUrl || 'Connected'} ✓
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {isHindi ? 'क्रेडेंशियल्स सत्यापित' : 'Authenticated'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Loader2 className="w-4 h-4 text-indigo-300 animate-spin" />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-white block">
                    {isHindi ? '2. पूरी प्लेलिस्ट डाउनलोड' : '2. Downloading Playlist'}
                  </span>
                  <span className="text-[11px] text-indigo-300 font-semibold block mt-0.5">
                    {streams && streams.length > 0
                      ? `${streams.length.toLocaleString()} ${isHindi ? 'चैनल लोड हुए...' : 'channels loaded...'}`
                      : isHindi ? 'डाउनलोडिंग जारी है...' : 'Downloading in progress...'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {isHindi ? 'बैकएंड डेटा का इंतज़ार कर रहा है' : 'Backend waiting for server'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-white block">
                    {isHindi ? '3. 100% अखंडता सत्यापन' : '3. 100% Validation'}
                  </span>
                  <span className="text-[11px] text-amber-300 font-semibold block mt-0.5">
                    {isHindi ? 'सत्यापन के बाद डाउनलोड सक्रिय' : 'Pending 100% confirmation'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {isHindi ? 'डाउनलोड बटन अभी छिपा है' : 'Download button locked'}
                  </span>
                </div>
              </div>
            </div>

            {/* Strict Policy Banner */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {isHindi
                  ? 'पूरी लिस्ट वैलिडेट होने के बाद ही डाउनलोड बटन सक्रिय होगा और दिखाई देगा। कृपया प्रतीक्षा करें...'
                  : 'Download button will appear and become active only after the entire list is fully validated. Please wait...'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* STATE 2: FULL PLAYLIST READY TO DOWNLOAD (100% VALIDATED & CONFIRMED) */
        <>
          <div className="mb-8 p-6 sm:p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-700 shadow-emerald-900/30 ring-4 ring-emerald-400/40 transition-all duration-300">
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-teal-300/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="text-center lg:text-left space-y-2 flex-1">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/20 backdrop-blur-md text-emerald-100 border border-white/25">
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>
                    {isHindi
                      ? `100% सत्यापित • ${streams.length.toLocaleString()} चैनल्स तैयार`
                      : `100% Validated • ${streams.length.toLocaleString()} Channels Ready`}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {isHindi ? 'पूरी प्लेलिस्ट डाउनलोड के लिए तैयार है!' : 'Full Playlist Ready to Download!'}
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100 max-w-xl font-semibold leading-relaxed">
                  {isHindi
                    ? `⚡ ${streams.length.toLocaleString()} लाइव चैनल्स • EPG गाइड, चैनल लोगो व कैटेगरी ग्रुप्स सहित पूरी प्लेलिस्ट 1-क्लिक में डाउनलोड करें।`
                    : `⚡ Complete playlist catalog of ${streams.length.toLocaleString()} Live Channels with EPG guides, logos & categories.`}
                </p>
              </div>

              {/* THE BIG HERO DOWNLOAD PLAYLIST BUTTON (ACTIVATED ONLY AFTER 100% VALIDATION) */}
              <button
                type="button"
                onClick={() => handleDownload('m3u_plus')}
                disabled={downloadingFormat !== null}
                className="w-full lg:w-auto px-8 sm:px-10 py-5 bg-white hover:bg-emerald-50 text-emerald-950 font-black text-base sm:text-lg rounded-2xl flex items-center justify-center gap-4 transition-all shrink-0 border-2 border-emerald-100 shadow-2xl shadow-emerald-950/40 hover:shadow-emerald-950/60 cursor-pointer active:scale-95 group"
                title={isHindi ? 'पूरी प्लेलिस्ट तुरंत डाउनलोड करें' : 'Download Complete Playlist Now'}
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 shadow-md">
                  {downloadingFormat === 'm3u_plus' ? (
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : downloadSuccessFormat === 'm3u_plus' ? (
                    <Check className="w-7 h-7 text-white" />
                  ) : (
                    <Download className="w-7 h-7 text-white" />
                  )}
                </div>
                <div className="text-left">
                  <div className="leading-tight font-black flex items-center gap-2">
                    <span className="text-emerald-950">
                      {downloadingFormat === 'm3u_plus'
                        ? isHindi ? 'डाउनलोड हो रहा है...' : 'Downloading Playlist...'
                        : downloadSuccessFormat === 'm3u_plus'
                        ? isHindi ? '✓ पूरी प्लेलिस्ट डाउनलोड सफल!' : '✓ Playlist Downloaded!'
                        : isHindi ? 'Download Playlist (पूरी प्लेलिस्ट डाउनलोड)' : 'Download Playlist (.m3u8)'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md uppercase font-bold tracking-wider bg-emerald-100 text-emerald-800">
                      M3U Plus
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 block mt-0.5">
                    {isHindi ? '1-क्लिक इंस्टेंट M3U Plus डाउनलोड' : '1-Click Direct Download'}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Download Options Cards (Rendered ONLY after full validation) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {/* Card 1: M3U Plus */}
            <div className="bg-white border-2 border-emerald-300/80 hover:border-emerald-500 rounded-2xl p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-bl-xl shadow-2xs">
                {isHindi ? 'सर्वाधिक अनुशंसित' : 'Recommended'}
              </div>

              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-4 shadow-2xs">
                  <Download className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mb-1">
                  M3U Plus (.m3u8 / .m3u)
                </h3>
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-2 block">
                  {isHindi ? 'EPG और कैटेगरी मेटाडेटा सहित' : 'With EPG & Category Logos'}
                </span>
                <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                  {isHindi
                    ? 'स्मार्ट टीवी, TiviMate, OTT Navigator और IPTV Smarters के लिए सबसे उत्तम फॉर्मेट। इसमें चैनल लोगो और ग्रुप कैटेगरीज शामिल हैं।'
                    : 'Optimal format for Smart TVs, TiviMate, OTT Navigator, and IPTV Smarters with complete metadata and logos.'}
                </p>
              </div>

              <button
                onClick={() => handleDownload('m3u_plus')}
                disabled={downloadingFormat !== null}
                className="w-full py-3 px-4 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-emerald-600/20 active:scale-[0.99]"
              >
                {downloadingFormat === 'm3u_plus' ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{isHindi ? 'डाउनलोड हो रहा है...' : 'Downloading...'}</span>
                  </>
                ) : downloadSuccessFormat === 'm3u_plus' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-200" />
                    <span>{isHindi ? '✓ डाउनलोड सफल!' : '✓ Downloaded!'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-emerald-200" />
                    <span>{isHindi ? 'डाउनलोड M3U Plus' : 'Download M3U Plus'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Card 2: Standard M3U */}
            <div className="bg-white border border-slate-200/90 hover:border-indigo-300 rounded-2xl p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 mb-4 shadow-2xs">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mb-1">
                  Standard M3U (.m3u)
                </h3>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  {isHindi ? 'क्लीन व हल्का फॉर्मेट' : 'Lightweight Clean Format'}
                </span>
                <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                  {isHindi
                    ? 'बिना किसी अतिरिक्त भारी टैग के साधारण प्लेलिस्ट। VLC Media Player, PotPlayer और Windows Media Player के लिए आदर्श।'
                    : 'Lightweight clean format without heavy XML metadata tags. Ideal for VLC, PotPlayer, and PC media players.'}
                </p>
              </div>

              <button
                onClick={() => handleDownload('m3u')}
                disabled={downloadingFormat !== null}
                className="w-full py-3 px-4 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs bg-slate-900 hover:bg-slate-800 cursor-pointer active:scale-[0.99]"
              >
                {downloadingFormat === 'm3u' ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{isHindi ? 'डाउनलोड हो रहा है...' : 'Downloading...'}</span>
                  </>
                ) : downloadSuccessFormat === 'm3u' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>{isHindi ? '✓ डाउनलोड सफल!' : '✓ Downloaded!'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-slate-300" />
                    <span>{isHindi ? 'डाउनलोड स्टैंडर्ड M3U' : 'Download Standard M3U'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Card 3: JSON Catalog */}
            <div className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
              <div>
                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 mb-4 shadow-2xs">
                  <Code2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mb-1">
                  JSON Catalog (.json)
                </h3>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  {isHindi ? 'डेवलपर / डेटा फॉर्मेट' : 'Structured Data Format'}
                </span>
                <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                  {isHindi
                    ? 'सभी चैनलों, कैटेगरीज और स्ट्रीम लिंक्स का सुव्यवस्थित JSON डेटा, कस्टम मीडिया ऐप्स और डेवलपर्स के लिए।'
                    : 'Clean structured JSON format with all channel names, stream endpoints, and categories for custom apps.'}
                </p>
              </div>

              <button
                onClick={() => handleDownload('json')}
                disabled={downloadingFormat !== null}
                className="w-full py-3 px-4 text-slate-800 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-2xs bg-slate-100 hover:bg-slate-200 cursor-pointer active:scale-[0.99]"
              >
                {downloadingFormat === 'json' ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-700 rounded-full animate-spin" />
                    <span>{isHindi ? 'डाउनलोड हो रहा है...' : 'Downloading...'}</span>
                  </>
                ) : downloadSuccessFormat === 'json' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>{isHindi ? '✓ डाउनलोड सफल!' : '✓ Downloaded!'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-slate-600" />
                    <span>{isHindi ? 'डाउनलोड JSON' : 'Download JSON'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Copy Direct M3U URL Box (Shown ONLY after full validation) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 mb-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{isHindi ? 'डायरेक्ट M3U लाइव स्ट्रीम URL' : 'Direct M3U Live Stream URL'}</span>
              </h3>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                {isHindi ? 'TiviMate / VLC / OTT Navigator' : 'For TiviMate / VLC / Smarters'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              {isHindi
                ? 'इस डायरेक्ट यूआरएल को कॉपी करके अपने किसी भी IPTV प्लेयर या स्मार्ट टीवी ऐप में पेस्ट करें:'
                : 'Copy and paste this direct stream link into any IPTV player or Smart TV app to load all channels instantly:'}
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={directM3uUrl}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 font-mono select-all focus:outline-none shadow-2xs"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer shadow-sm shadow-indigo-600/20 active:scale-[0.98]"
                title={isHindi ? 'M3U लिंक कॉपी करें' : 'Copy M3U Link'}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>{isHindi ? 'कॉपी हो गया!' : 'Copied!'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>{isHindi ? 'कॉपी लिंक' : 'Copy Link'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Setup Instructions */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                {t('how_to_setup', lang)}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
                <h4 className="font-bold text-indigo-700 mb-1">VLC Media Player (PC / Mac)</h4>
                <p className="text-slate-600 leading-relaxed">
                  {isHindi
                    ? 'VLC खोलें > Media मेन्यू में जाएं > "Open Network Stream" चुनें और ऊपर दिया गया M3U URL पेस्ट करें, या डाउनलोड की गई .m3u फाइल को सीधे VLC विंडो में ड्रैग करें।'
                    : 'Open VLC > Go to Media menu > Select "Open Network Stream" and paste the M3U URL, or simply drag the downloaded .m3u file into VLC.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
                <h4 className="font-bold text-indigo-700 mb-1">Android TV / Fire TV (TiviMate)</h4>
                <p className="text-slate-600 leading-relaxed">
                  {isHindi
                    ? 'TiviMate ऐप में Add Playlist चुनें > M3U Playlist विकल्प चुनें और ऊपर दिया गया डायरेक्ट URL पेस्ट करें। चैनल और EPG अपने आप लोड हो जाएंगे।'
                    : 'In TiviMate, select Add Playlist > Choose M3U Playlist and paste the direct stream link. Channels and EPG will populate automatically.'}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bottom Reset Action */}
      <div className="mt-8 pt-4 border-t border-slate-200 text-center">
        <button
          type="button"
          onClick={onReset || onBackToChoice}
          className="inline-flex items-center gap-2 text-xs font-black text-slate-500 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
        >
          <RotateCcw className="w-4 h-4 text-rose-500" />
          <span>{isHindi ? 'सभी फील्ड्स रीसेट करें और होम पेज पर वापस जाएँ' : 'Reset All Fields & Return to Home Page'}</span>
        </button>
      </div>
    </div>
  );
};
