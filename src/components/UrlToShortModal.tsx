import React, { useState } from 'react';
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  Trash2,
  RefreshCw,
  Globe,
  Share2,
} from 'lucide-react';
import { Language } from '../types';
import { shortenWithIsGd } from '../services/trackUrlClient';
import { sendUrlGeneratedNotification } from '../services/emailJsService';

interface UrlToShortModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const UrlToShortModal: React.FC<UrlToShortModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  const isHindi = lang === 'hi';

  const [originalUrl, setOriginalUrl] = useState('');
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedHistoryIndex, setCopiedHistoryIndex] = useState<number | null>(null);

  // Local history of shortened links
  const [history, setHistory] = useState<Array<{ originalUrl: string; shortUrl: string; timestamp: number }>>(() => {
    try {
      const saved = localStorage.getItem('yaaro_isgd_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  if (!isOpen) return null;

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUrl = originalUrl.trim();

    if (!cleanUrl) {
      setError(isHindi ? 'कृपया एक वैध मूल (Original) URL दर्ज करें।' : 'Please enter a valid original URL.');
      return;
    }

    let target = cleanUrl;
    if (!/^https?:\/\//i.test(target)) {
      target = 'https://' + target;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Use the is.gd API: https://is.gd/create.php?format=simple&url=[YOUR_LONG_URL]
      const result = await shortenWithIsGd(target);
      setShortUrl(result);

      // Save to history
      const newEntry = { originalUrl: target, shortUrl: result, timestamp: Date.now() };
      const updatedHistory = [newEntry, ...history.filter((h) => h.shortUrl !== result)].slice(0, 15);
      setHistory(updatedHistory);
      try {
        localStorage.setItem('yaaro_isgd_history', JSON.stringify(updatedHistory));
      } catch {
        // ignore storage errors
      }

      // Background notification
      sendUrlGeneratedNotification({
        url: result,
        source: 'URL to Short (is.gd API)',
        details: {
          'Original URL': target,
          'Shortened Link': result,
          'API Endpoint': `https://is.gd/create.php?format=simple&url=${encodeURIComponent(target)}`,
        },
      }).catch(() => {});
    } catch (err: any) {
      setError(
        err?.message ||
          (isHindi
            ? 'is.gd से लिंक छोटा करने में विफलता हुई। कृपया URL जांचें।'
            : 'Failed to shorten URL using is.gd API. Please verify the URL.')
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string, isHistory = false, historyIdx?: number) => {
    navigator.clipboard.writeText(text);
    if (isHistory && historyIdx !== undefined) {
      setCopiedHistoryIndex(historyIdx);
      setTimeout(() => setCopiedHistoryIndex(null), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('yaaro_isgd_history');
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-5 overflow-hidden animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-2xl max-h-[90vh] sm:max-h-[88vh] overflow-hidden flex flex-col my-auto transition-all relative">
        {/* Top Header Bar: Permanently pinned at top, never hidden when scrolling */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-600 to-amber-600 text-white p-4 sm:p-5 shrink-0 sticky top-0 z-30 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner shrink-0">
              <Link2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-extrabold tracking-tight truncate">
                  URL to Short
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white text-orange-900 uppercase tracking-wide shadow-2xs shrink-0">
                  Fast & Free
                </span>
              </div>
              <p className="text-xs text-orange-100 mt-0.5 leading-relaxed truncate sm:whitespace-normal">
                {isHindi
                  ? 'लंबे URL को तुरंत छोटा करें और 1-क्लिक में कॉपी करें।'
                  : 'Enter any long URL to instantly generate and copy a shortened link.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
            title={isHindi ? 'बंद करें (Close)' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-5 overscroll-contain">
          {/* Main Shortener Form */}
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-orange-600" />
                  <span>{isHindi ? 'मूल URL (Original URL) दर्ज करें:' : 'Original URL:'}</span>
                </span>
                {originalUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setOriginalUrl('');
                      setError(null);
                    }}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                  >
                    {isHindi ? 'हटाएं (Clear)' : 'Clear'}
                  </button>
                )}
              </label>

              {/* Input + Generate Button */}
              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                <div className="relative flex-1">
                  <input
                    type="url"
                    required
                    value={originalUrl}
                    onChange={(e) => {
                      setOriginalUrl(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={
                      isHindi
                        ? 'उदा: https://example.com/stream/playlist.m3u8'
                        : 'e.g. https://example.com/stream/playlist.m3u8'
                    }
                    className="w-full pl-3.5 pr-9 py-3 rounded-xl border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-xs sm:text-sm font-medium transition-all shadow-2xs outline-none bg-white text-slate-900 placeholder:text-slate-400"
                  />
                  {originalUrl && (
                    <button
                      type="button"
                      onClick={() => setOriginalUrl('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isGenerating || !originalUrl.trim()}
                  className={`px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-white transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-sm active:scale-[0.98] ${
                    isGenerating || !originalUrl.trim()
                      ? 'bg-orange-300 cursor-not-allowed opacity-80'
                      : 'bg-orange-600 hover:bg-orange-700 hover:shadow-orange-500/25'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>{isHindi ? 'जनरेट हो रहा है...' : 'Generating...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-200" />
                      <span>{isHindi ? 'Generate' : 'Generate'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* SHORTENED LINK DISPLAY (Directly below input field as requested) */}
            {shortUrl && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50/60 via-white to-orange-50/40 border-2 border-orange-500 shadow-md space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-orange-950 uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{isHindi ? 'शॉर्ट किया गया लिंक (Shortened Link):' : 'Shortened Link:'}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    is.gd Verified
                  </span>
                </div>

                {/* Display Field + Copy & Open Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shortUrl}
                    className="flex-1 font-mono text-sm sm:text-base font-bold bg-white border border-orange-300 rounded-xl px-4 py-2.5 text-orange-700 select-all focus:outline-none shadow-2xs"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(shortUrl)}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-200" />
                          <span>{isHindi ? 'कॉपी हो गया!' : 'Copied!'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>{isHindi ? 'Copy' : 'Copy'}</span>
                        </>
                      )}
                    </button>

                    <a
                      href={shortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0"
                      title="Open link"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="hidden sm:inline">{isHindi ? 'खोलें' : 'Open'}</span>
                    </a>

                    <a
                      href={`/masking-url.html?url=${encodeURIComponent(shortUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      title="Open in Masking URL full-screen iframe"
                    >
                      <Share2 className="w-3.5 h-3.5 text-amber-700" />
                      <span className="hidden sm:inline">{isHindi ? 'मास्किंग URL' : 'Mask URL'}</span>
                    </a>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-orange-100">
                  <span className="truncate max-w-[260px] sm:max-w-md">
                    {isHindi ? 'मूल लिंक:' : 'Original:'}{' '}
                    <span className="text-slate-700 font-mono">{originalUrl}</span>
                  </span>
                  <span className="font-semibold text-emerald-600 shrink-0">
                    {isHindi ? 'सक्रिय एवं सुरक्षित' : 'Active & Permanent'}
                  </span>
                </div>
              </div>
            )}
          </form>

          {/* History of Shortened URLs */}
          {history.length > 0 && (
            <div className="space-y-2.5 pt-4 border-t border-slate-200/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{isHindi ? 'हालिया शॉर्ट किए गए लिंक' : 'Recent Shortened Links'}</span>
                </span>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-[10px] font-semibold text-slate-400 hover:text-rose-600 cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{isHindi ? 'इतिहास साफ़ करें' : 'Clear history'}</span>
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {history.map((item, idx) => (
                  <div
                    key={`${item.shortUrl}-${idx}`}
                    className="p-3 bg-slate-50 hover:bg-orange-50/40 rounded-xl border border-slate-200/90 flex items-center justify-between gap-3 text-xs transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-orange-700 hover:underline">
                          {item.shortUrl}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">
                        {item.originalUrl}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(item.shortUrl, true, idx)}
                        className="px-2.5 py-1.5 bg-white hover:bg-orange-100 text-slate-700 hover:text-orange-900 border border-slate-200/80 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedHistoryIndex === idx ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>{isHindi ? 'कॉपी!' : 'Copied!'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{isHindi ? 'Copy' : 'Copy'}</span>
                          </>
                        )}
                      </button>
                      <a
                        href={item.shortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-white hover:bg-slate-200 text-slate-600 border border-slate-200/80 rounded-lg transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info note */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500 shrink-0">
          Powered by <span className="font-bold text-slate-700">Yaaro ka Yaar</span>
        </div>
      </div>
    </div>
  );
};
