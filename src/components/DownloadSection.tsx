import React, { useState } from 'react';
import { Download, FileText, Code2, Copy, Check, ArrowLeft, HelpCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { StreamCredentials, StreamChannel, Language } from '../types';
import { downloadPlaylistFile } from '../services/api';
import { addBrowserDownload } from '../services/browserStorage';
import { t } from '../services/translations';
import { apiUrl } from '../services/apiConfig';
import { sendUrlGeneratedNotification } from '../services/emailJsService';

interface DownloadSectionProps {
  credentials: StreamCredentials;
  streams: StreamChannel[];
  onBackToChoice: () => void;
  onReset?: () => void;
  onGoToView?: () => void;
  lang: Language;
}

export const DownloadSection: React.FC<DownloadSectionProps> = ({
  credentials,
  streams,
  onBackToChoice,
  onReset,
  lang,
}) => {
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [downloadSuccessFormat, setDownloadSuccessFormat] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const isHindi = lang === 'hi';

  // Generate direct M3U URL for external players
  const cleanServerUrl = credentials.serverUrl ? credentials.serverUrl.replace(/\/+$/, '') : '';
  const directM3uUrl = credentials.isDemo
    ? apiUrl('/api/xtream/download-playlist')
    : `${cleanServerUrl}/get.php?username=${encodeURIComponent(
        credentials.username || ''
      )}&password=${encodeURIComponent(credentials.password || '')}&type=m3u_plus&output=m3u8`;

  const handleDownload = async (format: 'm3u' | 'm3u_plus' | 'json') => {
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
    } catch (err: any) {
      console.warn('Download error:', err);
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(directM3uUrl);
    setCopied(true);
    sendUrlGeneratedNotification({
      url: directM3uUrl,
      source: 'Direct M3U Live Stream URL',
      details: {
        'Username': credentials.username || 'guest_demo',
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
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="font-bold truncate max-w-[220px] sm:max-w-xs">{cleanServerUrl || 'Stream Server'}</span>
          <span className="text-emerald-400">·</span>
          <span className="text-emerald-700 font-bold">{credentials.username || 'User'}</span>
        </div>
      </div>

      {/* Main Title Header */}
      <div className="mb-8 text-center sm:text-left">
        <div className="inline-flex items-center gap-2.5 px-3 py-1 bg-indigo-50 border border-indigo-200/80 rounded-full text-indigo-700 text-xs font-bold mb-3 shadow-2xs">
          <Download className="w-3.5 h-3.5" />
          <span>{isHindi ? 'Xtream Codes डायरेक्ट डाउनलोड हब' : 'Xtream Codes Direct Download Hub'}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-2">
          {t('download_page_title', lang)}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
          {isHindi
            ? 'अपनी M3U प्लेलिस्ट को सीधे अपनी पसंद के फॉर्मेट में डाउनलोड करें या डायरेक्ट लिंक कॉपी करके किसी भी प्लेयर में पेस्ट करें।'
            : 'Download your Xtream Codes playlist directly in your preferred format or copy the direct stream URL for any IPTV player.'}
        </p>
      </div>

      {/* Download Options Cards (Full Screen Grid) */}
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
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 shadow-sm shadow-emerald-600/20 active:scale-[0.99]"
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
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 shadow-xs active:scale-[0.99]"
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
            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 shadow-2xs active:scale-[0.99]"
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

      {/* Copy Direct M3U URL Box */}
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
