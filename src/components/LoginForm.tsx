import React, { useState, useEffect } from 'react';
import {
  Server,
  User,
  Lock,
  Eye,
  EyeOff,
  PlayCircle,
  HelpCircle,
  AlertCircle,
  Network,
  Trash2,
  Globe,
  Download,
  CheckCircle2,
  ListVideo,
  Copy,
  Check,
  Tv,
  Link2,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { StreamCredentials, Language, StreamChannel, Category, ViewMode } from '../types';
import { downloadPlaylistFile } from '../services/api';
import { authenticateMacPortal, downloadM3uFile, MacAuthResponse } from '../services/macPortalService';
import { BrandLogoIcon } from './BrandLogo';
import { RangeUrlGenerator } from './RangeUrlGenerator';
import { LinkMasterModal } from './LinkMasterModal';
import { QuickToolsPairsGrid } from './QuickToolsPairsGrid';
import { DashboardActionType } from './ActionChoice';
import { t } from '../services/translations';

interface LoginFormProps {
  onLogin: (creds: StreamCredentials, targetView?: ViewMode) => void;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
  lang: Language;
  onSelectLang?: (lang: Language) => void;
  onOpenMacModal: () => void;
  loadedUrl?: string | null;
  onDeleteLoadedUrl?: () => void;
  onMacLogin?: (macResult: {
    macAddress: string;
    portalUrl: string;
    channels: StreamChannel[];
    categories: Category[];
  }) => void;
  onPlayChannel?: (channel: StreamChannel) => void;
  onLoadChannelsToApp?: (channels: StreamChannel[], categories?: Category[]) => void;
  onSelectAction?: (action: DashboardActionType) => void;
}

const RECENT_STORAGE_KEY = 'streamhub_recent_connections';

interface RecentConnection {
  serverUrl: string;
  username: string;
  lastUsed: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onLogin,
  isLoading,
  error,
  onClearError,
  lang,
  onSelectLang,
  onOpenMacModal,
  loadedUrl,
  onDeleteLoadedUrl,
  onMacLogin,
  onPlayChannel,
  onLoadChannelsToApp,
  onSelectAction,
}) => {
  const isHindi = lang === 'hi';

  // Mode: 'xtream' (Xtream Codes API), 'mac' (MAC URL / Stalker Portal), 'range' (Range URL Generator), or 'linkmaster' (Link Master)
  const [activeTab, setActiveTab] = useState<'xtream' | 'mac' | 'range' | 'linkmaster'>('xtream');

  // Xtream Codes API form state
  const [serverUrl, setServerUrl] = useState(loadedUrl || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [recents, setRecents] = useState<RecentConnection[]>([]);
  const [isXtreamHighlighted, setIsXtreamHighlighted] = useState(false);

  // MAC URL / Stalker Portal form state
  const [macAddress, setMacAddress] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [isMacLoading, setIsMacLoading] = useState(false);
  const [macError, setMacError] = useState<string | null>(null);
  const [macResult, setMacResult] = useState<MacAuthResponse | null>(null);
  const [copiedM3u, setCopiedM3u] = useState(false);

  // Direct Xtream Codes M3U Download & URL generation state
  const [isXtreamDownloading, setIsXtreamDownloading] = useState<'m3u' | 'm3u_plus' | null>(null);
  const [downloadedXtreamFormat, setDownloadedXtreamFormat] = useState<string | null>(null);
  const [copiedXtreamUrl, setCopiedXtreamUrl] = useState(false);
  const [isXtreamGenerated, setIsXtreamGenerated] = useState(false);

  const isXtreamReady = Boolean(serverUrl.trim() && username.trim() && password.trim());
  const cleanServerUrl = serverUrl.trim().replace(/\/+$/, '');
  const directXtreamM3uPlus = isXtreamReady
    ? `${cleanServerUrl}/get.php?username=${encodeURIComponent(username.trim())}&password=${encodeURIComponent(password.trim())}&type=m3u_plus&output=m3u8`
    : '';
  const directXtreamM3u = isXtreamReady
    ? `${cleanServerUrl}/get.php?username=${encodeURIComponent(username.trim())}&password=${encodeURIComponent(password.trim())}&type=m3u&output=ts`
    : '';

  const handleGenerateAndDownload = (format?: 'm3u_plus' | 'm3u') => {
    if (!serverUrl.trim() || !username.trim() || !password.trim()) return;
    setIsXtreamGenerated(true);
    if (format) {
      handleDownloadXtreamDirect(format);
    }
  };

  const handleXtreamDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!serverUrl.trim() || !username.trim() || !password.trim()) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    onClearError();
    onLogin(
      {
        serverUrl: serverUrl.trim(),
        username: username.trim(),
        password: password.trim(),
      },
      'download'
    );
  };

  const handleDownloadXtreamDirect = async (format: 'm3u' | 'm3u_plus') => {
    if (!serverUrl.trim() || !username.trim() || !password.trim()) return;
    setIsXtreamDownloading(format);
    onClearError();

    const creds: StreamCredentials = {
      serverUrl: serverUrl.trim(),
      username: username.trim(),
      password: password.trim(),
    };

    try {
      await downloadPlaylistFile(creds, format, []);
      setDownloadedXtreamFormat(format);
      setTimeout(() => setDownloadedXtreamFormat(null), 3500);
    } catch {
      // Direct browser fallback trigger using standard get.php without opening 404 tab
      const directUrl = format === 'm3u_plus' ? directXtreamM3uPlus : directXtreamM3u;
      const m3uText = `#EXTM3U x-tvg-url=""\r\n#EXTINF:-1 tvg-id="master" tvg-name="Xtream Live",Xtream Live Stream (${username.trim()})\r\n${directUrl}\r\n`;
      const blob = new Blob([m3uText], { type: 'audio/x-mpegurl;charset=utf-8' });
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `playlist_${username.trim()}_${format}.m3u`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 1500);
      setDownloadedXtreamFormat(format);
      setTimeout(() => setDownloadedXtreamFormat(null), 3500);
    } finally {
      setIsXtreamDownloading(null);
    }
  };

  const handleCopyXtreamM3u = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedXtreamUrl(true);
    setTimeout(() => setCopiedXtreamUrl(false), 2500);
  };

  useEffect(() => {
    if (loadedUrl) {
      setServerUrl(loadedUrl);
    } else {
      setServerUrl('');
      setUsername('');
      setPassword('');
      setIsXtreamGenerated(false);
    }
  }, [loadedUrl]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_STORAGE_KEY);
      if (saved) {
        setRecents(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const deleteRecentUrl = (urlToDelete: string) => {
    const updated = recents.filter((r) => r.serverUrl !== urlToDelete);
    setRecents(updated);
    try {
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    if (serverUrl === urlToDelete) {
      setServerUrl('');
      setUsername('');
      setPassword('');
      setIsXtreamGenerated(false);
    }
    if (onDeleteLoadedUrl) {
      onDeleteLoadedUrl();
    }
  };

  const handleXtreamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    onClearError();

    // Save to recents (without storing raw password)
    try {
      const updated = [
        { serverUrl: serverUrl.trim(), username: username.trim(), lastUsed: new Date().toLocaleDateString() },
        ...recents.filter((r) => r.serverUrl !== serverUrl.trim() || r.username !== username.trim()),
      ].slice(0, 3);
      setRecents(updated);
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    onLogin(
      {
        serverUrl: serverUrl.trim(),
        username: username.trim(),
        password: password.trim(),
      },
      'download'
    );
  };

  // Format MAC address input automatically (adds colon after every 2 characters)
  const handleMacChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '');
    if (raw.length > 12) raw = raw.slice(0, 12);
    const parts = raw.match(/.{1,2}/g) || [];
    setMacAddress(parts.join(':'));
  };

  // Handle MAC Portal Authentication & Channel Fetch
  const handleMacSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!macAddress.trim() || !portalUrl.trim()) {
      setMacError(
        isHindi
          ? 'कृपया मैक एड्रेस और पोर्टल यूआरएल दोनों दर्ज करें।'
          : 'Please enter both MAC Address and Portal URL.'
      );
      return;
    }

    setIsMacLoading(true);
    setMacError(null);
    setMacResult(null);

    try {
      const result = await authenticateMacPortal(macAddress, portalUrl);
      setMacResult(result);
      // Automatic download disabled: user must click manual download button below
    } catch (err: any) {
      setMacError(err.message || 'MAC Portal authentication failed.');
    } finally {
      setIsMacLoading(false);
    }
  };

  const handleDownloadM3u = () => {
    if (!macResult?.m3uContent) return;
    downloadM3uFile(macResult.m3uContent, macResult.downloadFilename || `playlist_${macResult.macAddress.replace(/:/g, '')}.m3u`);
  };

  const handleCopyM3u = () => {
    if (!macResult?.m3uContent) return;
    navigator.clipboard.writeText(macResult.m3uContent);
    setCopiedM3u(true);
    setTimeout(() => setCopiedM3u(false), 2000);
  };

  const handleOpenInDashboard = () => {
    if (!macResult || !onMacLogin) return;
    onMacLogin({
      macAddress: macResult.macAddress,
      portalUrl: macResult.portalUrl,
      channels: macResult.channels,
      categories: macResult.categories,
    });
  };

  const handleResetMacUrl = () => {
    setMacResult(null);
    setPortalUrl('');
    setMacAddress('');
    setMacError(null);
    setCopiedM3u(false);
  };

  const handleQuickToolsAction = (action: DashboardActionType) => {
    if (action === 'xtream_api') {
      setActiveTab('xtream');
      setIsXtreamHighlighted(true);
      setTimeout(() => {
        const input = document.getElementById('xtream-server-url-input');
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      setTimeout(() => setIsXtreamHighlighted(false), 2500);
      return;
    }
    if (onSelectAction) {
      onSelectAction(action);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      {/* QUICK TOOLS Section - Horizontal Bar with 6 separate small boxes (2 tools each), placed directly above the Yaaro Ka Yaar Stream header block */}
      {!isXtreamGenerated && onSelectAction && (
        <div className="w-full mb-6">
          <QuickToolsPairsGrid
            lang={lang}
            onSelectAction={handleQuickToolsAction}
          />
        </div>
      )}

      {/* Title & Introduction with Logo */}
      <div className="flex flex-col items-center justify-center text-center mb-6">
        <div className="inline-flex items-center gap-2.5 px-3 py-1.5 bg-white border border-slate-200/90 rounded-xl shadow-2xs mb-2.5">
          <BrandLogoIcon size={24} />
          <div className="text-left">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 leading-tight">
              Yaaro Ka Yaar Stream
            </h1>
            <p className="text-[9px] font-bold tracking-wider text-rose-600 uppercase">
              IPTV & M3U MANAGER
            </p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
          {t('intro_desc', lang)}
        </p>
      </div>

      {/* Main Form Card */}
      <div
        className={`max-w-2xl mx-auto bg-white border ${
          isXtreamHighlighted
            ? 'border-indigo-400 ring-4 ring-indigo-500/15'
            : 'border-slate-200/90'
        } rounded-2xl p-6 sm:p-8 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.06)] transition-all duration-300`}
      >
        {isXtreamGenerated ? (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Success Header */}
            <div className="text-center pb-4 border-b border-slate-100">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                {isHindi ? 'Xtream Codes M3U प्लेलिस्ट तैयार है!' : 'Xtream Codes M3U Playlist Generated!'}
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-mono truncate max-w-md mx-auto">
                {cleanServerUrl} • User: {username.trim()}
              </p>
            </div>

            {/* Direct M3U URL Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>{isHindi ? 'डायरेक्ट M3U प्लेलिस्ट लिंक:' : 'Direct M3U Playlist Link:'}</span>
                <span className="text-[11px] text-emerald-700 font-semibold">{isHindi ? 'VLC / TiviMate / Smarters' : 'For VLC / TiviMate / Smarters'}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={directXtreamM3uPlus}
                  className="flex-1 font-mono text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopyXtreamM3u(directXtreamM3uPlus)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
                  title={isHindi ? 'M3U लिंक कॉपी करें' : 'Copy M3U Link'}
                >
                  {copiedXtreamUrl ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedXtreamUrl ? (isHindi ? 'कॉपी हो गया!' : 'Copied!') : (isHindi ? 'कॉपी लिंक' : 'Copy Link')}</span>
                </button>
              </div>
            </div>

            {/* Direct Download Options ONLY */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                {isHindi ? 'डायरेक्ट प्लेलिस्ट डाउनलोड विकल्प:' : 'Direct Playlist Download Options:'}
              </h3>

              {/* Option 1: M3U Plus */}
              <button
                type="button"
                onClick={() => handleDownloadXtreamDirect('m3u_plus')}
                disabled={isXtreamDownloading !== null}
                className="w-full p-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-between transition-all cursor-pointer shadow-md shadow-emerald-600/20 active:scale-[0.99] group"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/40 border border-emerald-400/50 flex items-center justify-center shrink-0">
                    <Download className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-black flex items-center gap-2">
                      <span>{isHindi ? 'डाउनलोड M3U Plus (.m3u8)' : 'Download M3U Plus (.m3u8)'}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white uppercase">
                        {isHindi ? 'अनुशंसित' : 'Recommended'}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-100 font-medium">
                      {isHindi ? 'चैनल नाम, टीवी लोगो और ग्रुप कैटेगरीज के साथ' : 'Includes channel logos, groups, and EPG metadata'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-extrabold px-3 py-1.5 bg-white/20 rounded-lg text-white group-hover:bg-white group-hover:text-emerald-800 transition-colors">
                  {isXtreamDownloading === 'm3u_plus'
                    ? (isHindi ? 'डाउनलोडिंग...' : 'Downloading...')
                    : downloadedXtreamFormat === 'm3u_plus'
                    ? (isHindi ? '✓ डाउनलोड सफल' : '✓ Done')
                    : (isHindi ? 'डाउनलोड' : 'Download')}
                </span>
              </button>

              {/* Option 2: Standard M3U */}
              <button
                type="button"
                onClick={() => handleDownloadXtreamDirect('m3u')}
                disabled={isXtreamDownloading !== null}
                className="w-full p-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-between transition-all cursor-pointer shadow-sm active:scale-[0.99] group"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <Download className="w-5 h-5 text-slate-300" />
                  </div>
                  <div>
                    <div className="text-sm font-black">
                      {isHindi ? 'डाउनलोड स्टैंडर्ड M3U (.m3u)' : 'Download Standard M3U (.m3u)'}
                    </div>
                    <p className="text-xs text-slate-400 font-medium">
                      {isHindi ? 'साधारण मीडिया प्लेयर्स और VLC के लिए' : 'Lightweight clean format for simple media players'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-extrabold px-3 py-1.5 bg-slate-800 rounded-lg text-slate-200 group-hover:bg-white group-hover:text-slate-900 transition-colors">
                  {isXtreamDownloading === 'm3u'
                    ? (isHindi ? 'डाउनलोडिंग...' : 'Downloading...')
                    : downloadedXtreamFormat === 'm3u'
                    ? (isHindi ? '✓ डाउनलोड सफल' : '✓ Done')
                    : (isHindi ? 'डाउनलोड' : 'Download')}
                </span>
              </button>
            </div>

            {/* Back / Reset Action */}
            <div className="pt-2 flex items-center justify-center gap-3 border-t border-slate-100 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setServerUrl('');
                  setUsername('');
                  setPassword('');
                  setIsXtreamGenerated(false);
                  setRecents([]);
                  try {
                    localStorage.removeItem(RECENT_STORAGE_KEY);
                    localStorage.removeItem('streamhub_last_loaded_url');
                  } catch {
                    // ignore
                  }
                  if (onDeleteLoadedUrl) {
                    onDeleteLoadedUrl();
                  }
                  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                }}
                className="inline-flex items-center gap-1.5 text-xs font-black text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 py-1.5 px-3 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                title={isHindi ? 'सभी फील्ड्स क्लियर करें और रीसेट करें' : 'Clear all fields and reset'}
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                <span>{isHindi ? 'Reset (सभी फील्ड्स क्लियर करें)' : 'Reset All Fields'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsXtreamGenerated(false)}
                className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-50"
              >
                ← {isHindi ? 'विवरण बदलें' : 'Edit Credentials'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Protocol Selector Tabs: Xtream Codes API vs MAC URL / Stalker Portal */}
            <div className="flex items-center p-1 bg-slate-100 border border-slate-200/80 rounded-xl mb-6 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('xtream')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'xtream'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-4 h-4 text-indigo-600" />
            <span>{t('tab_xtream', lang)}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mac')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'mac'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Network className="w-4 h-4 text-indigo-600" />
            <span>{t('tab_mac', lang)}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('range')}
            className={`flex-1 py-2.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'range'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t('tab_range', lang)}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('linkmaster')}
            className={`flex-1 py-2.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'linkmaster'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('tab_linkmaster', lang)}</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* SECTION 1: MAC URL / STALKER PORTAL INPUTS & SUBMIT     */}
        {/* ======================================================== */}
        {activeTab === 'mac' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Error Alert */}
            {macError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm flex items-start gap-3 shadow-2xs">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold whitespace-pre-line text-rose-900">{macError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleMacSubmit} className="space-y-4">
              {/* Field 1: Portal URL */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  {t('portal_url_label', lang)}
                  <span className="text-rose-500 ml-1">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Globe className="w-4 h-4 text-indigo-600" />
                  </div>
                  <input
                    type="text"
                    value={portalUrl}
                    onChange={(e) => setPortalUrl(e.target.value)}
                    placeholder="http://example.com:8080/c/"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500 font-mono">
                  {t('portal_url_hint', lang)}
                </p>
              </div>

              {/* Field 2: MAC Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  {t('mac_address_label', lang)}
                  <span className="text-rose-500 ml-1">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Network className="w-4 h-4 text-indigo-600" />
                  </div>
                  <input
                    type="text"
                    value={macAddress}
                    onChange={handleMacChange}
                    placeholder="00:1A:79:XX:XX:XX"
                    required
                    maxLength={17}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm font-mono tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500 font-mono">
                  {t('mac_address_hint', lang)}
                </p>
              </div>

              {/* Action Button: 'Fetch & Connect Channels' */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isMacLoading}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
                >
                  {isMacLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{t('fetching', lang)}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>{t('fetch_channels', lang)}</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Authenticated Result & M3U Playlist Download Function */}
            {macResult && (
              <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200/90 shadow-xs space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between gap-2 border-b border-emerald-200/60 pb-3">
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {isHindi
                        ? 'आईपीटीवी सर्वर से सफलतापूर्वक ऑथेंटिकेट हुआ!'
                        : 'Authenticated Successfully with IPTV Server!'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-white text-emerald-800 font-mono font-bold border border-emerald-200 shadow-2xs">
                      {macResult.authMethod}
                    </span>
                    <button
                      type="button"
                      onClick={handleResetMacUrl}
                      className="text-[11px] px-2.5 py-1 rounded-md bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                      title={t('delete', lang)}
                    >
                      <Trash2 className="w-3 h-3 text-rose-600" />
                      <span>{t('delete', lang)}</span>
                    </button>
                  </div>
                </div>

                {/* Stats Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <span className="text-slate-500 block text-[11px] font-semibold">
                      {t('total_channels', lang)}
                    </span>
                    <strong className="text-emerald-700 text-lg font-bold font-mono">
                      {macResult.totalChannels}
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <span className="text-slate-500 block text-[11px] font-semibold">
                      {t('all_categories', lang)}
                    </span>
                    <strong className="text-slate-900 text-lg font-bold font-mono">
                      {macResult.totalCategories}
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
                    <span className="text-slate-500 block text-[11px] font-semibold">MAC</span>
                    <strong className="text-indigo-700 font-mono text-xs truncate block font-bold">
                      {macResult.macAddress}
                    </strong>
                  </div>
                </div>

                {/* Channels Preview */}
                {macResult.channels.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                      {t('channels', lang)} ({macResult.channels.length}):
                    </label>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-xs">
                      {macResult.channels.slice(0, 5).map((ch, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-mono text-slate-400 w-5 font-semibold">
                              {idx + 1}.
                            </span>
                            <span className="font-semibold text-slate-800 truncate">
                              {ch.name}
                            </span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 shrink-0 font-bold border border-indigo-100">
                            {ch.category_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Primary Download M3U Function & In-App View */}
                <div className="pt-1 flex flex-col sm:flex-row items-stretch gap-2">
                  {/* Manual Download M3U Playlist Button */}
                  <button
                    type="button"
                    onClick={handleDownloadM3u}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer active:scale-[0.99]"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t('download_m3u', lang)}</span>
                  </button>

                  {/* Open & Play inside Dashboard */}
                  {onMacLogin && (
                    <button
                      type="button"
                      onClick={handleOpenInDashboard}
                      className="py-2.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-indigo-600/20"
                      title={t('open_dashboard', lang)}
                    >
                      <Tv className="w-4 h-4" />
                      <span>{t('open_dashboard', lang)}</span>
                    </button>
                  )}

                  {/* Copy M3U content */}
                  <button
                    type="button"
                    onClick={handleCopyM3u}
                    className="py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    title={t('copy_m3u', lang)}
                  >
                    {copiedM3u ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                    <span>{copiedM3u ? t('copied', lang) : t('copy', lang)}</span>
                  </button>

                  {/* Delete / Reset M3U Playlist Button */}
                  <button
                    type="button"
                    onClick={handleResetMacUrl}
                    className="py-2.5 px-3 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    title={t('delete', lang)}
                  >
                    <Trash2 className="w-3 h-4 text-rose-600" />
                    <span>{t('delete', lang)}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* SECTION 2: XTREAM CODES API (Standard Login)             */}
        {/* ======================================================== */}
        {activeTab === 'xtream' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-start gap-3 shadow-2xs">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">{error}</p>
                </div>
              </div>
            )}

            {/* Desktop 'Loaded URL' Section */}
            {(loadedUrl || recents.length > 0) && (
              <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      {t('loaded_url', lang)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {(loadedUrl
                    ? [{ serverUrl: loadedUrl, username: '', lastUsed: 'Active' }, ...recents.filter((r) => r.serverUrl !== loadedUrl)]
                    : recents
                  )
                    .slice(0, 3)
                    .map((r, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs"
                      >
                        <div
                          onClick={() => {
                            setServerUrl(r.serverUrl);
                            if (r.username) setUsername(r.username);
                          }}
                          className="min-w-0 flex-1 cursor-pointer group"
                          title={r.serverUrl}
                        >
                          <p className="font-mono text-indigo-700 font-semibold group-hover:text-indigo-900 truncate">
                            {r.serverUrl}
                          </p>
                          {r.username && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              User: {r.username}
                            </p>
                          )}
                        </div>

                        {/* Delete option right next to Loaded URL */}
                        <button
                          type="button"
                          onClick={() => deleteRecentUrl(r.serverUrl)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 rounded-md transition-colors cursor-pointer text-xs shrink-0 font-bold shadow-2xs"
                          title={t('delete_url', lang)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>{t('delete', lang)}</span>
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <form onSubmit={handleXtreamSubmit} className="space-y-4">
              {/* Stream API URL */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  {t('server_url', lang)}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Server className="w-4 h-4 text-indigo-600" />
                  </div>
                  <input
                    id="xtream-server-url-input"
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="http://server-domain.com:8080"
                    required
                    className={`w-full pl-10 pr-4 py-2.5 bg-slate-50/70 border ${
                      isXtreamHighlighted
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20'
                        : 'border-slate-200'
                    } rounded-lg text-slate-900 placeholder-slate-400 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition-all`}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {lang === 'en' ? 'E.g., http://iptv-server.com:8080 or https://myiptv.net' : 'उदा: http://iptv-server.com:8080 या https://myiptv.net'}
                </p>
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  {t('username', lang)}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4 text-indigo-600" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter Username"
                    required
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  {t('password', lang)}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4 text-indigo-600" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter Password"
                    required
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Primary Action Buttons: Direct Download Playlist + Connect */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleXtreamDownloadClick}
                  disabled={isLoading || !isXtreamReady}
                  className="w-full sm:flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-xl shadow-sm shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]"
                  title={isHindi ? 'सीधे प्लेलिस्ट डाउनलोड सेक्शन में जाएँ' : 'Go directly to Playlist Download'}
                >
                  <Download className="w-4 h-4 text-emerald-200 shrink-0" />
                  <span>{isHindi ? 'डाउनलोड प्लेलिस्ट (Download M3U)' : 'Download Playlist (M3U)'}</span>
                </button>

                <button
                  type="submit"
                  disabled={isLoading || !isXtreamReady}
                  className="w-full sm:flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-xl shadow-sm shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{isHindi ? 'कनेक्ट हो रहा है...' : 'Connecting Stream...'}</span>
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-5 h-5 text-indigo-200 shrink-0" />
                      <span>{isHindi ? 'Connect Stream (कनेक्ट करें)' : 'Connect Stream'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Instant Xtream Codes M3U Playlist & Direct Download Card */}
            {isXtreamReady && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 border-2 border-emerald-400 shadow-xs space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between gap-2 border-b border-emerald-200/80 pb-2.5">
                  <div className="flex items-center gap-2 text-emerald-950 text-xs sm:text-sm font-black">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {isHindi ? 'Xtream Codes M3U प्लेलिस्ट तैयार है!' : 'Xtream Codes M3U Playlist Ready!'}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                    M3U & M3U8
                  </span>
                </div>

                {/* Direct M3U URL preview box with Copy */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>{isHindi ? 'डायरेक्ट M3U प्लेलिस्ट URL:' : 'Direct M3U Playlist Link:'}</span>
                    <span className="text-[10px] font-semibold text-emerald-700">
                      {isHindi ? 'TiviMate / VLC / Smarters में लोड करें' : 'For TiviMate / VLC / Smarters'}
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={directXtreamM3uPlus}
                      className="flex-1 font-mono text-xs bg-white border border-emerald-300 rounded-lg px-3 py-2 text-emerald-900 select-all shadow-2xs focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyXtreamM3u(directXtreamM3uPlus)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
                      title={isHindi ? 'M3U लिंक कॉपी करें' : 'Copy M3U Link'}
                    >
                      {copiedXtreamUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedXtreamUrl ? (isHindi ? 'कॉपी!' : 'Copied!') : (isHindi ? 'कॉपी' : 'Copy')}</span>
                    </button>
                  </div>
                </div>

                {/* Instant Download Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleDownloadXtreamDirect('m3u_plus')}
                    disabled={isXtreamDownloading !== null}
                    className="py-2.5 px-3 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 hover:border-emerald-400 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Download className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      {isXtreamDownloading === 'm3u_plus'
                        ? (isHindi ? 'डाउनलोड हो रहा है...' : 'Downloading...')
                        : downloadedXtreamFormat === 'm3u_plus'
                        ? (isHindi ? '✓ डाउनलोड सफल!' : '✓ Downloaded!')
                        : (isHindi ? 'डाउनलोड M3U Plus (.m3u8)' : 'Download M3U Plus (.m3u8)')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadXtreamDirect('m3u')}
                    disabled={isXtreamDownloading !== null}
                    className="py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 hover:border-slate-400 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Download className="w-4 h-4 text-slate-600 shrink-0" />
                    <span className="truncate">
                      {isXtreamDownloading === 'm3u'
                        ? (isHindi ? 'डाउनलोड हो रहा है...' : 'Downloading...')
                        : downloadedXtreamFormat === 'm3u'
                        ? (isHindi ? '✓ डाउनलोड सफल!' : '✓ Downloaded!')
                        : (isHindi ? 'डाउनलोड स्टैंडर्ड M3U (.m3u)' : 'Download Standard M3U (.m3u)')}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* SECTION 3: RANGE URL & M3U PLAYLIST GENERATOR            */}
        {/* ======================================================== */}
        {activeTab === 'range' && (
          <div className="animate-in fade-in duration-200">
            <RangeUrlGenerator
              lang={lang}
              onPlayChannel={onPlayChannel}
            />
          </div>
        )}

        {/* ======================================================== */}
        {/* SECTION 4: LINK MASTER (M3U Encrypted Stream Aliases)    */}
        {/* ======================================================== */}
        {activeTab === 'linkmaster' && (
          <div className="animate-in fade-in duration-200">
            <LinkMasterModal
              isStandalonePage={true}
              lang={lang}
              onPlayChannel={onPlayChannel}
              onLoadToApp={onLoadChannelsToApp}
            />
          </div>
        )}
          </>
        )}
      </div>

      {/* Help & Information Toggle */}
      {!isXtreamGenerated && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            <span>{isHindi ? 'Xtream Codes और MAC Stalker पोर्टल में क्या अंतर है?' : 'What is Xtream Codes & MAC Stalker Portal?'}</span>
          </button>

          {showHelp && (
            <div className="mt-3 p-4 bg-white border border-slate-200 rounded-xl text-left text-xs text-slate-600 leading-relaxed space-y-2 shadow-sm">
              <p className="font-bold text-indigo-700">
                {isHindi ? 'IPTV क्रेडेंशियल प्रोटोकॉल गाइड:' : 'IPTV Protocols Guide:'}
              </p>
              <p>
                {isHindi
                  ? '1. Xtream Codes API: सर्वर URL, यूजरनेम और पासवर्ड से जुड़ता है। 2. MAC URL / Stalker Portal: केवल आपके डिवाइस के MAC एड्रेस (00:1A:79:XX:XX:XX) और पोर्टल URL से सर्वर पर हैंडशेक करके पूरी चैनल लिस्ट व स्ट्रीम URL प्राप्त करता है।'
                  : '1. Xtream Codes API connects using Server URL, Username, and Password. 2. MAC URL / Stalker Portal handshakes directly using your hardware MAC address (00:1A:79:XX:XX:XX) and Portal URL to fetch all live stream channels.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
