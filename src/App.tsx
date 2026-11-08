/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { StreamCredentials, UserInfo, ServerInfo, Category, StreamChannel, ViewMode, Language } from './types';
import { authenticateStreamApi } from './services/api';
import { loadOrFetchCatalog, setCachedCatalog, CatalogResult } from './services/catalogManager';
import { Header } from './components/Header';
import { LoginForm } from './components/LoginForm';
import { ActionChoice, DashboardActionType } from './components/ActionChoice';
import { DownloadSection } from './components/DownloadSection';
import { ChannelList } from './components/ChannelList';
import { FullScreenPlayer } from './components/FullScreenPlayer';
import { MacPortalModal } from './components/MacPortalModal';
import { BrandLogoIcon } from './components/BrandLogo';
import { RangeUrlGenerator } from './components/RangeUrlGenerator';
import { LinkMasterModal } from './components/LinkMasterModal';
import { ImportPlaylistModal } from './components/ImportPlaylistModal';
import { TrackUrlModal } from './components/TrackUrlModal';
import { UrlToShortModal } from './components/UrlToShortModal';
import { MaskingUrlModal } from './components/MaskingUrlModal';
import { UrlShieldModal } from './components/UrlShieldModal';
import { PlaylistVerifierModal } from './components/PlaylistVerifierModal';
import { ImageToUrlModal } from './components/ImageToUrlModal';
import { StarfieldBackground } from './components/StarfieldBackground';
import { ClickSparkleManager } from './components/ClickSparkleManager';
import { FooterBranding } from './components/FooterBranding';
import { FeedbackModal } from './components/FeedbackModal';
import { AuthModal, AuthMode } from './components/AuthModal';
import { AccountPortalScreen } from './components/AccountPortalScreen';
import { DesktopNoteModal } from './components/DesktopNoteModal';
import { UrlInspectorModal } from './components/UrlInspectorModal';
import { subscribeToAuth, logoutUser } from './services/firebaseAuth';
import { MessageSquare, Loader2 } from 'lucide-react';
import { t } from './services/translations';

const STORAGE_CREDS_KEY = 'streamhub_active_credentials';
const STORAGE_LANG_KEY = 'streamhub_active_language';
const STORAGE_VIEW_KEY = 'streamhub_active_view_mode';

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LANG_KEY);
      if (saved && ['en', 'hi', 'pa', 'bn', 'or', 'ta', 'te', 'ml', 'gu', 'kn'].includes(saved)) {
        return saved as Language;
      }
    } catch {
      // ignore
    }
    return 'en';
  });

  const handleSelectLang = (newLang: Language) => {
    setLang(newLang);
    try {
      localStorage.setItem(STORAGE_LANG_KEY, newLang);
    } catch {
      // ignore
    }
  };
  const [credentials, setCredentials] = useState<StreamCredentials | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);

  // Default to 'login' (Quick Tools home screen) on every initial load or refresh as requested
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [channels, setChannels] = useState<StreamChannel[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [catalogStats, setCatalogStats] = useState<CatalogResult | null>(null);

  // Active playing channel and context to return to upon closing player
  const [activeChannel, setActiveChannel] = useState<StreamChannel | null>(null);
  const [returnToModal, setReturnToModal] = useState<
    'mac' | 'range' | 'linkmaster' | 'import' | 'track' | 'verifier' | 'shield' | null
  >(null);

  // State to track initial authentication: if no session exists, immediately show login page without gate delay
  const [isVerifyingSession, setIsVerifyingSession] = useState(() => {
    try {
      return Boolean(sessionStorage.getItem(STORAGE_CREDS_KEY));
    } catch {
      return false;
    }
  });

  // If user opens a masking link via SPA, instantly redirect to standalone masking page without asking for sign-in
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryUrl = params.get('url') || params.get('u');
      const isMaskPath =
        window.location.pathname.includes('masking') ||
        window.location.pathname.includes('/mask') ||
        window.location.pathname.includes('tinysrc') ||
        window.location.pathname.startsWith('/m/');
      if (queryUrl || isMaskPath) {
        window.location.replace('/masking-url.html' + window.location.search);
      }
    }
  }, []);

  // Keep viewMode synced to sessionStorage so reloads remember current screen
  useEffect(() => {
    if (!isVerifyingSession) {
      try {
        sessionStorage.setItem(STORAGE_VIEW_KEY, viewMode);
      } catch {
        // ignore
      }
    }
  }, [isVerifyingSession, viewMode]);

  // MAC URL Portal Modal State
  const [isMacModalOpen, setIsMacModalOpen] = useState(false);

  // Range URL Generator Modal State
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);

  // Link Master Modal State
  const [isLinkMasterModalOpen, setIsLinkMasterModalOpen] = useState(false);

  // Import Playlist Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Track URL Modal State
  const [isTrackUrlModalOpen, setIsTrackUrlModalOpen] = useState(false);

  // URL to Short (is.gd API) Modal State
  const [isUrlToShortModalOpen, setIsUrlToShortModalOpen] = useState(false);

  // Masking URL Modal State
  const [isMaskingUrlModalOpen, setIsMaskingUrlModalOpen] = useState(false);

  // URL Shield Modal State (M3U Masker via URLVanish)
  const [isUrlShieldModalOpen, setIsUrlShieldModalOpen] = useState(false);

  // Playlist Verifier Modal State
  const [isVerifierModalOpen, setIsVerifierModalOpen] = useState(false);

  // Image to URL (ImgBB API) Modal State
  const [isImageToUrlModalOpen, setIsImageToUrlModalOpen] = useState(false);

  // User Feedback Modal State
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // Desktop Note Screen Modal State (Realtime Database live messages)
  const [isDesktopNoteModalOpen, setIsDesktopNoteModalOpen] = useState(false);

  // URL Inspector Modal State
  const [isUrlInspectorModalOpen, setIsUrlInspectorModalOpen] = useState(false);

  // Firebase Authentication State
  const [authUser, setAuthUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthMode>('login');

  // Remember last loaded URL for the Loaded URL section
  const [lastLoadedUrl, setLastLoadedUrl] = useState<string | null>(null);
  const [loginFormKey, setLoginFormKey] = useState(0);

  // Scroll to the very top whenever view mode changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [viewMode]);

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      if (user && !user.emailVerified && user.providerData?.some((p) => p.providerId === 'password')) {
        setAuthUser(null);
      } else {
        setAuthUser(user);
      }
    });
    return () => unsubscribe();
  }, []);

  // Verify authentication & session state upon initial page load or refresh
  useEffect(() => {
    let isCancelled = false;

    const verifySessionState = async () => {
      try {
        const savedCreds = sessionStorage.getItem(STORAGE_CREDS_KEY);
        const savedView = sessionStorage.getItem(STORAGE_VIEW_KEY) as ViewMode | null;

        if (!savedCreds) {
          // No user session detected: immediately enforce login screen and restrict protected content
          if (!isCancelled) {
            setCredentials(null);
            setUserInfo(null);
            setServerInfo(null);
            setViewMode('login');
            try {
              sessionStorage.setItem(STORAGE_VIEW_KEY, 'login');
            } catch {
              // ignore
            }
          }
          return;
        }

        const parsed: StreamCredentials = JSON.parse(savedCreds);
        if (!parsed.serverUrl || !parsed.username) {
          throw new Error('Malformed or incomplete credentials');
        }

        if (parsed.password === 'mac-portal' || parsed.password === 'encrypted-aliases') {
          // Stalker / MAC Portal or Masked Link Master session
          if (!isCancelled) {
            setCredentials(parsed);
            setUserInfo({
              username: parsed.username,
              status: 'Active (Restored Session)',
              max_connections: '1',
            });
            setServerInfo({ url: parsed.serverUrl });
            setLastLoadedUrl(parsed.serverUrl);
            // Default to 'login' (Quick Tools home screen) on reload/refresh
            setViewMode('login');
            try {
              sessionStorage.setItem(STORAGE_VIEW_KEY, 'login');
            } catch {
              // ignore
            }
          }
        } else {
          // Verify against Xtream API endpoint
          const authResult = await authenticateStreamApi(parsed);
          if (!isCancelled) {
            const activeCreds = { ...parsed, isDemo: authResult.isDemo };
            setCredentials(activeCreds);
            setUserInfo(authResult.user_info || null);
            setServerInfo(authResult.server_info || null);
            setLastLoadedUrl(activeCreds.serverUrl);
            // Default to 'login' (Quick Tools home screen) on reload/refresh
            setViewMode('login');
            try {
              sessionStorage.setItem(STORAGE_CREDS_KEY, JSON.stringify(activeCreds));
              sessionStorage.setItem(STORAGE_VIEW_KEY, 'login');
            } catch {
              // ignore
            }
          }
        }
      } catch (err: any) {
        // Any failure to authenticate immediately invalidates session and redirects to login
        if (!isCancelled) {
          setCredentials(null);
          setUserInfo(null);
          setServerInfo(null);
          setCategories([]);
          setChannels([]);
          setCatalogStats(null);
          setActiveChannel(null);
          setLastLoadedUrl(null);
          try {
            sessionStorage.removeItem(STORAGE_CREDS_KEY);
            sessionStorage.removeItem(STORAGE_VIEW_KEY);
            sessionStorage.setItem(STORAGE_VIEW_KEY, 'login');
          } catch {
            // ignore
          }
          setViewMode('login');
        }
      } finally {
        if (!isCancelled) {
          setIsVerifyingSession(false);
        }
      }
    };

    verifySessionState();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleLogin = async (creds: StreamCredentials, isSilent = false, targetView?: ViewMode) => {
    if (!isSilent) setIsLoadingAuth(true);
    setAuthError(null);

    try {
      const authResult = await authenticateStreamApi(creds);
      const activeCreds = { ...creds, isDemo: authResult.isDemo };

      setCredentials(activeCreds);
      setUserInfo(authResult.user_info || null);
      setServerInfo(authResult.server_info || null);
      setLastLoadedUrl(activeCreds.serverUrl);

      // Reset catalog state for new connection so validation is fresh
      setChannels([]);
      setCatalogStats(null);

      const nextView = targetView || 'download';
      setViewMode(nextView);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

      // If opening download view, fetch complete playlist from server (backend waits for 100% download)
      if (nextView === 'download') {
        setIsLoadingChannels(true);
        loadOrFetchCatalog(activeCreds, true)
          .then((res) => {
            if (res.channels && res.channels.length > 0 && res.isValidated && res.isComplete) {
              setChannels(res.channels);
              setCategories(res.categories);
              setCatalogStats(res);
            } else {
              setCatalogStats(res);
            }
          })
          .catch(() => {})
          .finally(() => {
            setIsLoadingChannels(false);
          });
      }

      try {
        sessionStorage.setItem(STORAGE_CREDS_KEY, JSON.stringify(activeCreds));
        sessionStorage.setItem(STORAGE_VIEW_KEY, nextView);
      } catch {
        // ignore
      }
    } catch (err: any) {
      if (targetView === 'download' || !targetView) {
        const fallbackCreds = { ...creds, isDemo: false };
        setCredentials(fallbackCreds);
        setChannels([]);
        setCatalogStats(null);
        setUserInfo({
          username: creds.username,
          status: 'Active (Direct M3U Mode)',
          max_connections: '1',
        });
        setServerInfo({ url: creds.serverUrl });
        setLastLoadedUrl(creds.serverUrl);
        setViewMode('download');
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        setIsLoadingChannels(true);
        loadOrFetchCatalog(fallbackCreds, true)
          .then((res) => {
            if (res.channels && res.channels.length > 0 && res.isValidated && res.isComplete) {
              setChannels(res.channels);
              setCategories(res.categories);
              setCatalogStats(res);
            } else {
              setCatalogStats(res);
            }
          })
          .catch(() => {})
          .finally(() => {
            setIsLoadingChannels(false);
          });
        try {
          sessionStorage.setItem(STORAGE_CREDS_KEY, JSON.stringify(fallbackCreds));
          sessionStorage.setItem(STORAGE_VIEW_KEY, 'download');
        } catch {
          // ignore
        }
        return;
      }

      setAuthError(err.message || 'Connection failed. Please check your credentials.');
      setCredentials(null);
      setUserInfo(null);
      setServerInfo(null);
      try {
        sessionStorage.removeItem(STORAGE_CREDS_KEY);
        sessionStorage.removeItem(STORAGE_VIEW_KEY);
      } catch {
        // ignore
      }
      setViewMode('login');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  /**
   * Handles direct login using authenticated MAC Portal results
   */
  const handleMacLogin = (macResult: {
    macAddress: string;
    portalUrl: string;
    channels: StreamChannel[];
    categories: Category[];
  }) => {
    const creds: StreamCredentials = {
      serverUrl: macResult.portalUrl,
      username: `MAC: ${macResult.macAddress}`,
      password: 'mac-portal',
      isDemo: false,
    };
    setCredentials(creds);
    setUserInfo({
      username: macResult.macAddress,
      status: 'Active (Stalker / MAG Portal)',
      max_connections: '1',
    });
    setServerInfo({
      url: macResult.portalUrl,
    });
    setChannels(macResult.channels);
    setCategories(macResult.categories);
    setLastLoadedUrl(macResult.portalUrl);
    setViewMode('choice');

    // Immediately cache the real MAC channels in IndexedDB to prevent loading fallback demo channels
    setCachedCatalog(creds, macResult.channels, macResult.categories).catch(() => {});

    try {
      sessionStorage.setItem(STORAGE_CREDS_KEY, JSON.stringify(creds));
    } catch {
      // ignore
    }
  };

  /**
   * Loads masked or imported channels directly into the app catalog and opens Channels view
   */
  const handleLoadChannelsToApp = (newChannels: StreamChannel[], newCategories?: Category[]) => {
    setChannels(newChannels);
    if (newCategories && newCategories.length > 0) {
      setCategories(newCategories);
    } else {
      const catMap = new Map<string, string>();
      newChannels.forEach((ch) => {
        catMap.set(ch.category_id || 'linkmaster', ch.category_name || 'Link Master Channels');
      });
      const cats: Category[] = Array.from(catMap.entries()).map(([id, name]) => ({
        category_id: id,
        category_name: name,
      }));
      setCategories(cats);
    }
    const creds: StreamCredentials = {
      serverUrl: 'Link Master Masked Playlist',
      username: 'LinkMaster Protected',
      password: 'encrypted-aliases',
      isDemo: false,
    };
    setCredentials(creds);
    setUserInfo({
      username: 'LinkMaster (Protected Aliases)',
      status: 'Active (Protected Stream Aliases)',
      max_connections: '5',
    });
    setLastLoadedUrl('Link Master Masked Playlist');
    setViewMode('channels');

    try {
      sessionStorage.setItem(STORAGE_CREDS_KEY, JSON.stringify(creds));
      sessionStorage.setItem(STORAGE_VIEW_KEY, 'channels');
    } catch {
      // ignore
    }
  };

  /**
   * Triggers data fetching and Web Worker parsing ONLY when the user clicks 'View Channels'.
   * Uses IndexedDB local caching for instant 0ms loads, and offloads heavy parsing to Web Worker.
   */
  const handleOpenViewChannels = async (forceRefresh = false) => {
    setViewMode('channels');
    if (!credentials) return;

    // If channels are already in state and not forcing a refresh, display immediately
    if (channels.length > 0 && !forceRefresh) {
      return;
    }

    setIsLoadingChannels(true);
    try {
      const result = await loadOrFetchCatalog(credentials, forceRefresh);
      setChannels(result.channels);
      setCategories(result.categories);
      setCatalogStats(result);
    } catch {
      // ignore
    } finally {
      setIsLoadingChannels(false);
    }
  };

  /**
   * Fetches and strictly validates the catalog for the Download Playlist screen
   * without switching the active view mode away from 'download'.
   */
  const handleFetchDownloadStreams = async (forceRefresh = true) => {
    if (!credentials) return;
    setIsLoadingChannels(true);
    try {
      const result = await loadOrFetchCatalog(credentials, forceRefresh);
      if (result.channels && result.channels.length > 0 && result.isValidated && result.isComplete) {
        setChannels(result.channels);
        setCategories(result.categories);
        setCatalogStats(result);
      } else {
        setCatalogStats(result);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingChannels(false);
    }
  };

  /**
   * Complete Sign Out & Session Teardown
   * Clears Firebase auth, IPTV stream credentials, loaded catalogs,
   * active channels/player, open modals, and browser sessionStorage,
   * then redirects directly to the Login screen.
   */
  const handleFullSignOut = async () => {
    try {
      await logoutUser();
    } catch {
      // ignore
    }

    setAuthUser(null);
    setCredentials(null);
    setUserInfo(null);
    setServerInfo(null);
    setCategories([]);
    setChannels([]);
    setCatalogStats(null);
    setActiveChannel(null);
    setReturnToModal(null);
    setLastLoadedUrl(null);

    // Close all open modals & player
    setIsMacModalOpen(false);
    setIsRangeModalOpen(false);
    setIsLinkMasterModalOpen(false);
    setIsImportModalOpen(false);
    setIsTrackUrlModalOpen(false);
    setIsVerifierModalOpen(false);
    setIsUrlShieldModalOpen(false);
    setIsImageToUrlModalOpen(false);
    setIsFeedbackModalOpen(false);
    setIsAuthModalOpen(false);

    // Completely wipe browser session storage
    try {
      sessionStorage.removeItem(STORAGE_CREDS_KEY);
      sessionStorage.removeItem(STORAGE_VIEW_KEY);
      sessionStorage.clear();
    } catch {
      // ignore
    }

    // Force direct redirect to Login screen
    setViewMode('login');
    try {
      sessionStorage.setItem(STORAGE_VIEW_KEY, 'login');
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    handleFullSignOut();
  };

  // Delete loaded URL, reset state, and return to primary dashboard view without logging the user out
  const handleDeleteLoadedUrl = () => {
    const urlToDelete = lastLoadedUrl || credentials?.serverUrl;
    setLastLoadedUrl(null);
    setCredentials(null);
    setUserInfo(null);
    setServerInfo(null);
    setChannels([]);
    setCategories([]);
    setCatalogStats(null);
    setActiveChannel(null);
    setAuthError(null);
    setIsMacModalOpen(false);
    setReturnToModal(null);

    // Clear persisted stream connection from storage (retaining user auth)
    try {
      localStorage.removeItem('streamhub_last_loaded_url');
      sessionStorage.removeItem(STORAGE_CREDS_KEY);
      sessionStorage.setItem(STORAGE_VIEW_KEY, 'choice');
      const savedRecents = localStorage.getItem('streamhub_recent_connections');
      if (savedRecents && urlToDelete) {
        const recents = JSON.parse(savedRecents);
        const updated = recents.filter((r: any) => r.serverUrl !== urlToDelete);
        localStorage.setItem('streamhub_recent_connections', JSON.stringify(updated));
      }
    } catch {
      // ignore
    }

    // Reset application state and navigate back to the primary dashboard view ('choice')
    // This restores sections like 'Quick Tools' and the 12 feature boxes underneath
    setViewMode('choice');
  };

  // Reset all fields and return user to home page
  const handleResetToHome = () => {
    setLastLoadedUrl(null);
    setCredentials(null);
    setUserInfo(null);
    setServerInfo(null);
    setChannels([]);
    setCategories([]);
    setCatalogStats(null);
    setActiveChannel(null);
    setAuthError(null);
    setIsMacModalOpen(false);
    setReturnToModal(null);
    try {
      localStorage.removeItem('streamhub_last_loaded_url');
      localStorage.removeItem('streamhub_recent_connections');
      sessionStorage.removeItem(STORAGE_CREDS_KEY);
      sessionStorage.setItem(STORAGE_VIEW_KEY, 'login');
    } catch {
      // ignore
    }
    setLoginFormKey((k) => k + 1);
    setViewMode('login');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId);
  };

  const handleSelectChannel = (
    channel: StreamChannel,
    fromModal?: 'mac' | 'range' | 'linkmaster' | 'import' | 'track' | 'verifier' | 'shield'
  ) => {
    // Strictly restrict stream playback to authenticated users only
    if (!credentials) {
      setViewMode('login');
      return;
    }
    if (fromModal) {
      setReturnToModal(fromModal);
    }
    // Ensure the channel exists in channels list
    setChannels((prev) => {
      if (prev.some((c) => c.stream_id === channel.stream_id)) return prev;
      return [channel, ...prev];
    });
    setActiveChannel(channel);
  };

  const handleClosePlayer = () => {
    setActiveChannel(null);

    // If stream was played from an open tool or modal, restore that exact modal
    if (returnToModal === 'range') {
      setIsRangeModalOpen(true);
      setReturnToModal(null);
    } else if (returnToModal === 'linkmaster') {
      setIsLinkMasterModalOpen(true);
      setReturnToModal(null);
    } else if (returnToModal === 'import') {
      setIsImportModalOpen(true);
      setReturnToModal(null);
    } else if (returnToModal === 'track') {
      setIsTrackUrlModalOpen(true);
      setReturnToModal(null);
    } else if (returnToModal === 'verifier') {
      setIsVerifierModalOpen(true);
      setReturnToModal(null);
    } else if (returnToModal === 'mac') {
      setIsMacModalOpen(true);
      setReturnToModal(null);
    } else if (returnToModal === 'shield') {
      setIsUrlShieldModalOpen(true);
      setReturnToModal(null);
    } else {
      // If user had channels loaded, ensure they land cleanly on the channels catalog
      if (viewMode === 'login' && channels.length > 0) {
        setViewMode('channels');
      }
    }
  };

  /**
   * Unified Action Handler for Quick Tools and Dashboard Cards
   */
  const handleSelectDashboardAction = (action: DashboardActionType) => {
    if (action === 'xtream_api') {
      setViewMode('login');
      setTimeout(() => {
        const input = document.getElementById('xtream-server-url-input');
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else if (action === 'verifier') {
      setIsVerifierModalOpen(true);
    } else if (action === 'track_url') {
      setIsTrackUrlModalOpen(true);
    } else if (action === 'url_shortener') {
      setIsUrlToShortModalOpen(true);
    } else if (action === 'masking_url') {
      setIsMaskingUrlModalOpen(true);
    } else if (action === 'url_shield') {
      setIsUrlShieldModalOpen(true);
    } else if (action === 'import_playlist') {
      setIsImportModalOpen(true);
    } else if (action === 'link_master') {
      setIsLinkMasterModalOpen(true);
    } else if (action === 'range_generator') {
      setIsRangeModalOpen(true);
    } else if (action === 'mac_portal') {
      setIsMacModalOpen(true);
    } else if (action === 'image_to_url') {
      setIsImageToUrlModalOpen(true);
    } else if (action === 'url_inspector') {
      setIsUrlInspectorModalOpen(true);
    } else if (action === 'desktop_note') {
      setIsDesktopNoteModalOpen(true);
    } else if (action === 'feedback') {
      setIsFeedbackModalOpen(true);
    } else if (action === 'channels') {
      handleOpenViewChannels();
    } else {
      setViewMode(action as ViewMode);
    }
  };

  // Check if initial URL is a masking URL request (prevent any sign-in gate or session verification screen)
  const isMaskingUrlRequest = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).has('url') ||
    new URLSearchParams(window.location.search).has('u') ||
    window.location.pathname.includes('masking') ||
    window.location.pathname.includes('/mask')
  );

  if (isMaskingUrlRequest) {
    return null;
  }

  // While verifying initial authentication session on page load or refresh, render the secure authentication gate
  if (isVerifyingSession) {
    return (
      <div className="relative min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center font-sans select-none">
        {/* Interactive Background */}
        <StarfieldBackground />

        <div className="relative z-10 flex flex-col items-center p-8 bg-slate-900/85 backdrop-blur-xl border border-slate-800/90 rounded-3xl shadow-2xl max-w-sm w-full mx-4 text-center animate-in fade-in duration-300">
          <div className="relative mb-4">
            <BrandLogoIcon size={56} className="animate-pulse" />
            <div className="absolute -inset-1 rounded-full bg-rose-500/25 blur-md animate-ping" />
          </div>
          
          <h1 className="text-lg font-black text-white tracking-tight mb-1">
            Yaaro Ka Yaar Stream
          </h1>
          <p className="text-[10px] text-rose-400 font-extrabold uppercase tracking-widest mb-6">
            IPTV Hub · Authentication Gate
          </p>

          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-800/90 rounded-xl border border-slate-700/80 mb-2.5 w-full justify-center shadow-xs">
            <Loader2 className="w-4 h-4 text-rose-500 animate-spin shrink-0" />
            <span className="text-xs font-bold text-slate-200">
              {lang === 'hi' ? 'सत्र सत्यापित किया जा रहा है...' : 'Verifying user session...'}
            </span>
          </div>

          <span className="text-[11px] text-slate-400 font-medium">
            {lang === 'hi' ? 'प्रमाणीकरण स्थिति जाँची जा रही है' : 'Validating authentication state'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-transparent text-slate-800 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Interactive Background Animation with Falling Stars and Cosmic Particles */}
      <StarfieldBackground />

      {/* Global Click Sparkle & Blast Animation with Melodic Sound Effects */}
      <ClickSparkleManager />

      {/* Top Bar with 'MAC URL' Icon, Navigation, and Language Switcher */}
      <Header
        credentials={credentials}
        userInfo={userInfo}
        viewMode={viewMode}
        onNavigate={(mode) => {
          if (mode === 'channels') {
            handleOpenViewChannels();
          } else if (mode === 'choice') {
            setIsMacModalOpen(false);
            setIsRangeModalOpen(false);
            setIsLinkMasterModalOpen(false);
            setIsImportModalOpen(false);
            setIsTrackUrlModalOpen(false);
            setIsVerifierModalOpen(false);
            setActiveChannel(null);
            setViewMode('choice');
          } else {
            setViewMode(mode);
          }
        }}
        onLogout={handleFullSignOut}
        lang={lang}
        onSelectLang={handleSelectLang}
        onOpenMacModal={() => setIsMacModalOpen(true)}
        onOpenRangeModal={() => setIsRangeModalOpen(true)}
        onOpenLinkMaster={() => setIsLinkMasterModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenTrackUrl={() => setIsTrackUrlModalOpen(true)}
        onOpenUrlToShort={() => setIsUrlToShortModalOpen(true)}
        onOpenMaskingUrl={() => setIsMaskingUrlModalOpen(true)}
        onOpenVerifier={() => setIsVerifierModalOpen(true)}
        onOpenImageToUrl={() => setIsImageToUrlModalOpen(true)}
        onOpenDesktopNote={() => setIsDesktopNoteModalOpen(true)}
        onOpenFeedback={() => setIsFeedbackModalOpen(true)}
        authUser={authUser}
        isAccountPortal={!authUser}
        onOpenAuth={(mode = 'login') => {
          setAuthModalMode(mode);
          setIsAuthModalOpen(true);
        }}
        onSignOutAuth={handleFullSignOut}
      />

      {/* Main Content Area */}
      <>
        {!authUser ? (
          <AccountPortalScreen
            onSuccess={(user) => {
              setAuthUser(user);
            }}
            lang={lang}
            onSelectLang={handleSelectLang}
          />
        ) : (
          <>
            {/* Dashboard Content */}
            <main className="flex-1">
          {/* Step 1: Login Form (Shown on app open or when in login mode) */}
          {viewMode === 'login' && (
            <LoginForm
              key={loginFormKey}
              onLogin={(creds, targetView) => handleLogin(creds, false, targetView)}
              isLoading={isLoadingAuth}
              error={authError}
              onClearError={() => setAuthError(null)}
              lang={lang}
              onSelectLang={handleSelectLang}
              onOpenMacModal={() => setIsMacModalOpen(true)}
              loadedUrl={lastLoadedUrl}
              onDeleteLoadedUrl={handleDeleteLoadedUrl}
              onMacLogin={handleMacLogin}
              onPlayChannel={handleSelectChannel}
              onLoadChannelsToApp={handleLoadChannelsToApp}
              onSelectAction={handleSelectDashboardAction}
            />
          )}

          {/* Step 2: Action Choices (Download, View, or Range Generator) */}
          {viewMode === 'choice' && (
            <ActionChoice
              credentials={credentials || { serverUrl: 'Yaaro Ka Yaar Stream Hub', username: 'Guest Streamer', password: 'demo', isDemo: true }}
              userInfo={userInfo}
              serverInfo={serverInfo}
              onSelectAction={handleSelectDashboardAction}
              lang={lang}
              onSelectLang={handleSelectLang}
            />
          )}

          {/* Option 1: Download Section */}
          {viewMode === 'download' && (
            <DownloadSection
              credentials={credentials || { serverUrl: 'Yaaro Ka Yaar Stream Hub', username: 'Guest Streamer', password: 'demo', isDemo: true }}
              streams={channels}
              isLoadingStreams={isLoadingChannels}
              isValidated={Boolean(catalogStats?.isValidated)}
              isComplete={Boolean(catalogStats?.isComplete)}
              validationStats={catalogStats ? {
                totalChannels: catalogStats.totalChannels ?? channels.length,
                validChannels: catalogStats.validChannels ?? channels.length,
                integrityStatus: catalogStats.integrityStatus ?? 'unknown',
              } : undefined}
              onFetchStreams={() => handleFetchDownloadStreams(true)}
              onBackToChoice={() => setViewMode('login')}
              onReset={handleResetToHome}
              onGoToView={() => setViewMode('download')}
              lang={lang}
            />
          )}

              {/* Option 2: View Channels Section with Web Worker parsing & Virtualization */}
              {viewMode === 'channels' && (
                <ChannelList
                  channels={channels}
                  categories={categories}
                  selectedCategoryId={selectedCategoryId}
                  onSelectCategory={handleSelectCategory}
                  onSelectChannel={handleSelectChannel}
                  onBackToChoice={() => setViewMode('choice')}
                  onGoToDownload={() => setViewMode('download')}
                  isLoading={isLoadingChannels}
                  lang={lang}
                  onRefreshCatalog={() => handleOpenViewChannels(true)}
                  catalogStats={catalogStats}
                />
              )}

              {/* Option 3: Sequential Range URL & M3U Playlist Generator Page */}
              {viewMode === 'range_generator' && (
                <div className="max-w-4xl mx-auto px-4 py-8">
                  <button
                    onClick={() => setViewMode('choice')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-lg mb-6 shadow-2xs transition-colors cursor-pointer"
                  >
                    ← {t('back', lang)}
                  </button>
                  <RangeUrlGenerator
                    lang={lang}
                    onPlayChannel={handleSelectChannel}
                  />
                </div>
              )}

              {/* Option 4: Link Master Page (M3U Encrypted Aliases) */}
              {viewMode === 'link_master' && (
                <div className="max-w-4xl mx-auto px-4 py-8">
                  <button
                    onClick={() => setViewMode('choice')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-lg mb-6 shadow-2xs transition-colors cursor-pointer"
                  >
                    ← {t('back', lang)}
                  </button>
                  <LinkMasterModal
                    isStandalonePage={true}
                    lang={lang}
                    onPlayChannel={handleSelectChannel}
                    onLoadToApp={handleLoadChannelsToApp}
                  />
                </div>
              )}

              {/* Option 5: Track URL Page (M3U Short Link & Device Analytics) */}
              {viewMode === 'track_url' && (
                <div className="max-w-5xl mx-auto px-4 py-8">
                  <button
                    onClick={() => setViewMode('choice')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-lg mb-6 shadow-2xs transition-colors cursor-pointer"
                  >
                    ← {t('back', lang)}
                  </button>
                  <TrackUrlModal
                    isStandalonePage={true}
                    lang={lang}
                    onPlayChannel={handleSelectChannel}
                  />
                </div>
              )}

              {/* Option 6: M3U Playlist Verifier Page (Live Probe & Active Playlist Generator) */}
              {viewMode === 'verifier' && (
                <div className="max-w-5xl mx-auto px-4 py-8">
                  <button
                    onClick={() => setViewMode('choice')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-lg mb-6 shadow-2xs transition-colors cursor-pointer"
                  >
                    ← {t('back', lang)}
                  </button>
                  <PlaylistVerifierModal
                    isStandalonePage={true}
                    lang={lang}
                    onPlayChannel={handleSelectChannel}
                    onLoadChannelsToApp={handleLoadChannelsToApp}
                  />
                </div>
              )}
        </main>
      </>
    )}
  </>

      {/* MAC URL Portal Modal Interface (Opens on 'MAC URL' click) */}
      {isMacModalOpen && (
        <MacPortalModal
          isOpen={isMacModalOpen}
          onClose={() => setIsMacModalOpen(false)}
          lang={lang}
          onMacLogin={handleMacLogin}
        />
      )}

      {/* Range URL Generator Modal Interface (Opens on 'Range URL' header click) */}
      {isRangeModalOpen && (
        <RangeUrlGenerator
          lang={lang}
          isModal={true}
          onClose={() => setIsRangeModalOpen(false)}
          onPlayChannel={(ch) => {
            setIsRangeModalOpen(false);
            handleSelectChannel(ch, 'range');
          }}
        />
      )}

      {/* Link Master Modal Interface (Opens on 'Link Master' header click) */}
      {isLinkMasterModalOpen && (
        <LinkMasterModal
          isOpen={isLinkMasterModalOpen}
          onClose={() => setIsLinkMasterModalOpen(false)}
          lang={lang}
          onPlayChannel={(ch) => {
            setIsLinkMasterModalOpen(false);
            handleSelectChannel(ch, 'linkmaster');
          }}
          onLoadToApp={(chList, cats) => {
            setIsLinkMasterModalOpen(false);
            handleLoadChannelsToApp(chList, cats);
          }}
        />
      )}

      {/* Import Playlist Modal Interface (Opens on 'Import Playlist' header click) */}
      {isImportModalOpen && (
        <ImportPlaylistModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          lang={lang}
          onPlayChannel={(ch) => {
            setIsImportModalOpen(false);
            handleSelectChannel(ch, 'import');
          }}
          onLoadChannelsToApp={(importedChs) => {
            setIsImportModalOpen(false);
            handleLoadChannelsToApp(importedChs);
          }}
        />
      )}

      {/* Track URL Modal Interface (Opens on 'Track URL' header or dashboard click) */}
      {isTrackUrlModalOpen && (
        <TrackUrlModal
          isOpen={isTrackUrlModalOpen}
          onClose={() => setIsTrackUrlModalOpen(false)}
          lang={lang}
          onPlayChannel={(ch) => {
            setIsTrackUrlModalOpen(false);
            handleSelectChannel(ch, 'track');
          }}
        />
      )}

      {/* Dedicated URL to Short (is.gd API) Modal */}
      {isUrlToShortModalOpen && (
        <UrlToShortModal
          isOpen={isUrlToShortModalOpen}
          onClose={() => setIsUrlToShortModalOpen(false)}
          lang={lang}
        />
      )}

      {/* Dedicated Masking URL Generator Modal */}
      {isMaskingUrlModalOpen && (
        <MaskingUrlModal
          isOpen={isMaskingUrlModalOpen}
          onClose={() => setIsMaskingUrlModalOpen(false)}
          lang={lang}
        />
      )}

      {/* URL Shield Modal (M3U Masker via URLVanish) */}
      {isUrlShieldModalOpen && (
        <UrlShieldModal
          isOpen={isUrlShieldModalOpen}
          onClose={() => setIsUrlShieldModalOpen(false)}
          lang={lang}
          onPlayChannel={(ch) => {
            setIsUrlShieldModalOpen(false);
            handleSelectChannel(ch, 'shield');
          }}
          onLoadChannelsToApp={(chs) => {
            setIsUrlShieldModalOpen(false);
            handleLoadChannelsToApp(chs);
          }}
        />
      )}

      {/* M3U Playlist Verifier Modal Interface (Opens on 'Verify M3U' header or dashboard click) */}
      {isVerifierModalOpen && (
        <PlaylistVerifierModal
          isOpen={isVerifierModalOpen}
          onClose={() => setIsVerifierModalOpen(false)}
          lang={lang}
          onPlayChannel={(ch) => {
            setIsVerifierModalOpen(false);
            handleSelectChannel(ch, 'verifier');
          }}
          onLoadChannelsToApp={(verifiedChs) => {
            setIsVerifierModalOpen(false);
            handleLoadChannelsToApp(verifiedChs);
          }}
        />
      )}

      {/* User Feedback & 5-Star Rating Modal */}
      {isFeedbackModalOpen && (
        <FeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          lang={lang}
        />
      )}

      {/* Image to URL (ImgBB API) Modal Interface */}
      {isImageToUrlModalOpen && (
        <ImageToUrlModal
          isOpen={isImageToUrlModalOpen}
          onClose={() => setIsImageToUrlModalOpen(false)}
          lang={lang}
        />
      )}

      {/* Notification Realtime Screen Modal */}
      <DesktopNoteModal
        isOpen={isDesktopNoteModalOpen}
        onClose={() => setIsDesktopNoteModalOpen(false)}
        currentUsername={credentials?.username || authUser?.displayName || 'Yaaro Ka Yaar'}
        lang={lang}
      />

      {/* URL Inspector Modal Interface */}
      <UrlInspectorModal
        isOpen={isUrlInspectorModalOpen}
        onClose={() => setIsUrlInspectorModalOpen(false)}
        lang={lang}
        onPlayChannel={handleSelectChannel}
      />

      {/* Account Authentication Modal (Sign In, Sign Up, Google, Forgot Password) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(user) => {
          setAuthUser(user);
        }}
      />

      {/* Full-Screen Video Player Component (Plays on selecting any channel via FFmpeg) */}
      {credentials && activeChannel && (
        <FullScreenPlayer
          channel={activeChannel}
          allChannels={channels.length > 0 ? channels : [activeChannel]}
          credentials={credentials}
          onClose={handleClosePlayer}
          onSelectChannel={(newChannel) => setActiveChannel(newChannel)}
          lang={lang}
        />
      )}

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200/90 bg-white/95 backdrop-blur-md text-center text-xs text-slate-500 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BrandLogoIcon size={22} />
            <p className="font-semibold text-slate-700">
              {t('footer_text', lang)}
            </p>
          </div>
          {/* Modern branding element featuring 'Yaaro Ka Yaar Stream' */}
          <FooterBranding onClick={() => setIsFeedbackModalOpen(true)} />
        </div>
      </footer>

      {/* Floating Feedback & Notes Icon Widget */}
      <button
        type="button"
        onClick={() => setIsFeedbackModalOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-40 p-2.5 sm:px-3.5 sm:py-2.5 bg-gradient-to-r from-rose-600 via-indigo-600 to-indigo-700 hover:from-rose-500 hover:to-indigo-600 text-white rounded-full shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer border border-white/20 select-none group"
        title="Feedback / Notes (Sends to Yaaro Ka Yaar via SMTP)"
        aria-label="Open Feedback & Notes Modal"
      >
        <MessageSquare className="w-4 h-4 text-amber-300 group-hover:rotate-12 transition-transform shrink-0" />
        <span className="text-xs font-extrabold hidden sm:inline">Feedback / Notes</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
      </button>
    </div>
  );
}
