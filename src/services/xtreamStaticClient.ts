import { StreamCredentials, StreamChannel, Category } from '../types';

/**
 * High-performance CORS proxy list for static hosting (GitHub Pages, Vercel, Netlify)
 * Bridges HTTPS client browsers to HTTP/HTTPS IPTV servers without CORS or Mixed Content errors.
 */
const CORS_PROXIES: ((url: string) => string)[] = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
  (url) => `https://api.cors.lol/?url=${encodeURIComponent(url)}`,
];

/**
 * Cleans and normalizes Xtream server URLs
 */
export function normalizeServerUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'http://' + url;
  }
  return url
    .replace(/\/+(player_api|get|panel_api|live|xmltv|portal)\.php.*$/i, '')
    .replace(/\/+(live|movie|series)\/.*$/i, '')
    .replace(/\/+[^/]+\.(m3u8?|ts|mp4|json)$/i, '')
    .replace(/\/+c\/?$/i, '')
    .replace(/\/+$/, '');
}

export interface CorsFetchResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Tries fetching a URL using direct connection (if safe) or via the CORS proxy cascade.
 * Timeout is 35 seconds to allow full multimegabyte IPTV catalogs to download completely.
 */
export async function fetchWithCorsFallback(
  targetUrl: string,
  responseType: 'text' | 'json' = 'text',
  timeoutMs = 35000
): Promise<CorsFetchResult> {
  const isTargetHttps = targetUrl.startsWith('https://');
  const isPageHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // Build candidate URL list:
  // Direct fetch can only work if not violating browser Mixed Content policy (HTTPS -> HTTP)
  const candidateUrls: string[] = [];

  // If both page and target are HTTPS, or both are HTTP, direct fetch is allowed by browser
  if (!isPageHttps || isTargetHttps) {
    candidateUrls.push(targetUrl);
  }

  // Add CORS proxies to bridge across origins and protocol boundaries
  for (const proxyFn of CORS_PROXIES) {
    candidateUrls.push(proxyFn(targetUrl));
  }

  // Iterate over candidates with timeout
  for (const candidate of candidateUrls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(candidate, {
        signal: controller.signal,
        headers: {
          Accept: responseType === 'json' ? 'application/json, text/plain, */*' : '*/*',
        },
      });

      clearTimeout(timer);

      if (res.ok) {
        if (responseType === 'json') {
          const data = await res.json();
          if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
            return { success: true, data };
          }
        } else {
          const text = await res.text();
          if (text && (text.includes('#EXTINF') || text.includes('#EXTM3U'))) {
            return { success: true, data: text };
          }
        }
      }
    } catch {
      clearTimeout(timer);
      // Try next proxy candidate
    }
  }

  return { success: false, error: 'All proxies and direct connection attempts failed.' };
}

/**
 * Fetches the entire M3U playlist file directly via get.php
 * Tries multiple formats (ts, m3u8, default) to ensure complete channel retrieval.
 */
export async function fetchFullM3uFromXtream(creds: StreamCredentials): Promise<string | null> {
  const cleanUrl = normalizeServerUrl(creds.serverUrl);
  if (!cleanUrl || !creds.username || !creds.password) return null;

  const user = encodeURIComponent(creds.username);
  const pass = encodeURIComponent(creds.password);

  const getUrlVariants = [
    `${cleanUrl}/get.php?username=${user}&password=${pass}&type=m3u_plus&output=ts`,
    `${cleanUrl}/get.php?username=${user}&password=${pass}&type=m3u_plus&output=m3u8`,
    `${cleanUrl}/get.php?username=${user}&password=${pass}&type=m3u_plus`,
    `${cleanUrl}/get.php?username=${user}&password=${pass}&type=m3u`,
  ];

  for (const targetUrl of getUrlVariants) {
    const res = await fetchWithCorsFallback(targetUrl, 'text', 35000);
    if (res.success && typeof res.data === 'string' && res.data.length > 50) {
      return res.data;
    }
  }

  return null;
}

/**
 * Comprehensive client-side Xtream catalog fetcher using player_api.php.
 * Fetches ALL live streams, VOD movies, and Series streams across all categories.
 * If global live_streams is limited or paginated by the server, it iterates across categories.
 */
export async function fetchFullCatalogViaPlayerApi(
  creds: StreamCredentials
): Promise<{ streams: any[]; categories: Category[] } | null> {
  const cleanUrl = normalizeServerUrl(creds.serverUrl);
  if (!cleanUrl || !creds.username || !creds.password) return null;

  const user = encodeURIComponent(creds.username);
  const pass = encodeURIComponent(creds.password);

  // 1. Fetch live categories & VOD categories in parallel
  const liveCatUrl = `${cleanUrl}/player_api.php?username=${user}&password=${pass}&action=get_live_categories`;
  const vodCatUrl = `${cleanUrl}/player_api.php?username=${user}&password=${pass}&action=get_vod_categories`;

  const [liveCatRes, vodCatRes] = await Promise.all([
    fetchWithCorsFallback(liveCatUrl, 'json', 15000).catch((): CorsFetchResult => ({ success: false })),
    fetchWithCorsFallback(vodCatUrl, 'json', 15000).catch((): CorsFetchResult => ({ success: false })),
  ]);

  const categoryMap = new Map<string, string>();
  const categoriesList: Category[] = [];

  const rawLiveCats = liveCatRes.success && Array.isArray(liveCatRes.data) ? liveCatRes.data : [];
  const rawVodCats = vodCatRes.success && Array.isArray(vodCatRes.data) ? vodCatRes.data : [];

  [...rawLiveCats, ...rawVodCats].forEach((c: any) => {
    if (c && c.category_id) {
      const id = String(c.category_id);
      const name = c.category_name || `Category ${id}`;
      if (!categoryMap.has(id)) {
        categoryMap.set(id, name);
        categoriesList.push({ category_id: id, category_name: name });
      }
    }
  });

  // 2. Fetch main live streams, VOD movies, and series
  const liveStreamsUrl = `${cleanUrl}/player_api.php?username=${user}&password=${pass}&action=get_live_streams`;
  const vodStreamsUrl = `${cleanUrl}/player_api.php?username=${user}&password=${pass}&action=get_vod_streams`;
  const seriesUrl = `${cleanUrl}/player_api.php?username=${user}&password=${pass}&action=get_series`;

  const [liveRes, vodRes, seriesRes] = await Promise.all([
    fetchWithCorsFallback(liveStreamsUrl, 'json', 30000).catch((): CorsFetchResult => ({ success: false })),
    fetchWithCorsFallback(vodStreamsUrl, 'json', 30000).catch((): CorsFetchResult => ({ success: false })),
    fetchWithCorsFallback(seriesUrl, 'json', 30000).catch((): CorsFetchResult => ({ success: false })),
  ]);

  let allRawStreams: any[] = [];

  if (liveRes.success && Array.isArray(liveRes.data)) {
    allRawStreams.push(
      ...liveRes.data.map((item: any) => ({
        ...item,
        stream_type: item.stream_type || 'live',
      }))
    );
  }

  if (vodRes.success && Array.isArray(vodRes.data)) {
    allRawStreams.push(
      ...vodRes.data.map((item: any) => ({
        ...item,
        stream_type: item.stream_type || 'movie',
      }))
    );
  }

  if (seriesRes.success && Array.isArray(seriesRes.data)) {
    allRawStreams.push(
      ...seriesRes.data.map((item: any) => ({
        ...item,
        stream_type: item.stream_type || 'series',
        name: item.name || item.title || `Series ${item.series_id}`,
        stream_id: item.series_id || item.stream_id,
      }))
    );
  }

  // 3. Category Pagination Fallback:
  // If global live_streams returned fewer than 20 streams, but the server reported multiple categories (> 3),
  // some Xtream servers restrict global fetching and require category_id parameter.
  // In this case, fetch per-category in small batches to get 100% of the channels.
  if (allRawStreams.length < 20 && rawLiveCats.length > 2) {
    const batchSize = 4;
    for (let i = 0; i < rawLiveCats.length; i += batchSize) {
      const batch = rawLiveCats.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((cat: any) => {
          const catUrl = `${cleanUrl}/player_api.php?username=${user}&password=${pass}&action=get_live_streams&category_id=${encodeURIComponent(cat.category_id)}`;
          return fetchWithCorsFallback(catUrl, 'json', 15000).catch((): CorsFetchResult => ({ success: false }));
        })
      );

      for (const res of batchResults) {
        if (res.success && Array.isArray(res.data)) {
          allRawStreams.push(...res.data);
        }
      }
    }

    // Deduplicate streams by stream_id
    const seenIds = new Set<string>();
    const uniqueStreams: any[] = [];
    for (const item of allRawStreams) {
      const idKey = `${item.stream_type || 'live'}_${item.stream_id || item.name}`;
      if (!seenIds.has(idKey)) {
        seenIds.add(idKey);
        uniqueStreams.push(item);
      }
    }
    allRawStreams = uniqueStreams;
  }

  if (allRawStreams.length > 0) {
    return {
      streams: allRawStreams,
      categories: categoriesList,
    };
  }

  return null;
}
