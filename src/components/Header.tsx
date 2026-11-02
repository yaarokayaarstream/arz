import React, { useState } from 'react';
import {
  LogOut,
  Network,
  Link2,
  ShieldCheck,
  FolderDown,
  Activity,
  CheckCircle2,
  Volume2,
  VolumeX,
  MessageSquare,
  Menu,
  X as MenuClose,
  LogIn,
  UserPlus,
  KeyRound,
  User as UserIcon,
  Bell,
  Image as ImageIcon,
  Globe,
  Sparkles,
} from 'lucide-react';
import { StreamCredentials, UserInfo, ViewMode, Language } from '../types';
import { BrandLogoIcon } from './BrandLogo';
import { t } from '../services/translations';
import { LanguageSelector } from './LanguageSelector';
import { soundService } from '../services/soundService';

interface HeaderProps {
  credentials: StreamCredentials | null;
  userInfo: UserInfo | null;
  viewMode: ViewMode;
  onNavigate: (mode: ViewMode) => void;
  onLogout: () => void;
  lang: Language;
  onToggleLang?: () => void;
  onSelectLang?: (lang: Language) => void;
  onOpenMacModal: () => void;
  onOpenRangeModal: () => void;
  onOpenLinkMaster: () => void;
  onOpenImportModal: () => void;
  onOpenTrackUrl: () => void;
  onOpenUrlToShort?: () => void;
  onOpenMaskingUrl?: () => void;
  onOpenVerifier: () => void;
  onOpenImageToUrl?: () => void;
  onOpenDesktopNote?: () => void;
  onOpenFeedback?: () => void;
  authUser?: any;
  onOpenAuth?: (mode?: 'login' | 'signup' | 'forgot' | 'google') => void;
  onSignOutAuth?: () => void;
  isAccountPortal?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  credentials,
  userInfo,
  viewMode,
  onNavigate,
  onLogout,
  lang,
  onToggleLang,
  onSelectLang,
  onOpenMacModal,
  onOpenRangeModal,
  onOpenLinkMaster,
  onOpenImportModal,
  onOpenTrackUrl,
  onOpenUrlToShort,
  onOpenMaskingUrl,
  onOpenVerifier,
  onOpenImageToUrl,
  onOpenDesktopNote,
  onOpenFeedback,
  authUser,
  onOpenAuth,
  onSignOutAuth,
  isAccountPortal = false,
}) => {
  const showTools = true;
  const [soundOn, setSoundOn] = useState(() => soundService.isEnabled());
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleToggleSound = () => {
    const newState = soundService.toggleSound();
    setSoundOn(newState);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 h-16 sm:h-17 py-1 flex items-center justify-between gap-2 sm:gap-3">
        {/* Zone 1: Hamburger Menu Toggle + Wordmark Logo + Nav */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Responsive Hamburger Menu Button (Far Left) */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`p-1.5 sm:p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 ${
              isMenuOpen
                ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-2xs'
                : 'bg-slate-100/90 hover:bg-slate-200/70 border-slate-200/90 text-slate-700 hover:text-indigo-600 shadow-2xs'
            }`}
            title="Menu — Sign In, Sign Up, Account"
            aria-label="Toggle Hamburger Menu"
          >
            {isMenuOpen ? (
              <MenuClose className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-rose-600" />
            ) : (
              <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-800" />
            )}
          </button>

          {/* Wordmark Logo */}
          <button 
            onClick={() => onNavigate(credentials ? 'choice' : 'login')}
            className="flex items-center gap-2 text-left group cursor-pointer focus:outline-none"
          >
            <BrandLogoIcon size={21} className="group-hover:scale-105 transition-transform shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs sm:text-[13px] font-bold tracking-tight text-slate-900 group-hover:text-rose-600 transition-colors whitespace-nowrap">
                Yaaro Ka Yaar Stream
              </span>
              <span className="text-[8px] font-semibold text-rose-600 tracking-wider uppercase -mt-0.5 hidden sm:block">
                IPTV Hub
              </span>
            </div>
          </button>

        </div>

        {/* Zone 2: Right Actions (Tools Scroll Container + Unclipped Corner Language Selector) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5">


          {/* Notification Screen Button */}
          {onOpenDesktopNote && (
            <button
              onClick={onOpenDesktopNote}
              className="flex flex-col items-center justify-center px-2 py-1 text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]"
              title={t('notification', lang)}
            >
              <Bell className="w-4 h-4 text-rose-200 shrink-0 mb-0.5" />
              <span className="text-[10px] font-bold leading-tight">{t('notification', lang)}</span>
            </button>
          )}

          {/* Sound Effect Toggle Button */}
          <button
            onClick={handleToggleSound}
            className={`flex flex-col items-center justify-center px-2 py-1 rounded-xl shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98] ${
              soundOn
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/90'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200'
            }`}
            title={soundOn ? t('sound_enabled', lang) : t('sound_muted', lang)}
          >
            {soundOn ? (
              <Volume2 className="w-4 h-4 text-amber-600 shrink-0 animate-pulse mb-0.5" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400 shrink-0 mb-0.5" />
            )}
            <span className="text-[10px] font-bold leading-tight">{soundOn ? t('sound', lang) : t('mute', lang)}</span>
          </button>

          {/* Feedback Trigger Button */}
          {onOpenFeedback && (
            <button
              onClick={onOpenFeedback}
              className="flex flex-col items-center justify-center px-2 py-1 text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/90 rounded-xl shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]"
              title={t('feedback', lang)}
            >
              <MessageSquare className="w-4 h-4 text-indigo-600 shrink-0 mb-0.5" />
              <span className="text-[10px] font-bold leading-tight">{t('feedback', lang)}</span>
            </button>
          )}
          </div>

          {/* Language Selector positioned in the Far Right Corner (Outside scroll container to prevent clipping) */}
          {onSelectLang && (
            <div className="pl-1 sm:pl-2 border-l border-slate-200/90 shrink-0 relative z-50">
              <LanguageSelector currentLang={lang} onSelectLang={onSelectLang} />
            </div>
          )}
        </div>
      </div>

      {/* Responsive Hamburger Dropdown Menu */}
      {isMenuOpen && (
        <div className="border-b border-slate-200/90 bg-white/98 backdrop-blur-md shadow-xl animate-in slide-in-from-top-2 duration-150">
          <div className="max-w-7xl mx-auto px-3 sm:px-5 py-3.5 space-y-3">
            {/* User Account / Auth Section */}
            <div className="p-3 bg-slate-50/90 border border-slate-200/90 rounded-2xl shadow-2xs">
              {authUser ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-r from-rose-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                      {authUser.displayName
                        ? authUser.displayName[0].toUpperCase()
                        : authUser.email
                        ? authUser.email[0].toUpperCase()
                        : 'U'}
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {authUser.displayName || 'Signed In Member'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">
                        {authUser.email}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (onSignOutAuth) onSignOutAuth();
                    }}
                    className="py-1.5 px-3 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto shadow-2xs flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>{t('logout', lang)}</span>
                  </button>
                </div>
              ) : credentials ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-r from-rose-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                      {credentials.username ? credentials.username[0].toUpperCase() : 'U'}
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {credentials.username || 'Connected Streamer'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">
                        {credentials.serverUrl}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onLogout();
                    }}
                    className="py-1.5 px-3 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto shadow-2xs flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>{t('logout', lang)}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{t('account_portal', lang)}</span>
                    </div>
                    <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      {t('secure_access', lang)}
                    </span>
                  </div>

                  {/* Sign in with Google Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (onOpenAuth) onOpenAuth('google');
                    }}
                    className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{t('signin_google', lang)}</span>
                  </button>

                  {/* Login and Sign Up Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (onOpenAuth) onOpenAuth('login');
                      }}
                      className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>{t('login', lang)}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (onOpenAuth) onOpenAuth('signup');
                      }}
                      className="py-2 px-3 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{t('signup', lang)}</span>
                    </button>
                  </div>

                  {/* Forgot Password Link */}
                  <div className="text-center pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (onOpenAuth) onOpenAuth('forgot');
                      }}
                      className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t('forgot_password', lang)}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Navigation Links */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100">
              {showTools && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenVerifier();
                    }}
                    className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center sm:justify-start gap-2 cursor-pointer transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">{t('verify', lang)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenTrackUrl();
                    }}
                    className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center sm:justify-start gap-2 cursor-pointer transition-colors"
                  >
                    <Activity className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="truncate">{t('track_url', lang)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (onOpenUrlToShort) onOpenUrlToShort();
                    }}
                    className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center sm:justify-start gap-2 cursor-pointer transition-colors"
                  >
                    <Link2 className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="truncate">URL to Short</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (onOpenMaskingUrl) onOpenMaskingUrl();
                      else window.location.href = '/masking-url.html';
                    }}
                    className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center sm:justify-start gap-2 cursor-pointer transition-colors"
                  >
                    <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">Masking URL</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenImportModal();
                    }}
                    className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center sm:justify-start gap-2 cursor-pointer transition-colors"
                  >
                    <FolderDown className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="truncate">{t('import_btn', lang)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenLinkMaster();
                    }}
                    className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center sm:justify-start gap-2 cursor-pointer transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">{t('link_master', lang)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenRangeModal();
                    }}
                    className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center sm:justify-start gap-2 cursor-pointer transition-colors"
                  >
                    <Link2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="truncate">{t('range_url', lang)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenMacModal();
                    }}
                    className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center sm:justify-start gap-2 cursor-pointer transition-colors"
                  >
                    <Network className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="truncate">{t('mac_url', lang)}</span>
                  </button>

                  {onOpenImageToUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenImageToUrl();
                      }}
                      className="p-2 bg-purple-50 hover:bg-purple-100 rounded-xl text-xs font-bold text-purple-900 flex items-center justify-center sm:justify-start gap-2 cursor-pointer transition-colors"
                    >
                      <ImageIcon className="w-4 h-4 text-purple-600 shrink-0" />
                      <span className="truncate">{t('image_to_url', lang)}</span>
                    </button>
                  )}
                </>
              )}

              {onOpenDesktopNote && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenDesktopNote();
                  }}
                  className="p-2 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-bold text-rose-900 flex items-center justify-center sm:justify-start gap-2 cursor-pointer transition-colors"
                >
                  <Bell className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="truncate">{t('notification', lang)}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  if (onOpenFeedback) onOpenFeedback();
                }}
                className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center sm:justify-start gap-2 cursor-pointer transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="truncate">{t('feedback', lang)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
