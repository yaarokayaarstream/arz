import { Request, Response } from 'express';

export interface VerifierChannel {
  id: string;
  num: number;
  name: string;
  streamUrl: string;
  logo: string;
  category: string;
  tvgId: string;
  tvgName: string;
  extension: 'm3u8' | 'ts' | 'mp4' | 'mkv' | 'other';
  rawExtInf?: string;
  headers?: {
    userAgent?: string;
    referer?: string;
  };
  // Verification fields
  active?: boolean;
  statusCode?: number;
  latencyMs?: number;
  attempts?: number;
  reason?: string;
}

export interface ParseResult {
  totalChannels: number;
  categories: string[];
  channels: VerifierChannel[];
  headerDirectives: string[];
}

/**
 * Ultra-fast M3U Parser with index-based attribute extraction
 */
export function parseM3uFast(content: string): ParseResult {
  const lines = content.split(/\r?\n/);
  const channels: VerifierChannel[] = [];
  const categoriesSet = new Set<string>();
  const headerDirectives: string[] = [];

  let curTvgId = '';
  let curTvgName = '';
  let curLogo = '';
  let curCategory = 'Live TV';
  let curName = 'Live Stream';
  let curUa = '';
  let curRef = '';
  let curExtInf = '';
  let chNum = 1;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTM3U')) {
      headerDirectives.push(line);
      const uaIdx = line.indexOf('user-agent="');
      if (uaIdx !== -1) {
        const uaEnd = line.indexOf('"', uaIdx + 12);
        if (uaEnd !== -1) curUa = line.slice(uaIdx + 12, uaEnd);
      }
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      curExtInf = line;

      // tvg-id
      const idIdx = line.indexOf('tvg-id="');
      curTvgId = idIdx !== -1 ? line.slice(idIdx + 8, line.indexOf('"', idIdx + 8)) : '';

      // tvg-name
      const nameIdx = line.indexOf('tvg-name="');
      curTvgName = nameIdx !== -1 ? line.slice(nameIdx + 10, line.indexOf('"', nameIdx + 10)) : '';

      // tvg-logo
      const logoIdx = line.indexOf('tvg-logo="');
      curLogo = logoIdx !== -1 ? line.slice(logoIdx + 10, line.indexOf('"', logoIdx + 10)) : '';

      // group-title
      const groupIdx = line.indexOf('group-title="');
      curCategory = groupIdx !== -1 ? line.slice(groupIdx + 13, line.indexOf('"', groupIdx + 13)) : 'Live TV';
      if (!curCategory) curCategory = 'Live TV';

      // extract channel name after comma
      const commaIdx = line.lastIndexOf(',');
      if (commaIdx !== -1) {
        curName = line.slice(commaIdx + 1).trim() || curTvgName || `Channel ${chNum}`;
      } else {
        curName = curTvgName || `Channel ${chNum}`;
      }
      continue;
    }

    if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
      curUa = line.slice(27).trim();
      continue;
    }
    if (line.startsWith('#EXTVLCOPT:http-referrer=')) {
      curRef = line.slice(25).trim();
      continue;
    }

    if (line.startsWith('#')) {
      continue;
    }

    // Stream URL Line
    const streamUrl = line;
    let ext: 'm3u8' | 'ts' | 'mp4' | 'mkv' | 'other' = 'other';
    const cleanLower = streamUrl.toLowerCase().split('?')[0];
    if (cleanLower.endsWith('.m3u8')) ext = 'm3u8';
    else if (cleanLower.endsWith('.ts')) ext = 'ts';
    else if (cleanLower.endsWith('.mp4')) ext = 'mp4';
    else if (cleanLower.endsWith('.mkv')) ext = 'mkv';

    categoriesSet.add(curCategory);

    channels.push({
      id: `probe_${chNum}_${Math.random().toString(36).slice(2, 6)}`,
      num: chNum++,
      name: curName,
      streamUrl,
      logo: curLogo,
      category: curCategory,
      tvgId: curTvgId,
      tvgName: curTvgName,
      extension: ext,
      rawExtInf: curExtInf,
      headers: curUa || curRef ? { userAgent: curUa, referer: curRef } : undefined,
    });

    curTvgId = '';
    curTvgName = '';
    curLogo = '';
    curCategory = 'Live TV';
    curName = 'Live Stream';
    curExtInf = '';
  }

  const categories = Array.from(categoriesSet).sort();

  return {
    totalChannels: channels.length,
    categories,
    channels,
    headerDirectives,
  };
}

/**
 * Single probe request attempt (HEAD or GET) with configurable timeout and abort signal
 */
async function probeSingleAttempt(
  targetUrl: string,
  method: 'HEAD' | 'GET',
  headers: Record<string, string>,
  useRange: boolean,
  timeoutMs: number
): Promise<{
  success: boolean;
  statusCode: number;
  latencyMs: number;
  reason?: string;
}> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const reqHeaders: Record<string, string> = { ...headers };
  if (useRange && method === 'GET') {
    reqHeaders['Range'] = 'bytes=0-2048';
  }

  try {
    const res = await fetch(targetUrl, {
      method,
      headers: reqHeaders,
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);

    const latencyMs = Date.now() - start;

    // HTTP 200 OK or HTTP 206 Partial Content indicates live stream is working
    if (res.ok || res.status === 200 || res.status === 206) {
      try {
        res.body?.cancel();
      } catch {
        // ignore
      }
      return {
        success: true,
        statusCode: res.status,
        latencyMs,
      };
    }

    return {
      success: false,
      statusCode: res.status,
      latencyMs,
      reason: `HTTP ${res.status} ${res.statusText}`,
    };
  } catch (err: any) {
    clearTimeout(timer);
    const latencyMs = Date.now() - start;
    const isTimeout =
      err.name === 'AbortError' ||
      err.message?.includes('timeout') ||
      err.message?.includes('abort');
    return {
      success: false,
      statusCode: isTimeout ? 408 : 503,
      latencyMs,
      reason: isTimeout
        ? `Timeout after ${(timeoutMs / 1000).toFixed(1)}s`
        : err.message || 'Connection failed',
    };
  }
}

/**
 * High-reliability stream probe with configurable timeout (10-15s) and 2-3x retries.
 * A stream is ONLY marked dead when all retry attempts have completely failed.
 */
export async function probeStreamWithRetries(
  streamUrl: string,
  customHeaders?: { userAgent?: string; referer?: string },
  timeoutMs = 12000,
  maxRetries = 3
): Promise<{
  active: boolean;
  statusCode: number;
  latencyMs: number;
  attempts: number;
  reason?: string;
}> {
  const targetUrl = streamUrl.trim();
  const defaultUA =
    customHeaders?.userAgent ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  const baseHeaders: Record<string, string> = {
    'User-Agent': defaultUA,
    Accept: '*/*',
    Connection: 'close',
  };
  if (customHeaders?.referer) {
    baseHeaders['Referer'] = customHeaders.referer;
  }

  const isHls = targetUrl.toLowerCase().includes('.m3u8');
  let lastResult: {
    success: boolean;
    statusCode: number;
    latencyMs: number;
    reason?: string;
  } = {
    success: false,
    statusCode: 0,
    latencyMs: 0,
    reason: 'Not tested',
  };

  // 1 initial attempt + maxRetries (e.g. 1 + 3 = 4 attempts total)
  const totalAttempts = 1 + Math.max(1, maxRetries);

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    // Adaptive strategy per attempt:
    let method: 'HEAD' | 'GET' = attempt === 1 && !isHls ? 'HEAD' : 'GET';
    let useRange = method === 'GET' && !isHls;
    const headers = { ...baseHeaders };

    if (attempt === 2) {
      // Retry 1: Many IPTV CDNs fail on HEAD or Range. Retry with clean GET.
      method = 'GET';
      useRange = false;
      await new Promise((r) => setTimeout(r, 600));
    } else if (attempt === 3) {
      // Retry 2: Many IPTV servers block generic browsers. Retry with VLC / IPTV media player UA.
      method = 'GET';
      useRange = false;
      headers['User-Agent'] = 'VLC/3.0.18 LibVLC/3.0.18';
      await new Promise((r) => setTimeout(r, 1000));
    } else if (attempt > 3) {
      // Retry 3: Generic clean media streaming client
      method = 'GET';
      useRange = false;
      headers['User-Agent'] = 'IPTVSmartersPlayer/3.0.0 (Android; ExoPlayer)';
      await new Promise((r) => setTimeout(r, 1200));
    }

    const res = await probeSingleAttempt(targetUrl, method, headers, useRange, timeoutMs);
    lastResult = res;

    // If stream responds successfully, return ACTIVE immediately without marking as dead
    if (res.success) {
      return {
        active: true,
        statusCode: res.statusCode,
        latencyMs: res.latencyMs,
        attempts: attempt,
      };
    }
  }

  // ONLY mark as dead when ALL retry attempts have completely failed
  return {
    active: false,
    statusCode: lastResult.statusCode,
    latencyMs: lastResult.latencyMs,
    attempts: totalAttempts,
    reason: `Dead (failed ${totalAttempts} attempts: ${lastResult.reason})`,
  };
}

/**
 * Backward-compatible probeStreamUrl calling probeStreamWithRetries
 */
export async function probeStreamUrl(
  streamUrl: string,
  customHeaders?: { userAgent?: string; referer?: string },
  timeoutMs = 12000
): Promise<{
  active: boolean;
  statusCode: number;
  latencyMs: number;
  attempts?: number;
  reason?: string;
}> {
  return probeStreamWithRetries(streamUrl, customHeaders, timeoutMs, 3);
}

/**
 * Builds a clean, verified M3U content containing only active channels
 */
export function buildVerifiedM3u(activeChannels: VerifierChannel[], customHeader?: string): string {
  let m3u = customHeader || '#EXTM3U\r\n';
  if (!m3u.endsWith('\r\n') && !m3u.endsWith('\n')) {
    m3u += '\r\n';
  }

  activeChannels.forEach((ch, idx) => {
    const ua = ch.headers?.userAgent;
    const ref = ch.headers?.referer;

    let extinf = `#EXTINF:-1 tvg-id="${ch.tvgId || ''}" tvg-name="${ch.tvgName || ch.name}" tvg-logo="${ch.logo || ''}" group-title="${ch.category || 'Live TV'}",${ch.name}\r\n`;
    if (ch.rawExtInf && ch.rawExtInf.startsWith('#EXTINF:')) {
      extinf = `${ch.rawExtInf.trim()}\r\n`;
    }

    m3u += extinf;
    if (ua) {
      m3u += `#EXTVLCOPT:http-user-agent=${ua}\r\n`;
    }
    if (ref) {
      m3u += `#EXTVLCOPT:http-referrer=${ref}\r\n`;
    }
    if (ua || ref) {
      const httpPayload: Record<string, string> = {};
      if (ua) httpPayload['User-Agent'] = ua;
      if (ref) httpPayload['Referer'] = ref;
      m3u += `#EXTHTTP:${JSON.stringify(httpPayload)}\r\n`;
    }
    m3u += `${ch.streamUrl}\r\n`;
  });

  return m3u;
}

// ------------------- EXPRESS HANDLERS -------------------

/**
 * POST /api/playlist/parse-only
 * Fast parsing of uploaded M3U playlist file/text
 */
export async function handleParseM3uOnly(req: Request, res: Response) {
  try {
    const { m3uContent } = req.body;
    if (!m3uContent || typeof m3uContent !== 'string') {
      return res.status(400).json({ success: false, message: 'm3uContent is required.' });
    }

    const result = parseM3uFast(m3uContent);

    return res.json({
      success: true,
      totalChannels: result.totalChannels,
      categories: result.categories,
      channels: result.channels,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/playlist/verify-live (Server-Sent Events streaming)
 * Concurrently probes channels and streams real-time progress events
 */
export async function handleVerifyLive(req: Request, res: Response) {
  try {
    const {
      m3uContent,
      concurrency = 8,
      timeoutMs = 12000,
      maxRetries = 3,
      userAgent,
      referer,
    } = req.body;

    if (!m3uContent || typeof m3uContent !== 'string') {
      return res.status(400).json({ success: false, message: 'm3uContent is required.' });
    }

    const parsed = parseM3uFast(m3uContent);
    const total = parsed.channels.length;

    if (total === 0) {
      return res.status(400).json({
        success: false,
        message: 'No channels or stream URLs found in the uploaded playlist.',
      });
    }

    // Set up Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Emit initial parsed event
    res.write(
      `event: parsed\ndata: ${JSON.stringify({
        totalChannels: total,
        categories: parsed.categories,
      })}\n\n`
    );

    let checked = 0;
    let activeCount = 0;
    let deadCount = 0;
    const activeChannels: VerifierChannel[] = [];
    const deadChannels: VerifierChannel[] = [];

    // Worker pool concurrency executor (default 8 for reliable network probing)
    const workerLimit = Math.max(1, Math.min(25, Number(concurrency) || 8));
    const effectiveTimeout = Math.max(5000, Math.min(30000, Number(timeoutMs) || 12000));
    const effectiveRetries = Math.max(1, Math.min(5, Number(maxRetries) || 3));
    let nextIndex = 0;

    const runWorker = async () => {
      while (nextIndex < total) {
        const idx = nextIndex++;
        const channel = parsed.channels[idx];

        // Probe this channel with 10-15s timeout and 2-3 retries
        const probeResult = await probeStreamWithRetries(
          channel.streamUrl,
          {
            userAgent: channel.headers?.userAgent || userAgent,
            referer: channel.headers?.referer || referer,
          },
          effectiveTimeout,
          effectiveRetries
        );

        channel.active = probeResult.active;
        channel.statusCode = probeResult.statusCode;
        channel.latencyMs = probeResult.latencyMs;
        channel.attempts = probeResult.attempts;
        channel.reason = probeResult.reason;

        checked++;
        if (probeResult.active) {
          activeCount++;
          activeChannels.push(channel);
        } else {
          deadCount++;
          deadChannels.push(channel);
        }

        const percent = Math.round((checked / total) * 100);

        // Stream real-time progress update to client
        res.write(
          `event: progress\ndata: ${JSON.stringify({
            checked,
            total,
            percent,
            activeCount,
            deadCount,
            channel: {
              id: channel.id,
              num: channel.num,
              name: channel.name,
              category: channel.category,
              streamUrl: channel.streamUrl,
              logo: channel.logo,
              extension: channel.extension,
              active: channel.active,
              statusCode: channel.statusCode,
              latencyMs: channel.latencyMs,
              attempts: channel.attempts,
              reason: channel.reason,
            },
          })}\n\n`
        );
      }
    };

    // Run parallel workers
    const workers = [];
    for (let i = 0; i < workerLimit; i++) {
      workers.push(runWorker());
    }
    await Promise.all(workers);

    // Build the clean verified M3U playlist containing ONLY active channels
    const activeM3u = buildVerifiedM3u(activeChannels);

    // Emit complete event
    res.write(
      `event: complete\ndata: ${JSON.stringify({
        totalChannels: total,
        activeCount,
        deadCount,
        activeRatePercent: Math.round((activeCount / total) * 100),
        activeM3u,
        activeChannels,
      })}\n\n`
    );

    res.end();
  } catch (err: any) {
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}

/**
 * POST /api/playlist/download-verified
 * Generates and downloads the verified active playlist file
 */
export async function handleDownloadVerifiedPlaylist(req: Request, res: Response) {
  try {
    const { m3uContent, filename = 'active_playlist.m3u' } = req.body;
    if (!m3uContent || typeof m3uContent !== 'string') {
      return res.status(400).send('Active M3U content is required.');
    }

    const safeName =
      String(filename)
        .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
        .replace(/\.m3u8?$/i, '') || 'active_playlist';

    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.m3u"`);
    res.setHeader('Cache-Control', 'no-cache');

    return res.send(m3uContent);
  } catch (err: any) {
    return res.status(500).send(`Error downloading verified playlist: ${err.message}`);
  }
}
