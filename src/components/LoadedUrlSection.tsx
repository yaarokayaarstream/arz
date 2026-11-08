import React from 'react';
import { Globe, Trash2, CheckCircle2 } from 'lucide-react';
import { StreamCredentials, UserInfo, Language } from '../types';
import { t } from '../services/translations';

interface LoadedUrlSectionProps {
  credentials: StreamCredentials;
  userInfo?: UserInfo | null;
  onDeleteLoadedUrl: () => void;
  lang: Language;
}

export const LoadedUrlSection: React.FC<LoadedUrlSectionProps> = ({
  credentials,
  userInfo,
  onDeleteLoadedUrl,
  lang,
}) => {
  return (
    <div className="w-full bg-white border-b border-slate-200/90 shadow-2xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 sm:gap-3">
          {/* Section Header & Loaded URL Info */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Section Tag */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[11px] uppercase tracking-wider shrink-0">
              <Globe className="w-3 h-3 text-indigo-600" />
              <span>{t('loaded_url', lang)}</span>
            </div>

            {/* The Loaded URL itself */}
            <div className="min-w-0 flex items-center gap-2">
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-mono text-xs text-slate-800 truncate max-w-[280px] sm:max-w-md md:max-w-lg select-all">
                {credentials.serverUrl}
              </div>

              {/* Status Indicator */}
              <div className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-700 font-semibold shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>{userInfo?.status || t('active', lang)}</span>
              </div>

              {/* Username metadata */}
              <div className="hidden lg:flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="text-slate-700 font-mono">User: {credentials.username}</span>
              </div>
            </div>
          </div>

          {/* Delete Action Button */}
          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <button
              type="button"
              onClick={onDeleteLoadedUrl}
              className="group flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 rounded-lg text-rose-700 hover:text-rose-800 text-xs font-bold shadow-2xs transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]"
              title={t('delete_url_tooltip', lang)}
            >
              <Trash2 className="w-3 h-3 text-rose-600 group-hover:text-rose-700 transition-colors" />
              <span>{t('delete_url', lang)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
