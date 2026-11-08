import React, { useState } from 'react';
import {
  Globe,
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
  Share2,
  ShieldCheck,
  Maximize2,
} from 'lucide-react';
import { Language } from '../types';
import { apiUrl, getApiBaseUrl, CLOUD_RUN_API_BASE } from '../services/apiConfig';

interface MaskingUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const MaskingUrlModal: React.FC<MaskingUrlModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  const isHindi = lang === 'hi';

  const [inputUrl, setInputUrl] = useState('');
  const [generatedMaskedUrl, setGeneratedMaskedUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [useProxy, setUseProxy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedHistoryIndex, setCopiedHistoryIndex] = useState<number | null>(null);

  const [tinysrcShortUrl, setTinysrcShortUrl] = useState<string | null>(null);
  const [copiedTinysrc, setCopiedTinysrc] = useState(false);

  // History of generated masking URLs
  const [history, setHistory] = useState<Array<{ originalUrl: string; maskedUrl: string; tinysrcUrl?: string; timestamp: number }>>(() => {
    try {
      const saved = localStorage.getItem('yaaro_masked_urls_history');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  if (!isOpen) return null;

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputUrl.trim();

    if (!clean) {
      setError(isHindi ? 'कृपया एक वैध शॉर्ट या टारगेट URL दर्ज करें।' : 'Please enter a valid short or destination URL.');
      return;
    }

    let target = clean;
    if (!/^https?:\/\//i.test(target)) {
      target = 'https://' + target;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Call URL masking endpoint to create a true non-redirecting cloaked link
      let maskedUrl = '';
      let externalTiny = '';

      try {
        const res = await fetch(apiUrl('/api/urlshield/mask-url'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: target, useProxy }),
        });
        const data = await res.json();
        if (res.ok && data?.success) {
          maskedUrl = data.maskedUrl; // In-app Non-Redirecting URL (.../tinysrc/go/ts_...)
          externalTiny = data.tinysrcUrl || '';
        }
      } catch {
        // Fallback to client-side path generation
      }

      const isStaticPlatform =
        typeof window !== 'undefined' &&
        (window.location.hostname.includes('github.io') ||
          window.location.hostname.includes('pages.dev') ||
          window.location.hostname.includes('netlify.app') ||
          window.location.hostname.includes('vercel.app') ||
          window.location.protocol === 'file:');

      const basePath = typeof window !== 'undefined' ? window.location.pathname.replace(/\/+$/, '') : '';
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const localMaskedUrl = `${origin}${basePath}/masking-url.html?url=${encodeURIComponent(target)}${useProxy ? '&proxy=1' : ''}`;

      // On GitHub Pages or static platforms, always use the clean in-app masking page on current domain
      if (isStaticPlatform || !maskedUrl) {
        maskedUrl = localMaskedUrl;
        externalTiny = '';
      }

      setGeneratedMaskedUrl(maskedUrl);
      setTinysrcShortUrl(externalTiny || null);

      // Save to history
      const newEntry = { originalUrl: target, maskedUrl, tinysrcUrl: externalTiny, timestamp: Date.now() };
      const updated = [newEntry, ...history.filter((h) => h.originalUrl !== target)].slice(0, 15);
      setHistory(updated);
      try {
        localStorage.setItem('yaaro_masked_urls_history', JSON.stringify(updated));
      } catch {}
    } catch (err: any) {
      setError(err?.message || (isHindi ? 'मास्किंग URL जनरेट करने में त्रुटि हुई।' : 'Failed to generate masking URL.'));
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
      localStorage.removeItem('yaaro_masked_urls_history');
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-5 overflow-hidden animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-2xl max-h-[90vh] sm:max-h-[88vh] overflow-hidden flex flex-col my-auto transition-all relative">
        {/* Top Header Bar: Permanently pinned at top, never hidden when scrolling */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white p-4 sm:p-5 shrink-0 sticky top-0 z-30 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner shrink-0">
              <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-extrabold tracking-tight truncate">
                  Yaaro ka Yaar Masker
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white text-emerald-950 uppercase tracking-wide shadow-2xs shrink-0">
                  Yaaro ka Yaar
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5 leading-relaxed truncate sm:whitespace-normal">
                {isHindi
                  ? 'ब्राउज़र के एड्रेस बार में सिर्फ Yaaro ka Yaar यूआरएल दिखेगा और ओरिजिनल लिंक हाइड रहेगा।'
                  : 'Display only the Yaaro ka Yaar URL in the browser bar, keeping original link hidden.'}
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
          {/* Main Input & Generate Form */}
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isHindi ? 'शॉर्ट URL दर्ज करें (Enter Short / Target URL):' : 'Enter Short / Destination URL:'}</span>
                </span>
                {inputUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputUrl('');
                      setError(null);
                    }}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                  >
                    {isHindi ? 'हटाएं (Clear)' : 'Clear'}
                  </button>
                )}
              </label>

              {/* Input Field + Generate Button */}
              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    required
                    value={inputUrl}
                    onChange={(e) => {
                      setInputUrl(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={
                      isHindi
                        ? 'उदा: https://stream.example.com या कोई भी URL'
                        : 'e.g. https://stream.example.com or any destination link'
                    }
                    className="w-full pl-3.5 pr-9 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-xs sm:text-sm font-medium transition-all shadow-2xs outline-none bg-white text-slate-900 placeholder:text-slate-400"
                  />
                  {inputUrl && (
                    <button
                      type="button"
                      onClick={() => setInputUrl('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isGenerating || !inputUrl.trim()}
                  className={`px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-white transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-sm active:scale-[0.98] ${
                    isGenerating || !inputUrl.trim()
                      ? 'bg-emerald-300 cursor-not-allowed opacity-80'
                      : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-500/25'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>{isHindi ? 'जनरेट हो रहा है...' : 'Generating...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-emerald-200" />
                      <span>{isHindi ? 'Generate Masking URL' : 'Generate Masking URL'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Optional Cloaking Proxy Switch */}
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="modalChkProxy"
                  checked={useProxy}
                  onChange={(e) => setUseProxy(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="modalChkProxy" className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
                  {isHindi
                    ? 'सर्वर-साइड प्रॉक्सी का उपयोग करें (X-Frame प्रतिबंध बाईपास करें)'
                    : 'Use Server-Side Cloaking Proxy (Bypasses iframe security headers)'}
                </label>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* GENERATED MASKING URL DISPLAY BOX (with Copy & Preview) */}
            {generatedMaskedUrl && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 border-2 border-emerald-500 shadow-md space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{isHindi ? 'जेनरेट किया गया मास्किंग URL:' : 'Generated Masking URL:'}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                    <span>🔒</span>
                    <span>{isHindi ? 'Zero Redirect (एड्रेस बार में फिक्स)' : 'Zero Redirect (Locked Bar)'}</span>
                  </span>
                </div>

                {/* Masked Link Display + Copy + Preview Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedMaskedUrl}
                    className="flex-1 font-mono text-xs sm:text-sm font-bold bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-emerald-800 select-all focus:outline-none shadow-2xs"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedMaskedUrl)}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-white" />
                          <span>{isHindi ? 'कॉपी हो गया!' : 'Copied!'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>{isHindi ? 'Copy Link' : 'Copy Link'}</span>
                        </>
                      )}
                    </button>

                    <a
                      href={generatedMaskedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
                      title={isHindi ? 'ब्राउज़र में खोलें (Zero Redirect - एड्रेस बार में मास्किंग लिंक ही रहेगा)' : 'Open in browser (Zero redirect - address bar stays masked)'}
                    >
                      <Maximize2 className="w-4 h-4 text-emerald-400" />
                      <span>{isHindi ? 'सीधे खोलें' : 'Open Direct'}</span>
                    </a>
                  </div>
                </div>

                {/* Optional External TinySRC shortlink if available */}
                {tinysrcShortUrl && tinysrcShortUrl !== generatedMaskedUrl && (
                  <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-200/90 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                        TinySRC Shortlink (tinysrc.me):
                      </span>
                      <span className="font-mono text-emerald-800 truncate block font-semibold text-[11px]">
                        {tinysrcShortUrl}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(tinysrcShortUrl);
                        setCopiedTinysrc(true);
                        setTimeout(() => setCopiedTinysrc(false), 2000);
                      }}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold shrink-0 transition-colors cursor-pointer"
                    >
                      {copiedTinysrc ? (isHindi ? 'कॉपी!' : 'Copied!') : (isHindi ? 'Copy' : 'Copy')}
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-emerald-100 gap-1.5">
                  <span className="truncate max-w-[280px] sm:max-w-md">
                    {isHindi ? 'टारगेट URL:' : 'Target URL:'}{' '}
                    <span className="text-slate-800 font-mono font-medium">{inputUrl}</span>
                  </span>
                  <span className="font-semibold text-emerald-700 shrink-0 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isHindi ? 'सुरक्षित मास्क्ड लिंक' : 'Secure Masked Link'}</span>
                  </span>
                </div>
              </div>
            )}
          </form>

          {/* Quick Help Tip */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isHindi ? 'मास्किंग URL की गारंटी (No Redirect Guarantee):' : 'Zero Redirect Guarantee:'}</span>
            </div>
            <p>
              {isHindi
                ? 'यह मास्किंग URL ब्राउज़र में खोलने पर कभी ओरिजिनल URL पर रीडायरेक्ट नहीं होता है। ब्राउज़र के एड्रेस बार में हमेशा यही मास्किंग लिंक दिखाई देता है और ओरिजिनल लिंक पूरी तरह गुप्त (100% hidden) रहता है।'
                : 'This masking URL NEVER redirects to the original destination in the browser. The browser address bar remains permanently locked on this masking URL, keeping your original destination 100% hidden.'}
            </p>
          </div>

          {/* History of Generated Masking URLs */}
          {history.length > 0 && (
            <div className="space-y-2.5 pt-4 border-t border-slate-200/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{isHindi ? 'हालिया जनरेट किए गए मास्किंग लिंक्स' : 'Recent Masked Links'}</span>
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
                    key={`${item.maskedUrl}-${idx}`}
                    className="p-3 bg-slate-50 hover:bg-emerald-50/40 rounded-xl border border-slate-200/90 flex items-center justify-between gap-3 text-xs transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-700 truncate max-w-[240px] sm:max-w-xs">
                          {item.maskedUrl}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
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
                        onClick={() => handleCopy(item.maskedUrl, true, idx)}
                        className="px-2.5 py-1.5 bg-white hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 border border-slate-200/80 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
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
                        href={item.maskedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-white hover:bg-slate-200 text-slate-600 border border-slate-200/80 rounded-lg transition-colors cursor-pointer"
                        title="Preview"
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
