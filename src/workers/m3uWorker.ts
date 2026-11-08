/**
 * Web Worker for offloading heavy M3U playlist and channel parsing
 * Runs in a separate background thread to keep the main UI 60fps smooth.
 */

export interface WorkerParseRequest {
  type: 'PARSE_M3U' | 'PARSE_XTREAM_STREAMS';
  payload: {
    rawContent?: string;
    rawStreams?: any[];
    serverUrl?: string;
    username?: string;
    password?: string;
  };
}

export interface WorkerParseResponse {
  type: 'PARSE_SUCCESS' | 'PARSE_ERROR';
  channels: any[];
  categories: any[];
  error?: string;
  stats?: {
    totalChannels: number;
    totalCategories: number;
    parseTimeMs: number;
  };
}

self.onmessage = (event: MessageEvent<WorkerParseRequest>) => {
  const startTime = performance.now();
  const { type, payload } = event.data;

  try {
    if (type === 'PARSE_M3U') {
      const rawText = payload.rawContent || '';
      const lines = rawText.split(/\r?\n/);

      const channels: any[] = [];
      const categorySet = new Map<string, string>();

      let currentExtInf: {
        name: string;
        tvgId: string;
        logo: string;
        group: string;
      } | null = null;

      let channelNum = 1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#EXTINF:')) {
          // Parse #EXTINF attributes
          // Format: #EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="...",Channel Name
          const tvgIdMatch = line.match(/tvg-id="([^"]*)"/i);
          const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
          const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
          const groupMatch = line.match(/group-title="([^"]*)"/i);

          const commaIndex = line.lastIndexOf(',');
          let displayName = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : '';

          if (!displayName && tvgNameMatch) {
            displayName = tvgNameMatch[1];
          }

          const group = groupMatch ? groupMatch[1].trim() : 'General';
          const catId = group.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'general';

          if (!categorySet.has(catId)) {
            categorySet.set(catId, group);
          }

          currentExtInf = {
            name: displayName || `Channel ${channelNum}`,
            tvgId: tvgIdMatch ? tvgIdMatch[1] : `ch_${channelNum}`,
            logo: logoMatch ? logoMatch[1] : '',
            group,
          };
        } else if (!line.startsWith('#') && currentExtInf) {
          // Stream URL line
          const streamUrl = line;
          const catId = currentExtInf.group.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'general';

          channels.push({
            num: channelNum++,
            name: currentExtInf.name,
            stream_type: 'live',
            stream_id: currentExtInf.tvgId || channelNum,
            stream_icon: currentExtInf.logo,
            category_id: catId,
            category_name: currentExtInf.group,
            direct_source: streamUrl,
            epg_channel_id: currentExtInf.tvgId,
            added: String(Math.floor(Date.now() / 1000)),
          });

          currentExtInf = null;
        }
      }

      const categories = Array.from(categorySet.entries()).map(([id, name]) => ({
        category_id: id,
        category_name: name,
      }));

      const parseTimeMs = Math.round(performance.now() - startTime);

      self.postMessage({
        type: 'PARSE_SUCCESS',
        channels,
        categories,
        stats: {
          totalChannels: channels.length,
          totalCategories: categories.length,
          parseTimeMs,
        },
      });
    } else if (type === 'PARSE_XTREAM_STREAMS') {
      const rawList = payload.rawStreams || [];
      const cleanUrl = (payload.serverUrl || '')
        .trim()
        .replace(/\/+(player_api|get|panel_api|live|xmltv)\.php.*$/i, '')
        .replace(/\/+c\/?$/i, '')
        .replace(/\/+$/, '');
      const user = payload.username || '';
      const pass = payload.password || '';

      const categorySet = new Map<string, string>();
      const channels: any[] = [];

      for (let i = 0; i < rawList.length; i++) {
        const item = rawList[i];
        const streamId = item.stream_id || i + 1;
        const catId = item.category_id ? String(item.category_id) : '1';
        const catName = item.category_name || `Category ${catId}`;

        if (!categorySet.has(catId)) {
          categorySet.set(catId, catName);
        }

        let streamUrl = item.direct_source;
        if (!streamUrl && cleanUrl && user && pass) {
          const ext = (item.container_extension || 'm3u8').toLowerCase();
          streamUrl = `${cleanUrl}/live/${encodeURIComponent(user)}/${encodeURIComponent(pass)}/${streamId}.${ext === 'ts' ? 'ts' : 'm3u8'}`;
        }

        channels.push({
          num: i + 1,
          name: item.name || `Channel ${streamId}`,
          stream_type: item.stream_type || 'live',
          stream_id: streamId,
          stream_icon: item.stream_icon || '',
          category_id: catId,
          category_name: catName,
          direct_source: streamUrl,
          epg_channel_id: item.epg_channel_id || '',
          added: item.added || '',
        });
      }

      const categories = Array.from(categorySet.entries()).map(([id, name]) => ({
        category_id: id,
        category_name: name,
      }));

      const parseTimeMs = Math.round(performance.now() - startTime);

      self.postMessage({
        type: 'PARSE_SUCCESS',
        channels,
        categories,
        stats: {
          totalChannels: channels.length,
          totalCategories: categories.length,
          parseTimeMs,
        },
      });
    }
  } catch (err: any) {
    self.postMessage({
      type: 'PARSE_ERROR',
      channels: [],
      categories: [],
      error: err.message || 'Worker failed to parse streams',
    });
  }
};
