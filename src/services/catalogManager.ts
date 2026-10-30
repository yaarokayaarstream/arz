import { Category, StreamChannel, StreamCredentials } from '../types';
import { WorkerParseRequest, WorkerParseResponse } from '../workers/m3uWorker';
import { fetchCategories, fetchStreams, fetchM3uContent } from './api';

const DB_NAME = 'StreamHubCatalogDB';
const DB_VERSION = 1;
const STORE_NAME = 'catalogs';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedCatalogRecord {
  key: string;
  channels: StreamChannel[];
  categories: Category[];
  timestamp: number;
}

export interface CatalogResult {
  channels: StreamChannel[];
  categories: Category[];
  isCached: boolean;
  parseTimeMs: number;
  timestamp: number;
}

function getCacheKey(creds: StreamCredentials): string {
  const url = (creds.serverUrl || '').trim().toLowerCase();
  const user = (creds.username || '').trim().toLowerCase();
  return `catalog_${user}@${url}`;
}

// Open IndexedDB instance safely
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves cached channels and categories from IndexedDB (instant load)
 */
export async function getCachedCatalog(
  creds: StreamCredentials
): Promise<{ channels: StreamChannel[]; categories: Category[]; timestamp: number } | null> {
  try {
    const db = await openDB();
    const key = getCacheKey(creds);

    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const record = request.result as CachedCatalogRecord | undefined;
        if (record && Date.now() - record.timestamp < CACHE_TTL_MS) {
          resolve({
            channels: record.channels,
            categories: record.categories,
            timestamp: record.timestamp,
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    // Fallback to localStorage if IndexedDB fails
    try {
      const raw = localStorage.getItem(getCacheKey(creds));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }
}

/**
 * Saves parsed channels and categories to IndexedDB cache
 */
export async function setCachedCatalog(
  creds: StreamCredentials,
  channels: StreamChannel[],
  categories: Category[]
): Promise<void> {
  try {
    const db = await openDB();
    const key = getCacheKey(creds);
    const record: CachedCatalogRecord = {
      key,
      channels,
      categories,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Fallback to localStorage
    try {
      localStorage.setItem(
        getCacheKey(creds),
        JSON.stringify({ channels, categories, timestamp: Date.now() })
      );
    } catch {
      // ignore
    }
  }
}

/**
 * Clears cached catalog for credentials
 */
export async function clearCachedCatalog(creds: StreamCredentials): Promise<void> {
  try {
    const db = await openDB();
    const key = getCacheKey(creds);
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(key);
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(getCacheKey(creds));
  } catch {
    // ignore
  }
}

/**
 * Offloads M3U playlist text parsing to background Web Worker
 */
export function parseM3uWithWorker(
  rawContent: string,
  creds: StreamCredentials
): Promise<{ channels: StreamChannel[]; categories: Category[]; parseTimeMs: number }> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL('../workers/m3uWorker.ts', import.meta.url), {
        type: 'module',
      });

      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Web Worker M3U parsing timed out'));
      }, 30000);

      worker.onmessage = (event: MessageEvent<WorkerParseResponse>) => {
        clearTimeout(timeout);
        worker.terminate();

        const data = event.data;
        if (data.type === 'PARSE_SUCCESS') {
          resolve({
            channels: data.channels,
            categories: data.categories,
            parseTimeMs: data.stats?.parseTimeMs || 0,
          });
        } else {
          reject(new Error(data.error || 'M3U parsing failed in worker'));
        }
      };

      worker.onerror = (err) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(err);
      };

      const request: WorkerParseRequest = {
        type: 'PARSE_M3U',
        payload: {
          rawContent,
          serverUrl: creds.serverUrl,
          username: creds.username,
          password: creds.password,
        },
      };

      worker.postMessage(request);
    } catch {
      // Synchronous fallback
      console.warn('Worker instantiation failed, parsing M3U on main thread');
      const lines = rawContent.split(/\r?\n/);
      const channels: StreamChannel[] = [];
      const categoryMap = new Map<string, string>();
      let currentInfo: any = null;
      let channelNum = 1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#EXTINF:')) {
          const tvgIdMatch = line.match(/tvg-id="([^"]*)"/i);
          const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
          const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
          const groupMatch = line.match(/group-title="([^"]*)"/i);
          const commaIndex = line.lastIndexOf(',');
          let displayName = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : '';
          if (!displayName && tvgNameMatch) displayName = tvgNameMatch[1];
          const group = groupMatch ? groupMatch[1].trim() : 'General';
          const catId = group.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'general';

          if (!categoryMap.has(catId)) categoryMap.set(catId, group);

          currentInfo = {
            name: displayName || `Channel ${channelNum}`,
            tvgId: tvgIdMatch ? tvgIdMatch[1] : `ch_${channelNum}`,
            logo: logoMatch ? logoMatch[1] : '',
            group,
            catId,
          };
        } else if (!line.startsWith('#') && currentInfo) {
          channels.push({
            num: channelNum++,
            name: currentInfo.name,
            stream_type: 'live',
            stream_id: currentInfo.tvgId || channelNum,
            stream_icon: currentInfo.logo,
            category_id: currentInfo.catId,
            category_name: currentInfo.group,
            direct_source: line,
            epg_channel_id: currentInfo.tvgId,
            added: String(Math.floor(Date.now() / 1000)),
          });
          currentInfo = null;
        }
      }

      const categories: Category[] = Array.from(categoryMap.entries()).map(([id, name]) => ({
        category_id: id,
        category_name: name,
      }));

      resolve({ channels, categories, parseTimeMs: 0 });
    }
  });
}

/**
 * Offloads heavy channel/playlist parsing to the background Web Worker
 */
export function parseChannelsWithWorker(
  rawStreams: any[],
  creds: StreamCredentials
): Promise<{ channels: StreamChannel[]; categories: Category[]; parseTimeMs: number }> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL('../workers/m3uWorker.ts', import.meta.url), {
        type: 'module',
      });

      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Web Worker parsing timed out'));
      }, 30000);

      worker.onmessage = (event: MessageEvent<WorkerParseResponse>) => {
        clearTimeout(timeout);
        worker.terminate();

        const data = event.data;
        if (data.type === 'PARSE_SUCCESS') {
          resolve({
            channels: data.channels,
            categories: data.categories,
            parseTimeMs: data.stats?.parseTimeMs || 0,
          });
        } else {
          reject(new Error(data.error || 'Parsing failed in worker'));
        }
      };

      worker.onerror = (err) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(err);
      };

      const request: WorkerParseRequest = {
        type: 'PARSE_XTREAM_STREAMS',
        payload: {
          rawStreams,
          serverUrl: creds.serverUrl,
          username: creds.username,
          password: creds.password,
        },
      };

      worker.postMessage(request);
    } catch (err) {
      // Direct thread fallback if Web Worker cannot be instantiated in environment
      console.warn('Worker instantiation failed, parsing on main thread:', err);
      const cleanUrl = (creds.serverUrl || '').replace(/\/+$/, '');
      const categoryMap = new Map<string, string>();
      const channels: StreamChannel[] = rawStreams.map((item, idx) => {
        const streamId = item.stream_id || idx + 1;
        const catId = item.category_id ? String(item.category_id) : '1';
        const catName = item.category_name || `Category ${catId}`;
        categoryMap.set(catId, catName);

        let streamUrl = item.direct_source;
        if (!streamUrl && cleanUrl && creds.username && creds.password) {
          streamUrl = `${cleanUrl}/live/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${streamId}.m3u8`;
        }

        return {
          num: idx + 1,
          name: item.name || `Channel ${streamId}`,
          stream_type: item.stream_type || 'live',
          stream_id: streamId,
          stream_icon: item.stream_icon || '',
          category_id: catId,
          category_name: catName,
          direct_source: streamUrl,
          epg_channel_id: item.epg_channel_id || '',
          added: item.added || '',
        };
      });

      const categories: Category[] = Array.from(categoryMap.entries()).map(([id, name]) => ({
        category_id: id,
        category_name: name,
      }));

      resolve({ channels, categories, parseTimeMs: 0 });
    }
  });
}

/**
 * Loads catalog on demand when 'View Channels' is clicked.
 * 1. Checks local cache first for instant 0ms load.
 * 2. If not cached (or forced refresh), fetches data and offloads M3U / stream parsing to Web Worker.
 * 3. Saves parsed catalog to IndexedDB cache for future instant loads.
 */
export async function loadOrFetchCatalog(
  creds: StreamCredentials,
  forceRefresh = false
): Promise<CatalogResult> {
  // 1. Check local cache first if not force-refreshing
  if (!forceRefresh) {
    const cached = await getCachedCatalog(creds);
    if (cached && cached.channels.length > 0) {
      return {
        channels: cached.channels,
        categories: cached.categories,
        isCached: true,
        parseTimeMs: 0,
        timestamp: cached.timestamp,
      };
    }
  }

  // 2. If credentials are MAC Portal based, authenticate directly via MAC portal endpoint
  if (creds.username?.startsWith('MAC:')) {
    const cleanMac = creds.username.replace(/^MAC:\s*/i, '').trim();
    try {
      const res = await fetch('/api/mac-portal/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          macAddress: cleanMac,
          portalUrl: creds.serverUrl,
          allowDemoFallback: creds.isDemo,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.channels) && data.channels.length > 0) {
        await setCachedCatalog(creds, data.channels, data.categories || []);
        return {
          channels: data.channels,
          categories: data.categories || [],
          isCached: false,
          parseTimeMs: 0,
          timestamp: Date.now(),
        };
      }
    } catch (macErr) {
      console.warn('MAC portal catalog fetch error:', macErr);
    }
  }

  // 3. Otherwise fetch Xtream categories and streams or M3U content
  const [categoriesList, m3uResult] = await Promise.all([
    fetchCategories(creds).catch(() => [] as Category[]),
    fetchM3uContent(creds).catch((): { success: boolean; m3uContent?: string } => ({ success: false })),
  ]);

  let parsed: { channels: StreamChannel[]; categories: Category[]; parseTimeMs: number };

  if (m3uResult.success && m3uResult.m3uContent) {
    // Heavy M3U parsing offloaded to background Web Worker!
    parsed = await parseM3uWithWorker(m3uResult.m3uContent, creds);
  } else {
    // Fetch raw streams and offload to Web Worker
    const rawStreams = await fetchStreams(creds, 'all');
    parsed = await parseChannelsWithWorker(rawStreams, creds);
  }

  // Merge server category names if present
  let finalCategories = parsed.categories;
  if (categoriesList && categoriesList.length > 0) {
    const serverCatMap = new Map<string, string>();
    categoriesList.forEach((c) => serverCatMap.set(String(c.category_id), c.category_name));

    // Update channels with clean category names
    parsed.channels.forEach((ch) => {
      const serverName = serverCatMap.get(String(ch.category_id));
      if (serverName) {
        ch.category_name = serverName;
      }
    });

    finalCategories = categoriesList;
  }

  // 3. Cache locally in IndexedDB for instant future loads
  await setCachedCatalog(creds, parsed.channels, finalCategories);

  return {
    channels: parsed.channels,
    categories: finalCategories,
    isCached: false,
    parseTimeMs: parsed.parseTimeMs,
    timestamp: Date.now(),
  };
}
