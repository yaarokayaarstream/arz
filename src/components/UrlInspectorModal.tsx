import React, { useState } from 'react';
import {
  X,
  ScanSearch,
  Search,
  Calendar,
  Clock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Globe,
  Server,
  User,
  Key,
  Cpu,
  Copy,
  Check,
  Play,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { inspectStreamUrl, UrlInspectionResult } from '../services/urlInspectorService';
import { Language, StreamChannel } from '../types';

interface UrlInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onPlayChannel?: (channel: StreamChannel) => void;
}

export const UrlInspectorModal: React.FC<UrlInspectorModalProps> = ({
  isOpen,
  onClose,
  lang,
  onPlayChannel,
}) => {
  const isHindi = lang === 'hi';

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [inputUrl, setInputUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UrlInspectionResult | null>(null);

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedAgent, setCopiedAgent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleInspect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputUrl.trim()) {
      setError(isHindi ? 'कृपया एक मान्य स्ट्रीम URL दर्ज करें।' : 'Please enter a valid stream URL.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await inspectStreamUrl(inputUrl.trim());
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Inspection failed. Please check the URL.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setInputUrl('');
    setResult(null);
    setError(null);
    setCopiedUrl(false);
    setCopiedAgent(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleLoadSample = (sampleType: 'xtream' | 'hls') => {
    if (sampleType === 'xtream') {
      setInputUrl('http://mag.ott-universe.com:8080/live/user786/securePass99/44120.ts');
    } else {
      setInputUrl('https://live-stream-gateway.net:8443/hls/premium_stream.m3u8?exp=1795000000&created=1730450000&token=ak_9a8fbc12e');
    }
    setError(null);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputUrl(text.trim());
        setError(null);
      }
    } catch {
      // ignore
    }
  };

  const handleCopy = (text: string, type: 'url' | 'agent') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedAgent(true);
      setTimeout(() => setCopiedAgent(false), 2000);
    }
  };

  const handlePlayStream = () => {
    if (!result || !onPlayChannel) return;
    const channel: StreamChannel = {
      num: 1,
      name: `${result.streamType} (${result.domain})`,
      stream_type: 'live',
      stream_id: result.streamId ? parseInt(result.streamId, 10) || 1 : 1,
      stream_icon: '',
      epg_channel_id: '',
      added: '',
      category_id: '1',
      custom_sid: '',
      direct_source: result.cleanUrl,
    };
    onPlayChannel(channel);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-purple-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 shrink-0">
              <ScanSearch className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {isHindi ? 'URL Inspector (स्ट्रीम इंस्पेक्टर)' : 'URL Inspector'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                  Audit Tool
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isHindi
                  ? 'स्ट्रीम URL डालें और निर्माण तिथि, एक्सपायरी स्थिति, यूज़र एजेंट और विवरण जांचें'
                  : 'Inspect creation date, expiration status, user agent, and stream parameters'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* URL Input Form */}
          <form onSubmit={handleInspect} className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <label htmlFor="url-inspector-input" className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-purple-600" />
                <span>{isHindi ? 'स्ट्रीम URL दर्ज करें:' : 'Enter Stream URL:'}</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  {isHindi ? '📋 क्लिपबोर्ड से पेस्ट करें' : '📋 Paste from Clipboard'}
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => handleLoadSample('xtream')}
                  className="text-[11px] text-purple-600 hover:text-purple-800 font-semibold cursor-pointer"
                >
                  {isHindi ? 'नमूना Xtream' : 'Sample Xtream'}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  id="url-inspector-input"
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="http://server.com:8080/live/user/pass/123.ts or https://domain.com/stream.m3u8"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all shadow-2xs"
                />
                {inputUrl && (
                  <button
                    type="button"
                    onClick={() => setInputUrl('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Details Action Button */}
              <button
                type="submit"
                disabled={isLoading || !inputUrl.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shrink-0"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{isHindi ? 'जांच हो रही है...' : 'Inspecting...'}</span>
                  </>
                ) : (
                  <>
                    <ScanSearch className="w-4 h-4 text-purple-200" />
                    <span>{isHindi ? 'Details (विवरण देखें)' : 'Details'}</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 shadow-2xs animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </form>

          {/* Inspection Results Section */}
          {result && (
            <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
              {/* Top Reset Action Bar: Prominent Reset button at the very top of loaded details */}
              <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-rose-50 via-purple-50/40 to-slate-50 border border-rose-200/90 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0 shadow-2xs">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span>{isHindi ? 'यूआरएल विवरण प्रदर्शित है' : 'URL Details Loaded'}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                    </p>
                    <p className="text-[11px] text-slate-500 truncate max-w-xs sm:max-w-md font-mono">
                      {result.cleanUrl}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/25 transition-all cursor-pointer active:scale-95 shrink-0"
                  title={isHindi ? 'सभी डिटेल्स रीसेट करें और नया URL डालें' : 'Reset all details and enter another URL'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isHindi ? 'Reset (रीसेट करें)' : 'Reset'}</span>
                </button>
              </div>

              {/* Status Banner */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                      result.expirationStatus === 'Active'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : result.expirationStatus === 'Expiring Soon'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : result.expirationStatus === 'Expired'
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                    }`}
                  >
                    {result.expirationStatus === 'Active' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    {result.expirationStatus === 'Expiring Soon' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                    {result.expirationStatus === 'Expired' && <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />}
                    <span>{result.expirationStatus}</span>
                  </span>

                  <span className="text-xs font-bold text-slate-700">
                    {result.streamType} · <span className="font-mono text-purple-700">{result.streamFormat.toUpperCase()}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {onPlayChannel && (
                    <button
                      type="button"
                      onClick={handlePlayStream}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isHindi ? 'प्लेयर में चलाएं' : 'Play Stream'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopy(result.cleanUrl, 'url')}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                    title="Copy Stream URL"
                  >
                    {copiedUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                    <span>{copiedUrl ? (isHindi ? 'कॉपी!' : 'Copied!') : (isHindi ? 'URL कॉपी' : 'Copy URL')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-2.5 py-1 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 hover:text-rose-800 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                    title={isHindi ? 'रीसेट करें' : 'Reset'}
                  >
                    <RotateCcw className="w-3 h-3 text-rose-600" />
                    <span>{isHindi ? 'रीसेट' : 'Reset'}</span>
                  </button>
                </div>
              </div>

              {/* 4 Primary Highlight Boxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Creation Date */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {isHindi ? 'निर्माण तिथि' : 'Creation Date'}
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Calendar className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs sm:text-[13px] font-black text-slate-900 truncate">
                      {result.creationDate || (isHindi ? 'सत्र में पहचानी गई' : 'Session Detected')}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                      {result.creationTimestamp ? `Epoch: ${result.creationTimestamp}` : 'Verified Timestamp'}
                    </p>
                  </div>
                </div>

                {/* 2. Expiration Status & Countdown */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {isHindi ? 'एक्सपायरी स्थिति' : 'Expiration Date'}
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs sm:text-[13px] font-black text-slate-900 truncate">
                      {result.expirationDate || (isHindi ? 'लाइफटाइम / असीमित' : 'Lifetime / No Expiry')}
                    </div>
                    <p className="text-[10px] text-emerald-700 font-bold mt-0.5">
                      {result.daysRemaining !== undefined
                        ? isHindi
                          ? `${result.daysRemaining} दिन बाकी (${result.hoursRemaining} घंटे)`
                          : `${result.daysRemaining} Days Left (${result.hoursRemaining}h)`
                        : isHindi
                        ? 'अनलिमिटेड एक्सेस'
                        : 'Unlimited Access'}
                    </p>
                  </div>
                </div>

                {/* 3. Agent (User Agent) */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {isHindi ? 'यूज़र एजेंट (Agent)' : 'Player Agent'}
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Cpu className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-purple-900 truncate" title={result.detectedCustomAgent || result.recommendedUserAgent}>
                      {result.detectedCustomAgent || result.recommendedUserAgent}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(result.detectedCustomAgent || result.recommendedUserAgent, 'agent')}
                      className="text-[10px] text-purple-700 hover:text-purple-900 font-bold mt-0.5 inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedAgent ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedAgent ? (isHindi ? 'कॉपी हो गया' : 'Copied') : (isHindi ? 'एजेंट कॉपी करें' : 'Copy Agent')}</span>
                    </button>
                  </div>
                </div>

                {/* 4. Server & Protocol */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {isHindi ? 'सर्वर व सुरक्षा' : 'Server & Gateway'}
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                      <Server className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-slate-900 truncate" title={result.domain}>
                      {result.domain}:{result.port}
                    </div>
                    <p className="text-[10px] text-teal-700 font-bold mt-0.5 flex items-center gap-1">
                      {result.isSecure ? <Lock className="w-2.5 h-2.5 text-emerald-600" /> : <Unlock className="w-2.5 h-2.5 text-slate-400" />}
                      <span>{result.isSecure ? 'SSL Encrypted (HTTPS)' : 'Standard HTTP'}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Other Technical Details (अन्य विवरण) */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{isHindi ? 'अन्य तकनीकी विवरण (Technical Details)' : 'Stream & Protocol Details'}</span>
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500 font-mono">
                    {result.protocol.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  {/* Account / Username if detected */}
                  {result.hasCredentials && (
                    <>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-500 block">User Name</span>
                        <span className="font-mono font-bold text-indigo-700 truncate block">{result.username}</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center justify-between">
                          <span>Password</span>
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </span>
                        <span className="font-mono font-bold text-slate-800 truncate block">
                          {showPassword ? result.password : '••••••••'}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Stream ID */}
                  {result.streamId && (
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 block">Stream / Channel ID</span>
                      <span className="font-mono font-bold text-slate-800">{result.streamId}</span>
                    </div>
                  )}

                  {/* Max Connections */}
                  {result.maxConnections !== undefined && (
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 block">Max Connections</span>
                      <span className="font-mono font-bold text-slate-800">{result.maxConnections}</span>
                    </div>
                  )}

                  {/* Active Connections */}
                  {result.activeConnections !== undefined && (
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 block">Active Connections</span>
                      <span className="font-mono font-bold text-emerald-700">{result.activeConnections}</span>
                    </div>
                  )}

                  {/* Server Response Latency */}
                  {result.serverLatencyMs !== null && result.serverLatencyMs !== undefined && (
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 block">Server Latency</span>
                      <span className="font-mono font-bold text-emerald-600">{result.serverLatencyMs} ms</span>
                    </div>
                  )}
                </div>

                {/* Compatible Players Recommendation */}
                <div>
                  <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                    {isHindi ? 'संगत मीडिया प्लेयर्स (Compatible Players):' : 'Compatible Player Applications:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.compatiblePlayers.map((player, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px] font-medium shadow-2xs"
                      >
                        {player}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Query Parameters / Tokens Table if available */}
                {result.rawTokens.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/80">
                    <span className="text-[11px] font-bold text-slate-600 block mb-1">
                      {isHindi ? 'डिटेक्टेड टोकन्स व पैरामीटर्स:' : 'Detected URL Query Parameters & Tokens:'}
                    </span>
                    <div className="max-h-28 overflow-y-auto bg-white rounded-lg border border-slate-200 p-2 font-mono text-[11px] space-y-1">
                      {result.rawTokens.map((tok) => (
                        <div key={tok} className="flex items-center justify-between text-slate-700 border-b border-slate-100 last:border-0 pb-0.5">
                          <span className="font-bold text-purple-700">{tok}:</span>
                          <span className="text-slate-600 truncate max-w-xs">{result.queryParams[tok]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isHindi ? 'नया URL जांचें (Clear)' : 'Clear & Inspect Another'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            {isHindi ? 'बंद करें' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
