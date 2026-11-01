import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export interface ClickRecord {
  id: string;
  timestamp: number;
  ip: string;
  userAgent: string;
  deviceType: 'Mobile' | 'Desktop' | 'Tablet' | 'Smart TV / STB' | 'IPTV App' | 'Unknown';
  clientName: string;
  os: string;
}

export interface TrackedUrlRecord {
  id: string;
  slug: string;
  name: string;
  m3uContent: string;
  channelCount: number;
  validityType: 'permanent' | 'timed';
  durationHours: number | null;
  expiresAt: number | null;
  createdAt: number;
  isDeleted: boolean;
  totalClicks: number;
  clicks: ClickRecord[];
}

const STORAGE_FILE = path.resolve(process.cwd(), '.track_urls_store.json');

// In-memory registry with file backing
class TrackUrlStore {
  private records: Map<string, TrackedUrlRecord> = new Map();

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          data.forEach((item: TrackedUrlRecord) => {
            if (item && item.slug && !item.isDeleted) {
              this.records.set(item.slug.toLowerCase(), item);
            }
          });
        }
      }
    } catch (err) {
      console.warn('[TrackUrlStore] Error reading storage file:', err);
    }
  }

  private saveToDisk() {
    try {
      const all = Array.from(this.records.values());
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(all, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[TrackUrlStore] Error writing storage file:', err);
    }
  }

  public getAll(): TrackedUrlRecord[] {
    return Array.from(this.records.values()).filter((r) => !r.isDeleted);
  }

  public getBySlug(slug: string): TrackedUrlRecord | undefined {
    return this.records.get(slug.toLowerCase());
  }

  public getById(id: string): TrackedUrlRecord | undefined {
    return Array.from(this.records.values()).find((r) => r.id === id && !r.isDeleted);
  }

  public set(record: TrackedUrlRecord) {
    this.records.set(record.slug.toLowerCase(), record);
    this.saveToDisk();
  }

  public delete(slugOrId: string): boolean {
    if (!slugOrId) return false;
    const clean = slugOrId.trim();
    const record =
      this.getBySlug(clean) ||
      this.getById(clean) ||
      Array.from(this.records.values()).find(
        (r) =>
          r.id.toLowerCase() === clean.toLowerCase() ||
          r.slug.toLowerCase() === clean.toLowerCase()
      );
    if (record) {
      record.isDeleted = true;
      this.records.delete(record.slug.toLowerCase());
      this.saveToDisk();
      return true;
    }
    return false;
  }
}

export const trackStore = new TrackUrlStore();

/**
 * Intelligent User-Agent Device, Player, and OS detection
 */
export function detectDeviceAndClient(ua: string): {
  deviceType: 'Mobile' | 'Desktop' | 'Tablet' | 'Smart TV / STB' | 'IPTV App' | 'Unknown';
  clientName: string;
  os: string;
} {
  const userAgent = ua || '';
  const lower = userAgent.toLowerCase();

  let deviceType: 'Mobile' | 'Desktop' | 'Tablet' | 'Smart TV / STB' | 'IPTV App' | 'Unknown' = 'Unknown';
  let clientName = 'Standard HTTP Client';
  let os = 'Unknown OS';

  // 1. Detect IPTV Players and Media Streamers
  if (lower.includes('tivimate')) {
    clientName = 'TiviMate IPTV';
    deviceType = 'Smart TV / STB';
  } else if (lower.includes('ott navigator') || lower.includes('ottnavigator')) {
    clientName = 'OTT Navigator IPTV';
    deviceType = 'Smart TV / STB';
  } else if (lower.includes('vlc') || lower.includes('libvlc')) {
    clientName = 'VLC Media Player';
    deviceType = 'IPTV App';
  } else if (lower.includes('kodi') || lower.includes('xbmc')) {
    clientName = 'Kodi Media Center';
    deviceType = 'Smart TV / STB';
  } else if (lower.includes('smarters') || lower.includes('iptv smarters')) {
    clientName = 'IPTV Smarters Pro';
    deviceType = 'IPTV App';
  } else if (lower.includes('exoplayer')) {
    clientName = 'ExoPlayer (Android)';
    deviceType = 'Smart TV / STB';
  } else if (lower.includes('applecoremedia')) {
    clientName = 'Apple CoreMedia (iOS/tvOS)';
  } else if (lower.includes('curl')) {
    clientName = 'cURL / CLI';
    deviceType = 'Desktop';
  } else if (lower.includes('wget')) {
    clientName = 'Wget / CLI';
    deviceType = 'Desktop';
  } else if (lower.includes('edg/')) {
    clientName = 'Microsoft Edge';
  } else if (lower.includes('chrome/') || lower.includes('crios/')) {
    clientName = 'Google Chrome';
  } else if (lower.includes('firefox/') || lower.includes('fxios/')) {
    clientName = 'Mozilla Firefox';
  } else if (lower.includes('safari/') && !lower.includes('chrome/')) {
    clientName = 'Apple Safari';
  } else if (lower.includes('samsungbrowser')) {
    clientName = 'Samsung Internet';
  }

  // 2. Detect Operating System
  if (lower.includes('android')) {
    if (lower.includes('tv') || lower.includes('aftt') || lower.includes('aftm') || lower.includes('firetv') || lower.includes('googletv')) {
      os = 'Android TV / Fire OS';
      deviceType = 'Smart TV / STB';
    } else {
      os = 'Android';
      if (deviceType === 'Unknown') deviceType = 'Mobile';
    }
  } else if (lower.includes('iphone')) {
    os = 'Apple iOS (iPhone)';
    if (deviceType === 'Unknown') deviceType = 'Mobile';
  } else if (lower.includes('ipad')) {
    os = 'Apple iPadOS';
    if (deviceType === 'Unknown') deviceType = 'Tablet';
  } else if (lower.includes('appletv') || lower.includes('tvos')) {
    os = 'Apple tvOS';
    deviceType = 'Smart TV / STB';
  } else if (lower.includes('windows nt') || lower.includes('win64') || lower.includes('win32')) {
    os = 'Microsoft Windows';
    if (deviceType === 'Unknown') deviceType = 'Desktop';
  } else if (lower.includes('macintosh') || lower.includes('mac os x')) {
    os = 'macOS';
    if (deviceType === 'Unknown') deviceType = 'Desktop';
  } else if (lower.includes('tizen')) {
    os = 'Tizen (Samsung Smart TV)';
    deviceType = 'Smart TV / STB';
  } else if (lower.includes('webos') || lower.includes('netcast')) {
    os = 'webOS (LG Smart TV)';
    deviceType = 'Smart TV / STB';
  } else if (lower.includes('roku')) {
    os = 'Roku OS';
    deviceType = 'Smart TV / STB';
  } else if (lower.includes('linux')) {
    os = 'GNU/Linux';
    if (deviceType === 'Unknown') deviceType = 'Desktop';
  }

  // 3. Fallback device classification
  if (deviceType === 'Unknown') {
    if (lower.includes('mobile') || lower.includes('phone')) {
      deviceType = 'Mobile';
    } else if (lower.includes('tablet')) {
      deviceType = 'Tablet';
    } else if (lower.includes('smarttv') || lower.includes('smart-tv') || lower.includes('tv')) {
      deviceType = 'Smart TV / STB';
    } else {
      deviceType = 'Desktop';
    }
  }

  return { deviceType, clientName, os };
}

/**
 * Creates a unique random slug if user didn't specify one
 */
function generateRandomSlug(length = 6): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let slug = '';
  for (let i = 0; i < length; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

/**
 * Count stream channels inside M3U playlist text
 */
function countM3uChannels(content: string): number {
  if (!content) return 0;
  const matches = content.match(/#EXTINF:/gi);
  return matches ? matches.length : 1;
}

// ------------------- API HANDLERS -------------------

/**
 * POST /api/track-url/create
 * Body: {
 *   name?: string,
 *   m3uContent: string,
 *   customSlug?: string,
 *   validityType: 'permanent' | 'timed',
 *   durationHours?: number
 * }
 */
export async function handleCreateTrackUrl(req: Request, res: Response) {
  try {
    const {
      name,
      m3uContent,
      customSlug,
      validityType = 'permanent',
      durationHours,
    } = req.body;

    if (!m3uContent || typeof m3uContent !== 'string' || !m3uContent.trim()) {
      return res.status(400).json({
        success: false,
        message: 'M3U playlist content is required.',
      });
    }

    // Determine clean slug
    let slug = '';
    if (customSlug && typeof customSlug === 'string' && customSlug.trim()) {
      slug = customSlug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      if (!slug || slug.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Custom name must be at least 2 alphanumeric characters.',
        });
      }

      // Check if already taken
      const existing = trackStore.getBySlug(slug);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `The custom name '${slug}' is already in use. Please choose a different name.`,
        });
      }
    } else {
      // Auto-generate unique slug
      let attempts = 0;
      do {
        slug = generateRandomSlug(6);
        attempts++;
      } while (trackStore.getBySlug(slug) && attempts < 10);
    }

    const now = Date.now();
    let expiresAt: number | null = null;
    let finalDurationHours: number | null = null;

    if (validityType === 'timed') {
      const hours = Number(durationHours) || 24;
      finalDurationHours = hours;
      expiresAt = now + hours * 60 * 60 * 1000;
    }

    const channelCount = countM3uChannels(m3uContent);
    const id = `trk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const playlistName =
      (name && typeof name === 'string' && name.trim()) ||
      `Playlist ${slug}`;

    const newRecord: TrackedUrlRecord = {
      id,
      slug,
      name: playlistName,
      m3uContent,
      channelCount,
      validityType,
      durationHours: finalDurationHours,
      expiresAt,
      createdAt: now,
      isDeleted: false,
      totalClicks: 0,
      clicks: [],
    };

    trackStore.set(newRecord);

    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    const baseUrl = `${protocol}://${host}`;
    const shortUrl = `${baseUrl}/t/${slug}`;
    const m3uUrl = `${baseUrl}/t/${slug}.m3u`;

    return res.status(201).json({
      success: true,
      message: 'Track URL generated successfully',
      data: {
        id: newRecord.id,
        slug: newRecord.slug,
        name: newRecord.name,
        channelCount: newRecord.channelCount,
        validityType: newRecord.validityType,
        expiresAt: newRecord.expiresAt,
        createdAt: newRecord.createdAt,
        totalClicks: newRecord.totalClicks,
        shortUrl,
        m3uUrl,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Failed to create track URL: ${err.message}`,
    });
  }
}

/**
 * GET /api/track-url/list
 * Returns all active tracked URLs with click totals and summary stats
 */
export async function handleListTrackUrls(req: Request, res: Response) {
  try {
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    const baseUrl = `${protocol}://${host}`;

    const records = trackStore.getAll();
    const now = Date.now();

    const list = records.map((r) => {
      const isExpired = r.validityType === 'timed' && r.expiresAt !== null && r.expiresAt < now;
      
      // Calculate device summary counts
      const deviceCounts: Record<string, number> = {};
      r.clicks.forEach((c) => {
        deviceCounts[c.deviceType] = (deviceCounts[c.deviceType] || 0) + 1;
      });

      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        channelCount: r.channelCount,
        validityType: r.validityType,
        durationHours: r.durationHours,
        expiresAt: r.expiresAt,
        isExpired,
        createdAt: r.createdAt,
        totalClicks: r.totalClicks,
        deviceCounts,
        shortUrl: `${baseUrl}/t/${r.slug}`,
        m3uUrl: `${baseUrl}/t/${r.slug}.m3u`,
      };
    });

    // Sort by creation date descending
    list.sort((a, b) => b.createdAt - a.createdAt);

    return res.json({
      success: true,
      data: list,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Failed to retrieve track URLs: ${err.message}`,
    });
  }
}

/**
 * GET /api/track-url/stats/:idOrSlug
 * Returns detailed analytics for a single tracked URL
 */
export async function handleGetTrackUrlStats(req: Request, res: Response) {
  try {
    const { idOrSlug } = req.params;
    if (!idOrSlug) {
      return res.status(400).json({ success: false, message: 'Slug or ID required.' });
    }

    const record =
      trackStore.getBySlug(idOrSlug) ||
      trackStore.getById(idOrSlug);

    if (!record || record.isDeleted) {
      return res.status(404).json({ success: false, message: 'Track URL not found or deleted.' });
    }

    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    const baseUrl = `${protocol}://${host}`;
    const now = Date.now();
    const isExpired = record.validityType === 'timed' && record.expiresAt !== null && record.expiresAt < now;

    // Aggregate Device Types
    const deviceBreakdown: Record<string, number> = {
      Mobile: 0,
      Desktop: 0,
      Tablet: 0,
      'Smart TV / STB': 0,
      'IPTV App': 0,
      Unknown: 0,
    };

    // Aggregate Client Players
    const clientBreakdown: Record<string, number> = {};

    // Aggregate OS
    const osBreakdown: Record<string, number> = {};

    // Unique IPs
    const uniqueIps = new Set<string>();

    record.clicks.forEach((c) => {
      deviceBreakdown[c.deviceType] = (deviceBreakdown[c.deviceType] || 0) + 1;
      clientBreakdown[c.clientName] = (clientBreakdown[c.clientName] || 0) + 1;
      osBreakdown[c.os] = (osBreakdown[c.os] || 0) + 1;
      if (c.ip) uniqueIps.add(c.ip);
    });

    // Recent 50 click events
    const recentClicks = [...record.clicks]
      .reverse()
      .slice(0, 50)
      .map((c) => ({
        id: c.id,
        timestamp: c.timestamp,
        deviceType: c.deviceType,
        clientName: c.clientName,
        os: c.os,
        maskedIp: c.ip ? c.ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.$2.***.***') : 'Unknown',
      }));

    return res.json({
      success: true,
      data: {
        id: record.id,
        slug: record.slug,
        name: record.name,
        channelCount: record.channelCount,
        validityType: record.validityType,
        durationHours: record.durationHours,
        expiresAt: record.expiresAt,
        isExpired,
        createdAt: record.createdAt,
        totalClicks: record.totalClicks,
        uniqueVisitors: uniqueIps.size,
        shortUrl: `${baseUrl}/t/${record.slug}`,
        m3uUrl: `${baseUrl}/t/${record.slug}.m3u`,
        deviceBreakdown,
        clientBreakdown,
        osBreakdown,
        recentClicks,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Failed to retrieve stats: ${err.message}`,
    });
  }
}

/**
 * DELETE /api/track-url/:idOrSlug
 * Deletes a tracked link (Link valid until user deletes it)
 */
export async function handleDeleteTrackUrl(req: Request, res: Response) {
  try {
    const { idOrSlug } = req.params;
    if (!idOrSlug) {
      return res.status(400).json({ success: false, message: 'Slug or ID required.' });
    }

    const clean = decodeURIComponent(idOrSlug).trim();
    const deleted = trackStore.delete(clean);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Track URL not found or already deleted.' });
    }

    return res.json({
      success: true,
      message: 'Track URL successfully deleted.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Failed to delete track URL: ${err.message}`,
    });
  }
}

/**
 * Public Access Route: GET /t/:slug or /t/:slug.m3u
 * - Tracks device, client player, IP, timestamp
 * - Returns clean M3U playlist file for IPTV apps or downloads
 */
export async function handlePublicTrackAccess(req: Request, res: Response) {
  try {
    let slug = req.params.slug || '';
    if (slug.endsWith('.m3u') || slug.endsWith('.m3u8')) {
      slug = slug.replace(/\.m3u8?$/i, '');
    }

    const record = trackStore.getBySlug(slug);

    if (!record || record.isDeleted) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Link Not Found - Track URL</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; max-width: 480px; text-align: center; }
            h1 { color: #f43f5e; margin-top: 0; font-size: 22px; }
            p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>404 — Track URL Not Found</h1>
            <p>This M3U short link does not exist or has been removed by the owner.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Check expiry
    const now = Date.now();
    if (record.validityType === 'timed' && record.expiresAt !== null && record.expiresAt < now) {
      return res.status(410).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Link Expired - Track URL</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; max-width: 480px; text-align: center; }
            h1 { color: #fbbf24; margin-top: 0; font-size: 22px; }
            p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>410 — Track URL Expired</h1>
            <p>This short link had a fixed validity duration which has now expired.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Capture User-Agent and IP
    const ua = req.get('user-agent') || '';
    const ip =
      (req.get('x-forwarded-for') || '').split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '';

    const { deviceType, clientName, os } = detectDeviceAndClient(ua);

    // Record click event
    const clickRecord: ClickRecord = {
      id: `clk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      ip,
      userAgent: ua,
      deviceType,
      clientName,
      os,
    };

    record.totalClicks += 1;
    record.clicks.push(clickRecord);
    trackStore.set(record);

    // Send M3U file
    const safeFilename = `${record.slug}.m3u`;
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res.send(record.m3uContent);
  } catch (err: any) {
    return res.status(500).send(`Server error: ${err.message}`);
  }
}

/**
 * POST /api/track-url/simulate-click
 * Allows user to test/simulate a click from different devices directly in UI
 */
export async function handleSimulateClick(req: Request, res: Response) {
  try {
    const { slug, simulatedDevice, simulatedClient } = req.body;
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Slug required.' });
    }

    const record = trackStore.getBySlug(slug);
    if (!record || record.isDeleted) {
      return res.status(404).json({ success: false, message: 'Track URL not found.' });
    }

    const now = Date.now();
    const devType = simulatedDevice || 'Smart TV / STB';
    const client = simulatedClient || 'TiviMate IPTV';
    const osMap: Record<string, string> = {
      'Mobile': 'Android Mobile',
      'Desktop': 'Windows 11',
      'Tablet': 'Apple iPadOS',
      'Smart TV / STB': 'Android TV (Google TV)',
      'IPTV App': 'VLC / Fire TV',
      'Unknown': 'Generic Media Box',
    };

    const clickRecord: ClickRecord = {
      id: `clk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      ip: `192.168.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
      userAgent: `Simulated-${client}`,
      deviceType: devType,
      clientName: client,
      os: osMap[devType] || 'Android TV',
    };

    record.totalClicks += 1;
    record.clicks.push(clickRecord);
    trackStore.set(record);

    return res.json({
      success: true,
      message: `Simulated click recorded for ${client} (${devType})`,
      data: {
        totalClicks: record.totalClicks,
        newClick: clickRecord,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
