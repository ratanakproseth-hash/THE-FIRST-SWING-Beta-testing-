import {
  DIFFICULTY_CATALOG,
  DifficultyMode,
  GameSettings,
  MAX_LEVEL,
  MAX_WEAPON_SLOTS,
  PersistentProgress,
  getCritMultiplierDamage,
  getExtraArmorConfig,
  getGrappleHookConfig,
  getPlayerAttackDamage,
  getPlayerMaxHp,
  getShieldConfig,
} from '../types/game';
import { ModalTab } from './MenuUpgradesModal';
import { Flame, Lock, Monitor, Play, Shield, Smartphone, Sparkles, Swords, Wrench } from 'lucide-react';

interface TitleScreenProps {
  progress: PersistentProgress;
  difficulty: DifficultyMode;
  onChangeDifficulty: (mode: DifficultyMode) => void;
  touchControls: GameSettings['touchControls'];
  onChangeTouchControls: (mode: GameSettings['touchControls']) => void;
  onStartCampaign: () => void;
  onContinueCampaign: () => void;
  onStartTutorial: () => void;
  onStartOutsideWorld: () => void;
  onStartFfa: () => void;
  onStartWave: () => void;
  onOpenModal: (tab: ModalTab) => void;
}

export function TitleScreen({
  progress,
  difficulty,
  onChangeDifficulty,
  touchControls,
  onChangeTouchControls,
  onStartCampaign,
  onContinueCampaign,
  onStartTutorial,
  onStartOutsideWorld,
  onStartFfa,
  onStartWave,
  onOpenModal,
}: TitleScreenProps) {
  const maxHp = getPlayerMaxHp(progress.upgrades, progress.equippedArmor);
  const atk = getPlayerAttackDamage(progress.upgrades);
  const crit10x = getCritMultiplierDamage(progress.upgrades);
  const grapple = getGrappleHookConfig(progress.equippedGrapple);
  const shield = getShieldConfig(progress.equippedShield);
  const armor = getExtraArmorConfig(progress.equippedArmor);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/88 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900/95 p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Top Brand + Summary */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="font-mono-num text-xs font-bold uppercase tracking-widest text-cyan-400">
              FIRST-PERSON GRAPPLE SWING &amp; IRON ARMOR COMBAT
            </div>
            <h1 className="mt-1 font-display text-3xl sm:text-5xl font-black tracking-tight text-white">
              THE FIRST SWING
            </h1>
            <p className="mt-1.5 text-sm text-slate-300 max-w-xl">
              Deploy straight inside the Iron Armor Suit with Sherlco AI, wall-sliding, 6-slot
              blades &amp; guns, glowing Weak Points, and underground warp portals across 50 arenas.
            </p>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono-num text-xs space-y-1">
              <div className="text-slate-400">
                CREDITS: <strong className="text-emerald-400">${progress.credits.toLocaleString()}</strong>
              </div>
              <div className="text-slate-400">
                UPGRADE PTS: <strong className="text-amber-300">{progress.upgradePoints}</strong>
              </div>
              <div className="text-slate-400">
                SUIT: <strong className="text-cyan-300">{maxHp.toLocaleString()} HP</strong> ·{' '}
                <strong className="text-sky-300">{shield.maxShieldHp} SHD</strong> ·{' '}
                <strong className="text-emerald-300">{armor.damageReductionPct}% ARM</strong> ·{' '}
                <strong className="text-rose-300">{atk.toLocaleString()} ATK</strong> (
                <strong className="text-amber-300">{crit10x.toLocaleString()} CRIT</strong>)
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
              <span className="font-mono-num text-[10px] font-bold uppercase text-slate-400">
                DIFFICULTY
              </span>
              <div className="flex items-center gap-1">
                {DIFFICULTY_CATALOG.map((d) => {
                  const active = difficulty === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onChangeDifficulty(d.id)}
                      title={d.subtitle}
                      className={`rounded-md border px-2.5 py-1 font-mono-num text-[10px] font-bold transition ${
                        active
                          ? 'border-white text-slate-950'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                      }`}
                      style={active ? { backgroundColor: d.accentColor } : undefined}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
              <span className="font-mono-num text-[10px] font-bold uppercase text-slate-400">
                CONTROLS
              </span>
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'auto', label: 'AUTO' },
                    { id: 'off', label: 'PC', icon: Monitor },
                    { id: 'on', label: 'MOBILE', icon: Smartphone },
                  ] as const
                ).map((opt) => {
                  const Icon = 'icon' in opt ? opt.icon : null;
                  const active = touchControls === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChangeTouchControls(opt.id)}
                      className={`flex items-center gap-1 rounded-md border px-2.5 py-1 font-mono-num text-[10px] font-bold transition ${
                        active
                          ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {Icon && <Icon className="w-3 h-3" />}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Primary Launch Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={onStartCampaign}
            className="rounded-xl bg-cyan-400 p-4 text-left text-slate-950 hover:bg-cyan-300 transition shadow-lg"
          >
            <div className="flex items-center gap-2 font-display text-base font-black">
              <Play className="w-5 h-5" />
              START CAMPAIGN (LV 1)
            </div>
            <p className="mt-1 text-xs font-medium text-slate-900">
              Launch directly in the Iron Suit with Sherlco AI into Sector LV 1.
            </p>
          </button>

          <button
            type="button"
            onClick={onContinueCampaign}
            className="rounded-xl border border-cyan-500/60 bg-slate-950 p-4 text-left hover:border-cyan-400 transition"
          >
            <div className="flex items-center gap-2 font-display text-base font-bold text-white">
              <Shield className="w-4 h-4 text-cyan-400" />
              CONTINUE SECTOR LV {progress.currentLevel}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Resume directly inside the Iron Suit (Highest: LV {progress.highestLevel}/{MAX_LEVEL}
              ).
            </p>
          </button>

          <button
            type="button"
            onClick={onStartTutorial}
            className="rounded-xl border border-emerald-500/60 bg-slate-950 p-4 text-left hover:border-emerald-400 transition"
          >
            <div className="flex items-center gap-2 font-display text-base font-bold text-emerald-300">
              <Sparkles className="w-4 h-4" />
              TUTORIAL MODE
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Voice-guided training with Sherlco on grapple swinging, zip, and Sword Barrage.
            </p>
          </button>
        </div>

        {/* Endgame & Unlockable Modes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={onStartOutsideWorld}
            className="rounded-xl border border-rose-500/60 bg-rose-950/35 p-3.5 text-left hover:bg-rose-950/60 transition"
          >
            <div className="flex items-center gap-2 font-display text-sm font-bold text-rose-300">
              <Flame className="w-4 h-4" />
              OUTSIDE WORLD (LV {MAX_LEVEL})
            </div>
            <p className="mt-1 text-xs text-slate-400">
              150 bots, returning Titans, 50m Fast Mimic, and 100x Final Titan.
            </p>
          </button>

          <button
            type="button"
            disabled={!progress.gameBeaten}
            onClick={onStartFfa}
            className={`rounded-xl border p-3.5 text-left transition ${
              progress.gameBeaten
                ? 'border-amber-500/60 bg-amber-950/30 hover:bg-amber-950/55'
                : 'border-slate-800 bg-slate-950/70 opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center justify-between font-display text-sm font-bold text-amber-300">
              <span>FREE-FOR-ALL MODE</span>
              {!progress.gameBeaten && <Lock className="w-4 h-4 text-slate-500" />}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {progress.gameBeaten
                ? 'Unlocked! Chaotic multi-faction robot war.'
                : 'Reach THE END to unlock FFA.'}
            </p>
          </button>

          <button
            type="button"
            disabled={!progress.gameBeaten}
            onClick={onStartWave}
            className={`rounded-xl border p-3.5 text-left transition ${
              progress.gameBeaten
                ? 'border-violet-500/60 bg-violet-950/30 hover:bg-violet-950/55'
                : 'border-slate-800 bg-slate-950/70 opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center justify-between font-display text-sm font-bold text-violet-300">
              <span>WAVE SURVIVAL MODE</span>
              {!progress.gameBeaten && <Lock className="w-4 h-4 text-slate-500" />}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {progress.gameBeaten
                ? 'Unlocked! Waves scale harder every round.'
                : 'Reach THE END to unlock Wave Mode.'}
            </p>
          </button>
        </div>

        {/* Armory, Upgrades, Levels Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <button
            type="button"
            onClick={() => onOpenModal('armory')}
            className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-left hover:border-cyan-400 transition"
          >
            <div>
              <div className="font-display text-sm font-bold text-white flex items-center gap-2">
                <Swords className="w-4 h-4 text-cyan-400" />
                ARMORY &amp; 6 SLOTS
              </div>
              <div className="mt-0.5 font-mono-num text-[11px] text-slate-400">
                {progress.maxWeaponSlots}/{MAX_WEAPON_SLOTS} Slots · {grapple.name.split(' ')[0]}
              </div>
            </div>
            <span className="font-mono-num text-xs text-cyan-300 font-bold">OPEN</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenModal('upgrades')}
            className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-left hover:border-amber-400 transition"
          >
            <div>
              <div className="font-display text-sm font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-400" />
                SUIT UPGRADES (∞)
              </div>
              <div className="mt-0.5 font-mono-num text-[11px] text-slate-400">
                Infinite HP, ATK, Mana &amp; Zip
              </div>
            </div>
            <span className="font-mono-num text-xs text-amber-300 font-bold">
              {progress.upgradePoints} PTS
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenModal('levels')}
            className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-left hover:border-emerald-400 transition"
          >
            <div>
              <div className="font-display text-sm font-bold text-white">SECTORS 1–50 &amp; SETTINGS</div>
              <div className="mt-0.5 font-mono-num text-[11px] text-slate-400">
                6 Arena Shapes · Connected Map
              </div>
            </div>
            <span className="font-mono-num text-xs text-emerald-300 font-bold">SELECT</span>
          </button>
        </div>
      </div>
    </div>
  );
}
