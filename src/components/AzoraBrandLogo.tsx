import React from 'react';

export interface AzoraSymbolProps {
  size?: number;
  variant?: 'primary' | 'android-icon' | 'simplified';
  className?: string;
  idPrefix?: string;
}

/**
 * AZORA Brand Symbol
 * Precision geometric monogram combining the letters 'A' (bold warm-cream ascending chevron)
 * and 'Z' (angled sky-blue & lavender prism crossbar) inside an elongated four-point celestial star.
 *
 * Palette:
 * - Soft Mint Green: #75D9B4
 * - Turquoise:       #42BDAE
 * - Sky Blue:        #69B7EC
 * - Subtle Lavender: #B8A4EF
 * - Warm Cream:      #FBF7EF
 * - Deep Muted Teal: #1B4D48
 */
export const AzoraSymbol: React.FC<AzoraSymbolProps> = ({
  size = 64,
  variant = 'primary',
  className = '',
  idPrefix = 'azora',
}) => {
  const starGradId = `${idPrefix}-star-grad-${variant}`;
  const zBarGradId = `${idPrefix}-zbar-grad-${variant}`;
  const aChevronGradId = `${idPrefix}-achev-grad-${variant}`;

  // Core star & monogram paths shared with mathematical consistency across all variants
  const starOuterPath =
    'M 268 42 C 276 154 292 178 468 126 C 334 232 302 268 248 468 C 234 340 212 312 46 328 C 194 248 224 212 268 42 Z';
  const aChevronPath =
    'M 250 144 L 320 262 L 280 296 L 248 232 L 204 316 L 154 320 L 250 144 Z';
  const zPrismPath = 'M 244 294 L 326 218 L 368 252 L 286 328 Z';

  if (variant === 'simplified') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        role="img"
        aria-label="AZORA simplified celestial star symbol"
      >
        <defs>
          <linearGradient id={starGradId} x1="90" y1="70" x2="410" y2="440" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#75D9B4" />
            <stop offset="42%" stopColor="#42BDAE" />
            <stop offset="80%" stopColor="#69B7EC" />
            <stop offset="100%" stopColor="#B8A4EF" />
          </linearGradient>
          <linearGradient id={zBarGradId} x1="244" y1="218" x2="368" y2="328" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8ED8F8" />
            <stop offset="55%" stopColor="#69B7EC" />
            <stop offset="100%" stopColor="#B8A4EF" />
          </linearGradient>
        </defs>

        {/* Elongated 4-Point Celestial Star Silhouette */}
        <path d={starOuterPath} fill={`url(#${starGradId})`} />

        {/* Bold Negative-Space 'A' Chevron */}
        <path d={aChevronPath} fill="#FBF7EF" />

        {/* Angled 'Z' & 'A-Crossbar' Geometric Ribbon */}
        <path d={zPrismPath} fill={`url(#${zBarGradId})`} />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={
        variant === 'android-icon'
          ? 'AZORA standalone square Android app icon'
          : 'AZORA celestial star monogram symbol'
      }
    >
      <defs>
        <linearGradient id={starGradId} x1="84" y1="64" x2="416" y2="448" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#75D9B4" />
          <stop offset="38%" stopColor="#42BDAE" />
          <stop offset="76%" stopColor="#69B7EC" />
          <stop offset="100%" stopColor="#B8A4EF" />
        </linearGradient>
        <linearGradient id={zBarGradId} x1="244" y1="218" x2="368" y2="328" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9BE2F8" />
          <stop offset="50%" stopColor="#69B7EC" />
          <stop offset="100%" stopColor="#B8A4EF" />
        </linearGradient>
        <linearGradient id={aChevronGradId} x1="190" y1="144" x2="290" y2="320" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBF7EF" />
          <stop offset="100%" stopColor="#F6F1E5" />
        </linearGradient>
      </defs>

      {/* Square Softly Rounded Warm Cream Container for Standalone Android App Icon */}
      {variant === 'android-icon' && (
        <>
          <rect
            x="16"
            y="16"
            width="480"
            height="480"
            rx="112"
            fill="#FBF7EF"
            stroke="#E5DEC9"
            strokeWidth="4"
          />
          <rect
            x="28"
            y="28"
            width="456"
            height="456"
            rx="100"
            stroke="#F3EDE0"
            strokeWidth="2"
          />
        </>
      )}

      <g transform={variant === 'android-icon' ? 'translate(26, 26) scale(0.9)' : undefined}>
        {/* Primary Elongated Four-Point Celestial Star Silhouette */}
        <path d={starOuterPath} fill={`url(#${starGradId})`} />

        {/* Subtle Luminous Mint Facet along Upper Zenith Point */}
        <path
          d="M 268 42 C 276 154 292 178 468 126 L 256 238 Z"
          fill="#75D9B4"
          fillOpacity="0.16"
        />

        {/* Bold Negative-Space 'A' Ascending Chevron */}
        <path d={aChevronPath} fill={`url(#${aChevronGradId})`} />

        {/* Precision 'Z' Diagonal & 'A' Crossbar Geometric Prism */}
        <path d={zPrismPath} fill={`url(#${zBarGradId})`} />
      </g>
    </svg>
  );
};

export interface AzoraPrimaryLogoProps {
  layout?: 'horizontal' | 'centered';
  symbolSize?: number;
  showTagline?: boolean;
  className?: string;
  idPrefix?: string;
}

/**
 * Primary Horizontal or Centered Logo featuring the Symbol and AZORA Wordmark
 */
export const AzoraPrimaryLogo: React.FC<AzoraPrimaryLogoProps> = ({
  layout = 'horizontal',
  symbolSize = 40,
  showTagline = false,
  className = '',
  idPrefix = 'azora-primary',
}) => {
  if (layout === 'centered') {
    return (
      <div className={`inline-flex flex-col items-center select-none ${className}`}>
        <AzoraSymbol size={symbolSize} variant="primary" idPrefix={idPrefix} />
        <span
          className="mt-4 font-bold uppercase text-[#1B4D48]"
          style={{
            fontSize: `${Math.max(18, Math.round(symbolSize * 0.31))}px`,
            letterSpacing: '0.32em',
            marginRight: '-0.32em',
            lineHeight: 1.1,
          }}
        >
          AZORA
        </span>
        {showTagline && (
          <span
            className="mt-2.5 font-medium uppercase text-[#4A6B66]"
            style={{
              fontSize: `${Math.max(10, Math.round(symbolSize * 0.1))}px`,
              letterSpacing: '0.28em',
              marginRight: '-0.28em',
            }}
          >
            LEARN · GROW · ACHIEVE
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <AzoraSymbol size={symbolSize} variant="primary" idPrefix={idPrefix} />
      <div className="flex flex-col">
        <span
          className="font-bold uppercase text-[#1B4D48] leading-none"
          style={{
            fontSize: `${Math.max(17, Math.round(symbolSize * 0.48))}px`,
            letterSpacing: '0.26em',
          }}
        >
          AZORA
        </span>
        {showTagline && (
          <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#4A6B66] mt-1">
            LEARN · GROW · ACHIEVE
          </span>
        )}
      </div>
    </div>
  );
};
