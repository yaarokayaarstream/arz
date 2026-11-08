import React, { useState, useEffect } from 'react';
import {
  Server,
  User,
  Lock,
  Eye,
  EyeOff,
  PlayCircle,
  AlertCircle,
  Network,
  Trash2,
  Globe,
  Download,
  CheckCircle2,
  Copy,
  Check,
  Tv,
  Link2,
  ShieldCheck,
} from 'lucide-react';
import { StreamCredentials, Language, StreamChannel, Category, ViewMode } from '../types';
import { authenticateStreamApi } from '../services/api';
import { loadOrFetchCatalog } from '../services/catalogManager';
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
  const [recents, setRecents] = useState<RecentConnection[]>([]);
  const [isXtreamHighlighted, setIsXtreamHighlighted] = useState(false);

  // MAC URL / Stalker Portal form state
  const [macAddress, setMacAddress] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [isMacLoading, setIsMacLoading] = useState(false);
  const [macError, setMacError] = useState<string | null>(null);
  const [macResult, setMacResult] = useState<MacAuthResponse | null>(null);
  const [copiedM3u, setCopiedM3u] = useState(false);

  // Server playlist connection state: fetching status, error, and channel holders
  const [isPlaylistFetched, setIsPlaylistFetched] = useState(false);
  const [isConnectingStream, setIsConnectingStream] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [fetchedStreams, setFetchedStreams] = useState<StreamChannel[]>([]);
  const [fetchedCategories, setFetchedCategories] = useState<Category[]>([]);
  const [fetchedStats, setFetchedStats] = useState<{
    totalChannels: number;
    status?: string;
    serverUrl?: string;
    expDate?: string;
  } | null>(null);

  const isXtreamReady = Boolean(serverUrl.trim() && username.trim() && password.trim());

  useEffect(() => {
    if (loadedUrl) {
      setServerUrl(loadedUrl);
    } else {
      setServerUrl('');
      setUsername('');
      setPassword('');
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
    }
    if (onDeleteLoadedUrl) {
      onDeleteLoadedUrl();
    }
  };

  const handleXtreamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    onClearError();
    setConnectError(null);
    setIsConnectingStream(true);

    const creds: StreamCredentials = {
      serverUrl: serverUrl.trim(),
      username: username.trim(),
      password: password.trim(),
    };

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

    try {
      // 1. Authenticate with server
      const authResult = await authenticateStreamApi(creds);
      const activeCreds = { ...creds, isDemo: authResult.isDemo };

      // 2. Transition immediately to download screen where full playlist fetch and 100% validation will run
      onLogin(activeCreds, 'download');
    } catch (err: any) {
      setConnectError(err.message || (isHindi ? 'स्ट्रीम सर्वर से कनेक्ट नहीं हो सका। कृपया क्रेडेंशियल्स जांचें।' : 'Could not connect to stream server. Please check your credentials.'));
    } finally {
      setIsConnectingStream(false);
    }
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
      {onSelectAction && (
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
            {(error || connectError) && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-start gap-3 shadow-2xs">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">{error || connectError}</p>
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
                    onChange={(e) => {
                      setServerUrl(e.target.value);
                      if (isPlaylistFetched) setIsPlaylistFetched(false);
                      if (connectError) setConnectError(null);
                    }}
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
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (isPlaylistFetched) setIsPlaylistFetched(false);
                      if (connectError) setConnectError(null);
                    }}
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
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (isPlaylistFetched) setIsPlaylistFetched(false);
                      if (connectError) setConnectError(null);
                    }}
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

              {/* Primary Action Button: Connect Stream */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isConnectingStream || isLoading || !isXtreamReady}
                  className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-xl shadow-sm shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]"
                >
                  {isConnectingStream || isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{isHindi ? 'Please Wait (कृपया प्रतीक्षा करें) — प्लेलिस्ट फ़ेच हो रही है...' : 'Please Wait — Connecting & Fetching Full Playlist...'}</span>
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
      </div>
    </div>
  );
};
