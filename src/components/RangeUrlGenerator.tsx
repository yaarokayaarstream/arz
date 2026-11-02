import React, { useState, useEffect, useMemo } from 'react';
import {
  Link2,
  Download,
  Copy,
  Check,
  Play,
  RotateCcw,
  AlertCircle,
  FileText,
  Sliders,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  Trash2,
} from 'lucide-react';
import {
  parseBaseUrlPattern,
  generateRangeUrls,
  downloadM3uFile,
  RangeGenerateResult,
  ParsedPattern,
} from '../services/rangeUrlService';
import { sendUrlGeneratedNotification } from '../services/emailJsService';
import { Language, StreamChannel } from '../types';
import { BrandLogoIcon } from './BrandLogo';

interface RangeUrlGeneratorProps {
  lang: Language;
  onPlayChannel?: (channel: StreamChannel) => void;
  initialBaseUrl?: string;
  isModal?: boolean;
  onClose?: () => void;
}

export const RangeUrlGenerator: React.FC<RangeUrlGeneratorProps> = ({
  lang,
  onPlayChannel,
  initialBaseUrl = '',
  isModal = false,
  onClose,
}) => {
  const isHindi = lang === 'hi';

  const [baseUrl, setBaseUrl] = useState(initialBaseUrl || '');
  const [startRange, setStartRange] = useState('');
  const [endRange, setEndRange] = useState('');
  const [channelPrefix, setChannelPrefix] = useState('Channel');
  const [groupTitle, setGroupTitle] = useState('Generated Streams');
  const [fileName, setFileName] = useState('sequential_playlist.m3u');
  const [preservePadding, setPreservePadding] = useState(true);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copiedM3u, setCopiedM3u] = useState(false);
  const [copiedUrls, setCopiedUrls] = useState(false);
  const [copiedSingleIndex, setCopiedSingleIndex] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<RangeGenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewFilter, setPreviewFilter] = useState('');

  // Live pattern preview
  const livePattern = useMemo<ParsedPattern | null>(() => {
    if (!baseUrl.trim()) return null;
    try {
      return parseBaseUrlPattern(baseUrl);
    } catch {
      return null;
    }
  }, [baseUrl]);

  // When base URL changes, auto-populate initial range if start is empty or matches previous detected
  useEffect(() => {
    if (livePattern && !startRange) {
      setStartRange(livePattern.detectedStart);
      try {
        const val = BigInt(livePattern.detectedStart);
        const pad = livePattern.detectedStart.startsWith('0') ? livePattern.detectedStart.length : 0;
        const endValStr = (val + 24n).toString();
        setEndRange(pad > 0 ? endValStr.padStart(pad, '0') : endValStr);
      } catch {
        // ignore
      }
    }
  }, [livePattern]);

  const handleReset = () => {
    setBaseUrl('');
    setStartRange('');
    setEndRange('');
    setChannelPrefix('Channel');
    setGroupTitle('Generated Streams');
    setFileName('sequential_playlist.m3u');
    setPreservePadding(true);
    setShowAdvanced(false);
    setResult(null);
    setError(null);
    setCopiedM3u(false);
    setCopiedUrls(false);
    setCopiedSingleIndex(null);
    setPreviewFilter('');
  };

  // Main Action: 'Generate URL'
  const handleGenerate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!baseUrl.trim()) {
      setError(isHindi ? 'कृपया बेस यूआरएल (Base URL) दर्ज करें।' : 'Please enter a Base URL.');
      return;
    }
    if (!startRange.trim()) {
      setError(isHindi ? 'कृपया शुरुआती रेंज (Start Range) दर्ज करें।' : 'Please enter the Start Range number.');
      return;
    }
    if (!endRange.trim()) {
      setError(isHindi ? 'कृपया अंतिम रेंज (End Range) दर्ज करें।' : 'Please enter the End Range number.');
      return;
    }

    try {
      setIsGenerating(true);
      const generated = generateRangeUrls({
        baseUrl,
        startRange,
        endRange,
        preservePadding,
        channelPrefix,
        groupTitle,
      });
      setResult(generated);

      // Send EmailJS notification for URL generation
      sendUrlGeneratedNotification({
        url: generated.sampleUrl,
        source: 'Sequential Range URL Generator',
        details: {
          'Base URL': baseUrl,
          'Start Range': generated.startFormatted,
          'End Range': generated.endFormatted,
          'Total URLs Generated': generated.totalCount,
          'File Extension': generated.pattern.extension || 'None',
          'First URL': generated.sampleUrl,
          'Last URL': generated.itemsPreview[generated.itemsPreview.length - 1]?.url || generated.sampleUrl,
        },
      }).catch((e) => console.warn('EmailJS URL generation alert failed:', e));
    } catch (err: any) {
      setError(err.message || 'Generation failed');
      setResult(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadM3u = () => {
    if (!result) return;

    const finalName = fileName.trim() ? fileName.trim() : 'sequential_playlist.m3u';
    downloadM3uFile(result.m3uContent, finalName);
  };

  const handleCopyM3u = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.m3uContent);
    setCopiedM3u(true);
    setTimeout(() => setCopiedM3u(false), 2500);
  };

  const handleCopyRawUrls = () => {
    if (!result) return;
    // Extract only the URLs from m3uContent
    const urlsOnly = result.m3uContent
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#'))
      .join('\n');
    navigator.clipboard.writeText(urlsOnly);
    setCopiedUrls(true);
    setTimeout(() => setCopiedUrls(false), 2500);
  };

  const handleCopySingle = (url: string, index: string) => {
    navigator.clipboard.writeText(url);
    setCopiedSingleIndex(index);
    setTimeout(() => setCopiedSingleIndex(null), 2000);
  };

  const handleTestPlay = (item: { name: string; url: string; index: string }) => {
    if (!onPlayChannel) return;
    const streamChannel: StreamChannel = {
      num: parseInt(item.index, 10) || 1,
      name: item.name,
      stream_type: 'live',
      stream_id: item.index,
      category_id: 'range',
      category_name: groupTitle || 'Generated Streams',
      direct_source: item.url,
    };
    onPlayChannel(streamChannel);
  };

  const containerContent = (
    <div className="space-y-6">
      {/* Header Badge & Title */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full text-indigo-700 text-xs font-bold mb-3 shadow-2xs">
          <Link2 className="w-3.5 h-3.5" />
          <span>{isHindi ? 'रेंज यूआरएल एवं M3U जनरेटर' : 'Sequential Range URL & M3U Generator'}</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 mb-1.5">
          {isHindi ? 'सीरियल स्ट्रीम URL बनाएं व M3U डाउनलोड करें' : 'Generate Sequential Stream URLs & Export M3U'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
          {isHindi
            ? 'बेस यूआरएल दर्ज करें। यदि यूआरएल में फाइल एक्सटेंशन (.ts, .m3u8 आदि) है तो उसके पहले का नंबर बदलेगा, अन्यथा अंतिम संख्या बदलेगी। असीमित बड़े नंबर समर्थित हैं।'
            : 'Enter a base URL. If it ends with an extension (.ts, .m3u8), preceding numbers are replaced; otherwise the last numeric sequence is incremented without limits.'}
        </p>
      </div>

      {/* Main Form */}
      <form onSubmit={handleGenerate} className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
        {/* Form Header with Reset Action */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            {isHindi ? 'स्ट्रीम रेंज कॉन्फ़िगरेशन' : 'Stream Range Configuration'}
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs active:scale-95"
            title={isHindi ? 'सभी इनपुट फ़ील्ड्स और सेटिंग्स रीसेट करें' : 'Reset all inputs and settings'}
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
            <span>{isHindi ? 'रीसेट' : 'Reset'}</span>
          </button>
        </div>
        {/* Field 1: Base URL */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              {isHindi ? '1. बेस यूआरएल (Base URL)' : '1. Base URL'}
              <span className="text-rose-500 ml-1">*</span>
            </label>
            {livePattern && (
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700">
                {livePattern.hasExtension
                  ? `Extension: ${livePattern.extension}`
                  : 'Plain URL (No Ext)'}
              </span>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Link2 className="w-4 h-4 text-indigo-600" />
            </div>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://server.com:8080/live/user/pass/1000.ts"
              required
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
            />
          </div>

          {/* Replacement Logic Visual Feedback */}
          {livePattern ? (
            <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 text-slate-600">
                <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">
                  {livePattern.hasExtension ? (
                    <>
                      {isHindi ? 'एक्सटेंशन के पहले की संख्या' : 'Replacing number before'} <code className="text-indigo-700 font-bold font-mono">{livePattern.extension}</code>: <code className="bg-indigo-100/70 text-indigo-800 px-1 py-0.5 rounded font-mono font-bold">{livePattern.numericPart}</code>
                    </>
                  ) : (
                    <>
                      {isHindi ? 'अंतिम संख्या बदलेगी' : 'Replacing last numeric sequence'}: <code className="bg-indigo-100/70 text-indigo-800 px-1 py-0.5 rounded font-mono font-bold">{livePattern.numericPart}</code>
                    </>
                  )}
                </span>
              </div>
              <span className="text-[10px] text-emerald-700 font-bold shrink-0 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                ✓ Pattern Detected
              </span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              {isHindi
                ? 'उदा: http://domain.com/live/1000.ts या http://server:8080/stream/channel_50'
                : 'E.g., http://domain.com/live/1000.ts or http://server:8080/stream/channel_50'}
            </p>
          )}
        </div>

        {/* Fields 2 & 3: Range Start and Range End (No hard-coded maximum limits!) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Start Range */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
              {isHindi ? '2. शुरुआती नंबर (Start Range)' : '2. Start Range'}
              <span className="text-rose-500 ml-1">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={startRange}
              onChange={(e) => setStartRange(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="e.g. 001 or 0005 or 1000"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
            />
            {startRange.trim().startsWith('0') ? (
              <p className="mt-1 text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                <span>✓</span>
                <span>
                  {isHindi
                    ? `अग्रणी शून्य: ${startRange.trim().length} अंक सुरक्षित (उदा: ${startRange.trim()}...)`
                    : `Leading zeros: ${startRange.trim().length} digits preserved (e.g., ${startRange.trim()}...)`}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">
                {isHindi ? 'सीक्वेंस का पहला नंबर' : 'Starting sequence number'}
              </p>
            )}
          </div>

          {/* End Range */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
              {isHindi ? '3. अंतिम नंबर (End Range)' : '3. End Range'}
              <span className="text-rose-500 ml-1">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={endRange}
              onChange={(e) => setEndRange(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="e.g. 025 or 0030 or 1050"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              {isHindi ? 'सीक्वेंस इस नंबर तक पूरी तरह बनेगी' : 'Sequence will generate completely up to this number'}
            </p>
          </div>
        </div>

        {/* Options & Zero-Padding checkbox */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={preservePadding}
              onChange={(e) => setPreservePadding(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <span>
              {isHindi
                ? 'स्टार्टिंग नंबर के हिसाब से शून्य लगाएं (उदा: 001, 002...)'
                : 'Preserve leading zeros based on starting number (e.g., 001, 002...)'}
            </span>
          </label>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isHindi ? 'M3U प्लेलिस्ट सेटिंग्स' : 'M3U Playlist Options'}</span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Advanced M3U Options */}
        {showAdvanced && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-in fade-in duration-150">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isHindi ? 'चैनल नाम प्रिफिक्स:' : 'Channel Name Prefix:'}
              </label>
              <input
                type="text"
                value={channelPrefix}
                onChange={(e) => setChannelPrefix(e.target.value)}
                placeholder="Channel or Stream"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isHindi ? 'ग्रुप / श्रेणी नाम:' : 'Group / Category Title:'}
              </label>
              <input
                type="text"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="Generated Streams"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isHindi ? 'M3U फ़ाइल का नाम:' : 'M3U File Name:'}
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="playlist.m3u"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium font-mono"
              />
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">{error}</span>
              <p className="text-[11px] text-rose-700">
                {isHindi
                  ? 'कृपया जांचें कि बेस यूआरएल में एक संख्या अनुक्रम मौजूद है और रेंज सही है।'
                  : 'Ensure the Base URL contains numeric sequences and your range numbers are non-negative.'}
              </p>
            </div>
          </div>
        )}

        {/* Primary Action Buttons: 'Generate URL' and 'Reset' */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="submit"
            disabled={isGenerating}
            className="w-full sm:flex-1 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 active:scale-[0.99] text-sm sm:text-base"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{isHindi ? 'URL जनरेट हो रहे हैं...' : 'Generating URLs...'}</span>
              </>
            ) : (
              <>
                <Link2 className="w-5 h-5" />
                <span>Generate URL</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="w-full sm:w-auto py-3.5 px-5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 font-bold rounded-xl transition-all cursor-pointer text-sm sm:text-base flex items-center justify-center gap-2 shadow-2xs active:scale-[0.99]"
            title={isHindi ? 'सभी इनपुट फ़ील्ड्स और सेटिंग्स पूरी तरह से रीसेट करें' : 'Reset all inputs and settings'}
          >
            <RotateCcw className="w-4 h-4 text-rose-600" />
            <span>{isHindi ? 'रीसेट' : 'Reset'}</span>
          </button>
        </div>
      </form>

      {/* Generated Result Section & M3U Playlist Download Functionality */}
      {result && (
        <div className="bg-white border border-emerald-200/90 rounded-2xl p-6 sm:p-7 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.06)] space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Top Success Strip & Sequence Range Verification */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5 text-emerald-800 text-sm font-bold">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-extrabold text-slate-900 block">
                  {isHindi ? 'सीक्वेंस सफलतापूर्वक जनरेट हो गई!' : 'Sequence Generated Successfully!'}
                </span>
                <div className="flex flex-wrap items-center gap-2 text-xs font-normal text-slate-600 font-mono mt-0.5">
                  <span>
                    Total: <strong className="text-slate-900 font-bold">{result.totalCount}</strong> URLs
                  </span>
                  <span>•</span>
                  <span>
                    Sequence: <strong className="text-emerald-700 font-bold">{result.startFormatted}</strong> → <strong className="text-indigo-700 font-bold">{result.endFormatted}</strong>
                  </span>
                  {result.padLen > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                      {isHindi ? `अग्रणी शून्य: ${result.padLen} अंक` : `${result.padLen}-digit padding`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-mono font-bold border border-emerald-200 shadow-2xs">
                {result.pattern.hasExtension ? result.pattern.extension : 'No Ext'}
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] px-2.5 py-1 rounded-md bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                title={isHindi ? 'रेंज यूआरएल और जेनरेटेड प्लेलिस्ट को डिलीट / रीसेट करें' : 'Delete and reset Range URL'}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>{isHindi ? 'डिलीट' : 'Delete'}</span>
              </button>
            </div>
          </div>

          {/* Sequence Start & End Sample Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Start Range Sample */}
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  {isHindi ? '1. पहला यूआरएल (Starting Range):' : '1. Start Range URL:'}
                </span>
                <span className="font-mono text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                  #{result.startFormatted}
                </span>
              </div>
              <div className="font-mono text-emerald-950 font-semibold text-[11px] break-all select-all">
                {result.sampleUrl}
              </div>
            </div>

            {/* End Range Sample */}
            <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                  {isHindi ? '2. अंतिम यूआरएल (End Range तक पूरा):' : '2. End Range URL (Complete):'}
                </span>
                <span className="font-mono text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-300">
                  #{result.endFormatted}
                </span>
              </div>
              <div className="font-mono text-indigo-950 font-semibold text-[11px] break-all select-all">
                {result.itemsPreview[result.itemsPreview.length - 1]?.url || result.sampleUrl}
              </div>
            </div>
          </div>

          {/* Action Buttons: 1. Download .m3u Playlist, 2. Delete / Reset Button, 3. Copy M3U, 4. Copy Plain URLs */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2.5 pt-1">
            {/* Primary Download Button for .m3u */}
            <button
              type="button"
              onClick={handleDownloadM3u}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shadow-emerald-600/20 active:scale-[0.99]"
            >
              <Download className="w-4 h-4" />
              <span>{isHindi ? 'M3U प्लेलिस्ट (.m3u) डाउनलोड करें' : 'Download .m3u Playlist'}</span>
            </button>

            {/* Delete / Reset Range URL Button requested by user */}
            <button
              type="button"
              onClick={handleReset}
              className="py-3 px-4 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-300 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs active:scale-[0.99]"
              title={isHindi ? 'रेंज यूआरएल और जेनरेटेड प्लेलिस्ट को डिलीट / रीसेट करें' : 'Delete & Reset Range URL'}
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>{isHindi ? 'डिलीट (रीसेट)' : 'Delete'}</span>
            </button>

            {/* Copy M3U Text */}
            <button
              type="button"
              onClick={handleCopyM3u}
              className="py-3 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Copy full M3U playlist text"
            >
              {copiedM3u ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span>{copiedM3u ? (isHindi ? 'कॉपी हुआ!' : 'Copied!') : (isHindi ? 'M3U कॉपी' : 'Copy M3U')}</span>
            </button>

            {/* Copy Plain URLs */}
            <button
              type="button"
              onClick={handleCopyRawUrls}
              className="py-3 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Copy plain URLs list"
            >
              {copiedUrls ? <Check className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4 text-slate-500" />}
              <span>{copiedUrls ? (isHindi ? 'URLs कॉपी!' : 'URLs Copied!') : (isHindi ? 'लिंक कॉपी' : 'Copy URLs')}</span>
            </button>
          </div>

          {/* Interactive Preview of Generated URLs */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                {isHindi ? 'जनरेट किए गए लिंक (अनुक्रम सूची):' : 'Generated Stream URLs Sequence:'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={previewFilter}
                  onChange={(e) => setPreviewFilter(e.target.value)}
                  placeholder={isHindi ? 'नंबर या लिंक खोजें...' : 'Filter number or URL...'}
                  className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono w-40"
                />
                <span className="text-[11px] text-slate-500 font-mono shrink-0">
                  {result.itemsPreview.length} of {result.totalCount}
                </span>
              </div>
            </div>

            {result.allItemsCount > 500 && (
              <p className="text-[11px] text-slate-500 mb-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                {isHindi
                  ? `नोट: प्रीव्यू में पहले 100 और अंतिम 100 लिंक दिखाए जा रहे हैं। M3U डाउनलोड और कॉपी में सभी ${result.totalCount} लिंक पूर्ण रूप से मौजूद हैं।`
                  : `Note: Preview displays the first 100 & last 100 URLs. The downloaded .m3u and copied list contain all ${result.totalCount} URLs completely.`}
              </p>
            )}

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {result.itemsPreview
                .filter((item) => {
                  if (!previewFilter.trim()) return true;
                  const q = previewFilter.trim().toLowerCase();
                  return (
                    item.numStr.toLowerCase().includes(q) ||
                    item.name.toLowerCase().includes(q) ||
                    item.url.toLowerCase().includes(q)
                  );
                })
                .map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200 flex items-center justify-between gap-3 shadow-2xs hover:bg-white transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[11px] font-mono text-slate-400 w-7 font-semibold">
                        #{item.index}
                      </span>
                      <span className="text-[11px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 shrink-0">
                        {item.numStr}
                      </span>
                      {item.index === '1' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                          Start
                        </span>
                      )}
                      {item.index === result.totalCount && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 shrink-0">
                          End
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{item.name}</p>
                        <p className="font-mono text-slate-500 text-[11px] truncate">{item.url}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onPlayChannel && (
                        <button
                          type="button"
                          onClick={() => handleTestPlay(item)}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg transition-colors cursor-pointer"
                          title={isHindi ? 'इस स्ट्रीम को चलाएं' : 'Test Play Stream'}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopySingle(item.url, item.index)}
                        className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                        title={isHindi ? 'यूआरएल कॉपी करें' : 'Copy URL'}
                      >
                        {copiedSingleIndex === item.index ? (
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

  if (isModal) {
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
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700">
                    Range URL Generator
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  {isHindi
                    ? 'सीरियल लिंक जनरेट करें और M3U प्लेलिस्ट डाउनलोड करें'
                    : 'Generate sequential URLs & download .m3u playlist'}
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
          <div className="p-6 overflow-y-auto">{containerContent}</div>
        </div>
      </div>
    );
  }

  return <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10">{containerContent}</div>;
};
