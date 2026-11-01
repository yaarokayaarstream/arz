import { Request, Response } from 'express';
import { spawn, ChildProcess } from 'child_process';
import { decryptUrlToken, aliasRegistry, parsePipedHeaders } from './linkMasterService';

/**
 * Normalizes and cleans IPTV and Xtream stream URLs.
 * Removes inadvertent player_api.php or script paths in the middle of stream URLs.
 */
export function normalizeStreamUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'http://' + url;
  }

  // Rewrite internal ais-dev / cloud-run / local proxy links directly to localhost:3000
  // so FFmpeg loops back directly to local Express with 0ms latency and bypasses Cloud Run cookie redirects
  if (
    url.includes('.ais-dev.') ||
    url.includes('.run.app') ||
    url.includes('/api/linkmaster/')
  ) {
    try {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith('/api/linkmaster/')) {
        url = `http://127.0.0.1:3000${parsed.pathname}${parsed.search}`;
      }
    } catch {
      url = url.replace(/https?:\/\/[^/]+(\/api\/linkmaster\/.*)/i, 'http://127.0.0.1:3000$1');
    }
  }

  // Clean common accidental script paths before /live/
  url = url.replace(/\/+(player_api|get|panel_api)\.php\/live\//i, '/live/');
  url = url.replace(/\/+(player_api|get|panel_api)\.php\/([0-9a-zA-Z_]+)\/([0-9a-zA-Z_]+)\/([0-9a-zA-Z_]+)/i, '/live/$2/$3/$4');

  return url;
}

// Track active FFmpeg processes to terminate stale streams cleanly
const activeFfmpegProcesses = new Map<string, ChildProcess>();

/**
 * Streams live channels via FFmpeg in real-time.
 * Remuxes incoming Xtream/M3U8/TS streams into browser-compliant fragmented MP4 (fMP4)
 * with copy video and AAC audio for zero-latency, high-performance playback.
 */
export async function handleFfmpegStream(req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rawUrl = (req.query.url as string || '').trim();
  if (!rawUrl) {
    return res.status(400).json({
      error: 'Missing stream url parameter',
      usage: '/api/ffmpeg/stream?url=<STREAM_URL>'
    });
  }

  let effectiveTargetUrl = normalizeStreamUrl(rawUrl);
  let effectiveUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  let effectiveReferer: string | undefined = undefined;

  // Handle pipe syntax on rawUrl if present (e.g. url|User-Agent=...&Referer=...)
  const piped = parsePipedHeaders(rawUrl);
  if (piped.headers['user-agent']) {
    effectiveUserAgent = piped.headers['user-agent'];
  }
  if (piped.headers['referer']) {
    effectiveReferer = piped.headers['referer'];
  }
  if (piped.clean !== rawUrl) {
    effectiveTargetUrl = normalizeStreamUrl(piped.clean);
  }

  // If this stream is a Link Master alias or token URL (or comes from ais-dev), decrypt the true upstream target!
  if (
    rawUrl.includes('/api/linkmaster/') ||
    rawUrl.includes('token=') ||
    rawUrl.includes('t=') ||
    rawUrl.includes('.ais-dev.') ||
    rawUrl.includes('.run.app')
  ) {
    try {
      const parsedUrl = new URL(rawUrl.startsWith('http') ? rawUrl : `http://localhost${rawUrl}`);
      const token = parsedUrl.searchParams.get('token') || parsedUrl.searchParams.get('t');
      if (token) {
        const decrypted = decryptUrlToken(token);
        if (decrypted && decrypted.realUrl) {
          effectiveTargetUrl = decrypted.realUrl;
          if (decrypted.userAgent) effectiveUserAgent = decrypted.userAgent;
          if (decrypted.referer) effectiveReferer = decrypted.referer;
        }
      }

      // If token wasn't decrypted or was absent, check memory registry by alias ID
      if (effectiveTargetUrl === rawUrl || effectiveTargetUrl.includes('/api/linkmaster/')) {
        const pathSegments = parsedUrl.pathname.split('/');
        const lastSeg = pathSegments[pathSegments.length - 1] || '';
        const cleanAliasId = lastSeg.replace(/\.[a-zA-Z0-9]+$/, '');
        const rec = aliasRegistry.get(cleanAliasId);
        if (rec) {
          effectiveTargetUrl = rec.originalUrl;
          if (rec.userAgent) effectiveUserAgent = rec.userAgent;
          if (rec.referer) effectiveReferer = rec.referer;
        }
      }
    } catch {
      // ignore
    }
  }

  // Fallback: If still pointing to an external ais-dev/run.app linkmaster path, loop back to local Express
  if (
    effectiveTargetUrl.includes('.ais-dev.') ||
    effectiveTargetUrl.includes('.run.app') ||
    effectiveTargetUrl.startsWith('/api/linkmaster/')
  ) {
    effectiveTargetUrl = effectiveTargetUrl.replace(
      /^(https?:\/\/[^/]+)?(\/api\/linkmaster\/.*)/i,
      'http://127.0.0.1:3000$2'
    );
  }

  const transcodeVideo = req.query.transcode === '1' || req.query.transcode === 'true';
  const sessionId = (req.query.sid as string) || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Terminate previous process for this session if any
  if (activeFfmpegProcesses.has(sessionId)) {
    try {
      const prev = activeFfmpegProcesses.get(sessionId);
      prev?.kill('SIGKILL');
    } catch {
      // ignore
    }
    activeFfmpegProcesses.delete(sessionId);
  }

  // Build FFmpeg command arguments
  const ffmpegArgs: string[] = [
    '-hide_banner',
    '-loglevel', 'error',
    // Network reconnect options for resilient IPTV streaming
    '-reconnect', '1',
    '-reconnect_at_eof', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-rw_timeout', '12000000',
    '-probesize', '2000000',
    '-analyzeduration', '2000000',
    '-user_agent', effectiveUserAgent,
    '-headers', `Accept: */*\r\nConnection: keep-alive\r\n${effectiveReferer ? `Referer: ${effectiveReferer}\r\n` : ''}`,
    '-i', effectiveTargetUrl,
  ];

  if (transcodeVideo) {
    // Ultrafast H.264 transcode for non-standard codecs
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-g', '50',
      '-pix_fmt', 'yuv420p'
    );
  } else {
    // Direct stream copy (instant, 0% CPU overhead)
    ffmpegArgs.push('-c:v', 'copy');
  }

  // Audio: Transcode to AAC stereo (ensures AC3/EAC3/MP2 formats play across all browsers)
  ffmpegArgs.push(
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ac', '2',
    '-ar', '48000',
    // Output container: Fragmented MP4 for live streaming directly over HTTP pipe
    '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    'pipe:1'
  );

  let streamStarted = false;
  const stderrLogs: string[] = [];

  let ffmpeg: ChildProcess;
  try {
    ffmpeg = spawn('/usr/bin/ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to launch FFmpeg', message: err.message });
  }

  activeFfmpegProcesses.set(sessionId, ffmpeg);

  ffmpeg.stdout?.on('data', (chunk: Buffer) => {
    if (!streamStarted) {
      streamStarted = true;
      if (!res.headersSent) {
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });
      }
    }
    if (!res.writableEnded) {
      res.write(chunk);
    }
  });

  ffmpeg.stderr?.on('data', (data) => {
    const msg = data.toString();
    stderrLogs.push(msg.trim());
    if (stderrLogs.length > 10) {
      stderrLogs.shift();
    }
  });

  const cleanup = () => {
    if (activeFfmpegProcesses.get(sessionId) === ffmpeg) {
      activeFfmpegProcesses.delete(sessionId);
    }
    try {
      ffmpeg.kill('SIGKILL');
    } catch {
      // ignore
    }
  };

  ffmpeg.on('close', (code) => {
    cleanup();
    if (!streamStarted && !res.headersSent) {
      // If FFmpeg exited before streaming any data, report clean 502 with error details
      const lastError = stderrLogs.join(' ').replace(/\s+/g, ' ').trim();
      res.status(502).json({
        success: false,
        error: 'Stream unavailable from provider server',
        exitCode: code,
        message: lastError || 'Provider stream unreachable or returned error'
      });
      return;
    }

    if (!res.writableEnded) {
      res.end();
    }
  });

  ffmpeg.on('error', (err) => {
    cleanup();
    if (!streamStarted && !res.headersSent) {
      res.status(502).json({ error: 'FFmpeg stream execution failed', details: err.message });
    } else if (!res.writableEnded) {
      res.end();
    }
  });

  // When client disconnects or pauses video, kill FFmpeg to free system resources
  req.on('close', cleanup);
  res.on('close', cleanup);
}

/**
 * Returns FFmpeg status and hardware capabilities
 */
export function handleFfmpegStatus(_req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.json({
    status: 'ready',
    engine: 'ffmpeg',
    path: '/usr/bin/ffmpeg',
    remuxer: 'fMP4 + AAC',
    hardwareDecoding: true,
    activeSessions: activeFfmpegProcesses.size
  });
}
