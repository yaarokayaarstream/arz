export interface BrowserHistoryItem {
  id: string;
  url: string;
  title: string;
  timestamp: number;
}

export interface BrowserDownloadItem {
  id: string;
  fileName: string;
  format: string;
  size?: string;
  url?: string;
  timestamp: number;
  status: 'completed' | 'downloading' | 'failed';
}

const HISTORY_KEY = 'streamhub_browser_history';
const DOWNLOADS_KEY = 'streamhub_browser_downloads';

// Default initial history starting with Google
const DEFAULT_HISTORY: BrowserHistoryItem[] = [
  {
    id: 'hist_google_1',
    url: 'https://www.google.com',
    title: 'Google Search',
    timestamp: Date.now() - 1000 * 60 * 5,
  },
  {
    id: 'hist_google_2',
    url: 'https://www.google.com/search?q=live+tv+channels+online',
    title: 'Google Search: live tv channels online',
    timestamp: Date.now() - 1000 * 60 * 15,
  },
  {
    id: 'hist_google_3',
    url: 'https://www.google.com/search?q=iptv+m3u+playlist+player',
    title: 'Google Search: iptv m3u playlist player',
    timestamp: Date.now() - 1000 * 60 * 45,
  },
];

const DEFAULT_DOWNLOADS: BrowserDownloadItem[] = [
  {
    id: 'dl_1',
    fileName: 'playlist_streamhub_demo.m3u',
    format: 'M3U Plus',
    size: '184 KB',
    url: '/api/xtream/download-playlist',
    timestamp: Date.now() - 1000 * 60 * 30,
    status: 'completed',
  },
  {
    id: 'dl_2',
    fileName: 'playlist_mac_portal.m3u',
    format: 'M3U (MAG Portal)',
    size: '96 KB',
    url: '/api/mac-portal/download',
    timestamp: Date.now() - 1000 * 60 * 90,
    status: 'completed',
  },
];

export function getBrowserHistory(): BrowserHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return DEFAULT_HISTORY;
}

export function addBrowserHistory(url: string, title?: string): BrowserHistoryItem[] {
  try {
    const current = getBrowserHistory();
    const cleanUrl = url.trim();
    // Prevent duplicate top item
    const filtered = current.filter((item) => item.url.toLowerCase() !== cleanUrl.toLowerCase());
    
    let displayTitle = title || cleanUrl;
    try {
      const parsed = new URL(cleanUrl);
      if (parsed.searchParams.has('q')) {
        displayTitle = `Google: ${parsed.searchParams.get('q')}`;
      } else if (parsed.hostname.includes('google')) {
        displayTitle = 'Google Search';
      }
    } catch {
      // ignore
    }

    const newItem: BrowserHistoryItem = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      url: cleanUrl,
      title: displayTitle,
      timestamp: Date.now(),
    };

    const updated = [newItem, ...filtered].slice(0, 100); // keep up to 100 entries
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearBrowserHistory(): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([]));
  } catch {
    // ignore
  }
}

export function deleteBrowserHistoryItem(id: string): BrowserHistoryItem[] {
  try {
    const current = getBrowserHistory();
    const updated = current.filter((item) => item.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function getBrowserDownloads(): BrowserDownloadItem[] {
  try {
    const raw = localStorage.getItem(DOWNLOADS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return DEFAULT_DOWNLOADS;
}

export function addBrowserDownload(item: {
  fileName: string;
  format: string;
  size?: string;
  url?: string;
}): BrowserDownloadItem[] {
  try {
    const current = getBrowserDownloads();
    const newItem: BrowserDownloadItem = {
      id: `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      fileName: item.fileName,
      format: item.format,
      size: item.size || '128 KB',
      url: item.url,
      timestamp: Date.now(),
      status: 'completed',
    };

    const updated = [newItem, ...current].slice(0, 50);
    localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearBrowserDownloads(): void {
  try {
    localStorage.setItem(DOWNLOADS_KEY, JSON.stringify([]));
  } catch {
    // ignore
  }
}

export function deleteBrowserDownloadItem(id: string): BrowserDownloadItem[] {
  try {
    const current = getBrowserDownloads();
    const updated = current.filter((item) => item.id !== id);
    localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}
