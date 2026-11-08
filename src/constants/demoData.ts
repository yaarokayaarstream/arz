import { Category, StreamChannel } from '../types';

export const DEMO_CATEGORIES: Category[] = [
  { category_id: "1", category_name: "National & News" },
  { category_id: "2", category_name: "World News" },
  { category_id: "3", category_name: "Sports & Live Events" },
  { category_id: "4", category_name: "Movies & Cinema" },
  { category_id: "5", category_name: "Science & Nature" },
  { category_id: "6", category_name: "Music & Entertainment" }
];

export const DEMO_STREAMS: StreamChannel[] = [
  {
    num: 1,
    name: "9X Jalwa Live Music HD",
    stream_type: "live",
    stream_id: 101,
    stream_icon: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_9X_JALWA/images/LOGO_HD/image.png",
    category_id: "6",
    category_name: "Music & Entertainment",
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
    category_name: "National & News",
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
    category_name: "World News",
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
    category_name: "National & News",
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
    category_name: "Sports & Live Events",
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
    category_name: "Movies & Cinema",
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
    category_name: "Movies & Cinema",
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
    category_name: "Science & Nature",
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
    category_name: "Science & Nature",
    direct_source: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8",
    epg_channel_id: "apple.bipbop.fmp4",
    added: "1700000008",
    custom_sid: null
  }
];
