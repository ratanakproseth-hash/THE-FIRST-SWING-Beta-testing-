import {
  BossPowerId,
  GameSettings,
  GrappleHookId,
  HudState,
  MAX_LEVEL,
  getBossPowerConfig,
  getDifficultyConfig,
  getGrappleHookConfig,
  getWeaponConfig,
} from '../types/game';
import { IronVisorOverlay } from './IronVisorOverlay';
import { MobileTouchControls, TouchInputActions } from './MobileTouchControls';

interface FirstSwingHudProps {
  hud: HudState;
  settings: GameSettings;
  touchActive: boolean;
  touchActions: TouchInputActions;
  claimedPowers: BossPowerId[];
  equippedPower: BossPowerId | null;
  equippedGrapple: GrappleHookId;
  onSelectWeaponSlot: (slotIndex: number) => void;
  onUsePower: (powerId: BossPowerId) => void;
  onSelectGlitchChoice: (choice: 'fight' | 'run') => void;
  onTriggerAiOvercharge?: () => void;
  onToggleControlMode: () => void;
  onOpenMenu: () => void;
}

export function FirstSwingHud({
  hud,
  settings,
  touchActive,
  touchActions,
  claimedPowers,
  equippedPower,
  equippedGrapple,
  onSelectWeaponSlot,
  onUsePower,
  onSelectGlitchChoice,
  onTriggerAiOvercharge,
  onToggleControlMode,
  onOpenMenu,
}: FirstSwingHudProps) {
  const hudScale = Math.max(0.75, Math.min(1.25, settings.hudScale ?? 1));
  const compact = Boolean(settings.hudCompact);
  const diffCfg = getDifficultyConfig(settings.difficulty);
  const hpPct = Math.max(0, Math.min(100, (hud.health / Math.max(1, hud.maxHealth)) * 100));
  const shieldPct =
    hud.maxShieldHp > 0
      ? Math.max(0, Math.min(100, (hud.shieldHp / Math.max(1, hud.maxShieldHp)) * 100))
      : 0;
  const manaPct = Math.max(0, Math.min(100, (hud.mana / Math.max(1, hud.maxMana)) * 100));
  const bossPct = hud.bossIsInfinite
    ? 100
    : Math.max(0, Math.min(100, (hud.bossHp / Math.max(1, hud.bossMaxHp)) * 100));
  const bossShieldPct =
    hud.bossShieldMaxHp > 0
      ? Math.max(0, Math.min(100, (hud.bossShieldHp / hud.bossShieldMaxHp) * 100))
      : 0;
  const activeCfg = getWeaponConfig(hud.activeWeaponId);
  const grappleCfg = getGrappleHookConfig(equippedGrapple);

  const reticleColor =
    hud.crosshairTarget === 'weakpoint'
      ? '#f43f5e'
      : hud.crosshairTarget === 'head'
        ? '#fb7185'
        : hud.crosshairTarget === 'body'
          ? '#f59e0b'
          : hud.aimLocked
            ? '#22d3ee'
            : '#e2e8f0';

  const spreadPx = Math.min(20, hud.recoilBloom);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none overflow-hidden">
      {/* Blue Iron Armor Screen Link + Dynamic Hurt Glass Cracks */}
      <IronVisorOverlay hud={hud} />

      {/* Damage flash vignette */}
      {hud.damageFlash > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, transparent 48%, rgba(239, 68, 68, ${
              hud.damageFlash * 0.52
            }) 100%)`,
          }}
        />
      )}

      {/* Glitch LV 0 distortion frame */}
      {hud.glitchScreenIntensity > 0.05 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, transparent 58%, rgba(220, 38, 38, ${
              hud.glitchScreenIntensity * 0.36
            }) 100%)`,
            boxShadow: `inset 0 0 80px rgba(244, 63, 94, ${hud.glitchScreenIntensity * 0.4})`,
          }}
        />
      )}

      {/* Gun Zoom Overlays: Full Optic Lens vs Tactical ADS Brackets */}
      {hud.sniperZoomed && activeCfg.isOpticScope && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
          <div
            className="w-[70vh] h-[70vh] rounded-full border-2 relative"
            style={{
              borderColor: activeCfg.accentColor,
              boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.78)',
            }}
          >
            <div
              className="absolute inset-x-0 top-1/2 h-px opacity-55"
              style={{ backgroundColor: activeCfg.accentColor }}
            />
            <div
              className="absolute inset-y-0 left-1/2 w-px opacity-55"
              style={{ backgroundColor: activeCfg.accentColor }}
            />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
              style={{
                backgroundColor:
                  hud.crosshairTarget === 'weakpoint' || hud.crosshairTarget === 'head'
                    ? '#f43f5e'
                    : activeCfg.accentColor,
              }}
            />
            <div
              className="absolute top-5 left-1/2 -translate-x-1/2 font-mono-num text-[11px] font-bold tracking-widest whitespace-nowrap"
              style={{ color: activeCfg.accentColor }}
            >
              {activeCfg.zoomLabel ?? 'OPTIC ZOOM'} · PRECISION
            </div>
            {(hud.crosshairTarget === 'weakpoint' || hud.crosshairTarget === 'head') && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono-num text-xs font-black tracking-widest text-rose-400">
                {hud.crosshairTarget === 'weakpoint' ? 'WEAK POINT LOCKED 3x' : 'HEADSHOT LOCKED 2x'}
              </div>
            )}
          </div>
        </div>
      )}

      {hud.sniperZoomed && !activeCfg.isOpticScope && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative w-44 h-44">
            <div
              className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2"
              style={{ borderColor: activeCfg.accentColor }}
            />
            <div
              className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2"
              style={{ borderColor: activeCfg.accentColor }}
            />
            <div
              className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2"
              style={{ borderColor: activeCfg.accentColor }}
            />
            <div
              className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2"
              style={{ borderColor: activeCfg.accentColor }}
            />
            <div
              className="absolute -bottom-6 left-1/2 -translate-x-1/2 font-mono-num text-[10px] font-bold tracking-widest whitespace-nowrap"
              style={{ color: activeCfg.accentColor }}
            >
              {activeCfg.zoomLabel ?? 'ADS ZOOM'}
            </div>
          </div>
        </div>
      )}

      {/* Slo-Mo border tint */}
      {hud.sloMo && (
        <div
          className="fixed inset-0 pointer-events-none border-4 border-sky-400/50"
          style={{
            background:
              'radial-gradient(circle at center, rgba(14,165,233,0.04) 40%, rgba(14,165,233,0.18) 100%)',
          }}
        />
      )}

      {/* Top Left: Suit / Sector Info & Player Vitals */}
      <div
        className="fixed top-2.5 left-2.5 sm:top-4 sm:left-4 flex flex-col gap-1.5 sm:gap-2 max-w-[205px] sm:max-w-xs"
        style={{
          transform: `scale(${hudScale})`,
          transformOrigin: 'top left',
        }}
      >
        <div className="rounded-lg border border-slate-800 bg-slate-950/92 px-2.5 py-2 sm:px-3.5 sm:py-2.5 shadow-xl">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-display text-[10px] sm:text-xs font-bold uppercase tracking-wider text-cyan-300 truncate">
                {hud.levelTag}
              </span>
              <span
                className="font-mono-num text-[9px] font-bold px-1 py-0.5 rounded border border-slate-700 bg-slate-900 shrink-0"
                style={{ color: diffCfg.accentColor }}
              >
                {diffCfg.label}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onToggleControlMode}
                title="Switch between PC (Keyboard/Mouse) and Mobile (Touch) controls"
                className={`pointer-events-auto rounded border px-2 py-1 sm:py-0.5 font-mono-num text-[10px] font-bold transition ${
                  touchActive
                    ? 'border-cyan-400 bg-cyan-950/90 text-cyan-200 hover:bg-cyan-900'
                    : 'border-sky-500/50 bg-slate-900 text-sky-300 hover:border-cyan-400 hover:text-white'
                }`}
              >
                {touchActive ? 'MOBILE' : 'PC'}
              </button>
              <button
                type="button"
                onClick={onOpenMenu}
                className="pointer-events-auto rounded border border-slate-700 bg-slate-900 px-2 py-1 sm:py-0.5 font-mono-num text-[10px] font-bold text-slate-300 hover:border-cyan-400 hover:text-white"
              >
                MENU
              </button>
            </div>
          </div>

          {/* Level Subject Subtitle */}
          {hud.levelSubject && (
            <div className="mt-1 font-mono-num text-[10px] font-semibold text-slate-300 truncate">
              {hud.levelSubject}
            </div>
          )}

          {/* Energy Shield Bar (when equipped) */}
          {hud.maxShieldHp > 0 && (
            <div className="mt-2">
              <div className="flex justify-between font-mono-num text-[10px] font-bold">
                <span className="text-sky-300">ENERGY SHIELD</span>
                <span className="text-cyan-100">
                  {Math.ceil(hud.shieldHp)} / {hud.maxShieldHp}
                </span>
              </div>
              <div className="mt-0.5 h-1.5 w-full rounded-sm bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-100"
                  style={{ width: `${shieldPct}%` }}
                />
              </div>
            </div>
          )}

          {/* HP Bar */}
          <div className="mt-2">
            <div className="flex justify-between font-mono-num text-[11px] font-bold">
              <span className="text-emerald-400">
                SUIT HP{hud.armorReductionPct > 0 ? ` (-${hud.armorReductionPct}%)` : ''}
              </span>
              <span className="text-white">
                {hud.health.toLocaleString()} / {hud.maxHealth.toLocaleString()}
              </span>
            </div>
            <div className="mt-1 h-2 w-full rounded-sm bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-100"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          {/* Mana Bar */}
          <div className="mt-1.5">
            <div className="flex justify-between font-mono-num text-[11px] font-bold">
              <span className="text-violet-400">REACTOR MANA</span>
              <span className="text-slate-200">
                {hud.mana} / {hud.maxMana}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-sm bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-violet-400 transition-all duration-100"
                style={{ width: `${manaPct}%` }}
              />
            </div>
          </div>

          {/* Movement / Stealth / State Readout */}
          {!compact && (
            <div className="mt-1.5 hidden sm:flex items-center justify-between gap-2 font-mono-num text-[10px] text-slate-300">
              <span>
                STANCE:{' '}
                <strong className="text-cyan-300 uppercase">
                  {hud.movementState.replace('_', ' ')}
                </strong>
              </span>
              <span>
                NOISE:{' '}
                <strong
                  className={
                    hud.noiseLevel === 'silent'
                      ? 'text-emerald-400'
                      : hud.noiseLevel === 'loud'
                        ? 'text-rose-400'
                        : 'text-amber-300'
                  }
                >
                  {hud.noiseLevel.toUpperCase()}
                </strong>
              </span>
            </div>
          )}
        </div>

        {/* Tutorial Step Banner */}
        {hud.mode === 'tutorial' && hud.tutorialStepText && (
          <div className="rounded-lg border border-cyan-500/50 bg-slate-950/92 px-3 py-2 text-xs text-cyan-200 shadow-lg">
            <div className="font-mono-num text-[10px] font-bold uppercase tracking-wider text-cyan-400">
              SHERLCO TRAINING DIRECTIVE
            </div>
            <p className="mt-0.5 font-medium text-white">{hud.tutorialStepText}</p>
          </div>
        )}

        {/* Side Quest Tracker */}
        {!compact && hud.sideQuest && (
          <div className="rounded-lg border border-amber-500/40 bg-slate-950/90 px-3 py-2 text-xs">
            <div className="flex items-center justify-between font-mono-num text-[10px] font-bold uppercase">
              <span className="text-amber-300">SIDE QUEST</span>
              <span className={hud.sideQuest.completed ? 'text-emerald-400' : 'text-slate-300'}>
                {hud.sideQuest.progress}/{hud.sideQuest.target}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-200">{hud.sideQuest.title}</p>
          </div>
        )}

        {/* Recruited Allies */}
        {hud.allies.length > 0 && (
          <div className="rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2 space-y-1">
            <div className="font-mono-num text-[10px] font-bold uppercase text-emerald-400">
              SQUAD ALLIES ({hud.allies.length})
            </div>
            {hud.allies.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-200">{a.name}</span>
                <span className="font-mono-num text-emerald-300">
                  {a.hp}/{a.maxHp} HP
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Center: Boss HP Bar, Glitch Distance, or Sector Objective */}
      <div
        className="fixed top-4 left-1/2 flex flex-col items-center gap-2 w-full max-w-lg px-4"
        style={{
          transform: `translateX(-50%) scale(${hudScale})`,
          transformOrigin: 'top center',
        }}
      >
        {hud.bossName && (
          <div className="w-full rounded-lg border border-rose-500/60 bg-slate-950/95 px-4 py-2.5 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-sm font-bold uppercase tracking-wide text-rose-400">
                {hud.bossName}
              </span>
              <span className="font-mono-num text-xs font-bold text-white">
                {hud.bossIsInfinite
                  ? '∞ HP · 1,000,000x TITAN'
                  : `${hud.bossHp.toLocaleString()} / ${hud.bossMaxHp.toLocaleString()} HP`}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full rounded-sm bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.bossIsInfinite ? 'bg-rose-600' : 'bg-rose-500'
                }`}
                style={{ width: `${bossPct}%` }}
              />
            </div>
            {hud.bossShieldMaxHp > 0 && (
              <div className="mt-1 h-1.5 w-full rounded-sm bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-100"
                  style={{ width: `${bossShieldPct}%` }}
                />
              </div>
            )}
            <div className="mt-1 flex items-center justify-between font-mono-num text-[10px] text-slate-400 gap-2">
              <span>BOSS DMG: {hud.bossDamage} HP</span>
              {hud.mode === 'glitch_lv0' ? (
                <span className="text-rose-300 font-bold">
                  PURSUIT: {hud.glitchChaseDistM}m · SPEED {hud.glitchTitanSpeedMps} m/s
                </span>
              ) : hud.bossStunnedSec > 0 ? (
                <span className="text-rose-400 font-black">
                  STUNNED ({hud.bossStunnedSec.toFixed(1)}s) · HIT RED WEAK POINT!
                </span>
              ) : (
                <span className="truncate">
                  {hud.bossLaserActive
                    ? 'LASER SWEEP ACTIVE!'
                    : hud.bossActiveAbilityName
                      ? hud.bossActiveAbilityName
                      : 'LOCK-ON ACTIVE'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Boss Stunned / Weak Point Callout */}
        {hud.bossStunnedSec > 0 && (
          <div className="rounded-lg border border-rose-400 bg-rose-950/95 px-4 py-1.5 text-center shadow-xl">
            <div className="font-display text-xs sm:text-sm font-black uppercase tracking-wider text-rose-300">
              BOSS STUNNED · WEAK POINT EXPOSED ({hud.bossStunnedSec.toFixed(1)}s)
            </div>
            <div className="font-mono-num text-[10px] text-amber-200">
              USE BARRAGE [F] OR 10x CRIT [Z] ON RED CORE FOR MASSIVE EXPLOSION!
            </div>
          </div>
        )}

        {/* Boss Explosion Ult Dodge Alert */}
        {hud.bossUltChargingSec > 0 && (
          <div className="rounded-lg border border-amber-400 bg-rose-950/95 px-4 py-2 text-center shadow-2xl">
            <div className="font-display text-sm font-bold uppercase tracking-wider text-amber-300">
              BOSS EXPLOSION ULT CHARGING ({hud.bossUltChargingSec.toFixed(1)}s)
            </div>
            <div className="font-mono-num text-[11px] text-white">
              DISTANCE: {hud.bossUltDistanceM}m · PRESS [V / ALT] TO DODGE OR SWING AWAY!
            </div>
          </div>
        )}

        {/* Wall Slide Prompt */}
        {hud.isWallSliding && (
          <div className="rounded-md border border-cyan-400 bg-slate-950/95 px-3.5 py-1 font-mono-num text-xs font-bold text-cyan-300 shadow-lg">
            WALL SLIDING · PRESS [SPACE] TO WALL-KICK!
          </div>
        )}

        {/* Proactive Sherlco AI Tactical Warning */}
        {hud.aiWarningText && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-amber-400/75 bg-slate-950/95 px-3.5 py-1.5 font-mono-num text-[11px] font-bold text-amber-200 shadow-xl">
            <span>{hud.aiWarningText}</span>
            {hud.aiOverchargeCooldownSec <= 0 &&
              hud.health / Math.max(1, hud.maxHealth) <= 0.35 &&
              onTriggerAiOvercharge && (
                <button
                  type="button"
                  onClick={onTriggerAiOvercharge}
                  className="rounded border border-emerald-400 bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-slate-950 hover:bg-emerald-400"
                >
                  REPAIR [Y]
                </button>
              )}
          </div>
        )}

        {/* Wave / FFA Banner */}
        {hud.mode === 'wave' && (
          <div className="rounded-lg border border-emerald-500/50 bg-slate-950/92 px-4 py-1.5 font-mono-num text-xs font-bold text-emerald-300">
            WAVE {hud.waveNumber} · HOSTILES LEFT: {hud.enemiesRemaining}
          </div>
        )}
        {hud.mode === 'ffa' && (
          <div className="rounded-lg border border-amber-500/50 bg-slate-950/92 px-4 py-1.5 font-mono-num text-xs font-bold text-amber-300">
            FFA SURVIVORS: {hud.enemiesRemaining + 1} · TOP BOT: {hud.ffaLeaderName}
          </div>
        )}

        {/* Dynamic Kill / Action Banner */}
        {hud.killBannerTimer > 0 && hud.killBannerText && (
          <div className="rounded-md border border-cyan-400/60 bg-slate-950/95 px-4 py-1.5 font-mono-num text-xs font-bold tracking-wider text-cyan-200 shadow-lg">
            {hud.killBannerText}
          </div>
        )}
      </div>

      {/* Top Right: Enemy Counter, Underground Portal Charge, Attack Sensor */}
      <div
        className="fixed top-2.5 right-2.5 sm:top-4 sm:right-4 flex flex-col items-end gap-1.5 sm:gap-2"
        style={{
          transform: `scale(${hudScale})`,
          transformOrigin: 'top right',
        }}
      >
        <div className="rounded-lg border border-slate-800 bg-slate-950/92 px-2.5 py-2 sm:px-3.5 sm:py-2.5 text-right shadow-xl">
          <div className="font-mono-num text-[10px] sm:text-xs font-bold text-white">
            {hud.mode === 'glitch_lv0' ? (
              <span className="text-rose-400">GLITCH ANOMALY · LV 0</span>
            ) : hud.enemiesRemaining > 0 ? (
              <span className="text-amber-300">
                HOSTILES: {hud.enemiesRemaining} / {hud.enemiesTotal}
              </span>
            ) : !hud.goalUnlocked ? (
              <span className="text-cyan-300">
                CHARGING UNDERGROUND PORTAL · {hud.portalChargePct}%
              </span>
            ) : (
              <span className="text-emerald-400">
                {hud.mode === 'campaign' && hud.level < MAX_LEVEL
                  ? `UNDERGROUND PORTAL READY · ${hud.goalDistanceM}m`
                  : hud.mode === 'campaign' && hud.level === MAX_LEVEL
                    ? `OUTSIDE WORLD PORTAL · ${hud.goalDistanceM}m`
                    : `UNDERGROUND EXTRACTION · ${hud.goalDistanceM}m`}
              </span>
            )}
          </div>
          {hud.mode !== 'glitch_lv0' && hud.portalChargePct < 100 && (
            <div className="mt-1 h-1.5 w-full rounded-sm bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-150"
                style={{ width: `${hud.portalChargePct}%` }}
              />
            </div>
          )}
          <div className="mt-1 font-mono-num text-[11px] text-slate-400">
            SECTOR RUN: <span className="text-emerald-300">+${hud.runCreditsEarned}</span> ·{' '}
            <span className="text-amber-300">+{hud.runPointsEarned} PT</span>
          </div>
          {hud.comboKills > 1 && (
            <div className="mt-1 font-mono-num text-xs font-bold text-rose-400">
              {hud.comboKills}x COMBO STREAK
            </div>
          )}
        </div>

        {/* Robot Attack Threat Sensor */}
        {hud.attackSensor.active && (
          <div
            className={`rounded-lg border px-3 py-1.5 font-mono-num text-[11px] font-bold ${
              hud.attackSensor.incomingThreat
                ? 'border-rose-500 bg-rose-950/95 text-rose-200'
                : 'border-amber-500/45 bg-slate-950/90 text-amber-200'
            }`}
          >
            SENSOR: {hud.attackSensor.direction.toUpperCase()} · {hud.attackSensor.nearestDistanceM}m
            {hud.attackSensor.incomingThreat ? ' · BLOCK [B] / DODGE [V]!' : ''}
          </div>
        )}
      </div>

      {/* GLITCH LV 0: Interactive Fight or Run Outcome Prompt */}
      {hud.mode === 'glitch_lv0' && hud.glitchChoice === 'pending' && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-xl rounded-xl border border-rose-500/70 bg-slate-950 p-6 shadow-2xl">
            <div className="font-mono-num text-xs font-bold uppercase tracking-widest text-rose-400">
              SYSTEM CORRUPTION · LEVEL 0 DETECTED
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold text-white">
              THE 1,000,000x INFINITE GLITCH TITAN HAS AWAKENED
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Reality fractured after your Outside World triumph. An indestructible{' '}
              <span className="text-rose-400 font-bold">∞ HP Colossal Titan</span> is tearing
              through Level 0. Choose your fate:
            </p>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onSelectGlitchChoice('fight')}
                className="rounded-lg border border-rose-500/70 bg-rose-950/60 p-4 text-left hover:bg-rose-900/70 transition"
              >
                <div className="font-display text-base font-bold text-rose-300">
                  STAND &amp; FIGHT HIM
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  Unleash everything you have against an infinite-HP leviathan in the shattered LV 0
                  arena.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onSelectGlitchChoice('run')}
                className="rounded-lg border border-cyan-500/70 bg-cyan-950/60 p-4 text-left hover:bg-cyan-900/70 transition"
              >
                <div className="font-display text-base font-bold text-cyan-300">
                  RUN AN ENDLESS CORRIDOR
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  Sprint &amp; grapple through an unlimited collapsing track while the Titan grows
                  faster every second.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Center Reticle + Headshot / Lock Indicators */}
      {!(hud.sniperZoomed && activeCfg.isOpticScope) && (
        <div
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ width: 28 + spreadPx * 2, height: 28 + spreadPx * 2 }}
        >
          <div
            className="absolute inset-0 rounded-full border-2 transition-colors duration-75"
            style={{ borderColor: reticleColor }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: reticleColor }}
          />
          {(hud.crosshairTarget === 'weakpoint' || hud.crosshairTarget === 'head') && (
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono-num text-[10px] font-bold text-rose-400 whitespace-nowrap">
              {hud.crosshairTarget === 'weakpoint' ? 'WEAK POINT 3x' : 'HEADSHOT 2x'}
            </div>
          )}
          {hud.hitMarkerTimer > 0 && (
            <div
              className="absolute inset-0 flex items-center justify-center font-mono-num text-sm font-black"
              style={{
                color: hud.hitWasWeakPoint
                  ? '#fbbf24'
                  : hud.hitWasHeadshot
                    ? '#f43f5e'
                    : '#ffffff',
              }}
            >
              ✕
            </div>
          )}
        </div>
      )}

      {/* Grapple / Zip Target Diamonds */}
      {hud.hasSwingTarget && (
        <div
          className="fixed w-4 h-4 -ml-2 -mt-2 rotate-45 border-2 border-cyan-400 pointer-events-none"
          style={{
            left: `${hud.swingTargetX * 100}%`,
            top: `${hud.swingTargetY * 100}%`,
          }}
        />
      )}
      {hud.hasZipTarget && (
        <div
          className={`fixed -translate-x-1/2 -translate-y-1/2 pointer-events-none font-mono-num text-[10px] font-bold px-1.5 py-0.5 rounded border ${
            hud.zipIsEnemy
              ? 'border-rose-400 bg-rose-950/90 text-rose-200'
              : 'border-cyan-400 bg-slate-950/90 text-cyan-200'
          }`}
          style={{
            left: `${hud.zipTargetX * 100}%`,
            top: `${hud.zipTargetY * 100}%`,
          }}
        >
          [E] ZIP {hud.enemyTargetName ? `· ${hud.enemyTargetName}` : ''}
        </div>
      )}

      {/* Underground Extraction Portal Waypoint */}
      {hud.goalVisible && hud.goalDistanceM > 8 && (
        <div
          className="fixed -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded border border-emerald-400/70 bg-slate-950/85 px-2 py-0.5 font-mono-num text-[10px] font-bold text-emerald-300"
          style={{
            left: `${hud.goalScreenX * 100}%`,
            top: `${hud.goalScreenY * 100}%`,
          }}
        >
          {hud.goalUnlocked ? 'UNDERGROUND PORTAL' : `PORTAL (${hud.portalChargePct}%)`} ·{' '}
          {hud.goalDistanceM}m
        </div>
      )}

      {/* Nearby Rescue / Quest NPC Prompt */}
      {hud.nearNpcPrompt && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 pointer-events-auto">
          <div className="rounded-lg border border-emerald-400/70 bg-slate-950/95 px-4 py-2 font-mono-num text-xs font-bold text-emerald-200">
            {hud.nearNpcPrompt}
          </div>
        </div>
      )}

      {/* Omega Laser Boom Charge Indicator */}
      {hud.activeWeaponId === 'laser_boom' && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 w-64 rounded-lg border border-pink-500/60 bg-slate-950/92 px-3 py-2">
          <div className="flex justify-between font-mono-num text-[10px] font-bold">
            <span className="text-pink-400">OMEGA LASER BOOM (100K DMG)</span>
            <span className="text-white">
              {hud.laserBoomCooldownSec > 0
                ? `RECHARGE ${Math.ceil(hud.laserBoomCooldownSec)}s`
                : `AMMO ${hud.laserBoomAmmo}/${hud.laserBoomMaxAmmo}`}
            </span>
          </div>
          <div className="mt-1 h-2 w-full rounded-sm bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-pink-500 transition-all duration-75"
              style={{ width: `${hud.laserBoomChargePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Bottom Left: Speedometer, Wrist Grapple, Abilities (Desktop) */}
      <div
        className={`${touchActive ? 'hidden sm:flex' : 'flex'} fixed bottom-4 left-4 flex-col gap-2`}
        style={{
          transform: `scale(${hudScale})`,
          transformOrigin: 'bottom left',
        }}
      >
        <div className="rounded-lg border border-slate-800 bg-slate-950/92 px-3.5 py-2.5 shadow-xl">
          <div className="flex items-baseline gap-2">
            <span className="font-mono-num text-3xl font-black text-cyan-300 leading-none">
              {hud.speedMph}
            </span>
            <span className="font-mono-num text-[10px] font-bold tracking-widest text-slate-400">
              MPH · ALT {hud.altitudeM}m
            </span>
          </div>

          {!compact && (
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono-num text-[10px]">
              <div className="text-slate-300">
                [L-WRIST] <span className="text-cyan-300 font-bold">{grappleCfg.name}</span>
              </div>
              <div className="text-slate-300">
                [E] ZIP:{' '}
                <span className={hud.zipCooldownSec > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                  {hud.zipCooldownSec > 0 ? `${hud.zipCooldownSec.toFixed(1)}s` : 'READY'}
                </span>
              </div>
              <div className="text-slate-300">
                [F] BARRAGE:{' '}
                <span className={hud.barrageCooldownSec > 0 ? 'text-amber-400' : 'text-cyan-300'}>
                  {hud.barrageCooldownSec > 0 ? `${hud.barrageCooldownSec.toFixed(1)}s` : 'READY'}
                </span>
              </div>
              <div className="text-slate-300">
                [T] SLO-MO:{' '}
                <span
                  className={
                    hud.sloMo
                      ? 'text-sky-300'
                      : hud.sloMoCooldownSec > 0
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                  }
                >
                  {hud.sloMo
                    ? `${Math.ceil(hud.sloMoRemainingSec)}s`
                    : hud.sloMoCooldownSec > 0
                      ? `CD ${Math.ceil(hud.sloMoCooldownSec)}s`
                      : '20s READY'}
                </span>
              </div>
              <div className="text-slate-300">
                [Z] 10x CRIT:{' '}
                <span className={hud.critSurgeActive ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                  {hud.critSurgeActive ? 'ARMED!' : `${hud.critSurgeCharge}%`}
                </span>
              </div>
              <div className="text-slate-300">
                [Y] AI ASSIST:{' '}
                <span
                  className={
                    hud.aiOverchargeSec > 0
                      ? 'text-emerald-300 font-bold'
                      : hud.aiOverchargeCooldownSec > 0
                        ? 'text-amber-400'
                        : 'text-cyan-300'
                  }
                >
                  {hud.aiOverchargeSec > 0
                    ? `+DMG ${hud.aiOverchargeSec.toFixed(1)}s`
                    : hud.aiOverchargeCooldownSec > 0
                      ? `CD ${Math.ceil(hud.aiOverchargeCooldownSec)}s`
                      : 'READY'}
                </span>
              </div>
              <div className="text-slate-300">
                [G] SWING · [RMB] {activeCfg.category === 'gun' ? 'ZOOM' : 'SWING'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Center: Unified 1-6 Weapon Slots + Boss Powers */}
      <div
        className="fixed bottom-2 sm:bottom-4 left-1/2 flex flex-col items-center gap-1 sm:gap-1.5 max-w-[96vw]"
        style={{
          transform: `translateX(-50%) scale(${hudScale})`,
          transformOrigin: 'bottom center',
        }}
      >
        {claimedPowers.length > 0 && (
          <div className="pointer-events-auto flex flex-wrap justify-center items-center gap-1">
            {claimedPowers.map((pid) => {
              const pCfg = getBossPowerConfig(pid);
              const cd = hud.powerCooldowns[pid] ?? 0;
              const isSelected = equippedPower === pid;
              return (
                <button
                  key={pid}
                  type="button"
                  onClick={() => onUsePower(pid)}
                  className={`rounded border px-2 py-1 font-mono-num text-[10px] font-bold transition ${
                    isSelected
                      ? 'border-amber-400 bg-slate-900 text-white'
                      : 'border-slate-700 bg-slate-950/90 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  [{pCfg.keyHint}] {pCfg.name.split(' ')[0].toUpperCase()}
                  {cd > 0 ? ` (${cd.toFixed(0)}s)` : ''}
                </button>
              );
            })}
          </div>
        )}

        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 rounded-xl border border-slate-800 bg-slate-950/95 p-1 sm:p-1.5 shadow-2xl overflow-x-auto max-w-full">
          {Array.from({ length: hud.maxWeaponSlots }).map((_, idx) => {
            const wId = hud.weaponSlots[idx];
            const wCfg = wId ? getWeaponConfig(wId) : null;
            const active = idx === hud.activeWeaponSlot;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectWeaponSlot(idx)}
                className={`flex flex-col items-start rounded-lg border px-2 py-1 sm:px-2.5 sm:py-1.5 min-w-[54px] sm:min-w-[84px] text-left transition ${
                  active
                    ? 'border-cyan-400 bg-slate-900 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between w-full font-mono-num text-[9px] sm:text-[10px]">
                  <span className={active ? 'text-cyan-300 font-bold' : 'text-slate-500'}>
                    [{idx + 1}]
                  </span>
                  {wCfg && (
                    <span className="hidden sm:inline uppercase text-[9px] text-slate-400">
                      {wCfg.category === 'sword' ? 'BLADE' : 'GUN'}
                    </span>
                  )}
                </div>
                <span className="mt-0.5 text-[10px] sm:text-[11px] font-semibold truncate max-w-[56px] sm:max-w-[96px]">
                  {wCfg ? wCfg.name.split(' ').slice(-1)[0] : 'EMPTY'}
                </span>
              </button>
            );
          })}
          <div className="px-2 hidden sm:block font-mono-num text-[10px] text-slate-400">
            <div>[Q] CYCLE</div>
            <div className="text-cyan-300 font-bold truncate max-w-[90px]">{activeCfg.name}</div>
          </div>
        </div>
      </div>

      {/* Fortnite-Style Mobile Touch Controls */}
      {touchActive && <MobileTouchControls hud={hud} settings={settings} actions={touchActions} />}

      {/* Click to Lock Pointer Notice (Desktop Only) */}
      {!touchActive &&
        !hud.pointerLocked &&
        !(hud.mode === 'glitch_lv0' && hud.glitchChoice === 'pending') && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 translate-y-16 rounded-md border border-cyan-500/40 bg-slate-950/90 px-3.5 py-1.5 font-mono-num text-[11px] font-bold text-cyan-200">
            CLICK VIEWPORT TO LOCK AIM · [TAB] MENU
          </div>
        )}
    </div>
  );
}
