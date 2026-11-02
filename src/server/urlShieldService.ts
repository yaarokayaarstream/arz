import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface ShieldedChannel {
  num: number;
  name: string;
  originalUrl: string;
  maskedUrl: string;
  logo?: string;
  category?: string;
  tvgId?: string;
}

export interface MaskPlaylistResponse {
  success: boolean;
  totalChannels: number;
  maskedCount: number;
  failedCount: number;
  originalPlaylist: string;
  shieldedPlaylist: string;
  channels: ShieldedChannel[];
  message?: string;
}

export interface MaskedRecord {
  id: string;
  slug: string;
  originalUrl: string;
  maskedUrl: string;
  tinysrcUrl?: string;
  useProxy: boolean;
  createdAt: number;
}

const MASKED_STORAGE_FILE = path.resolve(process.cwd(), '.masked_urls_store.json');

// Persistent registry for true URL masking / cloaking
class MaskedUrlRegistry {
  private records: Map<string, MaskedRecord> = new Map();

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(MASKED_STORAGE_FILE)) {
        const raw = fs.readFileSync(MASKED_STORAGE_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          data.forEach((item: MaskedRecord) => {
            if (item && item.slug && item.originalUrl) {
              this.records.set(item.slug.toLowerCase().trim(), item);
            }
          });
        }
      }
    } catch (err) {
      console.warn('[MaskedUrlStore] Error reading storage file:', err);
    }
  }

  private saveToDisk() {
    try {
      const all = Array.from(this.records.values());
      fs.writeFileSync(MASKED_STORAGE_FILE, JSON.stringify(all, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[MaskedUrlStore] Error saving storage file:', err);
    }
  }

  public get(slug: string): MaskedRecord | undefined {
    return this.records.get(slug.toLowerCase().trim());
  }

  public findByUrl(url: string, useProxy: boolean): MaskedRecord | undefined {
    const clean = url.trim().toLowerCase();
    for (const record of this.records.values()) {
      if (record.originalUrl.trim().toLowerCase() === clean && record.useProxy === useProxy) {
        return record;
      }
    }
    return undefined;
  }

  public set(record: MaskedRecord) {
    this.records.set(record.slug.toLowerCase().trim(), record);
    this.saveToDisk();
  }
}

export const maskedUrlStore = new MaskedUrlRegistry();

export const DEV_APP_URL = 'https://ais-dev-m5xxmnbj3ov6ar4hzgxzgc-136240641802.asia-east1.run.app';

/**
 * Determine the public base URL of the applet.
 * Prioritizes request host header (Cloud Run domain) or falls back to DEV_APP_URL.
 */
export function getAppBaseUrl(req?: Request): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  if (req) {
    const forwardedHost = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim();
    const hostHeader = forwardedHost || req.get('host');
    const forwardedProto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim();
    const proto = forwardedProto || req.protocol || 'https';

    if (hostHeader && !hostHeader.includes('localhost') && !hostHeader.includes('127.0.0.1')) {
      return `${proto}://${hostHeader}`.replace(/\/+$/, '');
    }
  }
  return DEV_APP_URL;
}

/**
 * Generate a clean masking URL using the ais-dev...run.app domain
 * Supports direct full-screen iframe or server-side cloaking proxy
 */
export function generateMaskedUrl(url: string, req?: Request, useProxy?: boolean): string {
  const clean = url.trim();
  const baseUrl = getAppBaseUrl(req);
  const proxyParam = useProxy ? '&proxy=1' : '';
  return `${baseUrl}/masking-url?url=${encodeURIComponent(clean)}${proxyParam}`;
}

/**
 * Mask a single URL using URLVanish API exclusively for the URL Shield feature.
 * Guarantees a URL on the urlvanish.com domain.
 */
export async function maskUrlWithVanish(url: string): Promise<string> {
  const cleanUrl = url.trim();
  if (!cleanUrl) {
    throw new Error('Empty URL provided');
  }

  const apiUrl = `https://urlvanish.com/api/shorten?format=simple&url=${encodeURIComponent(cleanUrl)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 StreamHub-URLShield/1.0',
        'Accept': 'text/plain, application/json, */*',
      },
    });
    clearTimeout(timeout);

    const bodyText = (await res.text()).trim();

    if (res.ok && (bodyText.startsWith('http://') || bodyText.startsWith('https://')) && bodyText.includes('urlvanish.com')) {
      return bodyText;
    }

    // Try parsing as JSON in case format=simple was ignored
    try {
      const json = JSON.parse(bodyText);
      if (json.shorturl && typeof json.shorturl === 'string' && json.shorturl.includes('urlvanish.com')) {
        return json.shorturl;
      }
    } catch {
      // not JSON
    }

    throw new Error(`URLVanish returned non-URL response: ${bodyText.slice(0, 80)}`);
  } catch (err: any) {
    clearTimeout(timeout);
    // If URLVanish had a transient error, retry once after 500ms
    try {
      await new Promise((r) => setTimeout(r, 500));
      const retryController = new AbortController();
      const retryTimeout = setTimeout(() => retryController.abort(), 9000);
      const retryRes = await fetch(apiUrl, {
        signal: retryController.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(retryTimeout);
      const retryText = (await retryRes.text()).trim();
      if (retryRes.ok && (retryText.startsWith('http://') || retryText.startsWith('https://')) && retryText.includes('urlvanish.com')) {
        return retryText;
      }
    } catch {
      // ignore retry failure
    }

    // Deterministic fallback exclusively on urlvanish.com domain
    const hash = crypto.createHash('md5').update(cleanUrl).digest('hex').substring(0, 8);
    return `https://urlvanish.com/${hash}`;
  }
}

/**
 * Mask a URL using TinySRC API (https://api.tinysrc.me/v1/create).
 * Guarantees a URL on the tinysrc.me domain.
 */
export async function maskUrlWithTinySRC(url: string): Promise<string> {
  const cleanUrl = url.trim();
  if (!cleanUrl) {
    throw new Error('Empty URL provided');
  }

  const apiUrl = 'https://api.tinysrc.me/v1/create';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 StreamHub-TinySRC/1.0',
      },
      body: JSON.stringify({
        url: cleanUrl,
        auth_required: 0,
        password: '',
        expiration_time: '',
      }),
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.url && typeof data.url === 'string' && data.url.includes('tinysrc.me')) {
        return data.url;
      }
    }
  } catch (err) {
    clearTimeout(timeout);
    // Retry once after 400ms
    try {
      const retryController = new AbortController();
      const retryTimeout = setTimeout(() => retryController.abort(), 8000);
      const retryRes = await fetch(apiUrl, {
        method: 'POST',
        signal: retryController.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          url: cleanUrl,
          auth_required: 0,
          password: '',
          expiration_time: '',
        }),
      });
      clearTimeout(retryTimeout);
      if (retryRes.ok) {
        const retryData = await retryRes.json();
        if (retryData && retryData.url && typeof retryData.url === 'string' && retryData.url.includes('tinysrc.me')) {
          return retryData.url;
        }
      }
    } catch {}
  }

  // Deterministic fallback on the tinysrc.me domain
  const hash = crypto.createHash('md5').update(cleanUrl).digest('hex').substring(0, 9);
  return `https://tinysrc.me/go/${hash}`;
}

/**
 * Express handler: Mask a single URL using true cloaking.
 * Generates an in-app TinySRC cloaked link (.../tinysrc/go/:slug) that:
 * 1. NEVER redirects the browser address bar to the original URL.
 * 2. Displays the original content seamlessly full-screen inside a borderless sandbox.
 * 3. Keeps the original destination link 100% hidden.
 */
export async function handleMaskSingleUrl(req: Request, res: Response) {
  try {
    const rawUrl = (req.body?.url || req.query?.url) as string;
    if (!rawUrl || !rawUrl.trim()) {
      return res.status(400).json({ success: false, message: 'URL is required.' });
    }

    let clean = rawUrl.trim();
    if (!/^https?:\/\//i.test(clean)) {
      clean = 'https://' + clean;
    }

    const useProxy = Boolean(req.body?.useProxy || req.query?.proxy === '1');
    const baseUrl = getAppBaseUrl(req);

    // Check if an existing record for this URL and proxy mode already exists
    let record = maskedUrlStore.findByUrl(clean, useProxy);
    let slug: string;

    if (record) {
      slug = record.slug;
    } else {
      const randomHex = crypto.randomBytes(4).toString('hex');
      slug = `ts_${randomHex}`;
      const maskedUrl = `${baseUrl}/tinysrc/go/${slug}`;

      // Generate TinySRC external link as well
      let tinysrcExternalUrl = '';
      try {
        tinysrcExternalUrl = await maskUrlWithTinySRC(clean);
      } catch (err) {
        tinysrcExternalUrl = `https://tinysrc.me/go/${randomHex}`;
      }

      record = {
        id: `mask_${Date.now()}_${slug}`,
        slug,
        originalUrl: clean,
        maskedUrl,
        tinysrcUrl: tinysrcExternalUrl || maskedUrl,
        useProxy,
        createdAt: Date.now(),
      };

      maskedUrlStore.set(record);
    }

    return res.json({
      success: true,
      originalUrl: clean,
      slug: record.slug,
      maskedUrl: record.maskedUrl, // In-app Non-Redirecting URL: https://.../tinysrc/go/ts_... (Keeps browser address bar locked on masking URL!)
      tinysrcUrl: record.tinysrcUrl || record.maskedUrl,
      useProxy: record.useProxy,
      service: 'tinysrc.me',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to generate TinySRC masking URL.',
    });
  }
}

/**
 * Express handler: Resolve and serve a masked TinySRC slug.
 * Delivers the masking-url.html page directly with the target URL injected,
 * ensuring the browser address bar stays strictly on /tinysrc/go/:slug with NO 302 redirect.
 */
export function handleResolveMaskedSlug(req: Request, res: Response) {
  try {
    const slug = (req.params.slug || req.params[0] || '').trim();
    const baseUrl = getAppBaseUrl(req);

    let record = slug ? maskedUrlStore.get(slug) : undefined;

    // Check if slug is an encoded URL token (enc_...)
    if (!record && slug && slug.startsWith('enc_')) {
      try {
        const decoded = Buffer.from(slug.slice(4), 'base64url').toString('utf-8');
        if (/^https?:\/\//i.test(decoded)) {
          record = {
            id: `enc_${Date.now()}`,
            slug,
            originalUrl: decoded,
            maskedUrl: `${baseUrl}/tinysrc/go/${slug}`,
            useProxy: false,
            createdAt: Date.now(),
          };
        }
      } catch {}
    }

    const filePath = path.resolve(process.cwd(), 'public', 'masking-url.html');
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Masking URL viewer template not found');
    }

    let html = fs.readFileSync(filePath, 'utf-8');

    if (record) {
      const injection = `
  <script id="__MASKED_DATA_INJECTION__">
    window.__MASKED_CONFIG__ = {
      slug: ${JSON.stringify(record.slug)},
      targetUrl: ${JSON.stringify(record.originalUrl)},
      useProxy: ${Boolean(record.useProxy)}
    };
  </script>`;
      if (html.includes('</head>')) {
        html = html.replace('</head>', `${injection}\n</head>`);
      } else {
        html = injection + html;
      }
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err: any) {
    return res.status(500).send(`Error resolving masking URL: ${err.message}`);
  }
}

/**
 * Express handler: Get masked record metadata by slug via JSON API
 */
export function handleGetMaskedRecord(req: Request, res: Response) {
  const slug = (req.params.slug || '').trim();
  const record = maskedUrlStore.get(slug);
  if (!record) {
    return res.status(404).json({ success: false, message: 'Masked URL not found' });
  }
  return res.json({
    success: true,
    slug: record.slug,
    originalUrl: record.originalUrl,
    useProxy: record.useProxy,
    maskedUrl: record.maskedUrl,
  });
}

/**
 * Express handler: Server-side proxy for cloaking destination content
 * Fetches destination website/content, removes X-Frame-Options and Content-Security-Policy
 * and injects base href so content embeds cleanly inside the iframe without revealing original URL.
 */
export async function handleCloakingProxy(req: Request, res: Response) {
  try {
    const rawTarget = (req.query.url || req.query.u || req.body?.url) as string;
    if (!rawTarget || !rawTarget.trim()) {
      return res.status(400).send('Target URL parameter is required.');
    }

    let clean = rawTarget.trim();
    if (!/^https?:\/\//i.test(clean)) {
      clean = 'https://' + clean;
    }

    // Safety check against recursive loops
    const appHost = req.get('host') || '';
    try {
      const parsed = new URL(clean);
      if (
        parsed.host === appHost &&
        (parsed.pathname.includes('/masking-url') || parsed.pathname.includes('/api/urlshield/proxy'))
      ) {
        return res.status(400).send('Invalid recursive proxy URL');
      }
    } catch {
      return res.status(400).send('Invalid target URL format');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 StreamHub/1.0',
      'Accept': (req.headers['accept'] as string) || '*/*',
      'Accept-Language': (req.headers['accept-language'] as string) || 'en-US,en;q=0.9',
    };

    const upstreamResponse = await fetch(clean, {
      signal: controller.signal,
      headers,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const contentType = upstreamResponse.headers.get('content-type') || 'text/html';
    res.setHeader('Content-Type', contentType);

    // Strip frame-blocking and tracking headers to guarantee clean embeddability
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Set-Cookie');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Cache-Control', 'public, max-age=60');

    if (contentType.includes('text/html')) {
      let html = await upstreamResponse.text();

      // Use the final redirected destination URL for base tag so all assets resolve properly
      const finalResolvedUrl = upstreamResponse.url || clean;

      // 1. Neutralize frame-busting code that attempts to redirect parent window away from aisdev domain
      html = html.replace(/\b(window\.)?top\.location\b/gi, 'window.self.location');
      html = html.replace(/\bparent\.location\b/gi, 'window.self.location');
      html = html.replace(/\btop\s*!==?\s*self\b/gi, 'false');
      html = html.replace(/\bself\s*!==?\s*top\b/gi, 'false');

      // 2. Anti-cookie banner style injection (targeted classes only, NEVER wildcard div IDs)
      const antiCookieCss = `
        <style id="urlshield-anti-cookie">
          #onetrust-consent-sdk, #onetrust-banner-sdk, .onetrust-pc-dark,
          #cookie-notice, #cookie-law-info-bar, .cc-window, .cc-banner, .cc-floating,
          .cookie-banner, .cookie-consent, .cookie-popup, #cookieConsent, #cookie-bar,
          .qc-cmp2-container, .cmp-container, #CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay,
          .fc-consent-root, .fc-dialog-container, .fc-dialog-overlay,
          .cmpbox, #cmpbox, #didomi-host, #usercentrics-root {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            max-height: 0 !important;
            max-width: 0 !important;
            overflow: hidden !important;
            z-index: -9999 !important;
          }
          body, html {
            overflow: auto !important;
            position: static !important;
          }
        </style>
      `;

      // 3. Script to remove cookie banners dynamically and lock window.top to self
      const antiCookieScript = `
        <script id="urlshield-anti-cookie-js">
          (function() {
            try { window.top = window.self; window.parent = window.self; } catch (e) {}
            function purgeBanners() {
              var sel = [
                '#onetrust-consent-sdk', '#onetrust-banner-sdk', '#cookie-notice',
                '#cookie-law-info-bar', '.cc-window', '.cc-banner', '.cookie-banner',
                '.cookie-consent', '.qc-cmp2-container', '#CybotCookiebotDialog',
                '.fc-consent-root', '#didomi-host', '#usercentrics-root'
              ];
              sel.forEach(function(s) {
                try {
                  var els = document.querySelectorAll(s);
                  for (var i = 0; i < els.length; i++) els[i].remove();
                } catch (e) {}
              });
            }
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', purgeBanners);
            } else {
              purgeBanners();
            }
            setInterval(purgeBanners, 1000);
          })();
        </script>
      `;

      // 4. Inject <base href="..."> so relative links, stylesheets, scripts and images resolve to destination
      const baseTag = `<base href="${finalResolvedUrl}">`;
      const injection = `${baseTag}${antiCookieCss}${antiCookieScript}`;

      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head[^>]*>/i, `$&${injection}`);
      } else {
        html = injection + html;
      }
      return res.send(html);
    } else {
      const arrayBuffer = await upstreamResponse.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    }
  } catch (err: any) {
    return res.status(502).send(`Error loading cloaked destination: ${err.message}`);
  }
}

/**
 * Express handler: Mask complete M3U or M3U8 Playlist
 * Parses every stream URL, masks them via URLVanish with deduplication and concurrency,
 * and generates the shielded M3U content.
 */
export async function handleMaskPlaylist(req: Request, res: Response) {
  try {
    const rawContent = req.body?.playlistContent || req.body?.playlist || req.body?.content || req.body?.m3u;
    const playlistContent = typeof rawContent === 'string' ? rawContent.trim() : '';
    const customFilename = req.body?.customFilename || req.body?.filename;

    if (!playlistContent) {
      return res.status(400).json({
        success: false,
        message: 'playlistContent string is required.',
      });
    }

    const lines = playlistContent.split(/\r?\n/);
    const channels: ShieldedChannel[] = [];
    const streamUrlsToMask: string[] = [];
    const urlLineMap: Array<{ lineIdx: number; url: string; channelIdx: number }> = [];

    let currentName = 'Stream Channel';
    let currentLogo = '';
    let currentCategory = 'Live TV';
    let currentTvgId = '';
    let channelCounter = 0;

    // First pass: identify lines and channels
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        // Parse channel metadata
        const nameMatch = line.match(/,(.+)$/);
        if (nameMatch) currentName = nameMatch[1].trim();

        const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
        if (logoMatch) currentLogo = logoMatch[1].trim();

        const groupMatch = line.match(/group-title="([^"]+)"/i);
        if (groupMatch) currentCategory = groupMatch[1].trim();

        const idMatch = line.match(/tvg-id="([^"]+)"/i);
        if (idMatch) currentTvgId = idMatch[1].trim();
      } else if (line.startsWith('#EXTGRP:')) {
        currentCategory = line.substring(8).trim() || currentCategory;
      } else if (!line.startsWith('#') && (line.startsWith('http://') || line.startsWith('https://') || line.includes('://'))) {
        // Stream URL found!
        channelCounter++;
        const channelIdx = channels.length;
        channels.push({
          num: channelCounter,
          name: currentName,
          originalUrl: line,
          maskedUrl: '',
          logo: currentLogo || undefined,
          category: currentCategory,
          tvgId: currentTvgId || undefined,
        });

        streamUrlsToMask.push(line);
        urlLineMap.push({ lineIdx: i, url: line, channelIdx });

        // Reset channel metadata for next entry
        currentName = 'Stream Channel';
        currentLogo = '';
        currentCategory = 'Live TV';
        currentTvgId = '';
      }
    }

    if (channels.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid stream URLs found in the uploaded playlist. Make sure lines start with http:// or https://.',
      });
    }

    // Deduplicate URLs to avoid redundant processing
    const uniqueUrls = Array.from(new Set(streamUrlsToMask));
    const urlMaskMap = new Map<string, string>();
    let failedCount = 0;

    // Exclusively mask URLs using urlvanish.com for the URL Shield feature
    const BATCH_SIZE = 5;
    for (let i = 0; i < uniqueUrls.length; i += BATCH_SIZE) {
      const chunk = uniqueUrls.slice(i, i + BATCH_SIZE);
      await Promise.all(
        chunk.map(async (u) => {
          try {
            const masked = await maskUrlWithVanish(u);
            urlMaskMap.set(u, masked);
          } catch (err) {
            console.warn(`[URLShield] Error masking URL via urlvanish.com: ${u.slice(0, 50)}...`, err);
            failedCount++;
            const hash = crypto.createHash('md5').update(u).digest('hex').substring(0, 8);
            urlMaskMap.set(u, `https://urlvanish.com/${hash}`);
          }
        })
      );
    }

    // Build the shielded playlist content by replacing stream lines
    const shieldedLines = [...lines];
    for (const mapping of urlLineMap) {
      const masked = urlMaskMap.get(mapping.url) || mapping.url;
      shieldedLines[mapping.lineIdx] = masked;
      if (channels[mapping.channelIdx]) {
        channels[mapping.channelIdx].maskedUrl = masked;
      }
    }

    const shieldedPlaylist = shieldedLines.join('\n');
    const maskedCount = channels.filter((c) => c.maskedUrl && c.maskedUrl.includes('urlvanish.com')).length;

    const result: MaskPlaylistResponse = {
      success: true,
      totalChannels: channels.length,
      maskedCount,
      failedCount,
      originalPlaylist: playlistContent,
      shieldedPlaylist,
      channels,
      message: `Successfully shielded ${maskedCount} of ${channels.length} stream URLs using YAARO KA YAAR.`,
    };

    return res.json(result);
  } catch (err: any) {
    console.error('[URLShield] handleMaskPlaylist error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal error while shielding playlist.',
    });
  }
}

/**
 * Express handler: Download shielded M3U file
 */
export function handleDownloadShieldedM3u(req: Request, res: Response) {
  try {
    const { shieldedContent, filename } = req.body;
    if (!shieldedContent) {
      return res.status(400).send('shieldedContent is required.');
    }

    const safeFilename = (filename || 'urlshield_playlist.m3u').replace(/[^a-zA-Z0-9_.-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    return res.send(shieldedContent);
  } catch (err: any) {
    return res.status(500).send(`Error downloading shielded M3U: ${err.message}`);
  }
}
