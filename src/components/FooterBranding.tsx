import React from 'react';
import { BrandLogoIcon } from './BrandLogo';
import { Sparkles, Radio } from 'lucide-react';

interface FooterBrandingProps {
  className?: string;
  onClick?: () => void;
}

export const FooterBranding: React.FC<FooterBrandingProps> = ({ className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`group relative inline-flex items-center gap-3 px-3.5 py-1.5 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all duration-300 select-none cursor-pointer active:scale-[0.98] ${className}`}
      title="Yaaro Ka Yaar Stream — Click to share feedback / rate app"
    >
      {/* Ambient Pulsing Aura Glow Behind Logo */}
      <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-rose-500/20 via-indigo-500/20 to-amber-500/20 opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-300 -z-10" />

      {/* Brand Icon with Gentle Hover Spin Accent */}
      <div className="relative">
        <BrandLogoIcon size={19} className="group-hover:scale-105 transition-transform duration-200" />
        <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
      </div>

      {/* Brand Typography with Animated Gradient Shimmer */}
      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1">
          <span className="text-[11px] sm:text-xs font-bold tracking-tight bg-gradient-to-r from-rose-600 via-indigo-600 to-amber-500 animate-brand-shimmer text-transparent bg-clip-text whitespace-nowrap">
            Yaaro Ka Yaar Stream
          </span>
          <Sparkles className="w-2.5 h-2.5 text-amber-500 opacity-80 group-hover:rotate-12 transition-transform duration-300 shrink-0" />
        </div>
        <div className="flex items-center gap-1 text-[8px] font-semibold text-slate-500 tracking-wider uppercase font-mono">
          <span className="text-rose-600 font-bold">IPTV HUB</span>
          <span className="text-slate-300">·</span>
          <span>Ultra-HD Stream</span>
        </div>
      </div>

      {/* Modern Live Soundwave / Signal Frequency Equalizer Animation */}
      <div className="flex items-end gap-0.5 h-4 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 shrink-0">
        <span className="w-0.5 bg-rose-500 rounded-full animate-wave-1" />
        <span className="w-0.5 bg-indigo-500 rounded-full animate-wave-2" />
        <span className="w-0.5 bg-cyan-500 rounded-full animate-wave-3" />
        <span className="w-0.5 bg-amber-500 rounded-full animate-wave-4" />
      </div>

      {/* Live Badge */}
      <div className="hidden xs:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[9px] font-bold text-emerald-700 font-mono">
        <Radio className="w-2.5 h-2.5 text-emerald-600 animate-pulse shrink-0" />
        <span>LIVE</span>
      </div>
    </div>
  );
};
