import {
  ExtraArmorId,
  GrappleHookId,
  ShieldId,
  WeaponId,
  getExtraArmorConfig,
  getGrappleHookConfig,
  getShieldConfig,
  getWeaponConfig,
} from '../types/game';

interface WeaponPreviewProps {
  weaponId?: WeaponId;
  grappleId?: GrappleHookId;
  shieldId?: ShieldId;
  armorId?: ExtraArmorId;
  className?: string;
}

export function WeaponPreview({
  weaponId,
  grappleId,
  shieldId,
  armorId,
  className = 'w-full h-20',
}: WeaponPreviewProps) {
  if (shieldId) {
    const cfg = getShieldConfig(shieldId);
    const accent = cfg.accentColor;
    return (
      <svg
        viewBox="0 0 220 76"
        className={`rounded-md border border-slate-800 bg-slate-950/90 p-1.5 ${className}`}
        aria-label={cfg.name}
      >
        <defs>
          <linearGradient id={`sh-${shieldId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        {/* Outer energy barrier rings */}
        <ellipse cx="110" cy="38" rx="68" ry="28" fill="none" stroke={accent} strokeOpacity="0.28" strokeWidth="2" strokeDasharray="6 4" />
        {/* Core hexagonal/heater energy shield */}
        <path
          d={
            shieldId === 'none'
              ? 'M88 20 L132 20 L128 46 L110 60 L92 46 Z'
              : shieldId === 'quantum_aegis'
                ? 'M76 14 L110 8 L144 14 L152 44 L110 66 L68 44 Z'
                : 'M80 14 L140 14 L144 42 L110 64 L76 42 Z'
          }
          fill={shieldId === 'none' ? '#1e293b' : `url(#sh-${shieldId})`}
          stroke={accent}
          strokeWidth="2.5"
        />
        <path d="M110 18 L128 24 L124 44 L110 54 L96 44 L92 24 Z" fill="#020617" fillOpacity="0.55" stroke={accent} strokeWidth="1.5" />
        <circle cx="110" cy="36" r={shieldId === 'none' ? 4 : 7} fill={accent} />
      </svg>
    );
  }

  if (armorId) {
    const cfg = getExtraArmorConfig(armorId);
    const accent = cfg.accentColor;
    return (
      <svg
        viewBox="0 0 220 76"
        className={`rounded-md border border-slate-800 bg-slate-950/90 p-1.5 ${className}`}
        aria-label={cfg.name}
      >
        {/* Shoulder pauldrons + chest carapace */}
        <path
          d="M52 24 L76 14 L94 20 L126 20 L144 14 L168 24 L158 40 L142 36 L136 64 L84 64 L78 36 L62 40 Z"
          fill="#1e293b"
          stroke={accent}
          strokeWidth="2.2"
        />
        {/* Armored chest plates */}
        <polygon points="86,26 134,26 128,44 92,44" fill="#0f172a" stroke={accent} strokeWidth="1.6" />
        <polygon points="94,48 126,48 122,60 98,60" fill="#334155" stroke={accent} strokeWidth="1.2" />
        {/* Arc reactor core */}
        <circle cx="110" cy="35" r="7" fill={accent} fillOpacity="0.35" stroke={accent} strokeWidth="2" />
        <circle cx="110" cy="35" r="3" fill="#ffffff" />
      </svg>
    );
  }

  if (grappleId) {
    const cfg = getGrappleHookConfig(grappleId);
    return (
      <svg
        viewBox="0 0 220 76"
        className={`rounded-md border border-slate-800 bg-slate-950/90 p-1.5 ${className}`}
        aria-label={cfg.name}
      >
        <defs>
          <linearGradient id={`g-${grappleId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="60%" stopColor="#64748b" />
            <stop offset="100%" stopColor={cfg.accentColor} />
          </linearGradient>
        </defs>
        {/* Gauntlet cuff */}
        <rect x="18" y="25" width="70" height="26" rx="5" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="52" cy="38" r="10" fill="#0f172a" stroke={cfg.accentColor} strokeWidth="2.5" />
        {/* Magnetic cable */}
        <path
          d="M88 38 Q120 26 154 38"
          fill="none"
          stroke={cfg.accentColor}
          strokeWidth="2.5"
          strokeDasharray={grappleId === 'quantum_hook' ? '4 2' : undefined}
        />
        {/* Dual/Triple Grapple Claw */}
        <polygon
          points="154,38 192,16 176,34 202,38 176,42 192,60"
          fill={`url(#g-${grappleId})`}
          stroke={cfg.accentColor}
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  const wId = weaponId ?? 'katana';
  const cfg = getWeaponConfig(wId);
  const accent = cfg.accentColor;
  const blade = cfg.bladeColor ?? '#e2e8f0';

  return (
    <svg
      viewBox="0 0 220 76"
      className={`rounded-md border border-slate-800 bg-slate-950/90 p-1.5 ${className}`}
      aria-label={cfg.name}
    >
      {wId === 'katana' || wId === 'ripper' || wId === 'plasma' || wId === 'void' ? (
        <>
          <rect x="22" y="34" width="38" height="9" rx="2" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
          <rect x="59" y="24" width="7" height="29" rx="2" fill="#e2e8f0" />
          <path d="M66 34 L192 26 L204 34 L66 41 Z" fill={blade} />
          <path d="M66 39 L198 34 L66 43 Z" fill={accent} />
        </>
      ) : wId === 'saber' ? (
        <>
          {/* Vanguard Curved Duelist Saber */}
          <path d="M30 48 Q56 54 66 28" fill="none" stroke="#94a3b8" strokeWidth="4" />
          <rect x="24" y="35" width="38" height="9" rx="2" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <rect x="60" y="25" width="6" height="28" rx="2" fill="#cbd5e1" />
          <path d="M66 36 Q135 28 202 18 L194 31 Q130 40 66 42 Z" fill={blade} />
          <path d="M66 41 Q132 37 195 29" fill="none" stroke={accent} strokeWidth="3" />
        </>
      ) : wId === 'axe' ? (
        <>
          <rect x="20" y="34" width="142" height="8" rx="3" fill="#334155" />
          <path d="M138 14 Q186 8 194 38 Q186 68 138 62 L148 38 Z" fill={blade} stroke={accent} strokeWidth="2.2" />
          <polygon points="136,34 114,28 114,48" fill={accent} />
        </>
      ) : wId === 'lightsaber' ? (
        <>
          <rect x="20" y="32" width="46" height="12" rx="3" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
          <rect x="66" y="30" width="8" height="16" fill="#0f172a" />
          <rect x="74" y="32" width="130" height="12" rx="6" fill={accent} opacity="0.55" />
          <rect x="74" y="35" width="128" height="6" rx="3" fill="#ffffff" />
        </>
      ) : wId === 'scythe' ? (
        <>
          <rect x="18" y="38" width="152" height="7" rx="2" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
          <circle cx="166" cy="41" r="7" fill={accent} />
          <path d="M166 36 Q192 8 118 12 Q168 24 166 42 Z" fill={blade} stroke={accent} strokeWidth="2" />
        </>
      ) : wId === 'sidearm' ? (
        <>
          <polygon points="56,36 74,36 68,62 50,62" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <rect x="52" y="24" width="96" height="16" rx="3" fill="#f8fafc" />
          <rect x="56" y="34" width="86" height="7" fill="#334155" />
          <rect x="82" y="21" width="52" height="4" fill={accent} />
        </>
      ) : wId === 'smg' ? (
        <>
          <polygon points="50,36 64,36 58,60 44,60" fill="#0f172a" />
          <circle cx="96" cy="50" r="12" fill="#334155" stroke={accent} strokeWidth="2" />
          <rect x="44" y="22" width="114" height="18" rx="3" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
          <rect x="158" y="27" width="24" height="7" fill={accent} />
        </>
      ) : wId === 'carbine' ? (
        <>
          <rect x="26" y="28" width="30" height="14" rx="2" fill="#0f172a" />
          <polygon points="74,38 88,38 82,62 68,62" fill="#1e293b" />
          <rect x="52" y="22" width="122" height="18" rx="3" fill="#f8fafc" />
          <rect x="174" y="26" width="26" height="8" fill={accent} />
        </>
      ) : wId === 'shotgun' ? (
        <>
          <polygon points="24,38 56,28 56,42 24,52" fill="#1e293b" />
          <rect x="56" y="22" width="116" height="18" rx="2" fill="#334155" />
          <rect x="104" y="38" width="44" height="8" rx="2" fill={accent} />
          <rect x="172" y="24" width="24" height="12" fill="#94a3b8" />
        </>
      ) : wId === 'sniper' ? (
        <>
          <rect x="18" y="28" width="34" height="16" rx="2" fill="#0f172a" />
          <rect x="52" y="26" width="88" height="14" rx="2" fill="#f8fafc" />
          <rect x="140" y="30" width="66" height="6" fill="#94a3b8" />
          <rect x="68" y="13" width="48" height="10" rx="3" fill="#1e293b" stroke={accent} strokeWidth="2" />
        </>
      ) : wId === 'rpg' ? (
        <>
          <rect x="28" y="22" width="128" height="24" rx="4" fill="#334155" stroke="#64748b" strokeWidth="2" />
          <polygon points="156,18 172,22 172,46 156,50" fill="#94a3b8" />
          <polygon points="172,24 202,34 172,44" fill={accent} />
          <rect x="66" y="46" width="12" height="16" fill="#0f172a" />
        </>
      ) : wId === 'railcannon' ? (
        <>
          <rect x="26" y="22" width="86" height="24" rx="3" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
          <rect x="112" y="22" width="82" height="6" fill="#e2e8f0" />
          <rect x="112" y="38" width="82" height="6" fill="#e2e8f0" />
          <rect x="112" y="31" width="76" height="4" fill={accent} />
        </>
      ) : (
        /* laser_boom: Omega Laser Boom Gun */
        <>
          <rect x="22" y="19" width="112" height="30" rx="5" fill="#0f172a" stroke={accent} strokeWidth="2" />
          <ellipse cx="144" cy="34" rx="7" ry="16" fill="none" stroke={accent} strokeWidth="2.5" />
          <ellipse cx="164" cy="34" rx="6" ry="13" fill="none" stroke={accent} strokeWidth="2.5" />
          <circle cx="186" cy="34" r="11" fill={accent} />
          <circle cx="186" cy="34" r="5" fill="#ffffff" />
        </>
      )}
    </svg>
  );
}
