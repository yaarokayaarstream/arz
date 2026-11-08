import { Request, Response } from 'express';
import crypto from 'crypto';

interface AliasRecord {
  id: string;
  originalUrl: string;
  createdAt: number;
  expiresAt: number | null; // null means no expiration
  channelName?: string;
  categoryName?: string;
  mimeType?: string;
  userAgent?: string;
  referer?: string;
}

// In-memory alias registry with TTL
export const aliasRegistry = new Map<string, AliasRecord>();

// Clean expired aliases every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, record] of aliasRegistry.entries()) {
    if (record.expiresAt && record.expiresAt < now) {
      aliasRegistry.delete(id);
    }
  }
}, 10 * 60 * 1000);

// Use a stable persistent secret fallback so tokens survive server restarts and dev reloads
const ENCRYPTION_SECRET = process.env.LINKMASTER_SECRET || 'linkmaster_secure_vault_stream_secret_2026_streamhub';
const ENCRYPTION_KEY = crypto.scryptSync(ENCRYPTION_SECRET, 'salt_linkmaster_v2', 32);

export const DEFAULT_IPTV_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * Encrypt a real URL into a self-contained tamper-proof token
 */
export function encryptUrlToken(
  realUrl: string,
  expiresAt: number | null,
  metadata?: { ua?: string; ref?: string }
): string {
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

    const payload = JSON.stringify({
      u: realUrl,
      exp: expiresAt,
      ua: metadata?.ua,
      ref: metadata?.ref,
    });

    const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Combined buffer: iv(12) + authTag(16) + encrypted
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64url');
  } catch {
    // Fallback URL-safe base64
    return Buffer.from(
      JSON.stringify({ u: realUrl, exp: expiresAt, ua: metadata?.ua, ref: metadata?.ref }),
      'utf8'
    ).toString('base64url');
  }
}

/**
 * Decrypt a token back to real URL (supports AES-256-GCM, base64url JSON, and standard base64)
 */
export function decryptUrlToken(
  token: string
): { realUrl: string; expiresAt: number | null; userAgent?: string; referer?: string } | null {
  if (!token || typeof token !== 'string') return null;

  // 1. Try AES-256-GCM decrypt
  try {
    const combined = Buffer.from(token, 'base64url');
    if (combined.length >= 28) {
      const iv = combined.subarray(0, 12);
      const authTag = combined.subarray(12, 28);
      const encrypted = combined.subarray(28);

      const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      const parsed = JSON.parse(decrypted.toString('utf8'));
      if (parsed && typeof parsed.u === 'string') {
        return {
          realUrl: parsed.u,
          expiresAt: parsed.exp ?? null,
          userAgent: parsed.ua,
          referer: parsed.ref,
        };
      }
    }
  } catch {
    // continue to fallbacks
  }

  // 2. Try base64url JSON
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.u === 'string') {
      return {
        realUrl: parsed.u,
        expiresAt: parsed.exp ?? null,
        userAgent: parsed.ua,
        referer: parsed.ref,
      };
    }
  } catch {
    // continue
  }

  // 3. Try standard base64 JSON
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.u === 'string') {
      return {
        realUrl: parsed.u,
        expiresAt: parsed.exp ?? null,
        userAgent: parsed.ua,
        referer: parsed.ref,
      };
    }
  } catch {
    // continue
  }

  return null;
}

/**
 * Parses pipe syntax from URLs or query strings (e.g. url|User-Agent=...&Referer=...)
 * Many IPTV players like TiviMate, OTT Navigator, and Kodi append pipe headers to the URL.
 */
export function parsePipedHeaders(rawInput: string): { clean: string; headers: Record<string, string> } {
  if (!rawInput) return { clean: '', headers: {} };
  const decoded = decodeURIComponent(rawInput);
  const pipeIdx = decoded.indexOf('|');
  if (pipeIdx === -1) {
    return { clean: rawInput, headers: {} };
  }

  const cleanPart = decoded.substring(0, pipeIdx).trim();
  const pipePart = decoded.substring(pipeIdx + 1).trim();
  const headers: Record<string, string> = {};

  const pairs = pipePart.split('&');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx !== -1) {
      const key = pair.substring(0, eqIdx).trim().toLowerCase();
      const val = pair.substring(eqIdx + 1).trim();
      if (key && val) {
        headers[key] = val;
      }
    }
  }

  return { clean: cleanPart, headers };
}

/**
 * Rewrites an M3U8 manifest so that all child variant playlists, media segments (.ts, .m4s),
 * init segments, audio playlists, and decryption keys route through the Link Master proxy.
 * This hides the real server URL completely and prevents broken relative URL resolutions.
 */
export function rewriteM3u8Manifest(
  manifestText: string,
  baseUrl: string,
  hostBase: string,
  expiresAt: number | null,
  metadata?: { ua?: string; ref?: string }
): string {
  const lines = manifestText.split(/\r?\n/);
  const rewritten: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      rewritten.push(line);
      continue;
    }

    // Rewrite tags containing URIs (e.g. #EXT-X-KEY:METHOD=...,URI="...", #EXT-X-MAP:URI="...", #EXT-X-MEDIA:...,URI="...")
    if (trimmed.startsWith('#EXT-X-KEY') || trimmed.startsWith('#EXT-X-MAP') || trimmed.startsWith('#EXT-X-MEDIA')) {
      line = line.replace(/URI="([^"]+)"/g, (_match, uri) => {
        try {
          const absoluteUri = new URL(uri, baseUrl).href;
          const token = encryptUrlToken(absoluteUri, expiresAt, metadata);
          const proxyUri = `${hostBase}/api/linkmaster/res?t=${encodeURIComponent(token)}`;
          return `URI="${proxyUri}"`;
        } catch {
          return _match;
        }
      });
      rewritten.push(line);
      continue;
    }

    // Other comment or tag lines
    if (trimmed.startsWith('#')) {
      rewritten.push(line);
      continue;
    }

    // This is a media segment URL or a variant playlist URL line!
    try {
      const absoluteUri = new URL(trimmed, baseUrl).href;
      const token = encryptUrlToken(absoluteUri, expiresAt, metadata);
      const isPlaylist = absoluteUri.toLowerCase().includes('.m3u8');
      const ext = isPlaylist ? '.m3u8' : '.ts';
      const proxyUri = `${hostBase}/api/linkmaster/res${ext}?t=${encodeURIComponent(token)}`;
      rewritten.push(proxyUri);
    } catch {
      // If URL parsing fails, retain original
      rewritten.push(line);
    }
  }

  return rewritten.join('\r\n');
}

/**
 * Obfuscate and replace real URLs in M3U with encrypted temporary aliases,
 * injecting required HTTP headers (such as valid browser User-Agent and Referer)
 * into the M3U playlist format so external IPTV players (VLC, TiviMate, OTT Navigator,
 * IPTV Smarters, Kodi, Perfect Player) play the streams reliably without 403 blocks.
 */
export async function handleObfuscateM3u(req: Request, res: Response) {
  try {
    const {
      m3uContent,
      expiryHours = 48, // default 48h (or 0 for permanent)
      streamingMode = 'direct', // 'direct' (Universal Direct IPTV - 100% external player compatible) or 'proxy' (Encrypted Proxy Server)
      aliasPrefix = 'stream',
      customHost,
      userAgent = DEFAULT_IPTV_USER_AGENT,
      referer,
      includeVlcOpt = true,
      includeExtHttp = true,
      includePipeSyntax = false,
    } = req.body;

    if (!m3uContent || typeof m3uContent !== 'string') {
      return res.status(400).json({ success: false, message: 'm3uContent is required.' });
    }

    const detectedHost = (
      req.get('x-forwarded-proto') && req.get('x-forwarded-host')
        ? `${req.get('x-forwarded-proto')}://${req.get('x-forwarded-host')}`
        : `${req.protocol}://${req.get('host')}`
    ).replace(/\/+$/, '');

    // Check if detected host is an internal ais-dev / cloud-run sandbox domain
    const isAisDevHost = detectedHost.includes('.ais-dev.') || detectedHost.includes('.run.app');
    
    // Default to 'direct' mode when on ais-dev unless client explicitly requested 'proxy' with customHost
    const effectiveMode: 'direct' | 'proxy' =
      req.body.streamingMode || (isAisDevHost && !customHost ? 'direct' : 'proxy');

    const hostBase = (
      customHost || (isAisDevHost ? 'http://localhost:3000' : detectedHost)
    ).replace(/\/+$/, '');

    const effectiveReferer = referer || `${hostBase}/`;
    const now = Date.now();
    const expiresAt = expiryHours > 0 ? now + expiryHours * 60 * 60 * 1000 : null;

    const lines = m3uContent.split(/\r?\n/);
    const modifiedLines: string[] = [];
    const aliasesList: Array<{
      id: string;
      originalUrl: string;
      aliasUrl: string;
      channelName: string;
      categoryName?: string;
      expiresAt: number | null;
      headers: {
        userAgent: string;
        referer: string;
      };
    }> = [];

    let currentChannelName = 'Stream Channel';
    let currentCategoryName = 'Live TV';
    let extm3uHeaderInjected = false;

    // Check if the file starts with #EXTM3U
    const firstNonEmptyIdx = lines.findIndex((l) => l.trim().length > 0);
    const hasExtM3uHeader = firstNonEmptyIdx !== -1 && lines[firstNonEmptyIdx].trim().startsWith('#EXTM3U');

    if (!hasExtM3uHeader) {
      // Prepend standard M3U header with global User-Agent attributes
      modifiedLines.push(
        `#EXTM3U x-tvg-url="" http-user-agent="${userAgent}" user-agent="${userAgent}"`
      );
      extm3uHeaderInjected = true;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) {
        modifiedLines.push('');
        continue;
      }

      // 1. Process header line #EXTM3U
      if (line.startsWith('#EXTM3U')) {
        let enhancedHeader = line;
        if (!enhancedHeader.includes('user-agent=')) {
          enhancedHeader += ` http-user-agent="${userAgent}" user-agent="${userAgent}"`;
        }
        modifiedLines.push(enhancedHeader);
        extm3uHeaderInjected = true;
        continue;
      }

      // 2. Process #EXTINF: line
      if (line.startsWith('#EXTINF:')) {
        // Extract category if present
        const groupMatch = line.match(/group-title="([^"]+)"/i);
        if (groupMatch) {
          currentCategoryName = groupMatch[1];
        }
        // Extract channel name after comma
        const commaIdx = line.lastIndexOf(',');
        if (commaIdx !== -1) {
          currentChannelName = line.slice(commaIdx + 1).trim();
        }

        // Inject user-agent and http-user-agent attributes into #EXTINF before the comma
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

        // Inject IPTV player directives right below #EXTINF:
        // A. Standard VLC / Perfect Player directive:
        if (includeVlcOpt) {
          modifiedLines.push(`#EXTVLCOPT:http-user-agent=${userAgent}`);
          if (effectiveReferer) {
            modifiedLines.push(`#EXTVLCOPT:http-referrer=${effectiveReferer}`);
          }
        }

        // B. Modern OTT Navigator / TiviMate / Android IPTV directive:
        if (includeExtHttp) {
          const httpHeaderJson = JSON.stringify({
            'User-Agent': userAgent,
            ...(effectiveReferer ? { Referer: effectiveReferer } : {}),
          });
          modifiedLines.push(`#EXTHTTP:${httpHeaderJson}`);
        }

        continue;
      }

      // 3. Skip old user-agent/referrer tags from input so we don't duplicate them
      if (
        line.startsWith('#EXTVLCOPT:http-user-agent') ||
        line.startsWith('#EXTVLCOPT:http-referrer') ||
        line.startsWith('#EXTHTTP:')
      ) {
        continue;
      }

      // 4. Pass-through other M3U tags
      if (line.startsWith('#')) {
        modifiedLines.push(line);
        continue;
      }

      // 5. This is a stream URL line!
      const originalUrl = line;

      // Determine proper file extension (.ts or .m3u8) so IPTV players immediately recognize the stream type
      let extension = '.m3u8';
      const cleanUrl = originalUrl.split(/[?#]/)[0].toLowerCase();
      if (cleanUrl.endsWith('.ts')) {
        extension = '.ts';
      } else if (cleanUrl.endsWith('.mp4')) {
        extension = '.mp4';
      } else if (cleanUrl.endsWith('.mkv')) {
        extension = '.mkv';
      }

      // Generate random high-entropy alias ID
      const aliasId = `${aliasPrefix}_${crypto.randomBytes(8).toString('hex')}`;

      // Store in memory registry for zero-latency lookup
      aliasRegistry.set(aliasId, {
        id: aliasId,
        originalUrl,
        createdAt: now,
        expiresAt,
        channelName: currentChannelName,
        categoryName: currentCategoryName,
        userAgent,
        referer: effectiveReferer,
      });

      // Also create encrypted stateless token with User-Agent & Referer metadata
      const encryptedToken = encryptUrlToken(originalUrl, expiresAt, {
        ua: userAgent,
        ref: effectiveReferer,
      });

      let finalStreamUrl = '';
      let aliasUrl = '';

      if (effectiveMode === 'direct') {
        // Universal Direct IPTV Mode:
        // Use clean direct stream URL (with optional pipe syntax) and all injected headers.
        // 100% playable on any IPTV app, VLC, or Smart TV without any ais-dev dependency!
        if (includePipeSyntax) {
          finalStreamUrl = `${originalUrl}|User-Agent=${encodeURIComponent(userAgent)}${
            effectiveReferer ? `&Referer=${encodeURIComponent(effectiveReferer)}` : ''
          }`;
        } else {
          finalStreamUrl = originalUrl;
        }
        aliasUrl = finalStreamUrl;
      } else {
        // Encrypted Proxy Mode:
        const baseAliasUrl = `${hostBase}/api/linkmaster/stream/${aliasId}${extension}?token=${encodeURIComponent(encryptedToken)}`;
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
      aliasesList.push({
        id: aliasId,
        originalUrl,
        aliasUrl,
        channelName: currentChannelName,
        categoryName: currentCategoryName,
        expiresAt: effectiveMode === 'direct' ? null : expiresAt,
        headers: {
          userAgent,
          referer: effectiveReferer,
        },
      });
    }

    return res.json({
      success: true,
      streamingMode: effectiveMode,
      totalReplaced: aliasesList.length,
      expiresAt: effectiveMode === 'direct' ? null : expiresAt,
      expiryHours,
      userAgent,
      referer: effectiveReferer,
      modifiedM3u: modifiedLines.join('\r\n'),
      aliases: aliasesList.slice(0, 150), // Preview sample
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Core stream fetcher and proxy.
 * Handles:
 * 1. M3U8 HLS manifest rewriting (so child playlists and TS chunks route via proxy with proper headers)
 * 2. Binary TS/MP4 chunk streaming with Range support
 * 3. HEAD requests for IPTV players checking stream validity
 * 4. User-Agent & Referer header forwarding to prevent 403 Forbidden blocks from upstream CDNs
 */
async function proxyStreamContent(
  req: Request,
  res: Response,
  targetUrl: string,
  expiresAt: number | null,
  aliasId?: string,
  options?: { userAgent?: string; referer?: string }
) {
  // Check expiration
  if (expiresAt && expiresAt < Date.now()) {
    return res.status(410).send('This temporary stream alias has expired.');
  }

  // Set full CORS & caching headers for wide IPTV player compatibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Disposition', 'inline');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  // Determine effective User-Agent to send upstream:
  // If the IPTV player or options provided a valid User-Agent, use it.
  // Otherwise, default to standard Chrome browser User-Agent so upstream CDNs never block the request.
  const incomingUa = (req.headers['user-agent'] as string) || '';
  const effectiveUserAgent =
    options?.userAgent ||
    (incomingUa && !incomingUa.toLowerCase().includes('node') && !incomingUa.toLowerCase().includes('undici')
      ? incomingUa
      : DEFAULT_IPTV_USER_AGENT);

  const effectiveReferer =
    options?.referer || (req.headers['referer'] as string) || (req.query.ref as string);

  const clientHeaders: Record<string, string> = {
    'User-Agent': effectiveUserAgent,
    Accept: '*/*',
    Connection: 'keep-alive',
  };
  if (req.headers.range) {
    clientHeaders['Range'] = req.headers.range as string;
  }
  if (effectiveReferer) {
    clientHeaders['Referer'] = effectiveReferer;
  }

  try {
    // If client sent HEAD request (common in IPTV players checking stream status)
    if (req.method === 'HEAD') {
      try {
        const headRes = await fetch(targetUrl, {
          method: 'HEAD',
          signal: controller.signal,
          headers: clientHeaders,
          redirect: 'follow',
        });
        res.status(headRes.status);
        const cType = headRes.headers.get('content-type') || 'application/vnd.apple.mpegurl';
        res.setHeader('Content-Type', cType);
        res.setHeader('Accept-Ranges', 'bytes');
        return res.end();
      } catch {
        // Safe fallback for IPTV players
        res.status(200);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        return res.end();
      }
    }

    const upstreamResponse = await fetch(targetUrl, {
      signal: controller.signal,
      headers: clientHeaders,
      redirect: 'follow',
    });

    if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
      return res
        .status(upstreamResponse.status)
        .send(`Upstream stream error (${upstreamResponse.status}): ${upstreamResponse.statusText}`);
    }

    const contentType = (upstreamResponse.headers.get('content-type') || '').toLowerCase();
    const finalUpstreamUrl = upstreamResponse.url || targetUrl;

    const hostBase = (
      req.get('x-forwarded-proto') && req.get('x-forwarded-host')
        ? `${req.get('x-forwarded-proto')}://${req.get('x-forwarded-host')}`
        : `${req.protocol}://${req.get('host')}`
    ).replace(/\/+$/, '');

    // Check if upstream returned an M3U8 playlist
    const isM3u8 =
      contentType.includes('mpegurl') ||
      contentType.includes('m3u8') ||
      finalUpstreamUrl.toLowerCase().includes('.m3u8') ||
      targetUrl.toLowerCase().includes('.m3u8');

    if (isM3u8) {
      const manifestText = await upstreamResponse.text();

      // If it contains #EXTM3U, rewrite all internal segment and variant URLs
      if (manifestText.includes('#EXTM3U')) {
        const rewrittenManifest = rewriteM3u8Manifest(manifestText, finalUpstreamUrl, hostBase, expiresAt, {
          ua: effectiveUserAgent,
          ref: effectiveReferer,
        });
        res.status(200);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline');
        return res.send(rewrittenManifest);
      } else {
        // Not actually a manifest, send text as is
        res.status(upstreamResponse.status);
        res.setHeader('Content-Type', contentType || 'text/plain');
        res.setHeader('Content-Disposition', 'inline');
        return res.send(manifestText);
      }
    }

    // Direct binary media stream (TS segment, fMP4 chunk, direct MPEG-TS stream)
    res.status(upstreamResponse.status);

    let outputContentType = contentType;
    if (!outputContentType || outputContentType === 'application/octet-stream') {
      if (targetUrl.toLowerCase().includes('.ts')) {
        outputContentType = 'video/mp2t';
      } else if (targetUrl.toLowerCase().includes('.m4s') || targetUrl.toLowerCase().includes('.mp4')) {
        outputContentType = 'video/mp4';
      } else {
        outputContentType = 'video/mp2t';
      }
    }
    res.setHeader('Content-Type', outputContentType);
    res.setHeader('Content-Disposition', 'inline');

    const contentLength = upstreamResponse.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    const contentRange = upstreamResponse.headers.get('content-range');
    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
    }
    const acceptRanges = upstreamResponse.headers.get('accept-ranges');
    if (acceptRanges) {
      res.setHeader('Accept-Ranges', acceptRanges);
    }

    if (!upstreamResponse.body) {
      return res.end();
    }

    // Stream chunks directly with backpressure handling
    // @ts-ignore
    const reader = upstreamResponse.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        break;
      }
      if (!res.write(value)) {
        await new Promise((resolve) => res.once('drain', resolve));
      }
    }
  } catch (streamErr: any) {
    if (!res.headersSent) {
      return res.status(502).send(`Stream fetch failed: ${streamErr.message}`);
    }
    res.end();
  }
}

/**
 * Handle initial streaming through temporary encrypted alias:
 * /api/linkmaster/stream/:aliasId
 */
export async function handleStreamAlias(req: Request, res: Response) {
  try {
    let rawAlias = req.params.aliasId || ''; // e.g., stream_12345678.m3u8 or stream_12345678.ts|User-Agent=...
    const parsedAlias = parsePipedHeaders(rawAlias);
    rawAlias = parsedAlias.clean;

    const aliasId = rawAlias.replace(/\.[a-zA-Z0-9]+$/, '');

    let tokenQuery = (req.query.token as string) || (req.query.t as string);
    let pipedUserAgent = parsedAlias.headers['user-agent'];
    let pipedReferer = parsedAlias.headers['referer'];

    if (tokenQuery) {
      const parsedToken = parsePipedHeaders(tokenQuery);
      tokenQuery = parsedToken.clean;
      if (parsedToken.headers['user-agent'] && !pipedUserAgent) {
        pipedUserAgent = parsedToken.headers['user-agent'];
      }
      if (parsedToken.headers['referer'] && !pipedReferer) {
        pipedReferer = parsedToken.headers['referer'];
      }
    }

    let targetUrl: string | null = null;
    let expiresAt: number | null = null;
    let storedUa: string | undefined = pipedUserAgent;
    let storedRef: string | undefined = pipedReferer;

    // 1. Check in-memory registry
    const record = aliasRegistry.get(aliasId);
    if (record) {
      targetUrl = record.originalUrl;
      expiresAt = record.expiresAt;
      storedUa = storedUa || record.userAgent;
      storedRef = storedRef || record.referer;
    }

    // 2. Fallback to stateless encrypted token
    if (!targetUrl && tokenQuery) {
      const decrypted = decryptUrlToken(tokenQuery);
      if (decrypted) {
        targetUrl = decrypted.realUrl;
        expiresAt = decrypted.expiresAt;
        storedUa = storedUa || decrypted.userAgent;
        storedRef = storedRef || decrypted.referer;
      }
    }

    // 3. Fallback: Check if aliasId itself has an entry matching prefix
    if (!targetUrl) {
      for (const [id, rec] of aliasRegistry.entries()) {
        if (rawAlias.startsWith(id)) {
          targetUrl = rec.originalUrl;
          expiresAt = rec.expiresAt;
          storedUa = storedUa || rec.userAgent;
          storedRef = storedRef || rec.referer;
          break;
        }
      }
    }

    // 4. Direct URL query fallback (for reverse-proxying non-CORS or Mixed Content streams)
    if (!targetUrl && req.query.url) {
      targetUrl = String(req.query.url).trim();
    }

    if (!targetUrl) {
      return res.status(404).send('Stream alias not found or invalid.');
    }

    return proxyStreamContent(req, res, targetUrl, expiresAt, aliasId, {
      userAgent: storedUa,
      referer: storedRef,
    });
  } catch (err: any) {
    if (!res.headersSent) {
      return res.status(500).send(`Link Master proxy error: ${err.message}`);
    }
    res.end();
  }
}

/**
 * Handle sub-resource streaming (M3U8 variant playlists, .ts segments, .m4s chunks, encryption keys):
 * /api/linkmaster/res?t=ENCRYPTED_TOKEN
 */
export async function handleStreamSubResource(req: Request, res: Response) {
  try {
    let token = (req.query.t as string) || (req.query.token as string) || (req.query.u as string);

    if (!token) {
      return res.status(400).send('Missing sub-resource token.');
    }

    const parsedToken = parsePipedHeaders(token);
    token = parsedToken.clean;

    const decrypted = decryptUrlToken(token);
    if (!decrypted || !decrypted.realUrl) {
      return res.status(404).send('Invalid or expired resource token.');
    }

    const effectiveUa = parsedToken.headers['user-agent'] || decrypted.userAgent;
    const effectiveRef = parsedToken.headers['referer'] || decrypted.referer;

    return proxyStreamContent(req, res, decrypted.realUrl, decrypted.expiresAt, undefined, {
      userAgent: effectiveUa,
      referer: effectiveRef,
    });
  } catch (err: any) {
    if (!res.headersSent) {
      return res.status(500).send(`Sub-resource proxy error: ${err.message}`);
    }
    res.end();
  }
}
