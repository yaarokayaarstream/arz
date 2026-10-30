import React, { useState, useMemo } from 'react';
import {
  Download,
  Tv,
  FolderDown,
  Network,
  Link2,
  ShieldCheck,
  Activity,
  CheckCircle2,
  Image as ImageIcon,
  Bell,
  MessageSquare,
  ChevronRight,
  Server,
  Sparkles,
  LayoutGrid,
  Layers,
  Search,
  Grid,
  Globe,
  ShieldAlert,
} from 'lucide-react';
import { StreamCredentials, UserInfo, ServerInfo, Language } from '../types';
import { t } from '../services/translations';
import { QuickToolsPairsGrid } from './QuickToolsPairsGrid';

export type DashboardActionType =
  | 'download'
  | 'channels'
  | 'range_generator'
  | 'link_master'
  | 'track_url'
  | 'url_shortener'
  | 'masking_url'
  | 'url_shield'
  | 'verifier'
  | 'image_to_url'
  | 'import_playlist'
  | 'mac_portal'
  | 'desktop_note'
  | 'feedback'
  | 'xtream_api';

interface ActionChoiceProps {
  credentials: StreamCredentials;
  userInfo: UserInfo | null;
  serverInfo: ServerInfo | null;
  onSelectAction: (action: DashboardActionType) => void;
  lang: Language;
  onSelectLang?: (lang: Language) => void;
}

export const ActionChoice: React.FC<ActionChoiceProps> = ({
  credentials,
  userInfo,
  serverInfo: _serverInfo,
  onSelectAction,
  lang,
  onSelectLang: _onSelectLang,
}) => {
  const isHindi = lang === 'hi';
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'streaming' | 'generator' | 'utilities'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [compactDensity, setCompactDensity] = useState<'compact' | 'normal'>('compact');

  const expDateFormatted = userInfo?.exp_date
    ? new Date(parseInt(userInfo.exp_date, 10) * 1000).toLocaleDateString()
    : null;

  // Complete list of all 11 dashboard tools with optimized, properly sized icons
  const allTools = [
    {
      id: 'xtream_api' as DashboardActionType,
      category: 'streaming',
      num: '0',
      title: isHindi ? 'Xtream Codes API' : 'Xtream Codes API',
      badge: 'Xtream API',
      desc: isHindi ? 'Xtream Codes API सर्वर क्रेडेंशियल्स दर्ज करें और चैनल व VOD एक्सेस करें।' : 'Connect via Xtream Codes API credentials (Server URL, User & Pass).',
      btnText: isHindi ? 'Xtream API' : 'Xtream API',
      icon: Server,
      iconBox: 'bg-indigo-50 border-indigo-200 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600',
      borderHover: 'hover:border-indigo-400 hover:shadow-indigo-500/10',
      badgeBg: 'bg-indigo-100/90 text-indigo-800 border-indigo-200',
      btnBg: 'bg-indigo-50 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white',
    },
    {
      id: 'download' as DashboardActionType,
      category: 'streaming',
      num: '1',
      title: isHindi ? 'डाउनलोड प्लेलिस्ट' : 'Download Playlist',
      badge: 'M3U / Plus',
      desc: isHindi ? 'EPG सहित M3U व M3U_PLUS फ़ाइलें तुरंत डाउनलोड करें।' : 'Export standard M3U or M3U_PLUS playlist files with EPG data.',
      btnText: isHindi ? 'डाउनलोड' : 'Download',
      icon: Download,
      iconBox: 'bg-indigo-50 border-indigo-200 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600',
      borderHover: 'hover:border-indigo-400 hover:shadow-indigo-500/10',
      badgeBg: 'bg-indigo-100/90 text-indigo-800 border-indigo-200',
      btnBg: 'bg-indigo-50 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white',
    },
    {
      id: 'channels' as DashboardActionType,
      category: 'streaming',
      num: '2',
      title: isHindi ? 'लाइव टीवी प्लेयर' : 'Live TV Player',
      badge: 'Live TV',
      desc: isHindi ? 'कैटेगरी के अनुसार टीवी चैनल्स देखें और प्लेयर में चलाएँ।' : 'Browse live channels by category and stream in player.',
      btnText: isHindi ? 'चैनल देखें' : 'View Channels',
      icon: Tv,
      iconBox: 'bg-emerald-50 border-emerald-200 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600',
      borderHover: 'hover:border-emerald-400 hover:shadow-emerald-500/10',
      badgeBg: 'bg-emerald-100/90 text-emerald-800 border-emerald-200',
      btnBg: 'bg-emerald-50 group-hover:bg-emerald-600 text-emerald-800 group-hover:text-white',
    },
    {
      id: 'import_playlist' as DashboardActionType,
      category: 'streaming',
      num: '3',
      title: isHindi ? 'प्लेलिस्ट इम्पोर्ट' : 'Import Playlist',
      badge: 'M3U8 Parser',
      desc: isHindi ? 'M3U लिंक लोड करें और सिंगल डाउनलोड पाएँ।' : 'Systematically extract streams from any M3U URL or file.',
      btnText: isHindi ? 'इम्पोर्ट' : 'Import',
      icon: FolderDown,
      iconBox: 'bg-blue-50 border-blue-200 text-blue-600 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600',
      borderHover: 'hover:border-blue-400 hover:shadow-blue-500/10',
      badgeBg: 'bg-blue-100/90 text-blue-800 border-blue-200',
      btnBg: 'bg-blue-50 group-hover:bg-blue-600 text-blue-700 group-hover:text-white',
    },
    {
      id: 'mac_portal' as DashboardActionType,
      category: 'streaming',
      num: '4',
      title: isHindi ? 'MAC URL पोर्टल' : 'MAC URL Stalker',
      badge: 'Stalker MAG',
      desc: isHindi ? 'MAC एड्रेस और पोर्टल URL से चैनल लोड करें।' : 'Authenticate with MAG / Stalker portal to export M3U.',
      btnText: isHindi ? 'MAC पोर्टल' : 'MAC Portal',
      icon: Network,
      iconBox: 'bg-violet-50 border-violet-200 text-violet-600 group-hover:bg-violet-600 group-hover:text-white group-hover:border-violet-600',
      borderHover: 'hover:border-violet-400 hover:shadow-violet-500/10',
      badgeBg: 'bg-violet-100/90 text-violet-800 border-violet-200',
      btnBg: 'bg-violet-50 group-hover:bg-violet-600 text-violet-700 group-hover:text-white',
    },
    {
      id: 'range_generator' as DashboardActionType,
      category: 'generator',
      num: '5',
      title: isHindi ? 'रेंज URL जनरेटर' : 'Range URL Gen',
      badge: 'Sequential',
      desc: isHindi ? 'संख्यात्मक बेस URL से सीक्वेंशियल M3U तैयार करें।' : 'Generate sequential M3U playlist from numeric URL ranges.',
      btnText: isHindi ? 'जनरेटर' : 'Generator',
      icon: Link2,
      iconBox: 'bg-sky-50 border-sky-200 text-sky-600 group-hover:bg-sky-600 group-hover:text-white group-hover:border-sky-600',
      borderHover: 'hover:border-sky-400 hover:shadow-sky-500/10',
      badgeBg: 'bg-sky-100/90 text-sky-800 border-sky-200',
      btnBg: 'bg-sky-50 group-hover:bg-sky-600 text-sky-700 group-hover:text-white',
    },
    {
      id: 'link_master' as DashboardActionType,
      category: 'generator',
      num: '6',
      title: isHindi ? 'लिंक मास्टर (मास्किंग)' : 'Link Master',
      badge: 'Protected',
      desc: isHindi ? 'क्रेडेंशियल्स को एन्क्रिप्टेड स्ट्रीम उपनामों से छिपाएँ।' : 'Mask real server credentials with encrypted temporary aliases.',
      btnText: isHindi ? 'लिंक मास्टर' : 'Link Master',
      icon: ShieldCheck,
      iconBox: 'bg-teal-50 border-teal-200 text-teal-600 group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600',
      borderHover: 'hover:border-teal-400 hover:shadow-teal-500/10',
      badgeBg: 'bg-teal-100/90 text-teal-800 border-teal-200',
      btnBg: 'bg-teal-50 group-hover:bg-teal-600 text-teal-800 group-hover:text-white',
    },
    {
      id: 'track_url' as DashboardActionType,
      category: 'generator',
      num: '6.5',
      title: isHindi ? 'Track URL एनालिटिक्स' : 'Track URL Analytics',
      badge: 'M3U Tracker',
      desc: isHindi ? 'M3U प्लेलिस्ट का ट्रैकेबल लिंक बनाएं, डिवाइस प्रकार और लाइव प्लेबैक स्टेट्स ट्रैक करें।' : 'Generate trackable M3U links, inspect device types and live playback statistics.',
      btnText: isHindi ? 'Track URL' : 'Track URL',
      icon: Activity,
      iconBox: 'bg-indigo-50 border-indigo-200 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600',
      borderHover: 'hover:border-indigo-400 hover:shadow-indigo-500/10',
      badgeBg: 'bg-indigo-100/90 text-indigo-800 border-indigo-200',
      btnBg: 'bg-indigo-50 group-hover:bg-indigo-600 text-indigo-800 group-hover:text-white',
    },
    {
      id: 'url_shortener' as DashboardActionType,
      category: 'generator',
      num: '7',
      title: isHindi ? 'URL to Short (is.gd)' : 'URL to Short (is.gd)',
      badge: 'is.gd API',
      desc: isHindi ? 'मूल URL डालें और तुरंत is.gd शॉर्ट लिंक जनरेट व 1-क्लिक कॉपी करें।' : 'Input any original URL to instantly generate and copy is.gd short links.',
      btnText: isHindi ? 'URL to Short' : 'URL to Short',
      icon: Link2,
      iconBox: 'bg-amber-50 border-amber-200 text-amber-600 group-hover:bg-amber-600 group-hover:text-white group-hover:border-amber-600',
      borderHover: 'hover:border-amber-400 hover:shadow-amber-500/10',
      badgeBg: 'bg-amber-100/90 text-amber-800 border-amber-200',
      btnBg: 'bg-amber-50 group-hover:bg-amber-600 text-amber-900 group-hover:text-white',
    },
    {
      id: 'masking_url' as DashboardActionType,
      category: 'generator',
      num: '8',
      title: isHindi ? 'मास्किंग URL (Yaaro ka Yaar)' : 'Masking URL (Yaaro ka Yaar)',
      badge: 'Yaaro ka Yaar',
      desc: isHindi ? 'ओरिजिनल लिंक छिपाकर सुरक्षित Yaaro ka Yaar मास्क्ड URL जनरेट करें।' : 'Generate a secure Yaaro ka Yaar masked URL, keeping original link hidden.',
      btnText: isHindi ? 'Yaaro ka Yaar मास्क' : 'Mask URL',
      icon: Globe,
      iconBox: 'bg-emerald-50 border-emerald-200 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600',
      borderHover: 'hover:border-emerald-400 hover:shadow-emerald-500/10',
      badgeBg: 'bg-emerald-100/90 text-emerald-800 border-emerald-200',
      btnBg: 'bg-emerald-50 group-hover:bg-emerald-600 text-emerald-800 group-hover:text-white',
    },
    {
      id: 'url_shield' as DashboardActionType,
      category: 'generator',
      num: '8.5',
      title: isHindi ? 'URL Shield (M3U Masker)' : 'URL Shield (M3U Masker)',
      badge: 'Yaaro Ka Yaar',
      desc: isHindi ? 'M3U प्लेलिस्ट अपलोड करें, सभी स्ट्रीम URLs को Yaaro Ka Yaar से मास्क करें और डाउनलोड करें।' : 'Upload M3U, cloak all stream URLs via Yaaro Ka Yaar & export shielded playlist.',
      btnText: isHindi ? 'शील्ड करें' : 'URL Shield',
      icon: ShieldAlert,
      iconBox: 'bg-rose-50 border-rose-200 text-rose-600 group-hover:bg-rose-600 group-hover:text-white group-hover:border-rose-600',
      borderHover: 'hover:border-rose-400 hover:shadow-rose-500/10',
      badgeBg: 'bg-rose-100/90 text-rose-800 border-rose-200',
      btnBg: 'bg-rose-50 group-hover:bg-rose-600 text-rose-800 group-hover:text-white',
    },
    {
      id: 'verifier' as DashboardActionType,
      category: 'utilities',
      num: '9',
      title: isHindi ? 'M3U वेरीफायर' : 'M3U Verifier',
      badge: 'Health Check',
      desc: isHindi ? 'स्ट्रीम्स जांचें और केवल एक्टिव चैनलों की M3U पाएं।' : 'Probe stream health concurrently and export active channels.',
      btnText: isHindi ? 'वेरीफायर' : 'Verifier',
      icon: CheckCircle2,
      iconBox: 'bg-rose-50 border-rose-200 text-rose-600 group-hover:bg-rose-600 group-hover:text-white group-hover:border-rose-600',
      borderHover: 'hover:border-rose-400 hover:shadow-rose-500/10',
      badgeBg: 'bg-rose-100/90 text-rose-800 border-rose-200',
      btnBg: 'bg-rose-50 group-hover:bg-rose-600 text-rose-800 group-hover:text-white',
    },
    {
      id: 'image_to_url' as DashboardActionType,
      category: 'utilities',
      num: '10',
      title: isHindi ? 'इमेज टू URL' : 'Image to URL',
      badge: 'Yaaro Ka Yaar',
      desc: isHindi ? 'इमेज अपलोड करें और तुरंत डायरेक्ट वेब लिंक पाएँ।' : 'Upload images to cloud & get direct shareable web links.',
      btnText: isHindi ? 'इमेज टू URL' : 'Image to URL',
      icon: ImageIcon,
      iconBox: 'bg-purple-50 border-purple-200 text-purple-600 group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-600',
      borderHover: 'hover:border-purple-400 hover:shadow-purple-500/10',
      badgeBg: 'bg-purple-100/90 text-purple-800 border-purple-200',
      btnBg: 'bg-purple-50 group-hover:bg-purple-600 text-purple-800 group-hover:text-white',
    },
    {
      id: 'desktop_note' as DashboardActionType,
      category: 'utilities',
      num: '11',
      title: isHindi ? 'लाइव नोटिफिकेशन' : 'Notifications',
      badge: 'Realtime Alert',
      desc: isHindi ? 'रियलटाइम ब्रॉडकास्ट संदेश और अलर्ट्स स्क्रीन।' : 'View live broadcasts and realtime alert screen.',
      btnText: isHindi ? 'नोटिफिकेशन' : 'Notifications',
      icon: Bell,
      iconBox: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-600 group-hover:bg-fuchsia-600 group-hover:text-white group-hover:border-fuchsia-600',
      borderHover: 'hover:border-fuchsia-400 hover:shadow-fuchsia-500/10',
      badgeBg: 'bg-fuchsia-100/90 text-fuchsia-800 border-fuchsia-200',
      btnBg: 'bg-fuchsia-50 group-hover:bg-fuchsia-600 text-fuchsia-800 group-hover:text-white',
    },
    {
      id: 'feedback' as DashboardActionType,
      category: 'utilities',
      num: '12',
      title: isHindi ? 'यूज़र फीडबैक' : 'User Feedback',
      badge: '5★ Rating',
      desc: isHindi ? 'प्रतिक्रिया या रेटिंग सीधे डेवलपर्स को भेजें।' : 'Submit rating and send feedback directly to developers.',
      btnText: isHindi ? 'फीडबैक' : 'Feedback',
      icon: MessageSquare,
      iconBox: 'bg-cyan-50 border-cyan-200 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-600',
      borderHover: 'hover:border-cyan-400 hover:shadow-cyan-500/10',
      badgeBg: 'bg-cyan-100/90 text-cyan-800 border-cyan-200',
      btnBg: 'bg-cyan-50 group-hover:bg-cyan-600 text-cyan-800 group-hover:text-white',
    },
  ];

  // Filter tools based on category pill & search query
  const filteredTools = useMemo(() => {
    return allTools.filter((tool) => {
      const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tool.title.toLowerCase().includes(q) ||
        tool.desc.toLowerCase().includes(q) ||
        tool.badge.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [allTools, selectedCategory, searchQuery]);

  return (
    <div className="max-w-[1600px] w-full mx-auto px-2.5 sm:px-5 lg:px-6 py-2.5 sm:py-3.5">
      {/* Top Dashboard Section: Status, User Details, Search & Filters */}
      <div className="w-full bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-2xs mb-3 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-[11px] font-bold shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>{t('stream_connected', lang)}</span>
              </span>

              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded-full text-indigo-700 text-[11px] font-bold">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span>{allTools.length} {isHindi ? 'टूल्स' : 'Tools'}</span>
              </span>

              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 ml-1">
                {isHindi ? 'डैशबोर्ड — सभी टूल्स' : 'Dashboard — All Tools'}
              </h1>
            </div>

            {/* Account Details Box & View Mode Toggle */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 flex items-center gap-2 text-xs shadow-2xs">
                <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Server className="w-3 h-3" />
                </div>
                <div className="text-[11px] truncate max-w-[130px]">
                  <span className="font-extrabold text-slate-800">{credentials.username || 'Demo User'}</span>
                  {expDateFormatted && (
                    <span className="text-slate-500 font-mono ml-1 hidden md:inline">({expDateFormatted})</span>
                  )}
                </div>
              </div>

              {/* Density Toggle (Compact vs Normal) */}
              <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
                <button
                  onClick={() => setCompactDensity('compact')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    compactDensity === 'compact' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Compact icons view"
                >
                  <Grid className="w-3 h-3" />
                  <span>{isHindi ? 'कॉम्पैक्ट' : 'Compact'}</span>
                </button>
                <button
                  onClick={() => setCompactDensity('normal')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    compactDensity === 'normal' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Standard cards view"
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span>{isHindi ? 'विस्तृत' : 'Cards'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter Pills & Live Search Bar */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {/* Category Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 shadow-2xs ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <LayoutGrid className="w-3 h-3" />
                <span>{isHindi ? 'सभी' : 'All'} ({allTools.length})</span>
              </button>

              <button
                onClick={() => setSelectedCategory('streaming')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 shadow-2xs ${
                  selectedCategory === 'streaming'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                <Tv className="w-3 h-3" />
                <span>{isHindi ? 'स्ट्रीमिंग' : 'Streaming'} (4)</span>
              </button>

              <button
                onClick={() => setSelectedCategory('generator')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 shadow-2xs ${
                  selectedCategory === 'generator'
                    ? 'bg-teal-600 text-white'
                    : 'bg-teal-50/80 text-teal-700 hover:bg-teal-100'
                }`}
              >
                <Link2 className="w-3 h-3" />
                <span>{isHindi ? 'जनरेटर' : 'Generators'} (4)</span>
              </button>

              <button
                onClick={() => setSelectedCategory('utilities')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 shadow-2xs ${
                  selectedCategory === 'utilities'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50/80 text-purple-700 hover:bg-purple-100'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>{isHindi ? 'यूटिलिटी' : 'Utilities'} (4)</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-52 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isHindi ? 'टूल खोजें...' : 'Search tools...'}
                className="w-full pl-8 pr-2.5 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800 placeholder-slate-400"
              />
            </div>
          </div>
        </div>

      {/* QUICK TOOLS Section: Full Horizontal Bar with 4 separate small boxes */}
      <div className="w-full mb-3">
        <QuickToolsPairsGrid
          lang={lang}
          onSelectAction={onSelectAction}
        />
      </div>

      {/* ALL DASHBOARD TOOLS GRID (6 Columns on desktop - Exactly 2 rows of 6 cards for all 12 tools) */}
      <div
        className={`grid gap-2 sm:gap-2.5 ${
          compactDensity === 'compact'
            ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6'
            : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6'
        }`}
      >
        {filteredTools.map((item) => {
          const IconComp = item.icon;
          return (
            <div
              key={item.id}
              onClick={() => onSelectAction(item.id)}
              className={`group bg-white hover:bg-slate-50/90 border border-slate-200/90 ${item.borderHover} rounded-xl p-2.5 sm:p-3 transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between active:scale-[0.98] select-none relative overflow-hidden`}
            >
              <div>
                {/* Header: Sized-Down Icon Container + Sleek Badge */}
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  {/* Smaller, Perfectly Proportioned Icon Box */}
                  <div
                    className={`w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl border flex items-center justify-center transition-all duration-150 shadow-2xs shrink-0 ${item.iconBox}`}
                  >
                    <IconComp className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 transition-transform duration-150 group-hover:scale-110" />
                  </div>

                  <span
                    className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border tracking-tight font-mono ${item.badgeBg}`}
                  >
                    {item.badge}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-xs sm:text-[13px] font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight mb-1 truncate">
                  {item.title}
                </h3>

                {/* Description (Concise 1-2 line) */}
                <p className="text-[10px] sm:text-[11px] text-slate-500 leading-snug line-clamp-2 min-h-[1.8rem]">
                  {item.desc}
                </p>
              </div>

              {/* Action Button */}
              <div className="mt-2 pt-1.5 border-t border-slate-100">
                <div
                  className={`w-full py-1 px-2 font-bold rounded-lg text-[10px] sm:text-[11px] flex items-center justify-between transition-colors shadow-2xs ${item.btnBg}`}
                >
                  <span className="truncate">{item.btnText}</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform shrink-0 ml-1" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTools.length === 0 && (
        <div className="p-6 text-center bg-white border border-slate-200 rounded-xl text-slate-500 text-xs">
          {isHindi ? 'कोई टूल नहीं मिला। कृपया खोज शब्द बदलें।' : 'No tools matched your search query. Try another keyword.'}
        </div>
      )}
    </div>
  );
};
