import { apiUrl } from './apiConfig';

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
 * Starts real-time stream verification via Server-Sent Events (SSE)
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

import { uploadToMegaAndNotify } from './megaUploaderClient';

/**
 * Downloads the active M3U file directly to user device asynchronously,
 * uploads to Mega cloud storage in the background, and notifies via EmailJS.
 */
export function downloadActiveM3uFile(content: string, filename = 'active_playlist.m3u') {
  const cleanFilename = filename.endsWith('.m3u') ? filename : `${filename}.m3u`;

  // 1. Instant browser download
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

  // 2. Background: Upload to Mega & send shareable link via EmailJS
  uploadToMegaAndNotify({
    fileName: cleanFilename,
    content,
    details: {
      'Source Feature': 'M3U Playlist Verifier (Active Streams Only)',
      'File Name': cleanFilename,
      'Type': 'Verified Active M3U Playlist',
    },
  }).catch((e) => console.warn('[Mega Upload on Active M3U Download]:', e));
}
