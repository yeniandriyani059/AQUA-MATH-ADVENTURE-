import React from 'react';
import { CharacterId, MedalTier } from '../types/game';
import {
  BIMA_REF_IMAGE_PATH,
  SINTA_REF_IMAGE_PATH,
} from '../utils/characterCutout';

export const AquaLogoSvg: React.FC<{ className?: string; compact?: boolean }> = ({
  className = '',
  compact = false,
}) => {
  if (compact) {
    return (
      <svg
        viewBox="0 0 320 68"
        className={`select-none ${className}`}
        role="img"
        aria-label="AQUA MATH ADVENTURE - SAVE AQUA CITY!"
      >
        <defs>
          <linearGradient id="aquaCrestGradCompact" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
          <linearGradient id="goldBadgeGradCompact" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
        </defs>
        {/* Shield Base */}
        <rect
          x="4"
          y="4"
          width="312"
          height="60"
          rx="18"
          fill="#082f49"
          stroke="#38bdf8"
          strokeWidth="3"
        />
        {/* Water Drop Emblem */}
        <path
          d="M34 14 C34 14 20 30 20 40 C20 48 26.2 54 34 54 C41.8 54 48 48 48 40 C48 30 34 14 34 14 Z"
          fill="url(#aquaCrestGradCompact)"
          stroke="#fde047"
          strokeWidth="2.5"
        />
        <circle cx="29" cy="37" r="3" fill="#ffffff" />
        {/* Title Text */}
        <text
          x="60"
          y="33"
          fill="#ffffff"
          fontFamily="'Fredoka', sans-serif"
          fontWeight="700"
          fontSize="20"
          letterSpacing="0.5"
        >
          AQUA MATH ADVENTURE
        </text>
        <text
          x="60"
          y="52"
          fill="url(#goldBadgeGradCompact)"
          fontFamily="'Fredoka', sans-serif"
          fontWeight="700"
          fontSize="13.5"
          letterSpacing="1.5"
        >
          SAVE AQUA CITY!
        </text>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 640 212"
      className={`select-none ${className}`}
      role="img"
      aria-label="AQUA MATH ADVENTURE - SAVE AQUA CITY!"
    >
      <defs>
        <linearGradient id="aquaShieldBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="60%" stopColor="#0369a1" />
          <stop offset="100%" stopColor="#082f49" />
        </linearGradient>
        <linearGradient id="goldRibbon" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
        <linearGradient id="cyanDrop" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>

      {/* Outer Golden Crest Frame */}
      <rect
        x="24"
        y="22"
        width="592"
        height="148"
        rx="36"
        fill="url(#aquaShieldBg)"
        stroke="#facc15"
        strokeWidth="6"
      />
      <rect
        x="34"
        y="32"
        width="572"
        height="128"
        rx="28"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="2.5"
        strokeDasharray="10 6"
      />

      {/* Top Small Identity Crest: 3D EDUCATIONAL ADVENTURE */}
      <rect
        x="170"
        y="6"
        width="300"
        height="26"
        rx="13"
        fill="#082f49"
        stroke="#38bdf8"
        strokeWidth="2.5"
      />
      <text
        x="320"
        y="23"
        textAnchor="middle"
        fill="#bae6fd"
        fontFamily="'Plus Jakarta Sans', sans-serif"
        fontWeight="800"
        fontSize="11.5"
        letterSpacing="2"
      >
        3D EDUCATIONAL ADVENTURE
      </text>

      {/* Left Water Drop + Plus/Minus Math Symbols */}
      <g transform="translate(52, 46)">
        <path
          d="M36 6 C36 6 10 38 10 58 C10 73 21.5 85 36 85 C50.5 85 62 73 62 58 C62 38 36 6 36 6 Z"
          fill="url(#cyanDrop)"
          stroke="#ffffff"
          strokeWidth="3.5"
        />
        <circle cx="27" cy="52" r="5" fill="#ffffff" opacity="0.85" />
        <text
          x="36"
          y="67"
          textAnchor="middle"
          fill="#fef08a"
          fontFamily="'Fredoka', sans-serif"
          fontWeight="700"
          fontSize="26"
        >
          +
        </text>
      </g>

      {/* Right Water Drop + Multiply/Divide Math Symbols */}
      <g transform="translate(516, 46)">
        <path
          d="M36 6 C36 6 10 38 10 58 C10 73 21.5 85 36 85 C50.5 85 62 73 62 58 C62 38 36 6 36 6 Z"
          fill="url(#cyanDrop)"
          stroke="#ffffff"
          strokeWidth="3.5"
        />
        <circle cx="27" cy="52" r="5" fill="#ffffff" opacity="0.85" />
        <text
          x="36"
          y="67"
          textAnchor="middle"
          fill="#fef08a"
          fontFamily="'Fredoka', sans-serif"
          fontWeight="700"
          fontSize="24"
        >
          ×÷
        </text>
      </g>

      {/* Main Title Typography: AQUA MATH ADVENTURE */}
      <text
        x="320"
        y="84"
        textAnchor="middle"
        fill="#ffffff"
        stroke="#082f49"
        strokeWidth="8"
        paintOrder="stroke fill"
        fontFamily="'Fredoka', sans-serif"
        fontWeight="700"
        fontSize="40"
        letterSpacing="1.5"
      >
        AQUA MATH
      </text>
      <text
        x="320"
        y="126"
        textAnchor="middle"
        fill="#67e8f9"
        stroke="#082f49"
        strokeWidth="8"
        paintOrder="stroke fill"
        fontFamily="'Fredoka', sans-serif"
        fontWeight="700"
        fontSize="36"
        letterSpacing="3"
      >
        ADVENTURE
      </text>

      {/* Bottom Golden Tagline Banner: SAVE AQUA CITY! */}
      <rect
        x="150"
        y="144"
        width="340"
        height="46"
        rx="23"
        fill="url(#goldRibbon)"
        stroke="#082f49"
        strokeWidth="4"
      />
      <text
        x="320"
        y="174"
        textAnchor="middle"
        fill="#082f49"
        fontFamily="'Fredoka', sans-serif"
        fontWeight="700"
        fontSize="22"
        letterSpacing="2"
      >
        SAVE AQUA CITY!
      </text>
    </svg>
  );
};

export const CharacterAvatarSvg: React.FC<{
  characterId: CharacterId;
  className?: string;
}> = ({ characterId, className = 'w-14 h-14' }) => {
  if (characterId === 'bima' || characterId === 'sinta') {
    const imgSrc = characterId === 'sinta' ? SINTA_REF_IMAGE_PATH : BIMA_REF_IMAGE_PATH;
    const borderColor = characterId === 'sinta' ? 'border-cyan-300' : 'border-yellow-400';
    return (
      <div
        className={`relative rounded-full overflow-hidden bg-gradient-to-b from-sky-300 to-sky-700 border-2 ${borderColor} shadow-md select-none ${className}`}
      >
        <img
          src={imgSrc}
          alt={characterId === 'sinta' ? 'Sinta' : 'Bima'}
          className="w-full h-full object-cover object-top scale-125 translate-y-1"
          draggable={false}
        />
      </div>
    );
  }

  // Kirana (Cute Chibi Girl with Pigtails & Golden Headband)
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
      <circle cx="40" cy="40" r="37" fill="#083344" stroke="#38bdf8" strokeWidth="3" />
      <circle cx="19" cy="42" r="9" fill="#3b2314" />
      <circle cx="61" cy="42" r="9" fill="#3b2314" />
      <path d="M22 68 C22 54 58 54 58 68 Z" fill="#0ea5e9" />
      <circle cx="40" cy="42" r="16" fill="#ffd6b0" />
      <path d="M24 38 C24 23 56 23 56 38 C48 31 32 31 24 38 Z" fill="#3b2314" />
      <path
        d="M27 30 Q40 22 53 30"
        stroke="#facc15"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="34" cy="43" r="2.8" fill="#451a03" />
      <circle cx="33.2" cy="42" r="1" fill="#ffffff" />
      <circle cx="46" cy="43" r="2.8" fill="#451a03" />
      <circle cx="45.2" cy="42" r="1" fill="#ffffff" />
      <path
        d="M35 49 Q40 53 45 49"
        stroke="#e11d48"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const MedalBadgeSvg: React.FC<{ medal: MedalTier; className?: string }> = ({
  medal,
  className = 'w-8 h-8',
}) => {
  const colorMap: Record<MedalTier, { fill: string; stroke: string; label: string }> = {
    gold: { fill: '#facc15', stroke: '#ca8a04', label: 'Emas' },
    silver: { fill: '#e2e8f0', stroke: '#64748b', label: 'Perak' },
    bronze: { fill: '#f59e0b', stroke: '#b45309', label: 'Perunggu' },
    none: { fill: '#1e293b', stroke: '#475569', label: 'Belum' },
  };
  const cfg = colorMap[medal];
  return (
    <svg viewBox="0 0 36 36" className={className} role="img" aria-label={`Medali ${cfg.label}`}>
      <path d="M11 4 L15 14 L21 14 L25 4 Z" fill="#0284c7" />
      <circle cx="18" cy="22" r="10" fill={cfg.fill} stroke={cfg.stroke} strokeWidth="2.5" />
      <path
        d="M18 15 L20 19.5 L25 20 L21.2 23.2 L22.3 28 L18 25.4 L13.7 28 L14.8 23.2 L11 20 L16 19.5 Z"
        fill={medal === 'none' ? '#334155' : '#ffffff'}
      />
    </svg>
  );
};
