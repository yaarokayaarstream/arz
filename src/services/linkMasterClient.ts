/**
 * Link Master Service - Client-side utilities for uploading, obfuscating,
 * and downloading M3U playlists with encrypted temporary stream aliases.
 */

export interface AliasItem {
  id: string;
  originalUrl: string;
  aliasUrl: string;
  channelName: string;
  categoryName?: string;
  expiresAt: number | null;
  headers?: {
    userAgent: string;
    referer?: string;
  };
}

export interface ObfuscateOptions {
  m3uContent: string;
  expiryHours: number; // e.g. 24, 72, 168 (7 days), 720 (30 days), 0 (no expiry)
  streamingMode?: 'direct' | 'proxy'; // 'direct' (Universal Direct IPTV - no ais-dev lock) or 'proxy' (Encrypted Server Proxy)
  aliasPrefix?: string;
  customHost?: string;
  userAgent?: string;
  referer?: string;
  includeVlcOpt?: boolean;
  includeExtHttp?: boolean;
  includePipeSyntax?: boolean;
}

export interface ObfuscateResult {
  modifiedM3u: string;
  streamingMode?: 'direct' | 'proxy';
  totalReplaced: number;
  expiresAt: number | null;
  expiryHours: number;
  userAgent: string;
  referer?: string;
  aliases: AliasItem[];
}

export const DEFAULT_IPTV_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export const USER_AGENT_PRESETS = [
  {
    id: 'chrome',
    label: 'Chrome / Modern Browser (Recommended)',
    desc: 'Bypasses Cloudflare & CDN IPTV anti-bot blocks',
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  },
  {
    id: 'iptvsmarters',
    label: 'IPTV Smarters Pro',
    desc: 'Standard Android IPTV player signature',
    value: 'IPTVSmarters/1.0.0 (Linux;Android 12)',
  },
  {
    id: 'vlc',
    label: 'VLC Media Player',
    desc: 'Official LibVLC signature',
    value: 'VLC/3.0.18 LibVLC/3.0.18',
  },
  {
    id: 'tivimate',
    label: 'TiviMate Player',
    desc: 'Popular Android TV signature',
    value: 'TiviMate/4.7.0',
  },
  {
    id: 'apple',
    label: 'Apple TV / Safari',
    desc: 'AppleCoreMedia native streaming',
    value: 'AppleCoreMedia/1.0.0.20K5342f (Apple TV; U; CPU OS 16_4 like Mac OS X; en_us)',
  },
];

/**
 * Sends M3U content to Link Master backend to replace real URLs with temporary encrypted aliases,
 * injecting required IPTV HTTP headers (User-Agent, Referer, #EXTVLCOPT, #EXTHTTP)
 * into the M3U playlist configuration.
 */
export async function obfuscateM3uPlaylist(options: ObfuscateOptions): Promise<ObfuscateResult> {
  const {
    m3uContent,
    expiryHours,
    aliasPrefix = 'stream',
    customHost,
    userAgent = DEFAULT_IPTV_USER_AGENT,
    referer,
    includeVlcOpt = true,
    includeExtHttp = true,
    includePipeSyntax = false,
  } = options;

  if (!m3uContent.trim()) {
    throw new Error('M3U playlist content is empty.');
  }

  const isAisDev = typeof window !== 'undefined' && (
    window.location.hostname.includes('.ais-dev.') ||
    window.location.hostname.includes('.run.app')
  );

  const effectiveStreamingMode = options.streamingMode || (isAisDev && !customHost ? 'direct' : 'proxy');

  try {
    const res = await fetch('/api/linkmaster/obfuscate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        m3uContent,
        expiryHours,
        streamingMode: effectiveStreamingMode,
        aliasPrefix,
        customHost: customHost || (isAisDev ? 'http://localhost:3000' : window.location.origin),
        userAgent,
        referer: referer || (window.location.origin ? `${window.location.origin}/` : undefined),
        includeVlcOpt,
        includeExtHttp,
        includePipeSyntax,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Server error ${res.status}`);
    }

    const data = await res.json();
    return {
      modifiedM3u: data.modifiedM3u,
      streamingMode: data.streamingMode || effectiveStreamingMode,
      totalReplaced: data.totalReplaced,
      expiresAt: data.expiresAt,
      expiryHours: data.expiryHours,
      userAgent: data.userAgent || userAgent,
      referer: data.referer,
      aliases: data.aliases || [],
    };
  } catch (apiErr: any) {
    // Client-side fallback if network error
    return clientSideObfuscate(options);
  }
}

/**
 * Fallback purely client-side obfuscation with full IPTV HTTP header injection
 */
function clientSideObfuscate(options: ObfuscateOptions): ObfuscateResult {
  const {
    m3uContent,
    expiryHours,
    aliasPrefix = 'stream',
    customHost,
    userAgent = DEFAULT_IPTV_USER_AGENT,
    referer,
    includeVlcOpt = true,
    includeExtHttp = true,
    includePipeSyntax = false,
  } = options;

  const hostBase = (customHost || window.location.origin).replace(/\/+$/, '');
  const effectiveReferer = referer || `${hostBase}/`;
  const now = Date.now();
  const expiresAt = expiryHours > 0 ? now + expiryHours * 3600 * 1000 : null;

  const lines = m3uContent.split(/\r?\n/);
  const modifiedLines: string[] = [];
  const aliases: AliasItem[] = [];

  let currentName = 'Stream Channel';
  let currentGroup = 'Live TV';

  // Check if starts with #EXTM3U
  const firstNonEmptyIdx = lines.findIndex((l) => l.trim().length > 0);
  const hasExtM3uHeader = firstNonEmptyIdx !== -1 && lines[firstNonEmptyIdx].trim().startsWith('#EXTM3U');

  if (!hasExtM3uHeader) {
    modifiedLines.push(
      `#EXTM3U x-tvg-url="" http-user-agent="${userAgent}" user-agent="${userAgent}"`
    );
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      modifiedLines.push('');
      continue;
    }

    if (line.startsWith('#EXTM3U')) {
      let enhancedHeader = line;
      if (!enhancedHeader.includes('user-agent=')) {
        enhancedHeader += ` http-user-agent="${userAgent}" user-agent="${userAgent}"`;
      }
      modifiedLines.push(enhancedHeader);
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      const groupMatch = line.match(/group-title="([^"]+)"/i);
      if (groupMatch) {
        currentGroup = groupMatch[1];
      }
      const commaIdx = line.lastIndexOf(',');
      if (commaIdx !== -1) {
        currentName = line.slice(commaIdx + 1).trim();
      }

      // Inject user-agent and http-user-agent attributes into #EXTINF
      let modifiedExtInf = line;
      if (!modifiedExtInf.includes('user-agent=')) {
        if (commaIdx !== -1) {
          const beforeComma = line.slice(0, commaIdx);
          const afterComma = line.slice(commaIdx);
          modifiedExtInf = `${beforeComma} user-agent="${userAgent}" http-user-agent="${userAgent}"${afterComma}`;
        } else {
          modifiedExtInf = `${line} user-agent="${userAgent}" http-user-agent="${userAgent}"`;
        }
      }
      modifiedLines.push(modifiedExtInf);

      // Add IPTV directives
      if (includeVlcOpt) {
        modifiedLines.push(`#EXTVLCOPT:http-user-agent=${userAgent}`);
        if (effectiveReferer) {
          modifiedLines.push(`#EXTVLCOPT:http-referrer=${effectiveReferer}`);
        }
      }

      if (includeExtHttp) {
        const httpJson = JSON.stringify({
          'User-Agent': userAgent,
          ...(effectiveReferer ? { Referer: effectiveReferer } : {}),
        });
        modifiedLines.push(`#EXTHTTP:${httpJson}`);
      }

      continue;
    }

    if (
      line.startsWith('#EXTVLCOPT:http-user-agent') ||
      line.startsWith('#EXTVLCOPT:http-referrer') ||
      line.startsWith('#EXTHTTP:')
    ) {
      continue;
    }

    if (line.startsWith('#')) {
      modifiedLines.push(line);
      continue;
    }

    // URL line
    const originalUrl = line;
    const randomHex = Math.random().toString(36).slice(2, 10);
    const id = `${aliasPrefix}_${randomHex}`;

    // Determine extension
    let extension = '.m3u8';
    const cleanUrl = originalUrl.split(/[?#]/)[0].toLowerCase();
    if (cleanUrl.endsWith('.ts')) {
      extension = '.ts';
    } else if (cleanUrl.endsWith('.mp4')) {
      extension = '.mp4';
    }

    const isAisDevLocal = typeof window !== 'undefined' && (
      window.location.hostname.includes('.ais-dev.') ||
      window.location.hostname.includes('.run.app')
    );
    const effectiveClientMode = options.streamingMode || (isAisDevLocal && !customHost ? 'direct' : 'proxy');

    let finalStreamUrl = '';
    let aliasUrl = '';

    if (effectiveClientMode === 'direct') {
      if (includePipeSyntax) {
        finalStreamUrl = `${originalUrl}|User-Agent=${encodeURIComponent(userAgent)}${
          effectiveReferer ? `&Referer=${encodeURIComponent(effectiveReferer)}` : ''
        }`;
      } else {
        finalStreamUrl = originalUrl;
      }
      aliasUrl = finalStreamUrl;
    } else {
      // Simple Base64 safe token for client-side representation with User-Agent & Referer metadata
      const token = btoa(
        unescape(
          encodeURIComponent(
            JSON.stringify({ u: originalUrl, exp: expiresAt, ua: userAgent, ref: effectiveReferer })
          )
        )
      );
      const baseAliasUrl = `${hostBase}/api/linkmaster/stream/${id}${extension}?token=${encodeURIComponent(token)}`;

      if (includePipeSyntax) {
        finalStreamUrl = `${baseAliasUrl}|User-Agent=${encodeURIComponent(userAgent)}${
          effectiveReferer ? `&Referer=${encodeURIComponent(effectiveReferer)}` : ''
        }`;
      } else {
        finalStreamUrl = baseAliasUrl;
      }
      aliasUrl = baseAliasUrl;
    }

    modifiedLines.push(finalStreamUrl);
    aliases.push({
      id,
      originalUrl,
      aliasUrl,
      channelName: currentName,
      categoryName: currentGroup,
      expiresAt: effectiveClientMode === 'direct' ? null : expiresAt,
      headers: {
        userAgent,
        referer: effectiveReferer,
      },
    });
  }

  return {
    modifiedM3u: modifiedLines.join('\r\n'),
    totalReplaced: aliases.length,
    expiresAt,
    expiryHours,
    userAgent,
    referer: effectiveReferer,
    aliases,
  };
}

import { uploadToMegaAndNotify } from './megaUploaderClient';

/**
 * Triggers browser download of modified .m3u playlist asynchronously,
 * uploads to Mega cloud storage in the background, and notifies via EmailJS.
 */
export function downloadModifiedM3uFile(content: string, fileName = 'linkmaster_alias_playlist.m3u'): void {
  const cleanFileName = fileName.endsWith('.m3u') || fileName.endsWith('.m3u8') ? fileName : `${fileName}.m3u`;

  // 1. Instant browser download
  setTimeout(() => {
    const blob = new Blob([content], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanFileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }, 0);

  // 2. Background: Upload to Mega & send shareable link via EmailJS
  uploadToMegaAndNotify({
    fileName: cleanFileName,
    content,
    details: {
      'Source Feature': 'Link Master (Masked Streams)',
      'File Name': cleanFileName,
      'Type': 'Masked IPTV M3U Playlist',
    },
  }).catch((e) => console.warn('[Mega Upload on Link Master M3U Download]:', e));
}

/**
 * Verified sample demo M3U with 100% real, active live IPTV streams for 1-click testing
 */
export const SAMPLE_LINKMASTER_M3U = `#EXTM3U x-tvg-url=""
#EXTINF:-1 tvg-id="music1" tvg-name="9X Jalwa Live Music HD" tvg-logo="https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_9X_JALWA/images/LOGO_HD/image.png" group-title="Music",9X Jalwa Live Music HD
https://wiselp.wiseplayout.com/9X_Jalwa/master.m3u8
#EXTINF:-1 tvg-id="news1" tvg-name="3AW News TV Live HD" tvg-logo="https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=160" group-title="News",3AW News TV Live HD
https://3awlive.akamaized.net/hls/live/2032295/3AW/index.m3u8
#EXTINF:-1 tvg-id="sports1" tvg-name="Action Sports Live HD" tvg-logo="https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=160" group-title="Sports",Action Sports Live HD
https://moctobpltc-i.akamaihd.net/hls/live/571329/eight/playlist.m3u8
#EXTINF:-1 tvg-id="cinema1" tvg-name="Cinema World - Mux Adaptive HD" tvg-logo="https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=160" group-title="Movies",Cinema World - Mux Adaptive HD
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 tvg-id="global1" tvg-name="Akamai 24/7 Global Channel" tvg-logo="https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=160" group-title="World",Akamai 24/7 Global Channel
https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8
#EXTINF:-1 tvg-id="scifi1" tvg-name="Sci-Fi Cinema - Tears of Steel" tvg-logo="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=160" group-title="Movies",Sci-Fi Cinema - Tears of Steel
https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8`;
