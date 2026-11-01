import React, { useState, useRef, useEffect, DragEvent } from 'react';
import {
  X,
  Image as ImageIcon,
  Upload,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Eye,
} from 'lucide-react';
import {
  uploadImageToImgbb,
  ImgBbUploadResponse,
} from '../services/imgbbService';
import { sendUrlGeneratedNotification } from '../services/emailJsService';
import { Language } from '../types';
import { t } from '../services/translations';

interface ImageToUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const ImageToUrlModal: React.FC<ImageToUrlModalProps> = ({ isOpen, onClose, lang }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<ImgBbUploadResponse | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean preview URL when changed
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  // Handle global paste event when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: globalThis.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            setSelectedFile(file);
            setError(null);
            setUploadResult(null);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('कृपया एक मान्य इमेज फ़ाइल चुनें (PNG, JPG, WEBP, GIF)');
        return;
      }
      setSelectedFile(file);
      setError(null);
      setUploadResult(null);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('कृपया एक मान्य इमेज फ़ाइल चुनें (PNG, JPG, WEBP, GIF)');
        return;
      }
      setSelectedFile(file);
      setError(null);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      const res = await uploadImageToImgbb(selectedFile, selectedFile.name);
      setUploadResult(res);

      // Send EmailJS alert for new generated image URL
      sendUrlGeneratedNotification({
        url: res.url,
        source: 'Image to URL (ImgBB / Yaaro Ka Yaar)',
        details: {
          'File Name': selectedFile.name,
          'Image Size': formatFileSize(selectedFile.size),
          'Dimensions': `${res.width}x${res.height}px`,
          'Direct Image URL': res.url,
          'Display Webpage URL': res.displayUrl,
          'Thumbnail URL': res.thumbUrl,
        },
      }).catch((e) => console.warn('EmailJS URL generation alert failed:', e));
    } catch (err: any) {
      setError(err.message || 'इमेज अपलोड विफल रहा। कृपया इंटरनेट कनेक्शन या फ़ाइल जाँचें।');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2200);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadResult(null);
    setError(null);
    setCopiedUrl(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-150 my-auto flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner - Updated with 'Yaaro Ka Yaar' badge */}
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shrink-0 shadow-2xs">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold tracking-tight">
                  {t('image_to_url', lang)}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 tracking-wide">
                  Yaaro Ka Yaar
                </span>
              </div>
              <p className="text-[11px] text-white/85 font-medium">
                Upload images to cloud and get instant direct URLs powered by Yaaro Ka Yaar
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">अपलोड त्रुटि (Upload Error):</p>
                <p className="mt-0.5 text-[11px] leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* File Drop Area */}
            {!uploadResult ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer select-none ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-50/70 scale-[1.01]'
                    : selectedFile
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {previewUrl ? (
                  <div className="flex flex-col items-center">
                    <div className="relative mb-3 group">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-h-48 rounded-xl object-contain shadow-md border border-slate-200"
                      />
                      <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                        बदलने के लिए क्लिक करें
                      </div>
                    </div>

                    <div className="text-xs font-bold text-slate-800 truncate max-w-sm">
                      {selectedFile?.name}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {formatFileSize(selectedFile?.size || 0)} · {selectedFile?.type}
                    </div>

                    <p className="text-[10px] text-indigo-600 font-medium mt-2">
                      फ़ाइल चुनी गई है! नीचे दिए गए 'Upload & Get URL' बटन पर क्लिक करें।
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                      <Upload className="w-6 h-6 animate-bounce" />
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-bold text-slate-800">
                        Drag and drop image here, or click to browse
                      </p>
                    </div>

                    <div className="pt-2 flex items-center gap-2 text-[10px] text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs font-mono">
                      <span>💡 Tip: Press Ctrl + V to paste an image from the clipboard</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Uploaded Success Result View */
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50/70 via-white to-indigo-50/40 border border-emerald-200/90 shadow-sm space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                        इमेज सफलतापूर्वक अपलोड हो गई! (Upload Successful)
                      </h4>
                      <p className="text-[10px] text-emerald-700 font-semibold font-mono">
                        {uploadResult.width}×{uploadResult.height}px · {formatFileSize(uploadResult.size)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>नई इमेज अपलोड करें</span>
                  </button>
                </div>

                {/* Thumbnail & Direct URL Showcase */}
                <div className="flex flex-col sm:flex-row gap-3.5 items-center">
                  <div className="relative group shrink-0">
                    <img
                      src={uploadResult.thumbUrl || uploadResult.displayUrl}
                      alt="Thumbnail"
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover border border-slate-200 shadow-sm bg-slate-50"
                    />
                    <a
                      href={uploadResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View</span>
                    </a>
                  </div>

                  {/* Direct URL Input Box */}
                  <div className="flex-1 w-full space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Direct Image URL (डायरेक्ट इमेज लिंक)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          readOnly
                          value={uploadResult.url}
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-indigo-700 select-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopy(uploadResult.url)}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
                        >
                          {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedUrl ? 'Copied!' : 'Copy'}</span>
                        </button>
                        <a
                          href={uploadResult.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs transition-colors cursor-pointer shrink-0"
                          title="Open direct URL in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {selectedFile && !uploadResult && (
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white font-bold rounded-xl shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 text-xs sm:text-sm transition-all cursor-pointer active:scale-[0.99] disabled:opacity-60"
                >
                  {isUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>अपलोड हो रहा है... (Uploading)</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Upload & Get URL</span>
                    </>
                  )}
                </button>
              )}

              {selectedFile && !isUploading && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3.5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-2xs"
                >
                  हटाएँ (Cancel)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Info - Updated status and API key hidden */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-700">Yaaro Ka Yaar - Image to URL Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
};
