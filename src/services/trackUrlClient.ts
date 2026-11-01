import { apiUrl } from './apiConfig';

export interface TrackUrlSummary {
  id: string;
  slug: string;
  name: string;
  channelCount: number;
  validityType: 'permanent' | 'timed';
  durationHours: number | null;
  expiresAt: number | null;
  isExpired: boolean;
  createdAt: number;
  totalClicks: number;
  deviceCounts: Record<string, number>;
  shortUrl: string;
  m3uUrl: string;
}

export interface TrackUrlDetailedStats {
  id: string;
  slug: string;
  name: string;
  channelCount: number;
  validityType: 'permanent' | 'timed';
  durationHours: number | null;
  expiresAt: number | null;
  isExpired: boolean;
  createdAt: number;
  totalClicks: number;
  uniqueVisitors: number;
  shortUrl: string;
  m3uUrl: string;
  deviceBreakdown: Record<string, number>;
  clientBreakdown: Record<string, number>;
  osBreakdown: Record<string, number>;
  recentClicks: Array<{
    id: string;
    timestamp: number;
    deviceType: string;
    clientName: string;
    os: string;
    maskedIp: string;
  }>;
}

export interface CreateTrackUrlPayload {
  name?: string;
  m3uContent: string;
  customSlug?: string;
  validityType: 'permanent' | 'timed';
  durationHours?: number;
}

/**
 * Creates a new Track URL with M3U payload, validity, and optional custom slug
 */
export async function createTrackUrl(payload: CreateTrackUrlPayload): Promise<{
  id: string;
  slug: string;
  name: string;
  channelCount: number;
  validityType: 'permanent' | 'timed';
  expiresAt: number | null;
  createdAt: number;
  totalClicks: number;
  shortUrl: string;
  m3uUrl: string;
}> {
  const res = await fetch(apiUrl('/api/track-url/create'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to create Track URL');
  }

  return data.data;
}

/**
 * Fetches all created Track URLs
 */
export async function fetchAllTrackUrls(): Promise<TrackUrlSummary[]> {
  const res = await fetch(apiUrl('/api/track-url/list'));
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to list Track URLs');
  }
  return data.data || [];
}

/**
 * Fetches detailed analytics for a single Track URL
 */
export async function fetchTrackUrlStats(idOrSlug: string): Promise<TrackUrlDetailedStats> {
  const res = await fetch(apiUrl(`/api/track-url/stats/${encodeURIComponent(idOrSlug)}`));
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch Track URL stats');
  }
  return data.data;
}

/**
 * Deletes a Track URL
 */
export async function deleteTrackUrl(idOrSlug: string): Promise<boolean> {
  const res = await fetch(apiUrl(`/api/track-url/${encodeURIComponent(idOrSlug)}`), {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to delete Track URL');
  }
  return true;
}

/**
 * Simulates a device click for analytics testing
 */
export async function simulateTrackClick(idOrSlug: string, deviceType: string, clientName: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl(`/api/track-url/simulate/${encodeURIComponent(idOrSlug)}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceType, clientName }),
    });
    const data = await res.json();
    return Boolean(data?.success);
  } catch {
    return false;
  }
}

/**
 * Shortens any long URL using the is.gd API:
 * https://is.gd/create.php?format=simple&url=[YOUR_LONG_URL]
 * Supports direct client fetch with proxy fallback to guarantee zero-CORS failure.
 */
export async function shortenWithIsGd(longUrl: string): Promise<string> {
  const clean = longUrl.trim();
  if (!clean) throw new Error('Please enter a valid URL.');

  // 1. Direct call as requested by user
  try {
    const directEndpoint = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(clean)}`;
    const directRes = await fetch(directEndpoint);
    if (directRes.ok) {
      const text = (await directRes.text()).trim();
      if (text.startsWith('https://is.gd/')) {
        return text;
      }
    }
  } catch (directErr) {
    console.warn('Direct is.gd browser request encountered CORS/network policy, using proxy fallback...', directErr);
  }

  // 2. Server-side proxy fallback
  const proxyRes = await fetch(apiUrl(`/api/shorten/isgd?url=${encodeURIComponent(clean)}`));
  const data = await proxyRes.json();
  if (data && data.success && data.shortUrl) {
    return data.shortUrl;
  }
  throw new Error(data?.message || 'Could not shorten URL with is.gd. Please ensure the URL is valid.');
}

