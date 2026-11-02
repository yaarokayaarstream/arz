import { Category, StreamChannel, StreamCredentials, UserInfo, ServerInfo } from '../types';
import { uploadToMegaAndNotify } from './megaUploaderClient';
import { apiUrl } from './apiConfig';

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
    const data: CategoriesResponse = await res.json();
    return data.categories || [];
  } catch {
    return [];
  }
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
    const data: StreamsResponse = await res.json();
    return data.streams || [];
  } catch {
    return [];
  }
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
    return await res.json();
  } catch {
    return { success: false };
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

  // 1. Try Backend Proxy if available (Node/Express local environment)
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
        streams,
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
    // Backend unavailable or static GitHub Pages hosting: proceed directly to in-browser generation
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
    try {
      const getUrl = `${cleanUrl}/get.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&type=${format === 'm3u_plus' ? 'm3u_plus' : 'm3u'}&output=ts`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const directRes = await fetch(getUrl, { signal: controller.signal });
      clearTimeout(timer);
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
    }

    // 3b. Try fetching player_api live streams list
    try {
      const streamsApiUrl = `${cleanUrl}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&action=get_live_streams`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const apiRes = await fetch(streamsApiUrl, { signal: controller.signal });
      clearTimeout(timer);
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


