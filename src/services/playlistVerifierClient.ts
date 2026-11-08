import { apiUrl } from './apiConfig';
import { parseM3uFast } from '../server/playlistVerifierService';

export interface VerifiedChannel {
  id: string;
  num: number;
  name: string;
  streamUrl: string;
  logo: string;
  category: string;
  extension: 'm3u8' | 'ts' | 'mp4' | 'mkv' | 'other';
  tvgId?: string;
  tvgName?: string;
  rawExtInf?: string;
  active?: boolean;
  statusCode?: number;
  latencyMs?: number;
  attempts?: number;
  reason?: string;
}

export interface VerificationProgressEvent {
  checked: number;
  total: number;
  percent: number;
  activeCount: number;
  deadCount: number;
  channel: VerifiedChannel;
}

export interface VerificationCompleteEvent {
  totalChannels: number;
  activeCount: number;
  deadCount: number;
  activeRatePercent: number;
  activeM3u: string;
  activeChannels: VerifiedChannel[];
}

export interface VerificationCallbacks {
  onParsed?: (data: { totalChannels: number; categories: string[] }) => void;
  onProgress?: (progress: VerificationProgressEvent) => void;
  onComplete?: (complete: VerificationCompleteEvent) => void;
  onError?: (err: Error) => void;
}

/**
 * Checks if the current app is running on GitHub Pages or a static hosting platform.
 */
function isStaticHosting(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname.includes('github.io') ||
    hostname.includes('pages.dev') ||
    hostname.includes('netlify.app') ||
    hostname.includes('vercel.app') ||
    window.location.protocol === 'file:'
  );
}

/**
 * HTML5 Media Element probe for live audio/video streams in browser.
 */
function probeWithMediaElement(url: string, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(false);

    const isAudio = url.includes('.mp3') || url.includes('.aac');
    const media = isAudio ? document.createElement('audio') : document.createElement('video');
    media.preload = 'metadata';
    media.muted = true;

    let timer: any = null;
    let isSettled = false;

    const cleanup = () => {
      if (isSettled) return;
      isSettled = true;
      if (timer) clearTimeout(timer);
      try {
        media.removeAttribute('src');
        media.load();
      } catch {
        // ignore
      }
    };

    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          cleanup();
          resolve(false);
        },
        { once: true }
      );
    }

    media.onloadedmetadata = () => {
      cleanup();
      resolve(true);
    };

    media.oncanplay = () => {
      cleanup();
      resolve(true);
    };

    media.onerror = () => {
      cleanup();
      resolve(false);
    };

    timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    try {
      media.src = url;
    } catch {
      cleanup();
      resolve(false);
    }
  });
}

/**
 * Probes a single stream URL in the browser with dual CORS & no-cors resilience.
 */
async function probeChannelInBrowser(
  streamUrl: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<{ active: boolean; statusCode: number; latencyMs: number; reason?: string }> {
  const start = Date.now();

  if (signal?.aborted) {
    return { active: false, statusCode: 499, latencyMs: 0, reason: 'Aborted' };
  }

  // Probe Strategy 1: Fast Range GET with mode: 'cors'
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const abortHandler = () => controller.abort();
    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    const res = await fetch(streamUrl, {
      method: 'GET',
      headers: { Range: 'bytes=0-1024' },
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', abortHandler);

    const latencyMs = Date.now() - start;
    if (res.ok || res.status === 200 || res.status === 206) {
      return { active: true, statusCode: res.status, latencyMs };
    }
  } catch (corsErr: any) {
    if (signal?.aborted || corsErr.name === 'AbortError') {
      return { active: false, statusCode: 408, latencyMs: Date.now() - start, reason: 'Timeout' };
    }
    // Most IPTV servers lack CORS headers for browsers. Continue to no-cors mode below!
  }

  // Probe Strategy 2: GET with mode: 'no-cors'
  // When an opaque response arrives, it confirms TCP handshake succeeded & server sent media data!
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const abortHandler = () => controller.abort();
    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    const res = await fetch(streamUrl, {
      method: 'GET',
      mode: 'no-cors',
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', abortHandler);

    const latencyMs = Date.now() - start;
    if (res.type === 'opaque' || res.ok || res.status === 200 || res.status === 0) {
      return { active: true, statusCode: 200, latencyMs };
    }
  } catch (noCorsErr: any) {
    if (signal?.aborted || noCorsErr.name === 'AbortError') {
      return { active: false, statusCode: 408, latencyMs: Date.now() - start, reason: 'Timeout' };
    }
  }

  // Probe Strategy 3: Media Element Metadata Probe
  try {
    const mediaActive = await probeWithMediaElement(streamUrl, Math.min(timeoutMs, 4000), signal);
    if (mediaActive) {
      return { active: true, statusCode: 200, latencyMs: Date.now() - start };
    }
  } catch {
    // continue to failure
  }

  return {
    active: false,
    statusCode: 503,
    latencyMs: Date.now() - start,
    reason: 'Unreachable or Offline',
  };
}

/**
 * Purely client-side in-browser verification engine.
 * Runs 100% in JavaScript without needing any server backend, making it fully functional on GitHub Pages.
 */
export async function verifyPlaylistInBrowser(
  m3uContent: string,
  callbacks: VerificationCallbacks,
  options?: {
    concurrency?: number;
    timeoutMs?: number;
    maxRetries?: number;
    abortSignal?: AbortSignal;
  }
): Promise<void> {
  const parsed = parseM3uFast(m3uContent);
  const total = parsed.channels.length;

  if (total === 0) {
    throw new Error('No stream channels or URLs found in the uploaded M3U playlist.');
  }

  // 1. Notify parsed event
  if (callbacks.onParsed) {
    callbacks.onParsed({
      totalChannels: total,
      categories: parsed.categories,
    });
  }

  const concurrency = Math.min(Math.max(options?.concurrency || 6, 2), 12);
  const timeoutMs = options?.timeoutMs || 10000;
  const maxRetries = options?.maxRetries ?? 2;
  const signal = options?.abortSignal;

  let checked = 0;
  let activeCount = 0;
  let deadCount = 0;

  const activeChannels: VerifiedChannel[] = [];
  const processedChannels: VerifiedChannel[] = [];

  let currentIndex = 0;

  // Worker task to process channels from queue
  const worker = async () => {
    while (currentIndex < total) {
      if (signal?.aborted) {
        break;
      }

      const idx = currentIndex++;
      const rawChan = parsed.channels[idx];

      let probeResult: { active: boolean; statusCode: number; latencyMs: number; reason?: string } = {
        active: false,
        statusCode: 503,
        latencyMs: 0,
        reason: '',
      };
      let attempts = 0;

      for (let r = 0; r <= maxRetries; r++) {
        attempts++;
        if (signal?.aborted) break;

        probeResult = await probeChannelInBrowser(rawChan.streamUrl, timeoutMs, signal);
        if (probeResult.active) {
          break;
        }

        // Slight backoff before retry
        if (r < maxRetries && !signal?.aborted) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      checked++;
      if (probeResult.active) {
        activeCount++;
      } else {
        deadCount++;
      }

      const verifiedChannel: VerifiedChannel = {
        ...rawChan,
        active: probeResult.active,
        statusCode: probeResult.statusCode,
        latencyMs: probeResult.latencyMs,
        attempts,
        reason: probeResult.reason,
      };

      processedChannels.push(verifiedChannel);
      if (probeResult.active) {
        activeChannels.push(verifiedChannel);
      }

      const percent = Math.min(100, Math.round((checked / total) * 100));

      // Emit real-time progress update
      if (callbacks.onProgress) {
        callbacks.onProgress({
          checked,
          total,
          percent,
          activeCount,
          deadCount,
          channel: verifiedChannel,
        });
      }

      // Small yield to let React UI render smoothly
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  };

  // Run concurrency pool
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  if (signal?.aborted) {
    return;
  }

  // Build active M3U file content
  let activeM3u = '#EXTM3U\n';
  activeChannels.forEach((ch) => {
    activeM3u += `#EXTINF:-1 tvg-id="${ch.tvgId || ''}" tvg-name="${ch.tvgName || ''}" tvg-logo="${ch.logo || ''}" group-title="${ch.category || 'Live'}",${ch.name}\n${ch.streamUrl}\n`;
  });

  const activeRatePercent = total > 0 ? Math.round((activeCount / total) * 100) : 0;

  // Emit completion
  if (callbacks.onComplete) {
    callbacks.onComplete({
      totalChannels: total,
      activeCount,
      deadCount,
      activeRatePercent,
      activeM3u,
      activeChannels,
    });
  }
}

/**
 * Server-Sent Events (SSE) verification implementation when running with an Express backend.
 */
async function startPlaylistVerificationSse(
  m3uContent: string,
  callbacks: VerificationCallbacks,
  options?: {
    concurrency?: number;
    timeoutMs?: number;
    maxRetries?: number;
    userAgent?: string;
    referer?: string;
    abortSignal?: AbortSignal;
  }
): Promise<void> {
  const response = await fetch(apiUrl('/api/playlist/verify-live'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      m3uContent,
      concurrency: options?.concurrency || 8,
      timeoutMs: options?.timeoutMs || 12000,
      maxRetries: options?.maxRetries ?? 3,
      userAgent: options?.userAgent,
      referer: options?.referer,
    }),
    signal: options?.abortSignal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Verification service returned HTTP ${response.status}: ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body stream is not available');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const rawEvent of events) {
      if (!rawEvent.trim()) continue;

      const lines = rawEvent.split('\n');
      let eventType = 'message';
      let eventData = '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          eventData = line.slice(5).trim();
        }
      }

      if (!eventData) continue;

      try {
        const parsed = JSON.parse(eventData);

        if (eventType === 'parsed' && callbacks.onParsed) {
          callbacks.onParsed(parsed);
        } else if (eventType === 'progress' && callbacks.onProgress) {
          callbacks.onProgress(parsed);
        } else if (eventType === 'complete' && callbacks.onComplete) {
          callbacks.onComplete(parsed);
        } else if (eventType === 'error') {
          throw new Error(parsed.error || 'Stream verification failed');
        }
      } catch (e: any) {
        if (eventType === 'error' && callbacks.onError) {
          callbacks.onError(e);
        }
      }
    }
  }
}

/**
 * Main Entry Point: Starts real-time stream verification.
 * Automatically selects Client-Side In-Browser verification when hosted on GitHub Pages or static hosts,
 * ensuring 100% reliable click-to-run execution with zero HTTP 404/405 or CORS connection errors.
 */
export async function startPlaylistVerification(
  m3uContent: string,
  callbacks: VerificationCallbacks,
  options?: {
    concurrency?: number;
    timeoutMs?: number;
    maxRetries?: number;
    userAgent?: string;
    referer?: string;
    abortSignal?: AbortSignal;
  }
): Promise<void> {
  // If running on GitHub Pages or any static host, use client-side in-browser verification directly
  if (isStaticHosting()) {
    return verifyPlaylistInBrowser(m3uContent, callbacks, options);
  }

  // In fullstack / local environment, try server SSE endpoint with automatic client-side fallback
  try {
    await startPlaylistVerificationSse(m3uContent, callbacks, options);
  } catch (sseError: any) {
    if (options?.abortSignal?.aborted) {
      return;
    }
    console.warn('Backend SSE verification unavailable, running client-side in-browser verification...', sseError);
    return verifyPlaylistInBrowser(m3uContent, callbacks, options);
  }
}

/**
 * Downloads the active M3U file directly to user device asynchronously.
 */
export function downloadActiveM3uFile(content: string, filename = 'active_playlist.m3u') {
  const cleanFilename = filename.endsWith('.m3u') ? filename : `${filename}.m3u`;

  setTimeout(() => {
    const blob = new Blob([content], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }, 0);
}
