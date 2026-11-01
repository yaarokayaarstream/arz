import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleFfmpegStream, handleFfmpegStatus } from './src/server/ffmpegStreamer';
import { authenticateAndFetchMacPortal } from './src/server/macPortalService';
import { handleObfuscateM3u, handleStreamAlias, handleStreamSubResource } from './src/server/linkMasterService';
import {
  handleCreateTrackUrl,
  handleListTrackUrls,
  handleGetTrackUrlStats,
  handleDeleteTrackUrl,
  handlePublicTrackAccess,
  handleSimulateClick,
} from './src/server/trackUrlService';
import {
  handleVerifyLive,
  handleParseM3uOnly,
  handleDownloadVerifiedPlaylist,
} from './src/server/playlistVerifierService';
import { handleSendFeedbackEmail } from './src/server/feedbackEmailService';
import { handleMegaUploadAndNotify, handleDownloadStoredMegaFile } from './src/server/megaService';
import {
  handleMaskSingleUrl,
  handleMaskPlaylist,
  handleDownloadShieldedM3u,
  handleCloakingProxy,
  handleResolveMaskedSlug,
  handleGetMaskedRecord,
} from './src/server/urlShieldService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// CORS middleware allowing requests from GitHub Pages and other origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Built-in verified high-definition public demo channels
export const DEMO_CATEGORIES = [
  { category_id: "1", category_name: "National & News" },
  { category_id: "2", category_name: "World News" },
  { category_id: "3", category_name: "Sports & Live Events" },
  { category_id: "4", category_name: "Movies & Cinema" },
  { category_id: "5", category_name: "Science & Nature" },
  { category_id: "6", category_name: "Music & Entertainment" }
];

export const DEMO_STREAMS = [
  {
    num: 1,
    name: "9X Jalwa Live Music HD",
    stream_type: "live",
    stream_id: 101,
    stream_icon: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_9X_JALWA/images/LOGO_HD/image.png",
    category_id: "6",
    direct_source: "https://wiselp.wiseplayout.com/9X_Jalwa/master.m3u8",
    epg_channel_id: "9x.jalwa.in",
    added: "1700000000",
    custom_sid: null
  },
  {
    num: 2,
    name: "3AW News TV Live HD",
    stream_type: "live",
    stream_id: 102,
    stream_icon: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=160&auto=format&fit=crop&q=80",
    category_id: "1",
    direct_source: "https://3awlive.akamaized.net/hls/live/2032295/3AW/index.m3u8",
    epg_channel_id: "3aw.news.tv",
    added: "1700000001",
    custom_sid: null
  },
  {
    num: 3,
    name: "Akamai 24/7 Global Live Channel",
    stream_type: "live",
    stream_id: 103,
    stream_icon: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=160&auto=format&fit=crop&q=80",
    category_id: "2",
    direct_source: "https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8",
    epg_channel_id: "akamai.global.live",
    added: "1700000002",
    custom_sid: null
  },
  {
    num: 4,
    name: "4 SiDES TV Live",
    stream_type: "live",
    stream_id: 104,
    stream_icon: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=160&auto=format&fit=crop&q=80",
    category_id: "1",
    direct_source: "https://stream.ottlive.co.in/4sidestv/index.m3u8",
    epg_channel_id: "4sides.news.tv",
    added: "1700000003",
    custom_sid: null
  },
  {
    num: 5,
    name: "Action Sports Live HD",
    stream_type: "live",
    stream_id: 301,
    stream_icon: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=160&auto=format&fit=crop&q=80",
    category_id: "3",
    direct_source: "https://moctobpltc-i.akamaihd.net/hls/live/571329/eight/playlist.m3u8",
    epg_channel_id: "sports.action.live",
    added: "1700000004",
    custom_sid: null
  },
  {
    num: 6,
    name: "Cinema World - Mux Adaptive HD",
    stream_type: "live",
    stream_id: 401,
    stream_icon: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=160&auto=format&fit=crop&q=80",
    category_id: "4",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    epg_channel_id: "cinema.world.mux",
    added: "1700000005",
    custom_sid: null
  },
  {
    num: 7,
    name: "Sci-Fi Cinema - Tears of Steel HD",
    stream_type: "live",
    stream_id: 402,
    stream_icon: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=160&auto=format&fit=crop&q=80",
    category_id: "4",
    direct_source: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    epg_channel_id: "scifi.tears.steel",
    added: "1700000006",
    custom_sid: null
  },
  {
    num: 8,
    name: "Apple BipBop Master HD Stream",
    stream_type: "live",
    stream_id: 501,
    stream_icon: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=160&auto=format&fit=crop&q=80",
    category_id: "5",
    direct_source: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8",
    epg_channel_id: "apple.bipbop.ts",
    added: "1700000007",
    custom_sid: null
  },
  {
    num: 9,
    name: "Broadcast fMP4 Science Channel",
    stream_type: "live",
    stream_id: 502,
    stream_icon: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=160&auto=format&fit=crop&q=80",
    category_id: "5",
    direct_source: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8",
    epg_channel_id: "apple.bipbop.fmp4",
    added: "1700000008",
    custom_sid: null
  }
];

export function sanitizeServerUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'http://' + url;
  }
  try {
    const parsed = new URL(url);
    let pathname = parsed.pathname.replace(/\/+(player_api|get|panel_api|live|xmltv)\.php.*$/i, '');
    pathname = pathname.replace(/\/+c\/?$/i, '');
    pathname = pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return url.replace(/\/+(player_api|get|panel_api|live|xmltv)\.php.*$/i, '').replace(/\/+c\/?$/i, '').replace(/\/+$/, '');
  }
}

// 1. Authenticate with Xtream Codes API
app.post('/api/xtream/authenticate', async (req, res) => {
  try {
    const { serverUrl, username, password } = req.body;

    if (!serverUrl || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields (Server URL, Username, Password) are required.'
      });
    }

    // Check if demo is requested
    const isDemo = username.toLowerCase() === 'demo' || serverUrl.toLowerCase().includes('demo');
    if (isDemo) {
      return res.json({
        success: true,
        isDemo: true,
        user_info: {
          username: username,
          status: "Active",
          exp_date: "1893456000", // Year 2030
          is_trial: "0",
          active_cons: "1",
          max_connections: "5",
          created_at: "1672531199",
          allowed_output_formats: ["m3u8", "ts", "rtmp"]
        },
        server_info: {
          url: "demo.streamhub.tv",
          port: "8080",
          server_protocol: "https",
          timezone: "Asia/Kolkata",
          timestamp_now: Math.floor(Date.now() / 1000)
        }
      });
    }

    const cleanUrl = sanitizeServerUrl(serverUrl);
    const targetUrl = `${cleanUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'IPTVSmarters/1.0.0 (Linux;Android 12)',
          'Accept': 'application/json, text/plain, */*'
        }
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data.user_info && data.user_info.auth === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid Username or Password. Please check your credentials.'
        });
      }

      if (data && data.user_info) {
        return res.json({
          success: true,
          isDemo: false,
          user_info: data.user_info,
          server_info: data.server_info || { url: cleanUrl }
        });
      }

      // If unexpected format, still accept if auth was truthy
      return res.json({
        success: true,
        isDemo: false,
        user_info: { username, status: "Active", max_connections: "1" },
        server_info: { url: cleanUrl }
      });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      console.warn('Xtream direct connect failed:', fetchErr.message);

      // Return a helpful error with fallback option
      return res.status(502).json({
        success: false,
        message: `Could not connect to stream server: ${fetchErr.message}. Verify that the URL and credentials are valid, or try the 1-Click Demo Preset.`,
        canFallbackToDemo: true
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Fetch categories
app.post('/api/xtream/categories', async (req, res) => {
  try {
    const { serverUrl, username, password, isDemo } = req.body;

    if (isDemo || username === 'demo') {
      return res.json({
        success: true,
        categories: DEMO_CATEGORIES
      });
    }

    const cleanUrl = sanitizeServerUrl(serverUrl);
    const targetUrl = `${cleanUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_categories`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'IPTVSmarters/1.0.0' }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const categories = await response.json();
    return res.json({
      success: true,
      categories: Array.isArray(categories) ? categories : []
    });
  } catch (err: any) {
    console.warn('Categories fetch failed, returning demo categories fallback:', err.message);
    return res.json({
      success: true,
      categories: DEMO_CATEGORIES,
      fallbackUsed: true
    });
  }
});

// 3. Fetch Live Streams
app.post('/api/xtream/streams', async (req, res) => {
  try {
    const { serverUrl, username, password, categoryId, isDemo } = req.body;

    if (isDemo || username === 'demo') {
      let streams = DEMO_STREAMS;
      if (categoryId && categoryId !== 'all') {
        streams = streams.filter(s => s.category_id === categoryId);
      }
      return res.json({
        success: true,
        streams
      });
    }

    const cleanUrl = sanitizeServerUrl(serverUrl);
    let targetUrl = `${cleanUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`;
    if (categoryId && categoryId !== 'all') {
      targetUrl += `&category_id=${encodeURIComponent(categoryId)}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'IPTVSmarters/1.0.0' }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const rawStreams = await response.json();
    const streamList = Array.isArray(rawStreams) ? rawStreams : [];

    // Map stream URLs
    const formatted = streamList.map((s: any, idx: number) => {
      const streamId = s.stream_id;
      const ext = (s.container_extension || 'm3u8').toLowerCase();
      // Use direct_source if server provided, else construct standard Xtream live stream URL
      const streamUrl = s.direct_source || `${cleanUrl}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.${ext === 'ts' ? 'ts' : 'm3u8'}`;
      return {
        num: idx + 1,
        name: s.name || `Channel ${streamId}`,
        stream_type: s.stream_type || 'live',
        stream_id: streamId,
        stream_icon: s.stream_icon || '',
        category_id: s.category_id ? String(s.category_id) : '1',
        direct_source: streamUrl,
        epg_channel_id: s.epg_channel_id || '',
        added: s.added || ''
      };
    });

    return res.json({
      success: true,
      streams: formatted
    });
  } catch (err: any) {
    console.warn('Streams fetch failed:', err.message);
    if (req.body.isDemo || req.body.username === 'demo' || req.body.allowDemoFallback) {
      let streams = DEMO_STREAMS;
      if (req.body.categoryId && req.body.categoryId !== 'all') {
        streams = streams.filter(s => s.category_id === req.body.categoryId);
      }
      return res.json({
        success: true,
        streams,
        fallbackUsed: true
      });
    }

    return res.status(502).json({
      success: false,
      message: `Failed to fetch live streams from IPTV server: ${err.message}. Please check if the server is active or try demo credentials.`,
      canFallbackToDemo: true
    });
  }
});

// 3.5 Fetch raw M3U playlist content for Web Worker parsing
app.post('/api/xtream/m3u-content', async (req, res) => {
  try {
    const { serverUrl, username, password, isDemo } = req.body;

    if (isDemo || username === 'demo') {
      let m3u = '#EXTM3U x-tvg-url=""\r\n';
      for (const ch of DEMO_STREAMS) {
        const catName = DEMO_CATEGORIES.find(c => c.category_id === ch.category_id)?.category_name || 'General';
        m3u += `#EXTINF:-1 tvg-id="${ch.epg_channel_id || ch.stream_id}" tvg-name="${ch.name}" tvg-logo="${ch.stream_icon}" group-title="${catName}",${ch.name}\r\n`;
        m3u += `${ch.direct_source}\r\n`;
      }
      return res.json({
        success: true,
        m3uContent: m3u
      });
    }

    const cleanUrl = sanitizeServerUrl(serverUrl);
    const m3uUrl = `${cleanUrl}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=m3u8`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(m3uUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'IPTVSmarters/1.0.0' }
    });
    clearTimeout(timeout);

    if (response.ok) {
      const text = await response.text();
      if (text.includes('#EXTINF') || text.includes('#EXTM3U')) {
        return res.json({
          success: true,
          m3uContent: text
        });
      }
    }

    return res.json({
      success: false,
      fallbackToStreamsApi: true
    });
  } catch (err: any) {
    console.warn('M3U content direct fetch failed, fallback to streams API:', err.message);
    return res.json({
      success: false,
      fallbackToStreamsApi: true
    });
  }
});

// 4. Download Playlist (.m3u / .m3u_plus / json)
app.post('/api/xtream/download-playlist', async (req, res) => {
  try {
    const { serverUrl, username, password, format = 'm3u_plus', output = 'm3u8', streams = [], isDemo } = req.body;

    const filename = `playlist_${username || 'streamhub'}_${new Date().toISOString().slice(0, 10)}.${format === 'json' ? 'json' : 'm3u'}`;

    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.send(JSON.stringify(streams.length > 0 ? streams : DEMO_STREAMS, null, 2));
    }

    // Generate Standard M3U / M3U_PLUS
    const cleanUrl = sanitizeServerUrl(serverUrl || 'https://demo.streamhub.tv');
    const isRealXtream = username && username.toLowerCase() !== 'demo' && !isDemo && !cleanUrl.includes('demo');

    // If real Xtream credentials are provided and no pre-loaded stream objects exist, fetch provider's live get.php
    if (isRealXtream && (!streams || streams.length === 0)) {
      try {
        const remoteGetUrl = `${cleanUrl}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=${format === 'm3u_plus' ? 'm3u_plus' : 'm3u'}&output=${output}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);
        const remoteRes = await fetch(remoteGetUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'IPTVSmarters/1.0.0 (Linux;Android 12)',
            'Accept': '*/*',
          },
        });
        clearTimeout(timeout);
        if (remoteRes.ok) {
          const remoteText = await remoteRes.text();
          if (remoteText.includes('#EXTM3U') || remoteText.includes('#EXTINF')) {
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
            return res.send(remoteText);
          }
        }
      } catch (remoteErr) {
        console.warn('[DownloadPlaylist] Remote get.php fetch fallback:', remoteErr);
      }
    }

    let m3uContent = '#EXTM3U x-tvg-url=""\r\n';
    const itemsToExport = streams.length > 0 ? streams : DEMO_STREAMS;

    for (const item of itemsToExport) {
      const channelName = item.name || `Channel ${item.stream_id}`;
      const logo = item.stream_icon || '';
      const group = item.category_name || item.category_id || 'Live TV';
      const tvgId = item.epg_channel_id || item.stream_id || '';
      
      let streamUrl = item.direct_source;
      if (!streamUrl) {
        streamUrl = `${cleanUrl}/live/${encodeURIComponent(username || 'demo')}/${encodeURIComponent(password || 'demo')}/${item.stream_id}.${output}`;
      }

      if (format === 'm3u_plus') {
        m3uContent += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${channelName}" tvg-logo="${logo}" group-title="${group}",${channelName}\r\n`;
      } else {
        m3uContent += `#EXTINF:-1,${channelName}\r\n`;
      }
      m3uContent += `${streamUrl}\r\n`;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    return res.send(m3uContent);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Dedicated Server-side FFmpeg Live Streaming Engine (remuxes and transcodes IPTV channels)
app.all('/api/ffmpeg/stream', handleFfmpegStream);
app.get('/api/ffmpeg/status', handleFfmpegStatus);




// 6. MAC URL Portal Authentication, Channel Fetch & Playlist Exporter
app.post('/api/mac-portal/authenticate', authenticateAndFetchMacPortal);

app.post('/api/mac-portal/download-m3u', (req, res) => {
  const { m3uContent, filename = 'playlist.m3u' } = req.body;
  if (!m3uContent) {
    return res.status(400).send('Missing m3uContent');
  }
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
  return res.send(m3uContent);
});
app.post('/api/mac-portal/generate', async (req, res) => {
  try {
    let { macAddress, serverHost, port = '8080', fileFormat = 'm3u_plus' } = req.body;

    if (!macAddress || !macAddress.trim()) {
      return res.status(400).json({ success: false, message: 'MAC Address is required.' });
    }

    // Clean and normalize MAC format (e.g. 001A79B4C28A -> 00:1A:79:B4:C2:8A)
    let cleanMac = macAddress.trim().toUpperCase().replace(/[^0-9A-F]/g, '');
    if (cleanMac.length === 12) {
      cleanMac = cleanMac.match(/.{1,2}/g)!.join(':');
    }

    const macRegex = /^([0-9A-F]{2}[:]){5}([0-9A-F]{2})$/;
    if (!macRegex.test(cleanMac)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid MAC Address format. Standard format is 00:1A:79:XX:XX:XX.'
      });
    }

    // Default demo portal host if not provided
    let host = (serverHost || '').trim();
    if (!host) {
      host = 'http://portal.mag-stalker.tv';
    }
    if (!host.startsWith('http://') && !host.startsWith('https://')) {
      host = 'http://' + host;
    }

    // Ensure port is attached if not already in URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(host);
      if (port && port.trim()) {
        parsedUrl.port = port.trim();
      }
    } catch {
      parsedUrl = new URL(`http://${host}:${port || '8080'}`);
    }

    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.port ? `:${parsedUrl.port}` : ''}`;
    const cleanPort = parsedUrl.port || port || '8080';

    // Provider download link formats (Stalker / MAG M3U converters)
    const providerDownloadUrl = `${baseUrl}/get.php?mac=${encodeURIComponent(cleanMac)}&type=${fileFormat}&output=m3u8`;
    const localDownloadUrl = `/api/mac-portal/download?mac=${encodeURIComponent(cleanMac)}&server=${encodeURIComponent(baseUrl)}&port=${encodeURIComponent(cleanPort)}&format=${fileFormat}`;

    return res.json({
      success: true,
      macAddress: cleanMac,
      port: cleanPort,
      serverUrl: baseUrl,
      fileFormat,
      downloadUrl: providerDownloadUrl,
      localDownloadUrl,
      generatedTimestamp: new Date().toISOString(),
      instructions: 'Use this download URL directly in VLC, TiviMate, OTT Navigator, or any M3U IPTV player.'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Direct file download for MAC generated playlist
app.get('/api/mac-portal/download', async (req, res) => {
  try {
    const { mac = '00:1A:79:B4:C2:8A', server = 'http://portal.mag-stalker.tv:8080', format = 'm3u_plus' } = req.query;
    const cleanMac = String(mac).toUpperCase();
    const filename = `playlist_mac_${cleanMac.replace(/:/g, '')}.${format === 'json' ? 'json' : format === 'txt' ? 'txt' : 'm3u'}`;

    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.json({
        portal: server,
        mac_address: cleanMac,
        type: 'Stalker Portal MAG Playlist',
        channels: DEMO_STREAMS
      });
    }

    // Generate M3U / M3U_PLUS with MAG / Stalker tags
    let m3u = `#EXTM3U x-tvg-url="" tvg-shift="0" mac="${cleanMac}"\r\n`;

    for (const ch of DEMO_STREAMS) {
      const channelName = ch.name;
      const logo = ch.stream_icon;
      const group = ch.category_id || 'Live TV';
      const tvgId = ch.epg_channel_id || ch.stream_id;
      const streamUrl = ch.direct_source || `${server}/live/${cleanMac}/${ch.stream_id}.m3u8`;

      if (format === 'm3u_plus') {
        m3u += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${channelName}" tvg-logo="${logo}" group-title="${group}" mac="${cleanMac}",${channelName}\r\n`;
      } else {
        m3u += `#EXTINF:-1,${channelName}\r\n`;
      }
      m3u += `${streamUrl}\r\n`;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    return res.send(m3u);
  } catch (err: any) {
    return res.status(500).send(`MAC download error: ${err.message}`);
  }
});

// 7. Link Master: Encrypted Temporary Alias Generator & Stream Proxy
app.post('/api/linkmaster/obfuscate', handleObfuscateM3u);
app.all('/api/linkmaster/res*', handleStreamSubResource);
app.all('/api/linkmaster/stream/:aliasId', handleStreamAlias);
app.all('/api/linkmaster/stream/*', handleStreamAlias);
app.all('/api/proxy/stream', handleStreamAlias);

// 8. Playlist Import & Systematic Parser Proxy with High-Speed Server Cache
interface CachedPlaylist {
  expiresAt: number;
  totalChannels: number;
  categories: string[];
  channels: any[];
  rawM3u: string;
  sourceUrl: string;
}
const playlistCache = new Map<string, CachedPlaylist>();

function fastServerParseM3u(content: string) {
  const lines = content.split(/\r?\n/);
  const channels: any[] = [];
  const categoriesSet = new Set<string>();

  let curTvgId = '';
  let curTvgName = '';
  let curLogo = '';
  let curCategory = 'Live TV';
  let curName = 'Live Stream';
  let curUa = '';
  let curRef = '';
  let chNum = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTM3U')) {
      const uaIdx = line.indexOf('user-agent="');
      if (uaIdx !== -1) {
        const uaEnd = line.indexOf('"', uaIdx + 12);
        if (uaEnd !== -1) curUa = line.slice(uaIdx + 12, uaEnd);
      }
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      const idIdx = line.indexOf('tvg-id="');
      curTvgId = idIdx !== -1 ? line.slice(idIdx + 8, line.indexOf('"', idIdx + 8)) : '';

      const nameIdx = line.indexOf('tvg-name="');
      curTvgName = nameIdx !== -1 ? line.slice(nameIdx + 10, line.indexOf('"', nameIdx + 10)) : '';

      const logoIdx = line.indexOf('tvg-logo="');
      curLogo = logoIdx !== -1 ? line.slice(logoIdx + 10, line.indexOf('"', logoIdx + 10)) : '';

      const groupIdx = line.indexOf('group-title="');
      curCategory = groupIdx !== -1 ? line.slice(groupIdx + 13, line.indexOf('"', groupIdx + 13)) : 'Live TV';
      if (!curCategory) curCategory = 'Live TV';

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

    if (line.startsWith('#')) continue;

    // Stream URL line
    const streamUrl = line;
    let ext: 'm3u8' | 'ts' | 'mp4' | 'mkv' | 'other' = 'other';
    const cleanLower = streamUrl.toLowerCase().split('?')[0];
    if (cleanLower.endsWith('.m3u8')) ext = 'm3u8';
    else if (cleanLower.endsWith('.ts')) ext = 'ts';
    else if (cleanLower.endsWith('.mp4')) ext = 'mp4';
    else if (cleanLower.endsWith('.mkv')) ext = 'mkv';

    categoriesSet.add(curCategory);

    channels.push({
      id: `ch_${chNum}_${Math.random().toString(36).slice(2, 6)}`,
      num: chNum++,
      name: curName,
      streamUrl,
      logo: curLogo,
      category: curCategory,
      tvgId: curTvgId,
      tvgName: curTvgName,
      extension: ext,
      headers: curUa || curRef ? { userAgent: curUa, referer: curRef } : undefined,
    });

    curTvgId = '';
    curTvgName = '';
    curLogo = '';
    curCategory = 'Live TV';
    curName = 'Live Stream';
  }

  const categories = Array.from(categoriesSet);
  categories.sort();

  return {
    totalChannels: channels.length,
    categories,
    channels,
  };
}

app.post('/api/playlist/fetch-and-parse', async (req, res) => {
  try {
    const {
      url,
      userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      referer,
    } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, message: 'URL parameter is required.' });
    }

    const cleanUrl = url.trim();
    const cacheKey = `${cleanUrl}_${userAgent || ''}`;
    const now = Date.now();

    // Check memory cache
    const cached = playlistCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return res.json({
        success: true,
        cached: true,
        totalChannels: cached.totalChannels,
        categories: cached.categories,
        channels: cached.channels,
        rawM3u: cached.rawM3u,
        sourceUrl: cleanUrl,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const headers: Record<string, string> = {
      'User-Agent': userAgent,
      'Accept-Encoding': 'gzip, deflate, br',
      Accept: '*/*',
    };
    if (referer) headers['Referer'] = referer;

    const fetchRes = await fetch(cleanUrl, {
      signal: controller.signal,
      headers,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!fetchRes.ok) {
      return res.status(fetchRes.status).json({
        success: false,
        message: `Remote playlist server returned HTTP ${fetchRes.status}: ${fetchRes.statusText}`,
      });
    }

    const text = await fetchRes.text();
    const parsed = fastServerParseM3u(text);

    const cacheEntry: CachedPlaylist = {
      expiresAt: now + 15 * 60 * 1000, // 15 min TTL
      totalChannels: parsed.totalChannels,
      categories: parsed.categories,
      channels: parsed.channels,
      rawM3u: text,
      sourceUrl: cleanUrl,
    };
    playlistCache.set(cacheKey, cacheEntry);

    return res.json({
      success: true,
      totalChannels: parsed.totalChannels,
      categories: parsed.categories,
      channels: parsed.channels,
      rawM3u: text,
      sourceUrl: cleanUrl,
    });
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      message: `Failed to fetch remote playlist: ${err.message}`,
    });
  }
});

// Direct single-stream M3U file download endpoint
app.get('/api/playlist/download-single', (req, res) => {
  try {
    const {
      name = 'stream_channel',
      url = '',
      logo = '',
      category = 'Live TV',
      ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    } = req.query;
    if (!url) {
      return res.status(400).send('Stream URL is required.');
    }

    const cleanName =
      String(name)
        .replace(/[^a-zA-Z0-9_\-\s]/g, '')
        .trim()
        .replace(/\s+/g, '_') || 'channel';
    const filename = `${cleanName}.m3u`;

    let m3u = `#EXTM3U http-user-agent="${ua}" user-agent="${ua}"\r\n`;
    m3u += `#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${category}",${name}\r\n`;
    m3u += `#EXTVLCOPT:http-user-agent=${ua}\r\n`;
    m3u += `#EXTHTTP:{"User-Agent":"${ua}"}\r\n`;
    m3u += `${url}\r\n`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    return res.send(m3u);
  } catch (err: any) {
    return res.status(500).send(`Error downloading single stream M3U: ${err.message}`);
  }
});

// 9. Track URL: Short Link Generation, Validity Management & Analytics
app.post('/api/track-url/create', handleCreateTrackUrl);
app.get('/api/track-url/list', handleListTrackUrls);
app.get('/api/track-url/stats/:idOrSlug', handleGetTrackUrlStats);
app.delete('/api/track-url/:idOrSlug', handleDeleteTrackUrl);
app.post('/api/track-url/simulate-click', handleSimulateClick);

// Public Track URL resolver (tracks device/client & serves M3U)
app.get('/t/:slug', handlePublicTrackAccess);
app.get('/api/t/:slug', handlePublicTrackAccess);

// 9.5 is.gd URL to Short Integration
app.all('/api/shorten/isgd', async (req, res) => {
  try {
    const rawUrl = (req.query.url || req.body?.url) as string;
    if (!rawUrl || !rawUrl.trim()) {
      return res.status(400).json({ success: false, message: 'URL parameter is required.' });
    }
    const cleanUrl = rawUrl.trim();
    const apiUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(cleanUrl)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timeout);

    const text = (await response.text()).trim();
    if (response.ok && text.startsWith('https://is.gd/')) {
      return res.json({
        success: true,
        shortUrl: text,
        originalUrl: cleanUrl,
      });
    }

    return res.status(400).json({
      success: false,
      message: text || 'Failed to shorten URL using is.gd.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Error shortening URL' });
  }
});

// 10. M3U Playlist Health Verifier & Active Playlist Generator
app.post('/api/playlist/verify-live', handleVerifyLive);
app.post('/api/playlist/parse-only', handleParseM3uOnly);
app.post('/api/playlist/download-verified', handleDownloadVerifiedPlaylist);

// 11. User Feedback System
const feedbackStore: Array<{
  id: string;
  fullName: string;
  email?: string;
  rating: number;
  message: string;
  createdAt: string;
}> = [];

app.post('/api/feedback', (req, res) => {
  const { fullName, email, rating, message } = req.body;
  if (!fullName || !message) {
    return res.status(400).json({ error: 'Full name and message are required.' });
  }
  const entry = {
    id: `fb_${Date.now()}`,
    fullName: String(fullName).trim(),
    email: email ? String(email).trim() : undefined,
    rating: Number(rating) || 5,
    message: String(message).trim(),
    createdAt: new Date().toISOString(),
  };
  feedbackStore.push(entry);
  console.log(`[Feedback Log] ${entry.fullName} rated ${entry.rating}★: "${entry.message}"`);
  return res.json({ success: true, message: 'Feedback logged successfully', entry });
});

app.get('/api/feedback', (_req, res) => {
  return res.json({ success: true, count: feedbackStore.length, entries: feedbackStore });
});

// Outbound SMTP Email Dispatch to innocent.aryan206@gmail.com
app.post('/api/feedback/send-email', handleSendFeedbackEmail);

// 12. Mega Cloud Storage Upload & EmailJS Link Notification
app.post('/api/mega/upload-and-notify', handleMegaUploadAndNotify);
app.get(['/api/mega/download/:fileId', '/api/mega/download/:fileId/:fileName'], handleDownloadStoredMegaFile);

// 13. URL Shield: M3U / M3U8 Playlist Masking & Single URL Cloaking via App Domain
app.post('/api/urlshield/mask-url', handleMaskSingleUrl);
app.post('/api/urlshield/mask-playlist', handleMaskPlaylist);
app.post('/api/urlshield/download', handleDownloadShieldedM3u);
app.all(['/api/urlshield/proxy', '/api/proxy'], handleCloakingProxy);
app.get('/api/urlshield/resolve/:slug', handleGetMaskedRecord);

// Direct route to serve the standalone Desktop Note HTML app
app.get('/desktop-note.html', (_req, res) => {
  const filePath = path.resolve(__dirname, 'public', 'desktop-note.html');
  res.sendFile(filePath);
});

// TinySRC masked slug resolver routes: Renders destination in borderless sandbox without 302 redirecting address bar!
app.get([
  '/tinysrc/go/:slug',
  '/tinysrc/:slug',
  '/m/:slug',
  '/mask/:slug',
], handleResolveMaskedSlug);

// Direct route to serve the standalone Masking URL cloaking page (keeps browser address bar masked without sign-in or cookies)
const MASKING_ROUTES = [
  '/tinysrc',
  '/tinysrc/',
  '/tinysrc/go',
  '/tinysrc/go/',
  '/masking-url',
  '/masking-url/',
  '/masking-url.html',
  '/masking',
  '/masking/',
  '/mask',
  '/mask/',
  '/mask.html',
  '/m',
  '/m/',
];

app.get(MASKING_ROUTES, (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const filePath = path.resolve(__dirname, 'public', 'masking-url.html');
  res.sendFile(filePath);
});

// If root path is accessed with ?url= or ?u=, directly serve masking-url.html so it bypasses SPA auth gate entirely
app.get('/', (req, res, next) => {
  if (req.query && (req.query.url || req.query.u)) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const filePath = path.resolve(__dirname, 'public', 'masking-url.html');
    return res.sendFile(filePath);
  }
  next();
});

// Configure Vite or Static Serve
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StreamHub Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
