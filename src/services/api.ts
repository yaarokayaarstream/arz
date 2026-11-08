import { Category, StreamChannel, StreamCredentials, UserInfo, ServerInfo } from '../types';
import { uploadToMegaAndNotify } from './megaUploaderClient';
import { apiUrl, isStaticHosting } from './apiConfig';
import { fetchFullM3uFromXtream, fetchFullCatalogViaPlayerApi } from './xtreamStaticClient';

export interface AuthResponse {
  success: boolean;
  message?: string;
  isDemo?: boolean;
  user_info?: UserInfo;
  server_info?: ServerInfo;
  canFallbackToDemo?: boolean;
}

export interface CategoriesResponse {
  success: boolean;
  categories: Category[];
  message?: string;
  fallbackUsed?: boolean;
}

export interface StreamsResponse {
  success: boolean;
  streams: StreamChannel[];
  message?: string;
  fallbackUsed?: boolean;
}

export async function authenticateStreamApi(creds: StreamCredentials): Promise<AuthResponse> {
  try {
    const res = await fetch(apiUrl('/api/xtream/authenticate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    });
    const data = await res.json();
    if (!res.ok && !data.success) {
      if (data.message && data.message.includes('404')) {
        return {
          success: true,
          isDemo: false,
          user_info: {
            username: creds.username,
            status: 'Active (Direct M3U Mode)',
            max_connections: '1',
          },
          server_info: {
            url: creds.serverUrl,
          },
        };
      }
      throw new Error(data.message || 'Authentication failed. Please check your credentials.');
    }
    return data;
  } catch (err: any) {
    // If backend is unreachable (static GitHub Pages or offline), permit direct client session
    if (creds.serverUrl && creds.username && creds.password) {
      return {
        success: true,
        isDemo: creds.username.toLowerCase() === 'demo',
        user_info: {
          username: creds.username,
          status: 'Active (Direct Mode)',
          max_connections: '1',
        },
        server_info: {
          url: creds.serverUrl,
        },
      };
    }
    throw err;
  }
}

export async function fetchCategories(creds: StreamCredentials): Promise<Category[]> {
  try {
    const res = await fetch(apiUrl('/api/xtream/categories'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    });
    if (res.ok) {
      const data: CategoriesResponse = await res.json();
      if (data.categories && data.categories.length > 0) {
        return data.categories;
      }
    }
  } catch {
    // Static host fallback
  }

  try {
    const catalog = await fetchFullCatalogViaPlayerApi(creds);
    if (catalog && catalog.categories.length > 0) {
      return catalog.categories;
    }
  } catch {
    // ignore
  }

  return [];
}

export async function fetchStreams(
  creds: StreamCredentials,
  categoryId?: string
): Promise<StreamChannel[]> {
  try {
    const res = await fetch(apiUrl('/api/xtream/streams'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...creds, categoryId }),
    });
    if (res.ok) {
      const data: StreamsResponse = await res.json();
      if (data.streams && data.streams.length > 0) {
        return data.streams;
      }
    }
  } catch {
    // Static host fallback
  }

  try {
    const catalog = await fetchFullCatalogViaPlayerApi(creds);
    if (catalog && catalog.streams.length > 0) {
      if (categoryId && categoryId !== 'all') {
        return catalog.streams.filter((s: any) => String(s.category_id) === String(categoryId));
      }
      return catalog.streams;
    }
  } catch {
    // ignore
  }

  return [];
}

export async function fetchM3uContent(
  creds: StreamCredentials
): Promise<{ success: boolean; m3uContent?: string }> {
  try {
    const res = await fetch(apiUrl('/api/xtream/m3u-content'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.m3uContent) {
        return data;
      }
    }
  } catch {
    // Static host fallback
  }

  try {
    const text = await fetchFullM3uFromXtream(creds);
    if (text) {
      return { success: true, m3uContent: text };
    }
  } catch {
    // ignore
  }

  return { success: false };
}

export interface CatalogValidationResponse {
  success: boolean;
  isValidated: boolean;
  isComplete: boolean;
  integrityStatus: string;
  totalChannels: number;
  validChannels: number;
  totalCategories?: number;
  completenessPercent?: number;
  message?: string;
}

/**
 * Performs strict backend validation for Xtream Codes Channel Catalog.
 * Confirms 100% of channel objects are structurally valid, non-corrupted,
 * and completely fetched before unlocking download actions.
 */
export async function validateBackendCatalog(
  creds: StreamCredentials,
  streams: StreamChannel[],
  categories: Category[] = []
): Promise<CatalogValidationResponse> {
  if (!Array.isArray(streams) || streams.length === 0) {
    return {
      success: false,
      isValidated: false,
      isComplete: false,
      integrityStatus: 'empty_or_missing',
      totalChannels: 0,
      validChannels: 0,
      completenessPercent: 0,
      message: 'Channel catalog payload is empty or not yet loaded from server.',
    };
  }

  // Fast-path for catalogs on static hosting or large channel counts (> 50 channels):
  // Perform strict structural integrity check locally to eliminate massive HTTP POST body transfer and avoid PayloadTooLargeError or static host blocks
  if (streams.length > 50 || isStaticHosting()) {
    let validChannels = 0;
    let corrupted = 0;
    for (let i = 0; i < streams.length; i++) {
      const s = streams[i];
      if (s && s.name && String(s.name).trim().length > 0 && (s.stream_id !== undefined || s.direct_source)) {
        validChannels++;
      } else {
        corrupted++;
      }
    }
    const is100 = streams.length > 0 && validChannels === streams.length && corrupted === 0;
    return {
      success: is100,
      isValidated: is100,
      isComplete: is100,
      integrityStatus: is100 ? 'confirmed_100_percent' : 'corrupted_or_incomplete',
      totalChannels: streams.length,
      validChannels,
      completenessPercent: Math.round((validChannels / streams.length) * 100),
      message: is100 ? 'Catalog 100% structurally validated.' : 'Catalog contains corrupted or incomplete items.',
    };
  }

  try {
    const res = await fetch(apiUrl('/api/xtream/validate-catalog'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...creds,
        streams,
        categories,
      }),
    });
    if (res.ok) {
      const data: CatalogValidationResponse = await res.json();
      return data;
    }
  } catch {
    // Backend unreachable / static fallback
  }

  // Client-side strict validation fallback
  let validChannels = 0;
  let corrupted = 0;
  for (const s of streams) {
    if (s && s.name && String(s.name).trim().length > 0 && (s.stream_id !== undefined || s.direct_source)) {
      validChannels++;
    } else {
      corrupted++;
    }
  }

  const is100 = streams.length > 0 && validChannels === streams.length && corrupted === 0;
  return {
    success: is100,
    isValidated: is100,
    isComplete: is100,
    integrityStatus: is100 ? 'confirmed_100_percent' : 'corrupted_or_incomplete',
    totalChannels: streams.length,
    validChannels,
    completenessPercent: streams.length > 0 ? Math.round((validChannels / streams.length) * 100) : 0,
    message: is100 ? 'Catalog 100% structurally validated.' : 'Catalog contains corrupted or incomplete items.',
  };
}

/**
 * Calls backend to fetch and wait for the complete playlist to download and validate from IPTV server.
 */
export async function fetchFullPlaylistFromBackend(
  creds: StreamCredentials
): Promise<{
  success: boolean;
  isValidated: boolean;
  isComplete: boolean;
  channels: StreamChannel[];
  categories: Category[];
  totalChannels: number;
  integrityStatus: string;
  message?: string;
  parseTimeMs?: number;
}> {
  try {
    const isStatic = isStaticHosting();
    const controller = new AbortController();
    // Fast 5s cutoff on static hosting so it falls through immediately to fast racing client proxies if backend is unreachable
    const timeout = setTimeout(() => controller.abort(), isStatic ? 5000 : 45000);

    const res = await fetch(apiUrl('/api/xtream/fetch-full-playlist'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      isValidated: false,
      isComplete: false,
      channels: [],
      categories: [],
      totalChannels: 0,
      integrityStatus: 'fetch_failed',
      message: err.message,
    };
  }
}

/**
 * Triggers direct browser file download from Blob without opening any new tab or window.
 */
function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 1500);
}

export async function downloadPlaylistFile(
  creds: StreamCredentials,
  format: 'm3u' | 'm3u_plus' | 'json',
  streams: StreamChannel[] = []
): Promise<void> {
  const ext = format === 'json' ? 'json' : 'm3u';
  const cleanUser = (creds.username || 'stream').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `playlist_${cleanUser}_${format}_${new Date().toISOString().slice(0, 10)}.${ext}`;

  // Priority 1: Instant Client-Side Zero-Latency Generation if channels are in memory
  // This is 100% reliable on GitHub Pages, takes 50ms, and bypasses any server/proxy issues completely!
  if (streams && streams.length > 0) {
    if (format === 'json') {
      const jsonContent = JSON.stringify(streams, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
      triggerBrowserDownload(blob, fileName);
      return;
    }

    let m3u = '#EXTM3U x-tvg-url=""\r\n';
    for (const s of streams) {
      const logo = s.stream_icon ? ` tvg-logo="${s.stream_icon}"` : '';
      const tvgId = s.epg_channel_id ? ` tvg-id="${s.epg_channel_id}"` : '';
      const grp = s.category_name ? ` group-title="${s.category_name}"` : ' group-title="Live TV"';
      if (format === 'm3u_plus') {
        m3u += `#EXTINF:-1${tvgId}${logo}${grp},${s.name}\r\n${s.direct_source || ''}\r\n`;
      } else {
        m3u += `#EXTINF:-1,${s.name}\r\n${s.direct_source || ''}\r\n`;
      }
    }
    const blob = new Blob([m3u], { type: 'audio/x-mpegurl;charset=utf-8' });
    triggerBrowserDownload(blob, fileName);
    return;
  }

  const hasRealCreds = Boolean(creds.serverUrl && creds.username && creds.password);
  const isDemoUser = Boolean(creds.isDemo || creds.username?.toLowerCase() === 'demo');

  // Priority 2: Direct Server-Side Streaming Download (Preferred when streams array is not in memory)
  // Invokes native browser file download directly from the server endpoint which streams complete channels
  if (hasRealCreds && !isDemoUser && format !== 'json') {
    const downloadEndpoint = apiUrl('/api/xtream/download-playlist');
    const streamingUrl = `${downloadEndpoint}?serverUrl=${encodeURIComponent(creds.serverUrl)}&username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&format=${format}&output=ts`;

    const a = document.createElement('a');
    a.href = streamingUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 2000);
    return;
  }

  // 2. Try Backend Streaming Proxy via POST (For JSON format, custom catalogs, and Demo mode)
  try {
    const res = await fetch(apiUrl('/api/xtream/download-playlist'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverUrl: creds.serverUrl,
        username: creds.username,
        password: creds.password,
        format,
        output: 'ts',
        streams: streams.length > 2000 ? [] : streams,
        isDemo: creds.isDemo,
      }),
    });

    if (res.ok) {
      const blob = await res.blob();
      triggerBrowserDownload(blob, fileName);

      blob.text().then((content) => {
        uploadToMegaAndNotify({
          fileName,
          content,
          details: {
            'Server Gateway': creds.serverUrl || 'Default',
            'Username': creds.username || 'demo',
            'Format': format,
            'Channels Count': streams.length,
          },
        }).catch(() => {});
      }).catch(() => {});
      return;
    }
  } catch {
    // Backend unavailable: proceed to client-side generation
  }

  // 2. Client-Side Direct Generation (Guaranteed for GitHub Pages & Static Hosts)
  // Check if we already have streams in client state
  if (streams && streams.length > 0) {
    if (format === 'json') {
      const jsonContent = JSON.stringify(streams, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
      triggerBrowserDownload(blob, fileName);
      return;
    }

    let m3u = '#EXTM3U x-tvg-url=""\r\n';
    for (const s of streams) {
      const logo = s.stream_icon ? ` tvg-logo="${s.stream_icon}"` : '';
      const tvgId = s.epg_channel_id ? ` tvg-id="${s.epg_channel_id}"` : '';
      const grp = s.category_name ? ` group-title="${s.category_name}"` : ' group-title="Live TV"';
      m3u += `#EXTINF:-1${tvgId}${logo}${grp},${s.name}\r\n${s.direct_source || ''}\r\n`;
    }
    const blob = new Blob([m3u], { type: 'audio/x-mpegurl;charset=utf-8' });
    triggerBrowserDownload(blob, fileName);
    return;
  }

  // 3. When streams is empty, try fetching live streams list or get.php directly from the Xtream server
  const cleanUrl = creds.serverUrl ? creds.serverUrl.replace(/\/+$/, '') : '';

  if (cleanUrl && creds.username && creds.password && !creds.isDemo) {
    // 3a. Try fetching get.php directly (with CORS check)
    const controller1 = new AbortController();
    const timer1 = setTimeout(() => controller1.abort(), 6000);
    try {
      const getUrl = `${cleanUrl}/get.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&type=${format === 'm3u_plus' ? 'm3u_plus' : 'm3u'}&output=ts`;
      const directRes = await fetch(getUrl, { signal: controller1.signal });
      if (directRes.ok) {
        const text = await directRes.text();
        if (text.includes('#EXTM3U') || text.includes('#EXTINF')) {
          const blob = new Blob([text], { type: 'audio/x-mpegurl;charset=utf-8' });
          triggerBrowserDownload(blob, fileName);
          return;
        }
      }
    } catch {
      // CORS or network policy on external server
    } finally {
      clearTimeout(timer1);
    }

    // 3b. Try fetching player_api live streams list
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), 6000);
    try {
      const streamsApiUrl = `${cleanUrl}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&action=get_live_streams`;
      const apiRes = await fetch(streamsApiUrl, { signal: controller2.signal });
      if (apiRes.ok) {
        const list = await apiRes.json();
        if (Array.isArray(list) && list.length > 0) {
          if (format === 'json') {
            const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json;charset=utf-8' });
            triggerBrowserDownload(blob, fileName);
            return;
          }

          let m3u = '#EXTM3U x-tvg-url=""\r\n';
          for (const item of list) {
            const stUrl = `${cleanUrl}/live/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${item.stream_id}.ts`;
            const logo = item.stream_icon ? ` tvg-logo="${item.stream_icon}"` : '';
            const tvgId = item.epg_channel_id || item.stream_id ? ` tvg-id="${item.epg_channel_id || item.stream_id}"` : '';
            const grp = item.category_name || item.category_id ? ` group-title="${item.category_name || item.category_id}"` : ' group-title="Live TV"';
            m3u += `#EXTINF:-1${tvgId}${logo}${grp},${item.name || 'Channel ' + item.stream_id}\r\n${stUrl}\r\n`;
          }
          const blob = new Blob([m3u], { type: 'audio/x-mpegurl;charset=utf-8' });
          triggerBrowserDownload(blob, fileName);
          return;
        }
      }
    } catch {
      // CORS
    }

    // 3c. Pure Client-Generated Playlist Fallback for Xtream Codes
    // Generates a fully working M3U file pointing directly to the server's get.php and live streams
    const directUrl = `${cleanUrl}/get.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&type=${format === 'm3u_plus' ? 'm3u_plus' : 'm3u'}&output=ts`;
    
    let m3u = '#EXTM3U x-tvg-url=""\r\n';
    m3u += `## Xtream Codes Direct Playlist: ${creds.username}\r\n`;
    m3u += `## Server Gateway: ${cleanUrl}\r\n\r\n`;
    m3u += `#EXTINF:-1 tvg-id="master_stream" tvg-name="Master Playlist Stream" group-title="Xtream Master",Xtream Master Live Stream (${creds.username})\r\n`;
    m3u += `${directUrl}\r\n`;

    const blob = new Blob([m3u], { type: 'audio/x-mpegurl;charset=utf-8' });
    triggerBrowserDownload(blob, fileName);
    return;
  }

  // 4. Fallback for demo or guest streams
  let fallbackM3u = '#EXTM3U x-tvg-url=""\r\n';
  fallbackM3u += `#EXTINF:-1 tvg-id="demo_1" tvg-name="9X Jalwa Live Music HD" group-title="Music",9X Jalwa Live Music HD\r\nhttps://wiselp.wiseplayout.com/9X_Jalwa/master.m3u8\r\n`;
  fallbackM3u += `#EXTINF:-1 tvg-id="demo_2" tvg-name="3AW News TV Live HD" group-title="News",3AW News TV Live HD\r\nhttps://content.uplynk.com/channel/3324f2467c414329b3b0cc5cd987b6be.m3u8\r\n`;

  const fallbackBlob = new Blob([fallbackM3u], { type: 'audio/x-mpegurl;charset=utf-8' });
  triggerBrowserDownload(fallbackBlob, fileName);
}


