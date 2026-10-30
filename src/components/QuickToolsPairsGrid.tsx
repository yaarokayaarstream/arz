import React, { useState } from 'react';
import {
  Server,
  CheckCircle2,
  Link2,
  Globe,
  FolderDown,
  ShieldCheck,
  Network,
  Image as ImageIcon,
  Sparkles,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  Bell,
  Palette,
} from 'lucide-react';
import { DashboardActionType } from './ActionChoice';
import { Language } from '../types';

interface QuickToolsPairsGridProps {
  lang: Language;
  onSelectAction: (action: DashboardActionType) => void;
  className?: string;
}

interface ToolboxTheme {
  name: string;
  // Subtle, very light background shading for the entire toolbox
  boxBg: string;
  boxBorder: string;
  boxHover: string;
  boxShadowHover: string;
  // Header styles
  headerBorder: string;
  titleColor: string;
  badgeClass: string;
  indicatorDot: string;
  // Inner tool button styles
  buttonBg: string;
  buttonBorder: string;
  buttonHoverBorder: string;
  textHover: string;
  chevronColor: string;
}

// 6 cohesive minimal color themes corresponding to each toolbox's dominant icon hues
const THEMES: Record<string, ToolboxTheme> = {
  indigo: {
    name: 'indigo',
    boxBg: 'bg-gradient-to-b from-indigo-50/75 via-indigo-50/35 to-indigo-50/15',
    boxBorder: 'border-indigo-200/70',
    boxHover: 'hover:border-indigo-300 hover:from-indigo-50/90 hover:via-indigo-50/45',
    boxShadowHover: 'hover:shadow-indigo-500/10',
    headerBorder: 'border-indigo-200/60',
    titleColor: 'text-indigo-950',
    badgeClass: 'bg-indigo-100/80 text-indigo-700 border-indigo-200/90',
    indicatorDot: 'bg-indigo-500',
    buttonBg: 'bg-white/95 hover:bg-white',
    buttonBorder: 'border-indigo-100/90',
    buttonHoverBorder: 'hover:border-indigo-300',
    textHover: 'group-hover:text-indigo-700',
    chevronColor: 'text-indigo-300 group-hover:text-indigo-600',
  },
  emerald: {
    name: 'emerald',
    boxBg: 'bg-gradient-to-b from-emerald-50/75 via-emerald-50/35 to-emerald-50/15',
    boxBorder: 'border-emerald-200/70',
    boxHover: 'hover:border-emerald-300 hover:from-emerald-50/90 hover:via-emerald-50/45',
    boxShadowHover: 'hover:shadow-emerald-500/10',
    headerBorder: 'border-emerald-200/60',
    titleColor: 'text-emerald-950',
    badgeClass: 'bg-emerald-100/80 text-emerald-800 border-emerald-200/90',
    indicatorDot: 'bg-emerald-500',
    buttonBg: 'bg-white/95 hover:bg-white',
    buttonBorder: 'border-emerald-100/90',
    buttonHoverBorder: 'hover:border-emerald-300',
    textHover: 'group-hover:text-emerald-700',
    chevronColor: 'text-emerald-300 group-hover:text-emerald-600',
  },
  amber: {
    name: 'amber',
    boxBg: 'bg-gradient-to-b from-amber-50/75 via-amber-50/35 to-amber-50/15',
    boxBorder: 'border-amber-200/70',
    boxHover: 'hover:border-amber-300 hover:from-amber-50/90 hover:via-amber-50/45',
    boxShadowHover: 'hover:shadow-amber-500/10',
    headerBorder: 'border-amber-200/60',
    titleColor: 'text-amber-950',
    badgeClass: 'bg-amber-100/80 text-amber-800 border-amber-200/90',
    indicatorDot: 'bg-amber-500',
    buttonBg: 'bg-white/95 hover:bg-white',
    buttonBorder: 'border-amber-100/90',
    buttonHoverBorder: 'hover:border-amber-300',
    textHover: 'group-hover:text-amber-700',
    chevronColor: 'text-amber-300 group-hover:text-amber-600',
  },
  sky: {
    name: 'sky',
    boxBg: 'bg-gradient-to-b from-sky-50/75 via-sky-50/35 to-sky-50/15',
    boxBorder: 'border-sky-200/70',
    boxHover: 'hover:border-sky-300 hover:from-sky-50/90 hover:via-sky-50/45',
    boxShadowHover: 'hover:shadow-sky-500/10',
    headerBorder: 'border-sky-200/60',
    titleColor: 'text-sky-950',
    badgeClass: 'bg-sky-100/80 text-sky-800 border-sky-200/90',
    indicatorDot: 'bg-sky-500',
    buttonBg: 'bg-white/95 hover:bg-white',
    buttonBorder: 'border-sky-100/90',
    buttonHoverBorder: 'hover:border-sky-300',
    textHover: 'group-hover:text-sky-700',
    chevronColor: 'text-sky-300 group-hover:text-sky-600',
  },
  rose: {
    name: 'rose',
    boxBg: 'bg-gradient-to-b from-rose-50/75 via-rose-50/35 to-rose-50/15',
    boxBorder: 'border-rose-200/70',
    boxHover: 'hover:border-rose-300 hover:from-rose-50/90 hover:via-rose-50/45',
    boxShadowHover: 'hover:shadow-rose-500/10',
    headerBorder: 'border-rose-200/60',
    titleColor: 'text-rose-950',
    badgeClass: 'bg-rose-100/80 text-rose-800 border-rose-200/90',
    indicatorDot: 'bg-rose-500',
    buttonBg: 'bg-white/95 hover:bg-white',
    buttonBorder: 'border-rose-100/90',
    buttonHoverBorder: 'hover:border-rose-300',
    textHover: 'group-hover:text-rose-700',
    chevronColor: 'text-rose-300 group-hover:text-rose-600',
  },
  purple: {
    name: 'purple',
    boxBg: 'bg-gradient-to-b from-purple-50/75 via-purple-50/35 to-purple-50/15',
    boxBorder: 'border-purple-200/70',
    boxHover: 'hover:border-purple-300 hover:from-purple-50/90 hover:via-purple-50/45',
    boxShadowHover: 'hover:shadow-purple-500/10',
    headerBorder: 'border-purple-200/60',
    titleColor: 'text-purple-950',
    badgeClass: 'bg-purple-100/80 text-purple-800 border-purple-200/90',
    indicatorDot: 'bg-purple-500',
    buttonBg: 'bg-white/95 hover:bg-white',
    buttonBorder: 'border-purple-100/90',
    buttonHoverBorder: 'hover:border-purple-300',
    textHover: 'group-hover:text-purple-700',
    chevronColor: 'text-purple-300 group-hover:text-purple-600',
  },
};

const DEFAULT_THEME_KEYS = ['indigo', 'emerald', 'amber', 'sky', 'rose', 'purple'];

export const QuickToolsPairsGrid: React.FC<QuickToolsPairsGridProps> = ({
  lang,
  onSelectAction,
  className = '',
}) => {
  const isHindi = lang === 'hi';

  // Theme rotation offset if user triggers reshuffle
  const [themeOffset, setThemeOffset] = useState<number>(0);

  const handleReshuffleColors = (e: React.MouseEvent) => {
    e.stopPropagation();
    setThemeOffset((prev) => (prev + 1) % DEFAULT_THEME_KEYS.length);
  };

  // 6 distinct small boxes, each containing two tools with matching color codes
  const toolBoxes = [
    {
      id: 'box_1',
      num: '01',
      label: isHindi ? 'IPTV प्रोटोकॉल्स' : 'IPTV Protocols',
      baseThemeIndex: 0,
      tools: [
        {
          id: 'xtream_api' as DashboardActionType,
          title: 'Xtream Codes API',
          icon: Server,
          iconBoxClass:
            'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-xs shadow-indigo-500/25 border-indigo-400/50',
        },
        {
          id: 'mac_portal' as DashboardActionType,
          title: 'MAC URL',
          icon: Network,
          iconBoxClass:
            'bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-xs shadow-indigo-600/25 border-indigo-500/50',
        },
      ],
    },
    {
      id: 'box_2',
      num: '02',
      label: isHindi ? 'शील्ड & मास्किंग' : 'Shield & Mask',
      baseThemeIndex: 1,
      tools: [
        {
          id: 'url_shield' as DashboardActionType,
          title: 'URL Shield',
          icon: ShieldAlert,
          iconBoxClass:
            'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs shadow-emerald-500/25 border-emerald-400/50',
        },
        {
          id: 'masking_url' as DashboardActionType,
          title: 'Masking URL',
          icon: Globe,
          iconBoxClass:
            'bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-xs shadow-teal-500/25 border-teal-400/50',
        },
      ],
    },
    {
      id: 'box_3',
      num: '03',
      label: isHindi ? 'वेरीफाई & शॉर्ट' : 'Verify & Short',
      baseThemeIndex: 2,
      tools: [
        {
          id: 'verifier' as DashboardActionType,
          title: 'Verify M3U',
          icon: CheckCircle2,
          iconBoxClass:
            'bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 shadow-xs shadow-amber-500/25 border-amber-300/60',
        },
        {
          id: 'url_shortener' as DashboardActionType,
          title: 'URL to Short',
          icon: Link2,
          iconBoxClass:
            'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-xs shadow-amber-500/25 border-amber-400/50',
        },
      ],
    },
    {
      id: 'box_4',
      num: '04',
      label: isHindi ? 'प्लेलिस्ट & मास्टर' : 'Playlist & Master',
      baseThemeIndex: 3,
      tools: [
        {
          id: 'import_playlist' as DashboardActionType,
          title: 'Import Playlist',
          icon: FolderDown,
          iconBoxClass:
            'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-xs shadow-sky-500/25 border-sky-400/50',
        },
        {
          id: 'link_master' as DashboardActionType,
          title: 'Link Master',
          icon: ShieldCheck,
          iconBoxClass:
            'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xs shadow-blue-500/25 border-blue-400/50',
        },
      ],
    },
    {
      id: 'box_5',
      num: '05',
      label: isHindi ? 'रेंज & ट्रैकिंग' : 'Range & Track',
      baseThemeIndex: 4,
      tools: [
        {
          id: 'range_generator' as DashboardActionType,
          title: 'Range URL',
          icon: Link2,
          iconBoxClass:
            'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-xs shadow-rose-500/25 border-rose-400/50',
        },
        {
          id: 'track_url' as DashboardActionType,
          title: 'Track URL',
          icon: Globe,
          iconBoxClass:
            'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-xs shadow-rose-500/25 border-rose-400/50',
        },
      ],
    },
    {
      id: 'box_6',
      num: '06',
      label: isHindi ? 'इमेज & अलर्ट' : 'Image & Alert',
      baseThemeIndex: 5,
      tools: [
        {
          id: 'image_to_url' as DashboardActionType,
          title: 'Image to URL',
          icon: ImageIcon,
          iconBoxClass:
            'bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white shadow-xs shadow-purple-500/25 border-purple-400/50',
        },
        {
          id: 'desktop_note' as DashboardActionType,
          title: isHindi ? 'नोटिफिकेशन' : 'Notifications',
          icon: Bell,
          iconBoxClass:
            'bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white shadow-xs shadow-fuchsia-500/25 border-fuchsia-400/50',
        },
      ],
    },
  ];

  return (
    <div
      className={`bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-2xs hover:shadow-xs transition-all ${className}`}
    >
      {/* Horizontal Bar Header: Title, Boxes Info, and Minimal Palette Indicator */}
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100 px-1">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shrink-0">
            <Sparkles className="w-3 h-3 text-indigo-600" />
          </div>
          <h3 className="text-xs sm:text-[13px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <span>QUICK TOOLS</span>
          </h3>
          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-full hidden sm:inline-block">
            {isHindi ? '6 छोटे बॉक्स · कलर-कोडेड' : '6 Mini Boxes · Color Coded'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handleReshuffleColors}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] sm:text-[11px] font-bold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95 select-none"
            title={isHindi ? 'कलर थीम रोटेट करें' : 'Rotate Color Themes'}
          >
            <RefreshCw className="w-3 h-3 text-indigo-500" />
            <span>{isHindi ? 'रोटेट रंग' : 'Rotate'}</span>
          </button>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-md flex items-center gap-1">
            <Palette className="w-3 h-3 text-emerald-600" />
            <span>{isHindi ? 'सटल शेडिंग' : 'Subtle Tinted'}</span>
          </span>
        </div>
      </div>

      {/* Horizontal Bar: 6 separate color-coded small boxes arranged side-by-side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
        {toolBoxes.map((box) => {
          const themeKey = DEFAULT_THEME_KEYS[(box.baseThemeIndex + themeOffset) % DEFAULT_THEME_KEYS.length];
          const theme = THEMES[themeKey] || THEMES.indigo;

          return (
            <div
              key={box.id}
              className={`${theme.boxBg} border ${theme.boxBorder} ${theme.boxHover} ${theme.boxShadowHover} rounded-xl p-2 sm:p-2.5 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between`}
            >
              {/* Box Header Badge */}
              <div className={`flex items-center justify-between mb-1.5 pb-1 border-b ${theme.headerBorder} px-0.5`}>
                <span className={`text-[10px] font-black uppercase tracking-wider ${theme.titleColor} flex items-center gap-1 truncate`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${theme.indicatorDot} shrink-0`} />
                  {box.label}
                </span>
                <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${theme.badgeClass} shrink-0`}>
                  Box {box.num}
                </span>
              </div>

              {/* The Two Tools in this color-coded toolbox */}
              <div className="flex flex-col gap-1.5">
                {box.tools.map((tool) => {
                  const IconComp = tool.icon;

                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => onSelectAction(tool.id)}
                      className={`group flex items-center justify-between gap-1.5 p-1.5 ${theme.buttonBg} border ${theme.buttonBorder} ${theme.buttonHoverBorder} rounded-lg transition-all duration-150 cursor-pointer shadow-2xs active:scale-[0.97] text-left select-none`}
                      title={tool.title}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${tool.iconBoxClass}`}
                        >
                          <IconComp className="w-3.5 h-3.5 shrink-0" />
                        </div>
                        <span
                          className={`text-[11px] font-bold text-slate-800 ${theme.textHover} transition-colors truncate`}
                        >
                          {tool.title}
                        </span>
                      </div>
                      <ChevronRight className={`w-3 h-3 ${theme.chevronColor} transition-transform group-hover:translate-x-0.5 shrink-0`} />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
