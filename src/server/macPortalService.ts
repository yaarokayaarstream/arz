import { Request, Response } from 'express';

export interface MacChannel {
  num: number;
  name: string;
  stream_type: string;
  stream_id: string | number;
  stream_icon: string;
  category_id: string;
  category_name: string;
  direct_source: string;
  epg_channel_id: string;
}

export interface MacCategory {
  category_id: string;
  category_name: string;
}

// Verified live stream channels reserved strictly for Demo Preset
export const DEMO_PRESET_STREAMS: MacChannel[] = [
  {
    num: 1,
    name: "9X Jalwa Live Music HD",
    stream_type: "live",
    stream_id: "mac_101",
    stream_icon: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_9X_JALWA/images/LOGO_HD/image.png",
    category_id: "music",
    category_name: "Music & Entertainment",
    direct_source: "https://wiselp.wiseplayout.com/9X_Jalwa/master.m3u8",
    epg_channel_id: "9x.jalwa.in",
  },
  {
    num: 2,
    name: "4 SiDES TV Live HD",
    stream_type: "live",
    stream_id: "mac_102",
    stream_icon: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=160&auto=format&fit=crop&q=80",
    category_id: "news",
    category_name: "National & News",
    direct_source: "https://stream.ottlive.co.in/4sidestv/index.m3u8",
    epg_channel_id: "4sides.tv",
  },
  {
    num: 3,
    name: "Action Sports Live HD",
    stream_type: "live",
    stream_id: "mac_103",
    stream_icon: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=160&auto=format&fit=crop&q=80",
    category_id: "sports",
    category_name: "Sports & Live Events",
    direct_source: "https://moctobpltc-i.akamaihd.net/hls/live/571329/eight/playlist.m3u8",
    epg_channel_id: "action.sports",
  },
  {
    num: 4,
    name: "Cinema World - Mux Adaptive HD",
    stream_type: "live",
    stream_id: "mac_104",
    stream_icon: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=160&auto=format&fit=crop&q=80",
    category_id: "movies",
    category_name: "Movies & Cinema",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    epg_channel_id: "cinema.mux",
  },
  {
    num: 5,
    name: "Sci-Fi Cinema - Tears of Steel HD",
    stream_type: "live",
    stream_id: "mac_105",
    stream_icon: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=160&auto=format&fit=crop&q=80",
    category_id: "movies",
    category_name: "Movies & Cinema",
    direct_source: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    epg_channel_id: "tears.steel",
  },
  {
    num: 6,
    name: "Apple BipBop Master HD Stream",
    stream_type: "live",
    stream_id: "mac_106",
    stream_icon: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=160&auto=format&fit=crop&q=80",
    category_id: "science",
    category_name: "Science & Nature",
    direct_source: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8",
    epg_channel_id: "apple.bipbop",
  },
  {
    num: 7,
    name: "Big Buck Bunny 1080p HLS",
    stream_type: "live",
    stream_id: "mac_107",
    stream_icon: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=160&auto=format&fit=crop&q=80",
    category_id: "movies",
    category_name: "Movies & Cinema",
    direct_source: "https://test-streams.mux.dev/test_001/stream.m3u8",
    epg_channel_id: "bunny.1080p",
  },
  {
    num: 8,
    name: "Sintel Open Movie 4K Live",
    stream_type: "live",
    stream_id: "mac_108",
    stream_icon: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=160&auto=format&fit=crop&q=80",
    category_id: "movies",
    category_name: "Movies & Cinema",
    direct_source: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
    epg_channel_id: "sintel.4k",
  }
];

/**
 * Normalizes MAC address string into standard colon format (00:1A:79:XX:XX:XX)
 */
export function normalizeMacAddress(mac: string): string {
  const clean = (mac || '').trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  if (clean.length === 12) {
    return clean.match(/.{1,2}/g)!.join(':');
  }
  return clean;
}

/**
 * Parses raw M3U / M3U_PLUS text content into structured channel objects
 */
export function parseM3uText(m3uText: string, baseUrl: string): { channels: MacChannel[]; categories: MacCategory[] } {
  const channels: MacChannel[] = [];
  const categoriesMap = new Map<string, string>();
  const lines = m3uText.split(/\r?\n/);

  let currentExtinf: {
    name: string;
    logo: string;
    group: string;
    tvgId: string;
  } | null = null;

  let channelNumber = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/i);
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
      const groupMatch = line.match(/group-title="([^"]*)"/i);

      let channelName = '';
      const commaIdx = line.lastIndexOf(',');
      if (commaIdx !== -1) {
        channelName = line.substring(commaIdx + 1).trim();
      }
      if (!channelName && tvgNameMatch) {
        channelName = tvgNameMatch[1].trim();
      }
      if (!channelName) {
        channelName = `Channel ${channelNumber}`;
      }

      const group = groupMatch ? groupMatch[1].trim() : 'Live TV';
      const logo = logoMatch ? logoMatch[1].trim() : '';
      const tvgId = tvgIdMatch ? tvgIdMatch[1].trim() : `tvg_${channelNumber}`;

      currentExtinf = {
        name: channelName,
        logo,
        group,
        tvgId,
      };
    } else if (!line.startsWith('#') && currentExtinf) {
      let streamUrl = line;
      if (!streamUrl.startsWith('http://') && !streamUrl.startsWith('https://')) {
        try {
          streamUrl = new URL(streamUrl, baseUrl).toString();
        } catch {
          // ignore
        }
      }

      const catId = currentExtinf.group.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'general';
      if (!categoriesMap.has(catId)) {
        categoriesMap.set(catId, currentExtinf.group);
      }

      channels.push({
        num: channelNumber,
        name: currentExtinf.name,
        stream_type: 'live',
        stream_id: `mac_${channelNumber}`,
        stream_icon: currentExtinf.logo,
        category_id: catId,
        category_name: currentExtinf.group,
        direct_source: streamUrl,
        epg_channel_id: currentExtinf.tvgId,
      });

      channelNumber++;
      currentExtinf = null;
    }
  }

  const categories: MacCategory[] = Array.from(categoriesMap.entries()).map(([category_id, category_name]) => ({
    category_id,
    category_name,
  }));

  return { channels, categories };
}

/**
 * Builds standard M3U_PLUS playlist string from channel array
 */
export function generateM3uContent(channels: MacChannel[], macAddress: string): string {
  let content = `#EXTM3U x-tvg-url="" tvg-shift="0" mac="${macAddress}"\r\n`;

  for (const ch of channels) {
    const tvgId = ch.epg_channel_id || ch.stream_id || '';
    const logo = ch.stream_icon || '';
    const group = ch.category_name || 'Live TV';
    const name = ch.name || `Channel ${ch.num}`;
    const url = ch.direct_source || '';

    content += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${name}" tvg-logo="${logo}" group-title="${group}" mac="${macAddress}",${name}\r\n`;
    content += `${url}\r\n`;
  }

  return content;
}

/**
 * Extracts cookies from a node-fetch / fetch Response header
 */
function extractCookies(res: any): string {
  const rawSetCookie = res.headers.raw ? res.headers.raw()['set-cookie'] : res.headers.get('set-cookie');
  if (!rawSetCookie) return '';

  const cookieList = Array.isArray(rawSetCookie) ? rawSetCookie : [rawSetCookie];
  return cookieList
    .map((c: string) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

/**
 * Safely parses Stalker / Ministra JSON responses, stripping JsHttpRequest prefixes like /*-object-* /
 */
export function parseStalkerJson(text: string): any {
  if (!text) return null;
  const clean = text.trim().replace(/^\/\*-object-\*\/\s*/, '');
  try {
    return JSON.parse(clean);
  } catch {
    const objMatch = clean.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {
        // ignore
      }
    }
    const arrMatch = clean.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        return JSON.parse(arrMatch[0]);
      } catch {
        // ignore
      }
    }
    return null;
  }
}

/**
 * Helper to perform a fetch request with a strict timeout signal
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 4000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Authenticates with Stalker / MAG / Xtream Codes IPTV server using MAC address & Portal URL
 * and fetches the complete channel list with stream URLs, names, and groups.
 *
 * Fast, non-blocking parallel probing of candidate endpoints prevents getting stuck.
 */
export async function authenticateAndFetchMacPortal(req: Request, res: Response) {
  try {
    const { macAddress, portalUrl, allowDemoFallback } = req.body;

    if (!macAddress || !macAddress.trim()) {
      return res.status(400).json({
        success: false,
        message: 'MAC Address is required (e.g., 00:1A:79:B4:C2:8A).'
      });
    }

    if (!portalUrl || !portalUrl.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Portal URL is required (e.g., http://example.com:8080/c/).'
      });
    }

    const cleanMac = normalizeMacAddress(macAddress);
    const macRegex = /^([0-9A-F]{2}[:]){5}([0-9A-F]{2})$/;
    if (!macRegex.test(cleanMac)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid MAC Address format. Standard format is 00:1A:79:XX:XX:XX.'
      });
    }

    let inputUrl = portalUrl.trim();
    if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
      inputUrl = 'http://' + inputUrl;
    }

    // Check if user explicitly requests the Demo Preset
    const isExplicitDemo =
      cleanMac === '00:1A:79:B4:C2:8A' &&
      (inputUrl.toLowerCase().includes('demo') || inputUrl.toLowerCase().includes('mag-stalker.tv'));

    if (isExplicitDemo) {
      const demoChannels = DEMO_PRESET_STREAMS.map((s, idx) => ({
        ...s,
        num: idx + 1,
        stream_id: `mac_ch_${idx + 1}`,
      }));

      const catMap = new Map<string, string>();
      for (const c of demoChannels) {
        if (!catMap.has(c.category_id)) catMap.set(c.category_id, c.category_name);
      }
      const categories: MacCategory[] = Array.from(catMap.entries()).map(([category_id, category_name]) => ({
        category_id,
        category_name,
      }));

      const m3uContent = generateM3uContent(demoChannels, cleanMac);

      return res.json({
        success: true,
        macAddress: cleanMac,
        portalUrl: inputUrl,
        authenticated: true,
        isDemo: true,
        authMethod: 'Demo Preset (Verified Streams)',
        totalChannels: demoChannels.length,
        totalCategories: categories.length,
        categories,
        channels: demoChannels,
        m3uContent,
        downloadFilename: `playlist_demo_${cleanMac.replace(/:/g, '')}.m3u`,
        serverInfo: {
          serverUrl: inputUrl,
          mac: cleanMac,
          protocol: inputUrl.startsWith('https') ? 'https' : 'http',
          time: new Date().toISOString()
        }
      });
    }

    // Parse user input URL into origin and base paths
    let parsedOrigin = '';
    try {
      const parsed = new URL(inputUrl);
      parsedOrigin = `${parsed.protocol}//${parsed.host}`;
    } catch {
      parsedOrigin = inputUrl.replace(/\/+$/, '');
    }

    const userCleanUrl = inputUrl.replace(/\/+$/, '');
    const rawMacNoColons = cleanMac.replace(/:/g, '');

    // Construct prioritized candidate base URLs without duplicate checking
    const candidateDirs: string[] = [userCleanUrl];
    if (userCleanUrl !== parsedOrigin) {
      candidateDirs.push(parsedOrigin);
    }
    if (userCleanUrl.endsWith('/c')) {
      const withoutC = userCleanUrl.replace(/\/c$/, '');
      if (!candidateDirs.includes(withoutC)) candidateDirs.push(withoutC);
    } else {
      const withC = `${userCleanUrl}/c`;
      if (!candidateDirs.includes(withC)) candidateDirs.push(withC);
    }
    if (!candidateDirs.includes(`${parsedOrigin}/c`)) candidateDirs.push(`${parsedOrigin}/c`);

    const magHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
      'X-User-Agent': 'Model: MAG250; Link: Ethernet',
      'X-User-MAC': cleanMac,
      'Cookie': `mac=${cleanMac}; stb_lang=en; timezone=GMT`,
      'Accept': '*/*',
    };

    let channels: MacChannel[] = [];
    let categories: MacCategory[] = [];
    let authenticated = false;
    let authMethod = '';
    const diagnosticErrors: string[] = [];

    // =========================================================================
    // STEP 1: Direct M3U URL / Provider M3U API (Parallel Probe)
    // =========================================================================
    const directM3uCandidates: string[] = [];
    if (inputUrl.includes('.m3u') || inputUrl.includes('get.php')) {
      directM3uCandidates.push(inputUrl);
    }
    for (const dir of candidateDirs.slice(0, 3)) {
      directM3uCandidates.push(`${dir}/get.php?mac=${encodeURIComponent(cleanMac)}&type=m3u_plus&output=m3u8`);
      directM3uCandidates.push(`${dir}/get.php?mac=${encodeURIComponent(cleanMac)}&type=m3u`);
      directM3uCandidates.push(`${dir}/playlist.m3u8?mac=${encodeURIComponent(cleanMac)}`);
      directM3uCandidates.push(`${dir}/get.php?username=${encodeURIComponent(cleanMac)}&password=${encodeURIComponent(cleanMac)}&type=m3u_plus&output=m3u8`);
    }

    // Run direct M3U probes in parallel with extended timeouts for large playlists
    await Promise.all(
      directM3uCandidates.map(async (testUrl) => {
        if (authenticated) return;
        try {
          const timeout = testUrl === inputUrl ? 60000 : 20000;
          const r = await fetchWithTimeout(testUrl, { headers: magHeaders }, timeout);
          if (r.ok) {
            const text = await r.text();
            if (text.includes('#EXTINF') || text.includes('#EXTM3U')) {
              const parsed = parseM3uText(text, parsedOrigin);
              if (parsed.channels.length > 0 && !authenticated) {
                channels = parsed.channels;
                categories = parsed.categories;
                authenticated = true;
                authMethod = `Provider M3U API (${new URL(testUrl).pathname})`;
              }
            }
          }
        } catch {
          // ignore candidate error
        }
      })
    );

    // =========================================================================
    // STEP 2: Xtream Codes API with MAC Address (Parallel Probe)
    // Many providers use Xtream Codes with MAC for player_api.php
    // =========================================================================
    if (!authenticated) {
      const xcEndpoints: string[] = [];
      for (const dir of candidateDirs.slice(0, 2)) {
        xcEndpoints.push(`${dir}/player_api.php?mac=${encodeURIComponent(cleanMac)}&action=get_live_streams`);
        xcEndpoints.push(`${dir}/player_api.php?username=${encodeURIComponent(cleanMac)}&password=${encodeURIComponent(cleanMac)}&action=get_live_streams`);
        xcEndpoints.push(`${dir}/player_api.php?username=${encodeURIComponent(rawMacNoColons)}&password=${encodeURIComponent(rawMacNoColons)}&action=get_live_streams`);
      }

      await Promise.all(
        xcEndpoints.map(async (xcUrl) => {
          if (authenticated) return;
          try {
            const r = await fetchWithTimeout(xcUrl, { headers: magHeaders }, 3500);
            if (r.ok) {
              const text = await r.text();
              const json = parseStalkerJson(text);
              const streamList = Array.isArray(json) ? json : json?.data || [];
              if (Array.isArray(streamList) && streamList.length > 0 && !authenticated) {
                const xcChannels: MacChannel[] = streamList.map((s: any, idx: number) => {
                  const sId = s.stream_id || idx + 1;
                  const ext = (s.container_extension || 'm3u8').toLowerCase();
                  const streamUrl =
                    s.direct_source ||
                    `${parsedOrigin}/live/${encodeURIComponent(cleanMac)}/${encodeURIComponent(cleanMac)}/${sId}.${ext === 'ts' ? 'ts' : 'm3u8'}`;
                  return {
                    num: idx + 1,
                    name: s.name || `Channel ${sId}`,
                    stream_type: s.stream_type || 'live',
                    stream_id: sId,
                    stream_icon: s.stream_icon || '',
                    category_id: s.category_id ? String(s.category_id) : '1',
                    category_name: s.category_name || 'Live TV',
                    direct_source: streamUrl,
                    epg_channel_id: s.epg_channel_id || '',
                  };
                });

                if (xcChannels.length > 0) {
                  channels = xcChannels;
                  authenticated = true;
                  authMethod = 'Xtream Codes API (MAC Authentication)';
                }
              }
            }
          } catch {
            // ignore
          }
        })
      );
    }

    // =========================================================================
    // STEP 3: Stalker Ministra Middleware Protocol (Parallel Handshake Probe)
    // =========================================================================
    if (!authenticated) {
      const handshakeUrls: string[] = [];
      for (const dir of candidateDirs) {
        handshakeUrls.push(`${dir}/load.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml`);
        handshakeUrls.push(`${dir}/server/load.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml`);
        handshakeUrls.push(`${dir}/c/load.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml`);
        handshakeUrls.push(`${dir}/c/server/load.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml`);
      }

      // Probe handshakes in parallel to find active portal endpoint instantly
      type HandshakeSuccess = { url: string; token: string; cookies: string };
      let successfulHandshake: HandshakeSuccess | null = null;

      await Promise.all(
        handshakeUrls.map(async (handshakeUrl) => {
          if (successfulHandshake) return;
          try {
            const r = await fetchWithTimeout(handshakeUrl, { headers: magHeaders }, 3500);
            if (!r.ok) {
              diagnosticErrors.push(`${handshakeUrl} (HTTP ${r.status})`);
              return;
            }

            const rawCookies = extractCookies(r);
            const text = await r.text();
            const json = parseStalkerJson(text);

            let token = '';
            if (json?.js?.token) {
              token = json.js.token;
            } else if (json?.token) {
              token = json.token;
            } else {
              const tokenMatch = text.match(/"token"\s*:\s*"([^"]+)"/i);
              if (tokenMatch && tokenMatch[1]) {
                token = tokenMatch[1];
              }
            }

            if (token && !successfulHandshake) {
              successfulHandshake = {
                url: handshakeUrl,
                token,
                cookies: rawCookies,
              };
            }
          } catch (err: any) {
            diagnosticErrors.push(`${handshakeUrl} (${err.message})`);
          }
        })
      );

      // If a handshake succeeded, fetch genres and all channels with session token
      if (successfulHandshake) {
        const { url: handshakeUrl, token, cookies: rawCookies } = successfulHandshake as HandshakeSuccess;
        authenticated = true;
        authMethod = 'Stalker Portal Protocol (Handshake + ITV)';

        const sessionCookies = [
          `mac=${cleanMac}`,
          'stb_lang=en',
          'timezone=GMT',
          rawCookies,
        ].filter(Boolean).join('; ');

        const authenticatedHeaders = {
          ...magHeaders,
          'Cookie': sessionCookies,
          'Authorization': `Bearer ${token}`,
        };

        const endpointBase = handshakeUrl.split('?')[0];

        // 1. Authorize session profile (non-blocking)
        try {
          const profileUrl = `${endpointBase}?type=stb&action=get_profile&token=${encodeURIComponent(token)}&stb_type=MAG250&sn=0000000000000&JsHttpRequest=1-xml`;
          await fetchWithTimeout(profileUrl, { headers: authenticatedHeaders }, 3000);
        } catch {
          // ignore
        }

        // 2. Fetch genres mapping
        const genresMap = new Map<string, string>();
        try {
          const genresUrl = `${endpointBase}?type=itv&action=get_genres&token=${encodeURIComponent(token)}&JsHttpRequest=1-xml`;
          const gRes = await fetchWithTimeout(genresUrl, { headers: authenticatedHeaders }, 3500);
          if (gRes.ok) {
            const gText = await gRes.text();
            const gData = parseStalkerJson(gText);
            const rawGenres = gData?.js || gData?.data || gData;
            if (Array.isArray(rawGenres)) {
              for (const g of rawGenres) {
                if (g.id && (g.title || g.name)) {
                  genresMap.set(String(g.id), String(g.title || g.name));
                }
              }
            }
          }
        } catch {
          // ignore
        }

        // 3. Fetch all channels (try get_all_channels and get_ordered_list)
        const channelEndpoints = [
          `${endpointBase}?type=itv&action=get_all_channels&token=${encodeURIComponent(token)}&JsHttpRequest=1-xml`,
          `${endpointBase}?type=itv&action=get_ordered_list&token=${encodeURIComponent(token)}&JsHttpRequest=1-xml`,
        ];

        for (const chUrl of channelEndpoints) {
          try {
            // Extended timeout up to 60s for large Stalker channel dumps
            const cRes = await fetchWithTimeout(chUrl, { headers: authenticatedHeaders }, 60000);
            if (cRes.ok) {
              const cText = await cRes.text();
              const cData = parseStalkerJson(cText);
              const rawChannels = cData?.js?.data || cData?.js || cData?.data || [];
              if (Array.isArray(rawChannels) && rawChannels.length > 0) {
                let num = 1;
                for (const rc of rawChannels) {
                  const cName = rc.name || rc.title || `Channel ${num}`;
                  let cmd = rc.cmd || '';
                  if (cmd.startsWith('ffmpeg ')) {
                    cmd = cmd.replace(/^ffmpeg\s+/, '');
                  }
                  if (cmd.startsWith('auto ')) {
                    cmd = cmd.replace(/^auto\s+/, '');
                  }
                  if (!cmd.startsWith('http://') && !cmd.startsWith('https://')) {
                    cmd = `${parsedOrigin}/live/${cleanMac}/${rc.id || num}.m3u8`;
                  }

                  const genreName = genresMap.get(String(rc.tv_genre_id)) || rc.category_name || 'Live TV';
                  const catId = String(rc.tv_genre_id || 'general');

                  channels.push({
                    num,
                    name: cName,
                    stream_type: 'live',
                    stream_id: rc.id || `stalker_${num}`,
                    stream_icon: rc.logo
                      ? (rc.logo.startsWith('http') ? rc.logo : `${parsedOrigin}/${rc.logo.replace(/^\//, '')}`)
                      : '',
                    category_id: catId,
                    category_name: genreName,
                    direct_source: cmd,
                    epg_channel_id: rc.epg_channel_id || String(rc.id || num),
                  });
                  num++;
                }
                break; // Found channels!
              }
            }
          } catch (err: any) {
            diagnosticErrors.push(`Channel fetch: ${err.message}`);
          }
        }
      }
    }

    // =========================================================================
    // Check results and return response
    // =========================================================================
    if (channels.length === 0) {
      if (allowDemoFallback) {
        channels = DEMO_PRESET_STREAMS.map((s, idx) => ({
          ...s,
          num: idx + 1,
          stream_id: `mac_ch_${idx + 1}`,
        }));
        authenticated = true;
        authMethod = 'Fallback Demo Preset';
      } else {
        const summaryErr = diagnosticErrors.slice(-2).join(' | ');
        return res.status(400).json({
          success: false,
          portalUrl: inputUrl,
          macAddress: cleanMac,
          message: `Unable to fetch channels from "${inputUrl}" for MAC ${cleanMac}. ${summaryErr ? `(${summaryErr})` : ''}
Please verify that:
1. The Portal URL is correct (e.g., http://your-server.com:8080/c/ or http://your-server.com:8080)
2. Your MAC address is activated with an active subscription on this portal.
3. The server allows Stalker MAG or M3U API connections.`,
          canUseDemo: true,
        });
      }
    }

    // Build categories list from real channels
    const catMap = new Map<string, string>();
    for (const c of channels) {
      if (!catMap.has(c.category_id)) {
        catMap.set(c.category_id, c.category_name);
      }
    }
    categories = Array.from(catMap.entries()).map(([category_id, category_name]) => ({
      category_id,
      category_name,
    }));

    // Generate full M3U content for download and copy
    const m3uContent = generateM3uContent(channels, cleanMac);

    return res.json({
      success: true,
      macAddress: cleanMac,
      portalUrl: inputUrl,
      authenticated,
      authMethod,
      totalChannels: channels.length,
      totalCategories: categories.length,
      categories,
      channels,
      m3uContent,
      downloadFilename: `playlist_${cleanMac.replace(/:/g, '')}.m3u`,
      serverInfo: {
        serverUrl: inputUrl,
        mac: cleanMac,
        protocol: inputUrl.startsWith('https') ? 'https' : 'http',
        time: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `MAC Portal authentication failed: ${err.message}`,
    });
  }
}
