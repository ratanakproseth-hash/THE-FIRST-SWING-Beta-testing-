import { HudState } from '../types/game';

interface IronVisorOverlayProps {
  hud: HudState;
}

export function IronVisorOverlay({ hud }: IronVisorOverlayProps) {
  if (!hud.suitEntered) return null;

  const hpRatio = hud.maxHealth > 0 ? Math.max(0, Math.min(1, hud.health / hud.maxHealth)) : 1;
  const flash = hud.damageFlash;

  // User thresholds:
  // - At <= 50% HP: small crack appears on visor screen
  // - At <= 20% HP: suit starts warning & alerting, and screen turns red with heavy cracks
  const isCritical20 = hpRatio <= 0.2;
  const isHalfHurt50 = hpRatio <= 0.5;
  const crackLevel = isCritical20 ? 2 : isHalfHurt50 ? 1 : 0;

  const crackOpacity =
    crackLevel === 0
      ? 0
      : isCritical20
        ? Math.min(0.96, 0.72 + flash * 0.24)
        : Math.min(0.75, 0.36 + (0.5 - hpRatio) * 0.9 + flash * 0.25);

  const linkStroke = isCritical20 ? '#ef4444' : isHalfHurt50 ? '#7dd3fc' : '#38bdf8';

  return (
    <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden select-none">
      {/* Blue Iron Screen Link Perimeter Glow — turns RED at <= 20% armor HP */}
      <div
        className="absolute inset-0 transition-colors duration-200"
        style={{
          background: isCritical20
            ? 'radial-gradient(ellipse at center, rgba(220, 38, 38, 0.16) 28%, rgba(220, 38, 38, 0.38) 72%, rgba(185, 28, 28, 0.62) 100%)'
            : 'radial-gradient(ellipse at center, transparent 60%, rgba(14, 165, 233, 0.14) 86%, rgba(56, 189, 248, 0.32) 100%)',
          boxShadow: isCritical20
            ? 'inset 0 0 110px rgba(239, 68, 68, 0.68)'
            : 'inset 0 0 36px rgba(56, 189, 248, 0.28)',
        }}
      />

      {/* Iron Visor Curved Helmet Frame + Optical Brackets + 50% Small Crack / 20% Critical Cracks */}
      <svg
        viewBox="0 0 1600 900"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        {/* Outer Visor Bezel Frame */}
        <path
          d="M 48 150 L 48 56 L 175 26 M 1552 150 L 1552 56 L 1425 26 M 48 750 L 48 844 L 175 874 M 1552 750 L 1552 844 L 1425 874"
          fill="none"
          stroke={linkStroke}
          strokeWidth="3.5"
          strokeOpacity={isCritical20 ? '0.88' : '0.65'}
        />

        {/* Upper & Lower Visor Arcs */}
        <path
          d="M 380 18 Q 800 54 1220 18"
          fill="none"
          stroke={linkStroke}
          strokeWidth="2"
          strokeOpacity="0.48"
        />
        <path
          d="M 410 882 Q 800 848 1190 882"
          fill="none"
          stroke={linkStroke}
          strokeWidth="2"
          strokeOpacity="0.4"
        />

        {/* Side Optical Horizon Ticks */}
        <path
          d="M 24 380 L 44 380 M 24 450 L 54 450 M 24 520 L 44 520 M 1576 380 L 1556 380 M 1576 450 L 1546 450 M 1576 520 L 1556 520"
          fill="none"
          stroke={isCritical20 ? '#fca5a5' : '#7dd3fc'}
          strokeWidth="2.5"
          strokeOpacity="0.52"
        />

        {/* Stage 1 (<= 50% HP): Small Visor Glass Crack */}
        {crackLevel >= 1 && (
          <g strokeOpacity={crackOpacity} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path
              d="M 0 135 L 78 172 L 136 154 L 182 192 M 78 172 L 96 226 L 134 246"
              stroke="#e0f2fe"
              strokeWidth="2.1"
            />
            <path
              d="M 1600 742 L 1522 706 L 1468 726 M 1522 706 L 1496 656"
              stroke="#e0f2fe"
              strokeWidth="2.0"
            />
            <path
              d="M 2 136 L 78 172 L 135 155"
              stroke="#38bdf8"
              strokeWidth="3.4"
              strokeOpacity={crackOpacity * 0.45}
            />
          </g>
        )}

        {/* Stage 2 (<= 20% HP): Critical Red Visor Fractures */}
        {crackLevel >= 2 && (
          <g strokeOpacity={crackOpacity} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path
              d="M 1600 130 L 1485 178 L 1390 156 L 1308 228 L 1228 242 M 1485 178 L 1445 268 L 1354 316"
              stroke="#fecdd3"
              strokeWidth="2.8"
            />
            <path
              d="M 0 780 L 115 724 L 208 758 L 288 690 M 115 724 L 162 632 L 245 595"
              stroke="#fecdd3"
              strokeWidth="2.8"
            />
            <path
              d="M 182 192 L 290 238 L 352 216 M 1468 726 L 1350 676 L 1272 704"
              stroke="#fda4af"
              strokeWidth="2.4"
            />
            <path
              d="M 140 0 L 185 88 L 136 154 M 1445 900 L 1418 796 L 1468 726"
              stroke="#ef4444"
              strokeWidth="3.2"
            />
          </g>
        )}
      </svg>

      {/* Top Visor Link Status Readout */}
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-2 font-mono-num text-[9px] font-bold tracking-widest">
        <span className={isCritical20 ? 'text-rose-300' : isHalfHurt50 ? 'text-amber-300' : 'text-sky-400/90'}>
          {isCritical20
            ? 'IRON VISOR CRITICAL · ARMOR BELOW 20%'
            : isHalfHurt50
              ? 'IRON VISOR LINK · SMALL GLASS FRACTURE'
              : 'IRON VISOR LINK ACTIVE'}
        </span>
      </div>

      {/* <= 20% HP: Suit Critical Warning & Alert Banner */}
      {isCritical20 && (
        <div className="absolute top-20 sm:top-24 left-1/2 -translate-x-1/2 rounded-lg border-2 border-red-500 bg-red-950/92 px-4 py-2 text-center shadow-2xl">
          <div className="font-display text-xs sm:text-sm font-black uppercase tracking-wider text-red-200">
            SUIT WARNING · CRITICAL ARMOR ({Math.round(hpRatio * 100)}%)
          </div>
          <div className="font-mono-num text-[10px] font-bold text-amber-300">
            ALERT: EVADE OR BLOCK IMMEDIATELY — HULL BREACH IMMINENT
          </div>
        </div>
      )}
    </div>
  );
}
