import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown, X } from 'lucide-react';
import { Language } from '../types';
import { SUPPORTED_LANGUAGES, t } from '../services/translations';

interface LanguageSelectorProps {
  currentLang: Language;
  onSelectLang: (lang: Language) => void;
  variant?: 'header' | 'button' | 'inline';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLang,
  onSelectLang,
  variant = 'header',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeOption =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (code: Language) => {
    onSelectLang(code);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Trigger Button - Shows the active language prominently */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-2xs shrink-0 active:scale-[0.98] border ${
          isOpen
            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-indigo-200'
            : 'bg-white hover:bg-slate-50 border-slate-200/90 hover:border-indigo-300 text-slate-800 hover:text-indigo-700'
        }`}
        title={`${t('change_lang', currentLang)} (${activeOption.nativeName})`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Globe className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
        {/* Prominent selected language name */}
        <span className="font-extrabold text-slate-900 tracking-wide text-xs">
          {activeOption.nativeName}
        </span>
        <span className="text-[10px] text-indigo-600 bg-indigo-50 font-mono font-bold px-1.5 py-0.5 rounded-md border border-indigo-100 hidden xs:inline">
          {activeOption.shortCode}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {/* Floating Language Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          role="listbox"
        >
          {/* Header of Dropdown */}
          <div className="p-3 bg-gradient-to-r from-indigo-50/90 to-purple-50/90 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
              <Globe className="w-4 h-4 text-indigo-600" />
              <span>{t('select_lang', currentLang)} / Select Language</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/80 transition-colors cursor-pointer"
              aria-label="Close language selector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List of 10 Indian Regional Languages */}
          <div className="max-h-80 overflow-y-auto p-1.5 space-y-1 divide-y divide-slate-50">
            {SUPPORTED_LANGUAGES.map((item) => {
              const isSelected = item.code === currentLang;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleSelect(item.code)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                      : 'text-slate-700 hover:bg-indigo-50/60 hover:text-indigo-900'
                  }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-mono font-extrabold shrink-0 border ${
                        isSelected
                          ? 'bg-white/20 text-white border-white/30'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {item.shortCode}
                    </span>
                    <div className="flex flex-col truncate">
                      <span
                        className={`font-extrabold text-xs leading-tight ${
                          isSelected ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {item.nativeName}
                      </span>
                      <span
                        className={`text-[11px] leading-tight ${
                          isSelected ? 'text-indigo-100' : 'text-slate-500'
                        }`}
                      >
                        {item.name}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-white text-indigo-600 flex items-center justify-center shrink-0 shadow-2xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 text-center font-medium">
            10 Languages Supported · 10 ਭਾਸ਼ਾਵਾਂ · 10টি ভাষা · ୧୦ଟି ଭାଷା
          </div>
        </div>
      )}
    </div>
  );
};
