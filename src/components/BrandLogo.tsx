import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textSize?: string;
}

/**
 * Official Brand Logo for Yaaro Ka Yaar Stream
 * Accurately reproduces the stylized dual-triangle geometric play icon with white & red triangles
 * on pure black background as provided by the user.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 36,
  showText = false,
  textSize = 'text-lg',
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Brand Icon (White & Red geometric play symbol on black) */}
      <div
        className="relative shrink-0 rounded-lg bg-black flex items-center justify-center border border-white/10 shadow-md shadow-black/60 overflow-hidden"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full p-1"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Top Triangle: Pure White */}
          <polygon
            points="34,14 34,39 58,26"
            fill="#FFFFFF"
          />

          {/* Diagonal Dividing Line: White Accent */}
          <line
            x1="26"
            y1="43"
            x2="65"
            y2="22.5"
            stroke="#FFFFFF"
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          {/* Bottom-Right Triangle: Vibrant Red */}
          <polygon
            points="39,39 64,25.5 64,54"
            fill="#E53935"
          />
        </svg>
      </div>

      {showText && (
        <span className={`${textSize} font-extrabold tracking-tight text-slate-900 whitespace-nowrap`}>
          Yaaro Ka Yaar Stream
        </span>
      )}
    </div>
  );
};

export const BrandLogoIcon: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => {
  return (
    <div
      className={`relative shrink-0 rounded-lg bg-black flex items-center justify-center border border-white/10 shadow-md shadow-black/60 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full p-0.5"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polygon points="34,14 34,39 58,26" fill="#FFFFFF" />
        <line x1="26" y1="43" x2="65" y2="22.5" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
        <polygon points="39,39 64,25.5 64,54" fill="#E53935" />
      </svg>
    </div>
  );
};
