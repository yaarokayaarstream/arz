import React, { useState } from 'react';
import {
  X,
  Network,
  Download,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  ListVideo,
  Globe,
  Tv,
  Trash2,
} from 'lucide-react';
import { Language, StreamChannel, Category } from '../types';
import { authenticateMacPortal, downloadM3uFile, MacAuthResponse } from '../services/macPortalService';
import { BrandLogoIcon } from './BrandLogo';

interface MacPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onMacLogin?: (macResult: {
    macAddress: string;
    portalUrl: string;
    channels: StreamChannel[];
    categories: Category[];
  }) => void;
}

export const MacPortalModal: React.FC<MacPortalModalProps> = ({
  isOpen,
  onClose,
  lang,
  onMacLogin,
}) => {
  const isHindi = lang === 'hi';

  const [macAddress, setMacAddress] = useState('');
  const [portalUrl, setPortalUrl] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MacAuthResponse | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Format MAC address input automatically (adds colon after every 2 characters)
  const handleMacChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '');
    if (raw.length > 12) raw = raw.slice(0, 12);
    const parts = raw.match(/.{1,2}/g) || [];
    setMacAddress(parts.join(':'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!macAddress.trim() || !portalUrl.trim()) {
      setError(
        isHindi
          ? 'कृपया एक वैध MAC एड्रेस और पोर्टल यूआरएल दर्ज करें।'
          : 'Please enter a valid MAC address and Portal URL.'
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const data = await authenticateMacPortal(macAddress, portalUrl);
      setResult(data);
      // Automatic download disabled: playlist is downloaded only upon clicking the manual download button
    } catch (err: any) {
      setError(err.message || 'Error authenticating with MAC portal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadM3u = () => {
    if (!result?.m3uContent) return;
    downloadM3uFile(
      result.m3uContent,
      result.downloadFilename || `playlist_${result.macAddress.replace(/:/g, '')}.m3u`
    );
  };

  const handleCopyLink = () => {
    if (!result?.m3uContent) return;
    navigator.clipboard.writeText(result.m3uContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenInDashboard = () => {
    if (!result || !onMacLogin) return;
    onMacLogin({
      macAddress: result.macAddress,
      portalUrl: result.portalUrl,
      channels: result.channels,
      categories: result.categories,
    });
    onClose();
  };

  const handleResetMacUrl = () => {
    setResult(null);
    setPortalUrl('');
    setMacAddress('');
    setError(null);
    setCopied(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/90 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <BrandLogoIcon size={22} />
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>Yaaro Ka Yaar Stream</span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-200 text-indigo-700">
                  MAC URL Stalker
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                {isHindi
                  ? 'MAC एड्रेस और पोर्टल यूआरएल से ऑथेंटिकेट करें व पूरी प्लेलिस्ट डाउनलोड करें'
                  : 'Authenticate with MAC address & Portal URL to fetch channels and export M3U'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="whitespace-pre-line leading-relaxed font-semibold">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Field 1: Portal URL */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                {isHindi ? '1. पोर्टल यूआरएल (Portal URL)' : '1. Portal URL'}
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
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Field 2: MAC Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                {isHindi ? '2. मैक एड्रेस (MAC Address)' : '2. MAC Address'}
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
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 font-mono text-sm tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500 font-mono">
                {isHindi
                  ? 'मानक 12-वर्ण MAC एड्रेस (उदा: 00:1A:79:B4:C2:8A)'
                  : 'Standard 12-hex MAC address (e.g., 00:1A:79:B4:C2:8A)'}
              </p>
            </div>

            {/* Action Button: 'Generate M3U Playlist' */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>
                    {isHindi
                      ? 'सर्वर से ऑथेंटिकेट व M3U जनरेट हो रहा है...'
                      : 'Authenticating with Stalker Portal & Generating M3U...'}
                  </span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Generate M3U Playlist</span>
                </>
              )}
            </button>
          </form>

          {/* Generated Result Section */}
          {result && (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200/90 shadow-xs space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between gap-2 border-b border-emerald-200/60 pb-3">
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {isHindi
                      ? 'पूरी चैनल लिस्ट सफलतापूर्वक प्राप्त हुई!'
                      : 'Channel List Fetched Successfully!'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white text-emerald-800 font-mono font-bold border border-emerald-200 shadow-2xs">
                    {result.authMethod}
                  </span>
                  <button
                    type="button"
                    onClick={handleResetMacUrl}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                    title={isHindi ? 'मैक यूआरएल और प्लेलिस्ट डिलीट / रीसेट करें' : 'Delete and reset MAC URL & playlist'}
                  >
                    <Trash2 className="w-3 h-3 text-rose-600" />
                    <span>{isHindi ? 'डिलीट' : 'Delete'}</span>
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 block text-[11px] font-semibold">
                    {isHindi ? 'चैनल संख्या' : 'Total Channels'}
                  </span>
                  <strong className="text-emerald-700 text-base font-bold font-mono">
                    {result.totalChannels}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 block text-[11px] font-semibold">
                    {isHindi ? 'ग्रुप / श्रेणियां' : 'Categories'}
                  </span>
                  <strong className="text-slate-900 text-base font-bold font-mono">
                    {result.totalCategories}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
                  <span className="text-slate-500 block text-[11px] font-semibold">MAC</span>
                  <strong className="text-indigo-700 text-xs font-mono truncate block font-bold">
                    {result.macAddress}
                  </strong>
                </div>
              </div>

              {/* Channels Preview */}
              {result.channels.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                    {isHindi ? 'फेच किए गए चैनल (नमूना):' : 'Channel Sample Preview:'}
                  </label>
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1 text-xs">
                    {result.channels.slice(0, 4).map((ch, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <span className="font-semibold text-slate-800 truncate">
                          {idx + 1}. {ch.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold shrink-0 border border-indigo-100">
                          {ch.category_name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual Download Guidance */}
              <div className="p-3 bg-emerald-100/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 shadow-2xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">
                    {isHindi
                      ? 'प्लेलिस्ट तैयार है! फ़ाइल डाउनलोड करने के लिए नीचे दिए गए बटन पर क्लिक करें।'
                      : 'Playlist is ready! Click the button below to download your M3U file.'}
                  </span>
                </div>
              </div>

              {/* Actions: Download M3U File, Open in App, Copy Link, Delete */}
              <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadM3u}
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-emerald-600/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isHindi ? 'M3U प्लेलिस्ट फ़ाइल डाउनलोड करें' : 'Download M3U Playlist File'}</span>
                </button>

                {onMacLogin && (
                  <button
                    type="button"
                    onClick={handleOpenInDashboard}
                    className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-indigo-600/20"
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>{isHindi ? 'ऐप में चलाएं' : 'Play in App'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{isHindi ? 'M3U कॉपी' : 'Copy M3U'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetMacUrl}
                  className="py-2 px-3 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title={isHindi ? 'मैक यूआरएल और प्लेलिस्ट डिलीट करें' : 'Delete and reset MAC URL'}
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>{isHindi ? 'डिलीट' : 'Delete'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
