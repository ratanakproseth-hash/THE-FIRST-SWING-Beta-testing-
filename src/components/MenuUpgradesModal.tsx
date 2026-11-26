import { useState } from 'react';
import {
  ARMOR_CATALOG,
  BOSS_POWERS,
  BossPowerId,
  DIFFICULTY_CATALOG,
  ExtraArmorId,
  GameMode,
  GameSettings,
  GRAPPLE_HOOKS,
  GrappleHookId,
  MAX_LEVEL,
  MAX_WEAPON_SLOTS,
  PersistentProgress,
  SHIELD_CATALOG,
  SLOT_UPGRADE_COSTS,
  ShieldId,
  UPGRADE_CATALOG,
  UpgradeKey,
  WEAPON_CATALOG,
  WeaponId,
  getCritMultiplierDamage,
  getExtraArmorConfig,
  getLevelSubject,
  getPlayerAttackDamage,
  getPlayerMaxHp,
  getPlayerMaxMana,
  getShieldConfig,
  getUpgradeCost,
  isBossLevelNumber,
} from '../types/game';
import { WeaponPreview } from './WeaponPreview';
import { Lock, Play, RotateCcw, Shield, Sparkles, Swords, X } from 'lucide-react';

export type ModalTab = 'upgrades' | 'armory' | 'levels' | 'settings';

interface MenuUpgradesModalProps {
  initialTab: ModalTab;
  isPausedRun: boolean;
  progress: PersistentProgress;
  settings: GameSettings;
  onClose: () => void;
  onResume?: () => void;
  onReturnToTitle: () => void;
  onRestartLevel?: () => void;
  onPurchaseUpgrade: (key: UpgradeKey) => void;
  onBuySlot: () => void;
  onBuyOrEquipWeapon: (id: WeaponId, targetSlotIndex?: number) => void;
  onBuyOrEquipGrapple: (id: GrappleHookId) => void;
  onBuyOrEquipShield: (id: ShieldId) => void;
  onBuyOrEquipArmor: (id: ExtraArmorId) => void;
  onEquipPower: (id: BossPowerId) => void;
  onStartMode: (mode: GameMode, level?: number) => void;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
}

export function MenuUpgradesModal({
  initialTab,
  isPausedRun,
  progress,
  settings,
  onClose,
  onResume,
  onReturnToTitle,
  onRestartLevel,
  onPurchaseUpgrade,
  onBuySlot,
  onBuyOrEquipWeapon,
  onBuyOrEquipGrapple,
  onBuyOrEquipShield,
  onBuyOrEquipArmor,
  onEquipPower,
  onStartMode,
  onUpdateSettings,
}: MenuUpgradesModalProps) {
  const [tab, setTab] = useState<ModalTab>(initialTab);
  const [weaponFilter, setWeaponFilter] = useState<'all' | 'sword' | 'gun'>('all');

  const baseAtk = getPlayerAttackDamage(progress.upgrades);
  const maxHp = getPlayerMaxHp(progress.upgrades, progress.equippedArmor);
  const maxMana = getPlayerMaxMana(progress.upgrades);
  const critDmg = getCritMultiplierDamage(progress.upgrades);
  const shieldCfg = getShieldConfig(progress.equippedShield);
  const armorCfg = getExtraArmorConfig(progress.equippedArmor);

  const nextSlotIndex = progress.maxWeaponSlots;
  const nextSlotCost =
    nextSlotIndex < MAX_WEAPON_SLOTS ? SLOT_UPGRADE_COSTS[nextSlotIndex] : null;

  const filteredWeapons = WEAPON_CATALOG.filter((w) =>
    weaponFilter === 'all' ? true : w.category === weaponFilter,
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90 p-4">
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-3.5 bg-slate-950">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-white">
              IRON ARMOR COMMAND · {isPausedRun ? 'PAUSED' : 'ARMORY & SECTORS'}
            </h2>
            <div className="mt-0.5 flex flex-wrap gap-4 font-mono-num text-xs text-slate-300">
              <span>
                CREDITS: <strong className="text-emerald-400">${progress.credits.toLocaleString()}</strong>
              </span>
              <span>
                UPGRADE PTS: <strong className="text-amber-300">{progress.upgradePoints}</strong>
              </span>
              <span>
                HP: <strong className="text-cyan-300">{maxHp.toLocaleString()}</strong> · SHIELD:{' '}
                <strong className="text-sky-300">{shieldCfg.maxShieldHp}</strong> · ARMOR:{' '}
                <strong className="text-emerald-300">{armorCfg.damageReductionPct}%</strong> · ATK:{' '}
                <strong className="text-rose-300">{baseAtk.toLocaleString()}</strong> · 10x CRIT:{' '}
                <strong className="text-amber-300">{critDmg.toLocaleString()}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isPausedRun && onResume && (
              <button
                type="button"
                onClick={onResume}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 font-display text-xs font-bold text-slate-950 hover:bg-cyan-400"
              >
                <Play className="w-3.5 h-3.5" />
                RESUME
              </button>
            )}
            {isPausedRun && onRestartLevel && (
              <button
                type="button"
                onClick={onRestartLevel}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-display text-xs font-bold text-slate-200 hover:border-cyan-400"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                RESTART
              </button>
            )}
            <button
              type="button"
              onClick={onReturnToTitle}
              className="rounded-lg border border-rose-500/50 bg-rose-950/60 px-3 py-2 font-display text-xs font-bold text-rose-200 hover:bg-rose-900/70"
            >
              MAIN MENU
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/70 px-5">
          {(
            [
              { id: 'upgrades', label: 'SUIT UPGRADES (∞)' },
              { id: 'armory', label: `ARMORY & SLOTS (${progress.maxWeaponSlots}/6)` },
              { id: 'levels', label: 'SECTORS & MODES' },
              { id: 'settings', label: 'SETTINGS' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 font-mono-num text-xs font-bold border-b-2 transition ${
                tab === t.id
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {tab === 'upgrades' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
                <span>
                  Suit cores scale infinitely across HP, Attack, Mana, and Zip Winch duration.
                </span>
                <span className="font-mono-num text-cyan-300 font-bold">
                  MAX HP {maxHp.toLocaleString()} · MANA {maxMana.toLocaleString()} · 10x CRIT{' '}
                  {critDmg.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {UPGRADE_CATALOG.map((def) => {
                  const lvl = progress.upgrades[def.key] ?? 0;
                  const cost = getUpgradeCost(def, lvl);
                  const canAfford = progress.upgradePoints >= cost;
                  return (
                    <div
                      key={def.key}
                      className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-base font-bold text-white">{def.name}</h3>
                          <span
                            className="font-mono-num text-xs font-bold"
                            style={{ color: def.accentColor }}
                          >
                            Tier {lvl} · ∞
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{def.subtitle}</p>
                        <div className="mt-2 font-mono-num text-xs font-bold text-slate-200">
                          Current: {def.effectLabel(lvl)}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onPurchaseUpgrade(def.key)}
                        className={`w-full rounded-lg py-2 font-mono-num text-xs font-bold transition ${
                          canAfford
                            ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        UPGRADE NEXT TIER ({cost} PTS)
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'armory' && (
            <div className="space-y-6">
              {/* Unified 6-Slot Loadout Bar */}
              <div className="rounded-xl border border-cyan-500/40 bg-slate-950 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-sm font-bold text-cyan-300 uppercase">
                      UNIFIED WEAPON LOADOUT SLOTS ({progress.maxWeaponSlots} / {MAX_WEAPON_SLOTS})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Swords, Sabers, and Guns share your active loadout slots. Switch with [1–6] or
                      [Q].
                    </p>
                  </div>
                  {nextSlotCost !== null ? (
                    <button
                      type="button"
                      disabled={progress.credits < nextSlotCost}
                      onClick={onBuySlot}
                      className={`rounded-lg px-3.5 py-2 font-mono-num text-xs font-bold transition ${
                        progress.credits >= nextSlotCost
                          ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      UNLOCK SLOT {nextSlotIndex + 1} (${nextSlotCost})
                    </button>
                  ) : (
                    <span className="font-mono-num text-xs font-bold text-emerald-400">
                      ALL 6 SLOTS UNLOCKED
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {Array.from({ length: MAX_WEAPON_SLOTS }).map((_, idx) => {
                    const unlocked = idx < progress.maxWeaponSlots;
                    const wId = progress.weaponSlots[idx];
                    const cfg = wId ? WEAPON_CATALOG.find((w) => w.id === wId) : null;
                    return (
                      <div
                        key={idx}
                        className={`rounded-lg border p-2 ${
                          !unlocked
                            ? 'border-slate-800 bg-slate-900/50 opacity-60'
                            : idx === progress.activeWeaponSlot
                              ? 'border-cyan-400 bg-slate-900'
                              : 'border-slate-700 bg-slate-900/90'
                        }`}
                      >
                        <div className="font-mono-num text-[10px] font-bold text-slate-400">
                          SLOT {idx + 1} {!unlocked ? '(LOCKED)' : ''}
                        </div>
                        {cfg ? (
                          <div className="mt-1">
                            <WeaponPreview weaponId={cfg.id} className="w-full h-11" />
                            <div className="mt-1 text-[11px] font-bold text-white truncate">
                              {cfg.name}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 text-[11px] text-slate-500">
                            {unlocked ? 'Assign below' : `Cost: $${SLOT_UPGRADE_COSTS[idx]}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Left-Wrist Grapple Hooks (Disconnected from Sword) */}
              <div>
                <h3 className="font-display text-sm font-bold text-white uppercase mb-2">
                  LEFT-WRIST GRAPPLE HOOKS (DISCONNECTED FROM SWORDS)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {GRAPPLE_HOOKS.map((g) => {
                    const owned = progress.ownedGrapples.includes(g.id);
                    const equipped = progress.equippedGrapple === g.id;
                    const canBuy = progress.credits >= g.price;
                    return (
                      <div
                        key={g.id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex flex-col justify-between gap-2.5"
                      >
                        <div>
                          <WeaponPreview grappleId={g.id} className="w-full h-16" />
                          <div className="mt-2 font-display text-sm font-bold text-white">
                            {g.name}
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-400">{g.subtitle}</p>
                        </div>
                        <button
                          type="button"
                          disabled={!owned && !canBuy}
                          onClick={() => onBuyOrEquipGrapple(g.id)}
                          className={`w-full rounded-lg py-1.5 font-mono-num text-xs font-bold transition ${
                            equipped
                              ? 'border border-cyan-400 bg-cyan-950 text-cyan-200'
                              : owned
                                ? 'bg-slate-800 text-white hover:bg-slate-700'
                                : canBuy
                                  ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {equipped ? 'EQUIPPED' : owned ? 'EQUIP GRAPPLE' : `BUY ($${g.price})`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Swords & Guns Catalog with Pre-Buy Illustrations */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="font-display text-sm font-bold text-white uppercase">
                    UNIFIED SWORDS &amp; GUNS ARMORY (PREVIEW BEFORE BUYING)
                  </h3>
                  <div className="flex gap-1.5">
                    {(['all', 'sword', 'gun'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setWeaponFilter(f)}
                        className={`rounded-md border px-2.5 py-1 font-mono-num text-[11px] font-bold uppercase ${
                          weaponFilter === f
                            ? 'border-cyan-400 bg-cyan-950 text-cyan-200'
                            : 'border-slate-700 bg-slate-950 text-slate-400'
                        }`}
                      >
                        {f === 'all' ? 'All Weapons' : f === 'sword' ? 'Swords & Sabers' : 'Guns & Lasers'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredWeapons.map((w) => {
                    const owned = progress.ownedWeapons.includes(w.id);
                    const equippedSlot = progress.weaponSlots.indexOf(w.id);
                    const canBuy = progress.credits >= w.price;
                    return (
                      <div
                        key={w.id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex flex-col justify-between gap-2.5"
                      >
                        <div>
                          <WeaponPreview weaponId={w.id} className="w-full h-20" />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="font-display text-sm font-bold text-white">
                              {w.name}
                            </span>
                            <span
                              className="font-mono-num text-[10px] font-bold uppercase"
                              style={{ color: w.accentColor }}
                            >
                              {w.category}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                            {w.subtitle}
                          </p>
                          <div className="mt-1.5 font-mono-num text-[10px] text-slate-300">
                            {w.isChargeLaserBoom
                              ? '100,000 DMG · 3 AMMO · 45s CD'
                              : `${w.dmgMultiplier}x ATK · ${w.manaCost} MANA`}
                          </div>
                        </div>

                        {!owned ? (
                          <button
                            type="button"
                            disabled={!canBuy}
                            onClick={() => onBuyOrEquipWeapon(w.id)}
                            className={`w-full rounded-lg py-1.5 font-mono-num text-xs font-bold transition ${
                              canBuy
                                ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            PURCHASE (${w.price.toLocaleString()})
                          </button>
                        ) : (
                          <div className="space-y-1">
                            <div className="font-mono-num text-[10px] text-cyan-300">
                              {equippedSlot >= 0
                                ? `Equipped in Slot ${equippedSlot + 1}`
                                : 'Owned · Assign to slot:'}
                            </div>
                            <div className="grid grid-cols-6 gap-1">
                              {Array.from({ length: progress.maxWeaponSlots }).map((_, sIdx) => {
                                const inThis = progress.weaponSlots[sIdx] === w.id;
                                return (
                                  <button
                                    key={sIdx}
                                    type="button"
                                    onClick={() => onBuyOrEquipWeapon(w.id, sIdx)}
                                    className={`rounded border py-1 font-mono-num text-[10px] font-bold ${
                                      inThis
                                        ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-400'
                                    }`}
                                  >
                                    S{sIdx + 1}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Energy Shields Shop (with SVG Preview Pictures) */}
              <div>
                <h3 className="font-display text-sm font-bold text-white uppercase mb-2">
                  ENERGY SHIELDS (ABSORBS DAMAGE + AUTO-RECHARGE)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {SHIELD_CATALOG.map((sh) => {
                    const owned = progress.ownedShields.includes(sh.id);
                    const equipped = progress.equippedShield === sh.id;
                    const canBuy = progress.credits >= sh.price;
                    return (
                      <div
                        key={sh.id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex flex-col justify-between gap-2.5"
                      >
                        <div>
                          <WeaponPreview shieldId={sh.id} className="w-full h-16" />
                          <div className="mt-2 font-display text-sm font-bold text-white">
                            {sh.name}
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-400">{sh.subtitle}</p>
                          <div className="mt-1 font-mono-num text-[10px] text-cyan-300">
                            {sh.maxShieldHp > 0
                              ? `${sh.maxShieldHp} SHIELD HP · ${sh.regenPerSec}/s REGEN`
                              : 'NO ENERGY BARRIER'}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!owned && !canBuy}
                          onClick={() => onBuyOrEquipShield(sh.id)}
                          className={`w-full rounded-lg py-1.5 font-mono-num text-xs font-bold transition ${
                            equipped
                              ? 'border border-cyan-400 bg-cyan-950 text-cyan-200'
                              : owned
                                ? 'bg-slate-800 text-white hover:bg-slate-700'
                                : canBuy
                                  ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {equipped
                            ? 'EQUIPPED'
                            : owned
                              ? 'EQUIP SHIELD'
                              : `BUY ($${sh.price.toLocaleString()})`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Extra Armor Plating Shop (with SVG Preview Pictures) */}
              <div>
                <h3 className="font-display text-sm font-bold text-white uppercase mb-2">
                  EXTRA ARMOR PLATING (BONUS HULL HP + DAMAGE REDUCTION)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {ARMOR_CATALOG.map((ar) => {
                    const owned = progress.ownedArmors.includes(ar.id);
                    const equipped = progress.equippedArmor === ar.id;
                    const canBuy = progress.credits >= ar.price;
                    return (
                      <div
                        key={ar.id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex flex-col justify-between gap-2.5"
                      >
                        <div>
                          <WeaponPreview armorId={ar.id} className="w-full h-16" />
                          <div className="mt-2 font-display text-sm font-bold text-white">
                            {ar.name}
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-400">{ar.subtitle}</p>
                          <div className="mt-1 font-mono-num text-[10px] text-emerald-300">
                            +{ar.bonusHp} MAX HP · -{ar.damageReductionPct}% DMG TAKEN
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!owned && !canBuy}
                          onClick={() => onBuyOrEquipArmor(ar.id)}
                          className={`w-full rounded-lg py-1.5 font-mono-num text-xs font-bold transition ${
                            equipped
                              ? 'border border-emerald-400 bg-emerald-950 text-emerald-200'
                              : owned
                                ? 'bg-slate-800 text-white hover:bg-slate-700'
                                : canBuy
                                  ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {equipped
                            ? 'EQUIPPED'
                            : owned
                              ? 'EQUIP ARMOR'
                              : `BUY ($${ar.price.toLocaleString()})`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Boss Powers */}
              <div>
                <h3 className="font-display text-sm font-bold text-white uppercase mb-2">
                  CLAIMED BOSS POWERS ([7–0] / [X])
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {BOSS_POWERS.map((bp) => {
                    const claimed = progress.claimedPowers.includes(bp.id);
                    const equipped = progress.equippedPower === bp.id;
                    return (
                      <div
                        key={bp.id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex flex-col justify-between gap-2"
                      >
                        <div>
                          <div className="font-mono-num text-[10px] font-bold" style={{ color: bp.color }}>
                            [{bp.keyHint}] {bp.bossTitle}
                          </div>
                          <div className="font-display text-sm font-bold text-white">{bp.name}</div>
                          <p className="mt-1 text-[11px] text-slate-400">{bp.subtitle}</p>
                        </div>
                        <button
                          type="button"
                          disabled={!claimed}
                          onClick={() => onEquipPower(bp.id)}
                          className={`rounded-md py-1.5 font-mono-num text-[11px] font-bold ${
                            !claimed
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : equipped
                                ? 'border border-amber-400 bg-amber-950 text-amber-200'
                                : 'bg-slate-800 text-white hover:bg-slate-700'
                          }`}
                        >
                          {!claimed ? 'DEFEAT TITAN' : equipped ? 'EQUIPPED [X]' : 'SET DEFAULT [X]'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'levels' && (
            <div className="space-y-6">
              {/* Special & Campaign Launch Modes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => onStartMode('campaign', 1)}
                  className="rounded-xl border border-cyan-500/50 bg-slate-950 p-4 text-left hover:border-cyan-400 transition"
                >
                  <div className="flex items-center gap-2 font-display text-sm font-bold text-cyan-300">
                    <Shield className="w-4 h-4" />
                    DEPLOY SECTOR LV 1
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Drop directly in the Iron Suit into LV 1 ({getLevelSubject(1, 'campaign')}) with
                    underground warp portals.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onStartMode('tutorial', 1)}
                  className="rounded-xl border border-emerald-500/50 bg-slate-950 p-4 text-left hover:border-emerald-400 transition"
                >
                  <div className="flex items-center gap-2 font-display text-sm font-bold text-emerald-300">
                    <Sparkles className="w-4 h-4" />
                    TUTORIAL MODE (SHERLCO GUIDED)
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Master grapple swinging, wall-sliding, weak points, and Sword Barrage with
                    Sherlco.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onStartMode('outside_world', MAX_LEVEL)}
                  className="rounded-xl border border-rose-500/50 bg-slate-950 p-4 text-left hover:border-rose-400 transition"
                >
                  <div className="flex items-center gap-2 font-display text-sm font-bold text-rose-300">
                    <Swords className="w-4 h-4" />
                    OUTSIDE WORLD (150 BOTS + TITANS)
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    All bosses return alongside the 100x Final Titan &amp; 50m Fast Mimic.
                  </p>
                </button>
              </div>

              {/* Post-Endgame Unlockable Modes: FFA & Wave */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!progress.gameBeaten}
                  onClick={() => onStartMode('ffa', 1)}
                  className={`rounded-xl border p-4 text-left transition ${
                    progress.gameBeaten
                      ? 'border-amber-500/60 bg-slate-950 hover:border-amber-400'
                      : 'border-slate-800 bg-slate-950/60 opacity-65 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-amber-300">
                      FREE-FOR-ALL COLOSSEUM
                    </span>
                    {!progress.gameBeaten && <Lock className="w-4 h-4 text-slate-500" />}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {progress.gameBeaten
                      ? 'Unlocked! Every robot fights each other and hunts you across the arena.'
                      : 'Beat the game (reach THE END after Glitch LV 0) to unlock Free-For-All Mode.'}
                  </p>
                </button>

                <button
                  type="button"
                  disabled={!progress.gameBeaten}
                  onClick={() => onStartMode('wave', 1)}
                  className={`rounded-xl border p-4 text-left transition ${
                    progress.gameBeaten
                      ? 'border-violet-500/60 bg-slate-950 hover:border-violet-400'
                      : 'border-slate-800 bg-slate-950/60 opacity-65 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-violet-300">
                      ESCALATING WAVE FORTRESS
                    </span>
                    {!progress.gameBeaten && <Lock className="w-4 h-4 text-slate-500" />}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {progress.gameBeaten
                      ? 'Unlocked! Endless waves getting faster, bigger, and deadlier each round.'
                      : 'Beat the game (reach THE END after Glitch LV 0) to unlock Wave Mode.'}
                  </p>
                </button>
              </div>

              {/* Underground Portal 1-50 Campaign Sectors */}
              <div>
                <h3 className="font-display text-sm font-bold text-white uppercase mb-2">
                  UNDERGROUND PORTAL SECTORS (LV 1 – LV {MAX_LEVEL}) · BOSSES EVERY 5 LEVELS
                </h3>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {Array.from({ length: MAX_LEVEL }).map((_, idx) => {
                    const lvl = idx + 1;
                    const boss = isBossLevelNumber(lvl);
                    const unlocked = lvl <= progress.highestLevel;
                    const subject = getLevelSubject(lvl, 'campaign');
                    return (
                      <button
                        key={lvl}
                        type="button"
                        disabled={!unlocked}
                        title={`LV ${lvl}: ${subject}`}
                        onClick={() => onStartMode('campaign', lvl)}
                        className={`rounded-md border py-2 font-mono-num text-xs font-bold transition ${
                          !unlocked
                            ? 'border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed'
                            : boss
                              ? 'border-rose-500/60 bg-rose-950/70 text-rose-200 hover:bg-rose-900'
                              : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-cyan-400'
                        }`}
                      >
                        {boss ? `B${lvl}` : lvl}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <div className="space-y-1.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Difficulty Mode
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {DIFFICULTY_CATALOG.map((d) => {
                      const active = settings.difficulty === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => onUpdateSettings({ difficulty: d.id })}
                          className={`rounded-md border py-1.5 font-mono-num text-[11px] font-bold uppercase transition ${
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
                  <div className="font-mono-num text-[10px] text-slate-400">
                    {DIFFICULTY_CATALOG.find((d) => d.id === settings.difficulty)?.subtitle}
                  </div>
                </div>

                <div className="flex justify-between text-xs pt-1">
                  <span className="text-slate-300">Look / Mouse Sensitivity</span>
                  <span className="font-mono-num text-cyan-300">
                    {settings.sensitivity.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.3}
                  max={2.4}
                  step={0.05}
                  value={settings.sensitivity}
                  onChange={(e) => onUpdateSettings({ sensitivity: Number(e.target.value) })}
                  className="w-full accent-cyan-400"
                />

                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Base FOV</span>
                  <span className="font-mono-num text-cyan-300">{settings.fovBase}°</span>
                </div>
                <input
                  type="range"
                  min={68}
                  max={105}
                  step={1}
                  value={settings.fovBase}
                  onChange={(e) => onUpdateSettings({ fovBase: Number(e.target.value) })}
                  className="w-full accent-cyan-400"
                />

                <div className="pt-1 space-y-1.5">
                  <div className="text-xs text-slate-300">Graphics Quality (Smoothness)</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['low', 'medium', 'high'] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onUpdateSettings({ quality: q })}
                        className={`rounded-md border py-1.5 font-mono-num text-[11px] font-bold uppercase transition ${
                          settings.quality === q
                            ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-1 space-y-1.5">
                  <div className="text-xs text-slate-300">Control Mode (PC / Mobile)</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'auto', label: 'AUTO' },
                        { id: 'off', label: 'PC' },
                        { id: 'on', label: 'MOBILE' },
                      ] as const
                    ).map((tc) => (
                      <button
                        key={tc.id}
                        type="button"
                        onClick={() => onUpdateSettings({ touchControls: tc.id })}
                        className={`rounded-md border py-1.5 font-mono-num text-[11px] font-bold uppercase transition ${
                          settings.touchControls === tc.id
                            ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {tc.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3 text-xs">
                <div className="font-mono-num text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                  HUD &amp; Mobile Touch Layout
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">HUD Size</span>
                    <span className="font-mono-num text-cyan-300">
                      {Math.round((settings.hudScale ?? 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.75}
                    max={1.25}
                    step={0.05}
                    value={settings.hudScale ?? 1}
                    onChange={(e) => onUpdateSettings({ hudScale: Number(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Mobile Buttons Size</span>
                    <span className="font-mono-num text-cyan-300">
                      {Math.round((settings.touchScale ?? 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.75}
                    max={1.3}
                    step={0.05}
                    value={settings.touchScale ?? 1}
                    onChange={(e) => onUpdateSettings({ touchScale: Number(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Mobile Controls Opacity</span>
                    <span className="font-mono-num text-cyan-300">
                      {Math.round((settings.touchOpacity ?? 0.9) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.45}
                    max={1.0}
                    step={0.05}
                    value={settings.touchOpacity ?? 0.9}
                    onChange={(e) => onUpdateSettings({ touchOpacity: Number(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div className="border-t border-slate-800 pt-2 space-y-1.5">
                  {(
                    [
                      { key: 'hudCompact', label: 'Compact HUD (Hide Extra Panels)' },
                      { key: 'pendulumWave', label: 'Pendulum Wave Physics' },
                      { key: 'adaptiveWave', label: 'Adaptive String Tension Wave' },
                      { key: 'windEffects', label: 'High-Speed Wind Effects' },
                      { key: 'shadows', label: 'Dynamic Shadows' },
                      { key: 'muted', label: 'Mute Game Audio' },
                    ] as const
                  ).map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center justify-between cursor-pointer min-h-[34px]"
                    >
                      <span className="text-slate-200">{item.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(settings[item.key])}
                        onChange={(e) => onUpdateSettings({ [item.key]: e.target.checked })}
                        className="accent-cyan-400 w-4 h-4"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
