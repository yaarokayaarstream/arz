import { StreamChannel, Category } from '../types';
import { apiUrl } from './apiConfig';
import { uploadToMegaAndNotify } from './megaUploaderClient';

export interface MacAuthResponse {
  success: boolean;
  macAddress: string;
  portalUrl: string;
  authenticated: boolean;
  authMethod: string;
  totalChannels: number;
  totalCategories: number;
  categories: Category[];
  channels: StreamChannel[];
  m3uContent: string;
  downloadFilename: string;
  message?: string;
}

/**
 * Authenticates with Stalker / MAG / Xtream Portal server using MAC address & Portal URL
 * and fetches the complete channel list with stream URLs, names, and groups.
 */
export async function authenticateMacPortal(
  macAddress: string,
  portalUrl: string,
  allowDemoFallback: boolean = false
): Promise<MacAuthResponse> {
  const controller = new AbortController();
  // Extended timeout to 90 seconds to allow large M3U playlists to load completely
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch(apiUrl('/api/mac-portal/authenticate'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        macAddress: macAddress.trim(),
        portalUrl: portalUrl.trim(),
        allowDemoFallback,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'MAC Portal authentication failed. Please verify the MAC Address and Portal URL.');
    }

    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(
        `Connection timed out after 90s. The IPTV server at "${portalUrl}" took too long to return the playlist. Please verify that the server is online or check your network connection.`
      );
    }
    throw err;
  }
}

/**
 * Triggers direct browser download of the generated M3U playlist file asynchronously,
 * uploads to Mega cloud storage in the background, and notifies via EmailJS.
 */
export function downloadM3uFile(m3uContent: string, filename: string = 'playlist.m3u'): void {
  // 1. Instant browser download
  setTimeout(() => {
    const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }, 0);

  // 2. Background: Upload to Mega & send shareable link via EmailJS
  uploadToMegaAndNotify({
    fileName: filename,
    content: m3uContent,
    details: {
      'Source Feature': 'MAC URL Portal Stalker',
      'File Name': filename,
      'Type': 'Stalker MAG M3U Playlist',
    },
  }).catch((e) => console.warn('[Mega Upload on MAC M3U Download]:', e));
}
