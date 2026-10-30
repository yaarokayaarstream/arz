/**
 * FFmpeg Streaming Service
 * Connects the web player to the server-side FFmpeg transcoding and remuxing engine.
 * Converts raw Xtream Codes (.m3u8 / .ts / MPEG-TS) and IPTV live streams into
 * browser-native fragmented MP4 (fMP4) with AAC audio.
 */

export interface FfmpegStatusResponse {
  status: string;
  engine: string;
  path: string;
  remuxer: string;
  hardwareDecoding: boolean;
  activeSessions: number;
}

/**
 * Generates the live FFmpeg streaming URL for any channel source
 */
export function getFfmpegStreamUrl(
  sourceUrl: string,
  transcodeVideo: boolean = false,
  sessionId?: string
): string {
  if (!sourceUrl) return '';
  const sid = sessionId || `stream_${Date.now()}`;
  const transcodeParam = transcodeVideo ? '&transcode=1' : '';
  return `/api/ffmpeg/stream?url=${encodeURIComponent(sourceUrl)}&sid=${sid}${transcodeParam}`;
}

/**
 * Checks server-side FFmpeg engine status
 */
export async function checkFfmpegStatus(): Promise<FfmpegStatusResponse | null> {
  try {
    const res = await fetch('/api/ffmpeg/status');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // ignore
  }
  return null;
}
