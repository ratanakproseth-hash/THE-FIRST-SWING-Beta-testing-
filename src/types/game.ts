export const MAX_LEVEL = 50;
export const MAX_WEAPON_SLOTS = 6;
export const ZIP_COOLDOWN_SEC = 0.3;
export const SLO_MO_DURATION_SEC = 20;
export const SLO_MO_COOLDOWN_SEC = 10;
export const OUTSIDE_WORLD_BOT_COUNT = 150;
export const LASER_BOOM_DMG = 100_000;
export const LASER_BOOM_MAX_AMMO = 3;
export const LASER_BOOM_COOLDOWN_SEC = 45;
export const SWORD_BARRAGE_COOLDOWN_SEC = 4.5;
export const SWORD_BARRAGE_MANA_COST = 16;
export const BOSS_BASE_DAMAGE = 400;

export type AppPhase =
  | 'title'
  | 'playing'
  | 'paused'
  | 'level_clear'
  | 'game_over'
  | 'the_end';

export type GameMode =
  | 'campaign'
  | 'tutorial'
  | 'outside_world'
  | 'glitch_lv0'
  | 'ffa'
  | 'wave';

export type GlitchOutcomeChoice = 'pending' | 'fight' | 'run';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type DifficultyMode = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
  id: DifficultyMode;
  label: string;
  subtitle: string;
  accentColor: string;
  enemyHpMult: number;
  enemyDamageMult: number;
  enemySpeedMult: number;
  rewardMult: number;
}

export const DIFFICULTY_CATALOG: DifficultyConfig[] = [
  {
    id: 'easy',
    label: 'EASY',
    subtitle: '70% Enemy HP · 55% Damage · 82% Speed · 90% Rewards',
    accentColor: '#34d399',
    enemyHpMult: 0.7,
    enemyDamageMult: 0.55,
    enemySpeedMult: 0.82,
    rewardMult: 0.9,
  },
  {
    id: 'normal',
    label: 'NORMAL',
    subtitle: '100% Enemy HP · 100% Damage · Standard Speed & Rewards',
    accentColor: '#38bdf8',
    enemyHpMult: 1.0,
    enemyDamageMult: 1.0,
    enemySpeedMult: 1.0,
    rewardMult: 1.0,
  },
  {
    id: 'hard',
    label: 'HARD',
    subtitle: '138% Enemy HP · 145% Damage · 120% Speed · 135% Rewards',
    accentColor: '#fb7185',
    enemyHpMult: 1.38,
    enemyDamageMult: 1.45,
    enemySpeedMult: 1.2,
    rewardMult: 1.35,
  },
];

export function getDifficultyConfig(difficulty: DifficultyMode): DifficultyConfig {
  return DIFFICULTY_CATALOG.find((d) => d.id === difficulty) ?? DIFFICULTY_CATALOG[1];
}

export type UpgradeKey = 'hp' | 'attack' | 'mana' | 'zip';

export type UpgradeLevels = Record<UpgradeKey, number>;

export const DEFAULT_UPGRADES: UpgradeLevels = {
  hp: 0,
  attack: 0,
  mana: 0,
  zip: 0,
};

export const ATTACK_DAMAGE_TIERS = [
  10, 25, 55, 100, 175, 275, 400, 560, 760, 1000,
] as const;

export function getPlayerMaxHp(
  upgrades: UpgradeLevels,
  armorId: ExtraArmorId = 'none',
): number {
  const lvl = Math.max(0, upgrades.hp ?? 0);
  const armorBonus = getExtraArmorConfig(armorId).bonusHp;
  return 125 + lvl * 125 + armorBonus; // Scales infinitely: 125 -> 250 -> ... -> + Armor bonus
}

export function getPlayerAttackDamage(upgrades: UpgradeLevels): number {
  const lvl = Math.max(0, upgrades.attack ?? 0);
  if (lvl < ATTACK_DAMAGE_TIERS.length) {
    return ATTACK_DAMAGE_TIERS[lvl];
  }
  return 1000 + (lvl - (ATTACK_DAMAGE_TIERS.length - 1)) * 250; // Infinite scaling beyond 1,000
}

export function getCritMultiplierDamage(upgrades: UpgradeLevels): number {
  // Crit is strictly 10x the player's Attack stat
  return getPlayerAttackDamage(upgrades) * 10;
}

export function getPlayerMaxMana(upgrades: UpgradeLevels): number {
  const lvl = Math.max(0, upgrades.mana ?? 0);
  return 100 + lvl * 25; // Infinite scaling
}

export function getManaRegenRate(upgrades: UpgradeLevels): number {
  const lvl = Math.max(0, upgrades.mana ?? 0);
  return 22 + lvl * 4.5; // Infinite scaling
}

export function getZipStats(upgrades: UpgradeLevels): {
  maxRange: number;
  maxDuration: number;
  pullSpeed: number;
} {
  const lvl = Math.max(0, upgrades.zip ?? 0);
  return {
    maxRange: 85 + lvl * 12,
    maxDuration: 1.25 + lvl * 0.2,
    pullSpeed: 68 + lvl * 5.2,
  };
}

export function getBossHpForLevel(level: number, isOutsideWorld = false): number {
  if (isOutsideWorld || level >= MAX_LEVEL) return 1_000_000;
  const clamped = Math.max(5, Math.min(MAX_LEVEL, level));
  const t = (clamped - 5) / Math.max(1, MAX_LEVEL - 5);
  return Math.round(10_000 + Math.pow(t, 1.35) * 990_000);
}

export function getBossDamageForLevel(): number {
  // Bosses deal 400 HP damage
  return BOSS_BASE_DAMAGE;
}

export function getBossScaleForLevel(level: number): number {
  // Bosses grow noticeably bigger each encounter across the 50 levels
  const tier = Math.max(0, Math.floor(level / 5) - 1);
  return 1.0 + tier * 0.26;
}

export interface UpgradeDefinition {
  key: UpgradeKey;
  name: string;
  subtitle: string;
  baseCost: number;
  effectLabel: (level: number) => string;
  accentColor: string;
}

export const UPGRADE_CATALOG: UpgradeDefinition[] = [
  {
    key: 'hp',
    name: 'HP Shield Plating',
    subtitle: 'Infinite scaling (+125 Shield HP per tier, starting at 125)',
    baseCost: 2,
    effectLabel: (lvl) => `${125 + lvl * 125} Max HP`,
    accentColor: '#10b981',
  },
  {
    key: 'attack',
    name: 'Attack Edge & Core',
    subtitle: 'Infinite scaling (10 -> 1,000+ Base DMG · Criticals deal 10x stat)',
    baseCost: 2,
    effectLabel: (lvl) => {
      const fake = { hp: 0, attack: lvl, mana: 0, zip: 0 };
      const base = getPlayerAttackDamage(fake);
      return `${base.toLocaleString()} Base · ${(base * 10).toLocaleString()} (10x Crit)`;
    },
    accentColor: '#ef4444',
  },
  {
    key: 'mana',
    name: 'Mana & Energy Core',
    subtitle: 'Infinite Mana & regen scaling for Heavy Guns, Barrage, Blocking & Powers',
    baseCost: 2,
    effectLabel: (lvl) => `${100 + lvl * 25} Max Mana · ${Math.round(22 + lvl * 4.5)}/s Regen`,
    accentColor: '#a855f7',
  },
  {
    key: 'zip',
    name: 'Zip Lasting Winch',
    subtitle: 'Infinite scaling for Zip duration, range & pull acceleration (0.3s CD)',
    baseCost: 2,
    effectLabel: (lvl) =>
      `${(1.25 + lvl * 0.2).toFixed(2)}s Zip Pull · ${85 + lvl * 12}m Range`,
    accentColor: '#06b6d4',
  },
];

export function getUpgradeCost(def: UpgradeDefinition, currentLevel: number): number {
  if (currentLevel < 10) {
    return Math.round(def.baseCost * Math.pow(1.48, currentLevel) + currentLevel * 2);
  }
  return Math.round(90 + (currentLevel - 9) * 28);
}

// --- BOSS POWERS ---
export type BossPowerId = 'fire' | 'water' | 'punch' | 'shrink';

export interface BossPowerConfig {
  id: BossPowerId;
  keyHint: string;
  name: string;
  bossTitle: string;
  subtitle: string;
  manaCost: number;
  cooldownSec: number;
  color: string;
}

export const BOSS_POWERS: BossPowerConfig[] = [
  {
    id: 'fire',
    keyHint: '7',
    name: 'Inferno Nova',
    bossTitle: 'Pyro-Titan',
    subtitle: 'Launches an explosive solar fireball blast & scorching ring (2.4x DMG AoE)',
    manaCost: 22,
    cooldownSec: 5.5,
    color: '#f97316',
  },
  {
    id: 'water',
    keyHint: '8',
    name: 'Hydro Surge',
    bossTitle: 'Leviathan-Titan',
    subtitle: 'Blasts a pressurized tidal wave that stuns & hurls enemies back (1.8x DMG)',
    manaCost: 18,
    cooldownSec: 5.0,
    color: '#0ea5e9',
  },
  {
    id: 'punch',
    keyHint: '9',
    name: 'Colossus Wipe Punch',
    bossTitle: 'Breaker-Titan',
    subtitle: 'Devastating kinetic punch that wipes cover buildings & crushes foes (3.2x DMG)',
    manaCost: 28,
    cooldownSec: 7.0,
    color: '#eab308',
  },
  {
    id: 'shrink',
    keyHint: '0',
    name: 'Quantum Shrink',
    bossTitle: 'Singularity-Titan',
    subtitle: 'Shrinks target villains to 48% size, halving their damage & boosting hits +50%',
    manaCost: 20,
    cooldownSec: 6.5,
    color: '#d946ef',
  },
];

export function getBossPowerConfig(id: BossPowerId): BossPowerConfig {
  return BOSS_POWERS.find((p) => p.id === id) ?? BOSS_POWERS[0];
}

export function getBossPowerForLevel(level: number): BossPowerId {
  const bossIdx = Math.max(0, Math.floor(level / 5) - 1);
  return BOSS_POWERS[bossIdx % BOSS_POWERS.length].id;
}

// --- DISCONNECTED GRAPPLE HOOK SYSTEM (LEFT WRIST) ---
export type GrappleHookId = 'standard_hook' | 'titanium_winch' | 'quantum_hook';

export interface GrappleHookConfig {
  id: GrappleHookId;
  name: string;
  subtitle: string;
  price: number;
  rangeBonus: number;
  speedBonus: number;
  accentColor: string;
}

export const GRAPPLE_HOOKS: GrappleHookConfig[] = [
  {
    id: 'standard_hook',
    name: 'Wrist-Mounted Grapple Hook',
    subtitle: 'Disconnected from sword — dual-prong magnetic cable gauntlet on left wrist',
    price: 0,
    rangeBonus: 0,
    speedBonus: 1.0,
    accentColor: '#22d3ee',
  },
  {
    id: 'titanium_winch',
    name: 'Titan Winch Grapple',
    subtitle: '+25m tether reach & +18% faster pendulum acceleration',
    price: 260,
    rangeBonus: 25,
    speedBonus: 1.18,
    accentColor: '#38bdf8',
  },
  {
    id: 'quantum_hook',
    name: 'Singularity Grapple Claw',
    subtitle: '+55m extreme reach & +32% slingshot momentum transfer',
    price: 750,
    rangeBonus: 55,
    speedBonus: 1.32,
    accentColor: '#a855f7',
  },
];

export function getGrappleHookConfig(id: GrappleHookId): GrappleHookConfig {
  return GRAPPLE_HOOKS.find((g) => g.id === id) ?? GRAPPLE_HOOKS[0];
}

// --- ENERGY SHIELDS & EXTRA ARMOR PLATING (SHOP WITH PICTURES) ---
export type ShieldId = 'none' | 'aegis_mk1' | 'bastion_mk2' | 'quantum_aegis';

export interface ShieldConfig {
  id: ShieldId;
  name: string;
  subtitle: string;
  price: number;
  maxShieldHp: number;
  regenPerSec: number;
  accentColor: string;
}

export const SHIELD_CATALOG: ShieldConfig[] = [
  {
    id: 'none',
    name: 'No Energy Shield',
    subtitle: 'Unshielded Iron Suit frame — relies solely on Suit Armor HP & Dodge',
    price: 0,
    maxShieldHp: 0,
    regenPerSec: 0,
    accentColor: '#64748b',
  },
  {
    id: 'aegis_mk1',
    name: 'Aegis Deflector Mk-I',
    subtitle: '+140 Regenerating Energy Shield HP · Recharges 28/s out of combat',
    price: 180,
    maxShieldHp: 140,
    regenPerSec: 28,
    accentColor: '#38bdf8',
  },
  {
    id: 'bastion_mk2',
    name: 'Bastion Hex-Barrier Mk-II',
    subtitle: '+320 Regenerating Energy Shield HP · Recharges 55/s out of combat',
    price: 420,
    maxShieldHp: 320,
    regenPerSec: 55,
    accentColor: '#22d3ee',
  },
  {
    id: 'quantum_aegis',
    name: 'Quantum Over-Shield Core',
    subtitle: '+620 Regenerating Energy Shield HP · Rapid 95/s recharge barrier',
    price: 860,
    maxShieldHp: 620,
    regenPerSec: 95,
    accentColor: '#a855f7',
  },
];

export function getShieldConfig(id: ShieldId): ShieldConfig {
  return SHIELD_CATALOG.find((s) => s.id === id) ?? SHIELD_CATALOG[0];
}

export type ExtraArmorId = 'none' | 'titanium_plate' | 'nano_carapace' | 'omega_juggernaut';

export interface ExtraArmorConfig {
  id: ExtraArmorId;
  name: string;
  subtitle: string;
  price: number;
  bonusHp: number;
  damageReductionPct: number;
  accentColor: string;
}

export const ARMOR_CATALOG: ExtraArmorConfig[] = [
  {
    id: 'none',
    name: 'Standard Suit Chassis',
    subtitle: 'Default Mk-I Iron Suit alloy · 0% extra armor reduction',
    price: 0,
    bonusHp: 0,
    damageReductionPct: 0,
    accentColor: '#64748b',
  },
  {
    id: 'titanium_plate',
    name: 'Titanium Reactive Plating',
    subtitle: '+90 Max Suit HP & 14% incoming damage reduction from all hits',
    price: 160,
    bonusHp: 90,
    damageReductionPct: 14,
    accentColor: '#f59e0b',
  },
  {
    id: 'nano_carapace',
    name: 'Nano-Carbon Exo-Carapace',
    subtitle: '+220 Max Suit HP & 26% incoming damage reduction vs Lasers & Bosses',
    price: 390,
    bonusHp: 220,
    damageReductionPct: 26,
    accentColor: '#10b981',
  },
  {
    id: 'omega_juggernaut',
    name: 'Omega Juggernaut Exo-Suit',
    subtitle: '+480 Max Suit HP & 40% incoming damage reduction fortress plating',
    price: 820,
    bonusHp: 480,
    damageReductionPct: 40,
    accentColor: '#f43f5e',
  },
];

export function getExtraArmorConfig(id: ExtraArmorId): ExtraArmorConfig {
  return ARMOR_CATALOG.find((a) => a.id === id) ?? ARMOR_CATALOG[0];
}

// --- LEVEL SUBJECTS (LV 1-50 & SPECIAL MODES) ---
export const LEVEL_SUBJECTS: string[] = [
  'Calibration Yard: First Flight & Grapple Basics',
  'Perimeter Laser Grid: Sweep Dodging',
  'Hostage Extraction: Cryo Outpost Alpha',
  'Canyon Flankers: Pyro Ambush',
  'TITAN TRIAL I: Pyro-Titan Furnace Core',
  'Sniper Watchtowers: Volt Overwatch',
  'Shadow Corridors: Void Blink Ambush',
  'Twin-Arch Siege: Juggernaut Bastion',
  'High-Wire Crossing: Lancer Skirmishers',
  'TITAN TRIAL II: Leviathan-Titan Hydro Lock',
  'Cryo Helix Ascent: Frostbite Gauntlet',
  'Laser Crossfire: Scorched Bastion',
  'Deep Lattice: Cryo & Pyro Synthesis',
  'Pulse Bridge: Volt Rail Ambush',
  'TITAN TRIAL III: Breaker-Titan Wrecking Yard',
  'Suspended Spires: Void Shadow Hunt',
  'Lancer Vanguard: Aerial Grapple Duel',
  'Refraction Vault: Twin-Laser Labyrinth',
  'Armored Citadel: Heavy Juggernaut Line',
  'TITAN TRIAL IV: Singularity-Titan Rift',
  'Thermal Helix: Magma Laser Sweepers',
  'Sub-Zero Sector: Stalker Pack',
  'Voltaic Archway: High-Voltage Snipers',
  'Phantom Bridge: Blinking Mimic Squad',
  'TITAN TRIAL V: Overclocked Pyro-Titan',
  'Prism Quarry: Rotating Laser Towers',
  'Blaze Ramparts: Bombardier Barrage',
  'Cryo Vault: Rescue & Escort Protocol',
  'Void Apex: Assassins in the Fog',
  'TITAN TRIAL VI: Abyssal Leviathan-Titan',
  'Kinetic Helix: Heavy Lancer Phalanx',
  'Shock Grid: Dual-Laser Corridor',
  'Iron Bastion: Juggernaut Fortress',
  'Storm Ridge: Volt & Cryo Crossfire',
  'TITAN TRIAL VII: Siegebreaker Titan Prime',
  'Eclipse Labyrinth: Blinking Stalkers',
  'Solar Bridge: Pyro Bomber Armada',
  'Zero-G Conduit: Gravity Tether Gauntlet',
  'Shattered Pyramid: Elite Hunter Conclave',
  'TITAN TRIAL VIII: Void Singularity Titan',
  'Apex Helix: Quad-Laser Gauntlet',
  'Storm Citadel: Lancer & Sniper Alliance',
  'Meltdown Canyon: Inferno & Volt Mix',
  'Phantom Pyramid: Mirror Mimic Swarm',
  'TITAN TRIAL IX: Supreme Overlord Titan',
  'Omega Lattice: Laser Storm Protocol',
  'Final Ascent: Juggernaut & Assassin Guard',
  'Quantum Core: Rescue the Elite Vanguard',
  'Threshold Gate: 49th Sector Lockdown',
  'OMEGA FINALE: Outside World Apocalypse (150 Bots)',
];

export function getLevelSubject(level: number, mode: GameMode): string {
  if (mode === 'tutorial') return 'Combat Training Academy: Lasers, Wall-Slide & Weak Points';
  if (mode === 'outside_world') return 'OMEGA FINALE: Outside World Apocalypse (150 Bots + Titan)';
  if (mode === 'glitch_lv0') return 'GLITCH SECTOR LV.0: Infinite Titan Anomaly';
  if (mode === 'ffa') return 'Free-For-All Royale: All-Out Mech Battle';
  if (mode === 'wave') return 'Endless Wave Survival: Escalating Threat Matrix';
  const idx = Math.max(0, Math.min(LEVEL_SUBJECTS.length - 1, level - 1));
  return LEVEL_SUBJECTS[idx];
}

// --- 200-ABILITY & ATTACK ARSENAL FOR ROBOTS & BOSSES ---
export type AbilityPatternKind =
  | 'burst_3'
  | 'fan_5'
  | 'spiral_ring'
  | 'sniper_lance'
  | 'mortar_arc'
  | 'homing_seekers'
  | 'scatter_shotgun'
  | 'cross_beam_volley'
  | 'dash_cleave'
  | 'blink_ambush'
  | 'gravity_tether'
  | 'shockwave_slam'
  | 'twin_helix'
  | 'cluster_bomb'
  | 'barrage_rain'
  | 'orbit_blades'
  | 'rail_piercer'
  | 'vortex_pull'
  | 'sweeping_arc'
  | 'overload_nova';

export interface EnemyAbilityModule {
  code: string;
  prefix: string;
  colorHex: number;
  speedMult: number;
  dmgMult: number;
  cryoSlow: boolean;
  explosive: boolean;
  gravityPull: boolean;
  homing: boolean;
}

export const ENEMY_ABILITY_MODULES: EnemyAbilityModule[] = [
  { code: 'pyro', prefix: 'Pyro', colorHex: 0xf97316, speedMult: 1.05, dmgMult: 1.15, cryoSlow: false, explosive: true, gravityPull: false, homing: false },
  { code: 'cryo', prefix: 'Cryo', colorHex: 0x38bdf8, speedMult: 0.96, dmgMult: 0.95, cryoSlow: true, explosive: false, gravityPull: false, homing: false },
  { code: 'volt', prefix: 'Volt', colorHex: 0xfacc15, speedMult: 1.38, dmgMult: 1.05, cryoSlow: false, explosive: false, gravityPull: false, homing: false },
  { code: 'void', prefix: 'Void', colorHex: 0xc026d3, speedMult: 1.12, dmgMult: 1.2, cryoSlow: false, explosive: false, gravityPull: true, homing: true },
  { code: 'solar', prefix: 'Solar', colorHex: 0xfbbf24, speedMult: 1.18, dmgMult: 1.25, cryoSlow: false, explosive: true, gravityPull: false, homing: false },
  { code: 'abyss', prefix: 'Abyssal', colorHex: 0x6366f1, speedMult: 1.04, dmgMult: 1.12, cryoSlow: true, explosive: false, gravityPull: true, homing: false },
  { code: 'plasma', prefix: 'Plasma', colorHex: 0x22d3ee, speedMult: 1.26, dmgMult: 1.1, cryoSlow: false, explosive: false, gravityPull: false, homing: true },
  { code: 'crimson', prefix: 'Crimson', colorHex: 0xef4444, speedMult: 1.22, dmgMult: 1.3, cryoSlow: false, explosive: true, gravityPull: false, homing: false },
  { code: 'sonic', prefix: 'Sonic', colorHex: 0x34d399, speedMult: 1.44, dmgMult: 0.95, cryoSlow: false, explosive: false, gravityPull: false, homing: false },
  { code: 'omega', prefix: 'Omega', colorHex: 0xf43f5e, speedMult: 1.32, dmgMult: 1.35, cryoSlow: true, explosive: true, gravityPull: true, homing: true },
];

export interface EnemyAbilityPatternDef {
  pattern: AbilityPatternKind;
  suffix: string;
  boltCount: number;
  spreadRad: number;
  shockwaveRadius: number;
}

export const ENEMY_ABILITY_PATTERNS: EnemyAbilityPatternDef[] = [
  { pattern: 'burst_3', suffix: 'Tri-Burst', boltCount: 3, spreadRad: 0.14, shockwaveRadius: 0 },
  { pattern: 'fan_5', suffix: 'Pentagram Fan', boltCount: 5, spreadRad: 0.36, shockwaveRadius: 0 },
  { pattern: 'spiral_ring', suffix: 'Spiral Ring', boltCount: 8, spreadRad: 6.28, shockwaveRadius: 0 },
  { pattern: 'sniper_lance', suffix: 'Hyper Lance', boltCount: 1, spreadRad: 0.01, shockwaveRadius: 0 },
  { pattern: 'mortar_arc', suffix: 'Siege Mortar', boltCount: 3, spreadRad: 0.28, shockwaveRadius: 5.5 },
  { pattern: 'homing_seekers', suffix: 'Seeker Swarm', boltCount: 4, spreadRad: 0.48, shockwaveRadius: 0 },
  { pattern: 'scatter_shotgun', suffix: 'Flak Scatter', boltCount: 6, spreadRad: 0.34, shockwaveRadius: 0 },
  { pattern: 'cross_beam_volley', suffix: 'Crossfire Volley', boltCount: 4, spreadRad: 0.24, shockwaveRadius: 0 },
  { pattern: 'dash_cleave', suffix: 'Blitz Dash Strike', boltCount: 3, spreadRad: 0.22, shockwaveRadius: 4.5 },
  { pattern: 'blink_ambush', suffix: 'Phase Blink Ambush', boltCount: 4, spreadRad: 0.28, shockwaveRadius: 0 },
  { pattern: 'gravity_tether', suffix: 'Gravity Snare', boltCount: 2, spreadRad: 0.16, shockwaveRadius: 6.0 },
  { pattern: 'shockwave_slam', suffix: 'Tectonic Slam', boltCount: 6, spreadRad: 1.2, shockwaveRadius: 8.5 },
  { pattern: 'twin_helix', suffix: 'Twin Helix Stream', boltCount: 4, spreadRad: 0.12, shockwaveRadius: 0 },
  { pattern: 'cluster_bomb', suffix: 'Cluster Detonation', boltCount: 5, spreadRad: 0.52, shockwaveRadius: 6.0 },
  { pattern: 'barrage_rain', suffix: 'Skyfall Barrage', boltCount: 6, spreadRad: 0.44, shockwaveRadius: 4.5 },
  { pattern: 'orbit_blades', suffix: 'Orbital Saw Ring', boltCount: 6, spreadRad: 1.8, shockwaveRadius: 0 },
  { pattern: 'rail_piercer', suffix: 'Railgun Piercer', boltCount: 2, spreadRad: 0.04, shockwaveRadius: 0 },
  { pattern: 'vortex_pull', suffix: 'Singularity Pull', boltCount: 5, spreadRad: 0.65, shockwaveRadius: 7.0 },
  { pattern: 'sweeping_arc', suffix: 'Sweeping Arc Wave', boltCount: 7, spreadRad: 0.68, shockwaveRadius: 0 },
  { pattern: 'overload_nova', suffix: 'Core Overload Nova', boltCount: 10, spreadRad: 6.28, shockwaveRadius: 9.0 },
];

export interface EnemyAbilitySpec {
  id: number; // 0..199 (200 distinct attacks/abilities!)
  name: string;
  pattern: AbilityPatternKind;
  module: EnemyAbilityModule;
  colorHex: number;
  boltCount: number;
  spreadRad: number;
  speedMult: number;
  dmgMult: number;
  homing: boolean;
  explosive: boolean;
  gravityPull: boolean;
  cryoSlow: boolean;
  shockwaveRadius: number;
}

export const ENEMY_ABILITY_CATALOG: EnemyAbilitySpec[] = (() => {
  const list: EnemyAbilitySpec[] = [];
  for (let p = 0; p < ENEMY_ABILITY_PATTERNS.length; p++) {
    for (let m = 0; m < ENEMY_ABILITY_MODULES.length; m++) {
      const pat = ENEMY_ABILITY_PATTERNS[p];
      const mod = ENEMY_ABILITY_MODULES[m];
      const id = p * ENEMY_ABILITY_MODULES.length + m;
      list.push({
        id,
        name: `${mod.prefix} ${pat.suffix}`,
        pattern: pat.pattern,
        module: mod,
        colorHex: mod.colorHex,
        boltCount: pat.boltCount,
        spreadRad: pat.spreadRad,
        speedMult: mod.speedMult,
        dmgMult: mod.dmgMult,
        homing: mod.homing || pat.pattern === 'homing_seekers',
        explosive: mod.explosive || pat.shockwaveRadius > 0,
        gravityPull: mod.gravityPull || pat.pattern === 'gravity_tether' || pat.pattern === 'vortex_pull',
        cryoSlow: mod.cryoSlow,
        shockwaveRadius: pat.shockwaveRadius,
      });
    }
  }
  return list;
})();

export function getEnemyAbilitySpec(index: number): EnemyAbilitySpec {
  const safe = ((Math.floor(index) % ENEMY_ABILITY_CATALOG.length) + ENEMY_ABILITY_CATALOG.length) % ENEMY_ABILITY_CATALOG.length;
  return ENEMY_ABILITY_CATALOG[safe];
}

// --- UNIFIED WEAPON CATEGORY: SWORDS & GUNS SHARE UP TO 6 LOADOUT SLOTS ---
export type WeaponCategory = 'sword' | 'gun';

export type SwordWeaponId =
  | 'katana'
  | 'ripper'
  | 'saber'
  | 'axe'
  | 'lightsaber'
  | 'scythe'
  | 'plasma'
  | 'void';

export type GunWeaponId =
  | 'sidearm'
  | 'smg'
  | 'carbine'
  | 'shotgun'
  | 'sniper'
  | 'rpg'
  | 'railcannon'
  | 'laser_boom';

export type WeaponId = SwordWeaponId | GunWeaponId;

export interface WeaponConfig {
  id: WeaponId;
  category: WeaponCategory;
  name: string;
  subtitle: string;
  animStyle: string;
  price: number;
  dmgMultiplier: number;
  cooldown: number;
  manaCost: number;
  accentColor: string;
  bladeColor?: string;
  reachBonus?: number;
  recoilPitch?: number;
  recoilYaw?: number;
  pellets?: number;
  spread?: number;
  blastRadius?: number;
  hasScopeZoom?: boolean;
  isOpticScope?: boolean;
  zoomFov?: number;
  zoomLabel?: string;
  isChargeLaserBoom?: boolean;
}

export const SLOT_UPGRADE_COSTS = [0, 0, 180, 360, 620, 980] as const;

export const WEAPON_CATALOG: WeaponConfig[] = [
  // --- SWORDS & MELEE ---
  {
    id: 'katana',
    category: 'sword',
    name: 'Cyber Katana',
    subtitle: 'Balanced high-speed steel blade (1.0x DMG · [F] Sword Barrage ready)',
    animStyle: 'Diagonal Snap Slash',
    price: 0,
    dmgMultiplier: 1.0,
    cooldown: 0.26,
    manaCost: 4,
    reachBonus: 0.4,
    bladeColor: '#e2e8f0',
    accentColor: '#22d3ee',
  },
  {
    id: 'ripper',
    category: 'sword',
    name: 'Cobalt Ripper Edge',
    subtitle: '+45% cleave damage & extended reach',
    animStyle: 'Diagonal Snap Slash',
    price: 150,
    dmgMultiplier: 1.45,
    cooldown: 0.26,
    manaCost: 6,
    reachBonus: 0.9,
    bladeColor: '#bae6fd',
    accentColor: '#3b82f6',
  },
  {
    id: 'saber',
    category: 'sword',
    name: 'Vanguard Duelist Saber',
    subtitle: 'Curved arc-edge saber with rapid thrust & sweeping cut (1.85x DMG)',
    animStyle: 'Curved Duelist Thrust',
    price: 260,
    dmgMultiplier: 1.85,
    cooldown: 0.22,
    manaCost: 8,
    reachBonus: 1.25,
    bladeColor: '#f8fafc',
    accentColor: '#10b981',
  },
  {
    id: 'axe',
    category: 'sword',
    name: 'Titan Battle Axe',
    subtitle: 'Heavy twin-crescent axe with crushing overhead cleave (2.1x DMG)',
    animStyle: 'Overhead Vertical Cleave',
    price: 340,
    dmgMultiplier: 2.1,
    cooldown: 0.4,
    manaCost: 11,
    reachBonus: 1.35,
    bladeColor: '#cbd5e1',
    accentColor: '#f97316',
  },
  {
    id: 'plasma',
    category: 'sword',
    name: 'Solaris Plasma Cleaver',
    subtitle: 'High-heat amber plasma edge (2.2x DMG)',
    animStyle: 'Diagonal Snap Slash',
    price: 460,
    dmgMultiplier: 2.2,
    cooldown: 0.26,
    manaCost: 12,
    reachBonus: 1.5,
    bladeColor: '#fef08a',
    accentColor: '#f59e0b',
  },
  {
    id: 'lightsaber',
    category: 'sword',
    name: 'Plasma Lightsaber',
    subtitle: 'Pure ionized beam blade with hyper-fast figure-8 cross-slashes (2.5x DMG)',
    animStyle: 'Figure-8 Plasma Flourish',
    price: 680,
    dmgMultiplier: 2.5,
    cooldown: 0.19,
    manaCost: 14,
    reachBonus: 1.85,
    bladeColor: '#ffffff',
    accentColor: '#38bdf8',
  },
  {
    id: 'scythe',
    category: 'sword',
    name: 'Reaper Crescent Scythe',
    subtitle: 'Wide 180° sweeping polearm arc hitting multiple foes (2.9x DMG)',
    animStyle: '180° Wide Reaping Sweep',
    price: 980,
    dmgMultiplier: 2.9,
    cooldown: 0.34,
    manaCost: 16,
    reachBonus: 2.8,
    bladeColor: '#e2e8f0',
    accentColor: '#a855f7',
  },
  {
    id: 'void',
    category: 'sword',
    name: 'Singularity Void Blade',
    subtitle: '3.2x damage & sweeping crimson-violet wave arc',
    animStyle: 'Cross-Slash Arc',
    price: 1350,
    dmgMultiplier: 3.2,
    cooldown: 0.25,
    manaCost: 20,
    reachBonus: 2.4,
    bladeColor: '#f5d0fe',
    accentColor: '#d946ef',
  },

  // --- GUNS & HEAVY CANNONS (ALL SUPPORT ZOOM/ADS) ---
  {
    id: 'sidearm',
    category: 'gun',
    name: 'Pulse Sidearm',
    subtitle: 'Hold [RMB] for 1.5x Iron-Sight Zoom · Crisp accuracy, low mana drain',
    animStyle: 'Semi-Auto Pistol',
    price: 0,
    dmgMultiplier: 1.0,
    cooldown: 0.17,
    manaCost: 4,
    recoilPitch: 0.018,
    recoilYaw: 0.006,
    pellets: 1,
    spread: 0.004,
    hasScopeZoom: true,
    isOpticScope: false,
    zoomFov: 56,
    zoomLabel: '1.5x IRON SIGHT',
    accentColor: '#38bdf8',
  },
  {
    id: 'smg',
    category: 'gun',
    name: 'Vector Rapid SMG',
    subtitle: 'Hold [RMB] for 1.6x Holo Zoom · Blistering full-auto, 5 Mana/shot',
    animStyle: 'Full-Auto SMG',
    price: 140,
    dmgMultiplier: 0.82,
    cooldown: 0.075,
    manaCost: 5,
    recoilPitch: 0.021,
    recoilYaw: 0.016,
    pellets: 1,
    spread: 0.022,
    hasScopeZoom: true,
    isOpticScope: false,
    zoomFov: 52,
    zoomLabel: '1.6x HOLO REFLEX',
    accentColor: '#34d399',
  },
  {
    id: 'carbine',
    category: 'gun',
    name: 'Twin-Rail Carbine',
    subtitle: 'Hold [RMB] for 2.0x ACOG Zoom · Balanced auto-fire, 1.45x DMG',
    animStyle: 'Auto Rail Rifle',
    price: 220,
    dmgMultiplier: 1.45,
    cooldown: 0.12,
    manaCost: 8,
    recoilPitch: 0.028,
    recoilYaw: 0.014,
    pellets: 1,
    spread: 0.011,
    hasScopeZoom: true,
    isOpticScope: false,
    zoomFov: 44,
    zoomLabel: '2.0x TACTICAL ACOG',
    accentColor: '#22d3ee',
  },
  {
    id: 'shotgun',
    category: 'gun',
    name: 'Helix Scattergun',
    subtitle: 'Hold [RMB] for 1.4x Choke Zoom · 6-pellet plasma blast, booming kick',
    animStyle: 'Pump Scatter Blast',
    price: 460,
    dmgMultiplier: 0.78,
    cooldown: 0.45,
    manaCost: 24,
    recoilPitch: 0.085,
    recoilYaw: 0.032,
    pellets: 6,
    spread: 0.052,
    hasScopeZoom: true,
    isOpticScope: false,
    zoomFov: 58,
    zoomLabel: '1.4x CHOKE AIM',
    accentColor: '#f59e0b',
  },
  {
    id: 'sniper',
    category: 'gun',
    name: 'Longbow Optics Sniper',
    subtitle: 'Hold [RMB] for 3.5x Zoom Lens · 3.6x DMG (10x Crit on Headshot!)',
    animStyle: 'Precision Scope Rifle',
    price: 780,
    dmgMultiplier: 3.6,
    cooldown: 0.72,
    manaCost: 28,
    recoilPitch: 0.105,
    recoilYaw: 0.018,
    pellets: 1,
    spread: 0.0005,
    hasScopeZoom: true,
    isOpticScope: true,
    zoomFov: 24,
    zoomLabel: '3.5x PRECISION OPTIC',
    accentColor: '#f43f5e',
  },
  {
    id: 'rpg',
    category: 'gun',
    name: 'Hydra Heavy RPG',
    subtitle: 'Hold [RMB] for 1.8x Targeting Sight · 18m AoE blast & huge boom',
    animStyle: 'Shoulder Rocket Tube',
    price: 1050,
    dmgMultiplier: 4.4,
    cooldown: 0.92,
    manaCost: 38,
    recoilPitch: 0.14,
    recoilYaw: 0.035,
    pellets: 1,
    spread: 0.002,
    blastRadius: 18,
    hasScopeZoom: true,
    isOpticScope: false,
    zoomFov: 48,
    zoomLabel: '1.8x LAUNCHER SIGHT',
    accentColor: '#fb923c',
  },
  {
    id: 'railcannon',
    category: 'gun',
    name: 'Overcharge Rail-Cannon',
    subtitle: 'Hold [RMB] for 2.6x Rail Optic · Massive recoil & 4.2x hyper-strike',
    animStyle: 'Heavy Rail Strike',
    price: 1350,
    dmgMultiplier: 4.2,
    cooldown: 0.65,
    manaCost: 42,
    recoilPitch: 0.12,
    recoilYaw: 0.036,
    pellets: 1,
    spread: 0.001,
    hasScopeZoom: true,
    isOpticScope: true,
    zoomFov: 34,
    zoomLabel: '2.6x RAIL OPTIC',
    accentColor: '#ef4444',
  },
  {
    id: 'laser_boom',
    category: 'gun',
    name: 'Omega Laser Boom Gun',
    subtitle:
      'Hold [RMB] for 2.4x Prism Lock · Hold [LMB] to fire 100,000 DMG mega beam!',
    animStyle: 'Charge-Up Mega Beam',
    price: 1800,
    dmgMultiplier: 1.0,
    cooldown: 0.9,
    manaCost: 35,
    recoilPitch: 0.16,
    recoilYaw: 0.025,
    pellets: 1,
    spread: 0,
    blastRadius: 14,
    hasScopeZoom: true,
    isOpticScope: true,
    zoomFov: 38,
    zoomLabel: '2.4x PRISM LOCK',
    isChargeLaserBoom: true,
    accentColor: '#ec4899',
  },
];

export function getWeaponConfig(id: WeaponId): WeaponConfig {
  return WEAPON_CATALOG.find((w) => w.id === id) ?? WEAPON_CATALOG[0];
}

export interface GameSettings {
  swingAssist: number;
  swingSpeedScale: number;
  webElasticity: number;
  pendulumWave: boolean;
  adaptiveWave: boolean;
  sloMo: boolean;
  sensitivity: number;
  fovBase: number;
  quality: GraphicsQuality;
  difficulty: DifficultyMode;
  shadows: boolean;
  windEffects: boolean;
  soundVolume: number;
  muted: boolean;
  touchControls: 'auto' | 'on' | 'off';
  hudScale: number;
  touchScale: number;
  touchOpacity: number;
  hudCompact: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  swingAssist: 84,
  swingSpeedScale: 0.92,
  webElasticity: 88,
  pendulumWave: true,
  adaptiveWave: true,
  sloMo: false,
  sensitivity: 1.0,
  fovBase: 82,
  quality: 'high',
  difficulty: 'normal',
  shadows: true,
  windEffects: true,
  soundVolume: 0.78,
  muted: false,
  touchControls: 'auto',
  hudScale: 1.0,
  touchScale: 1.0,
  touchOpacity: 0.9,
  hudCompact: false,
};

export type PlayerMovementState =
  | 'idle'
  | 'walk'
  | 'sprint'
  | 'crouch'
  | 'slide'
  | 'wall_slide'
  | 'airborne'
  | 'double_jump'
  | 'dodge'
  | 'swinging'
  | 'zipping'
  | 'zip_strike'
  | 'blocking';

export type NoiseLevel = 'silent' | 'normal' | 'loud';

export type CrosshairTargetKind = 'none' | 'body' | 'head' | 'weakpoint';

export type SensorDirection = 'front' | 'left' | 'right' | 'back';

export interface AttackSensorState {
  active: boolean;
  incomingThreat: boolean;
  nearestDistanceM: number;
  direction: SensorDirection;
}

export interface SideQuestHud {
  title: string;
  progress: number;
  target: number;
  rewardCredits: number;
  rewardPoints: number;
  completed: boolean;
}

export interface AllyNpcHud {
  id: number;
  name: string;
  hp: number;
  maxHp: number;
  recruited: boolean;
}

export interface HudState {
  level: number;
  mode: GameMode;
  arenaShapeName: string;
  levelSubject: string;
  suitEntered: boolean;
  outsideWorldActive: boolean;
  isBossLevel: boolean;
  isRescueLevel: boolean;
  levelTag: string;
  waveNumber: number;
  ffaLeaderName: string;
  glitchChoice: GlitchOutcomeChoice;
  glitchChaseDistM: number;
  glitchTitanSpeedMps: number;
  tutorialStepIndex: number;
  tutorialStepText: string;
  speedMph: number;
  altitudeM: number;
  health: number;
  maxHealth: number;
  shieldHp: number;
  maxShieldHp: number;
  armorReductionPct: number;
  mana: number;
  maxMana: number;
  sloMo: boolean;
  sloMoRemainingSec: number;
  sloMoCooldownSec: number;
  activeWeaponId: WeaponId;
  activeWeaponSlot: number;
  weaponSlots: WeaponId[];
  maxWeaponSlots: number;
  laserBoomAmmo: number;
  laserBoomMaxAmmo: number;
  laserBoomCooldownSec: number;
  laserBoomChargePct: number;
  barrageCooldownSec: number;
  sniperZoomed: boolean;
  isBlocking: boolean;
  doubleJumpReady: boolean;
  playerShrunkSec: number;
  movementState: PlayerMovementState;
  noiseLevel: NoiseLevel;
  isCrouching: boolean;
  isSprinting: boolean;
  isSliding: boolean;
  isWallSliding: boolean;
  isSwinging: boolean;
  isZipping: boolean;
  zipRemainingSec: number;
  zipCooldownSec: number;
  dodgeCooldownSec: number;
  dodgeActive: boolean;
  critSurgeCharge: number;
  critSurgeActive: boolean;
  crosshairTarget: CrosshairTargetKind;
  recoilBloom: number;
  aimLocked: boolean;
  hasSwingTarget: boolean;
  swingTargetX: number;
  swingTargetY: number;
  hasZipTarget: boolean;
  zipTargetX: number;
  zipTargetY: number;
  zipIsEnemy: boolean;
  enemyTargetName: string;
  enemyTargetHpRatio: number;
  enemiesRemaining: number;
  enemiesTotal: number;
  captivesRemaining: number;
  allies: AllyNpcHud[];
  sideQuest: SideQuestHud | null;
  nearNpcPrompt: string | null;
  attackSensor: AttackSensorState;
  bossName: string | null;
  bossPower: BossPowerId | null;
  bossHp: number;
  bossMaxHp: number;
  bossIsInfinite: boolean;
  bossShieldHp: number;
  bossShieldMaxHp: number;
  bossDamage: number;
  bossAlerted: boolean;
  bossLockOnActive: boolean;
  bossUltChargingSec: number;
  bossUltMaxSec: number;
  bossUltDistanceM: number;
  bossLaserActive: boolean;
  bossStunnedSec: number;
  bossActiveAbilityName: string | null;
  powerCooldowns: Record<BossPowerId, number>;
  goalDistanceM: number;
  goalUnlocked: boolean;
  portalChargePct: number;
  goalScreenX: number;
  goalScreenY: number;
  goalVisible: boolean;
  aiOverchargeSec: number;
  aiOverchargeCooldownSec: number;
  aiWarningText: string | null;
  hitMarkerTimer: number;
  hitWasHeadshot: boolean;
  hitWasWeakPoint: boolean;
  killBannerTimer: number;
  killBannerText: string;
  damageFlash: number;
  glitchScreenIntensity: number;
  pointerLocked: boolean;
  comboKills: number;
  runPointsEarned: number;
  runCreditsEarned: number;
}

export interface PersistentProgress {
  currentLevel: number;
  highestLevel: number;
  upgradePoints: number;
  credits: number;
  totalRobotsDestroyed: number;
  totalBossesDefeated: number;
  totalRescuedAllies: number;
  gameBeaten: boolean;
  suitEnteredOnce: boolean;
  upgrades: UpgradeLevels;
  ownedWeapons: WeaponId[];
  weaponSlots: WeaponId[];
  activeWeaponSlot: number;
  maxWeaponSlots: number;
  ownedGrapples: GrappleHookId[];
  equippedGrapple: GrappleHookId;
  ownedShields: ShieldId[];
  equippedShield: ShieldId;
  ownedArmors: ExtraArmorId[];
  equippedArmor: ExtraArmorId;
  claimedPowers: BossPowerId[];
  equippedPower: BossPowerId | null;
}

export const DEFAULT_PROGRESS: PersistentProgress = {
  currentLevel: 1,
  highestLevel: 1,
  upgradePoints: 0,
  credits: 0,
  totalRobotsDestroyed: 0,
  totalBossesDefeated: 0,
  totalRescuedAllies: 0,
  gameBeaten: false,
  suitEnteredOnce: false,
  upgrades: { ...DEFAULT_UPGRADES },
  ownedWeapons: ['katana', 'sidearm'],
  weaponSlots: ['katana', 'sidearm'],
  activeWeaponSlot: 0,
  maxWeaponSlots: 2,
  ownedGrapples: ['standard_hook'],
  equippedGrapple: 'standard_hook',
  ownedShields: ['none'],
  equippedShield: 'none',
  ownedArmors: ['none'],
  equippedArmor: 'none',
  claimedPowers: [],
  equippedPower: null,
};

export interface LevelClearSummary {
  clearedLevel: number;
  wasOutsideWorld: boolean;
  wasBossLevel: boolean;
  wasRescueLevel: boolean;
  bossName: string | null;
  claimedPowerReward: BossPowerId | null;
  pointsEarned: number;
  creditsEarned: number;
  robotsDestroyed: number;
  alliesRecruited: number;
  elapsedSec: number;
}

export function isBossLevelNumber(level: number): boolean {
  return level > 0 && level % 5 === 0;
}

export function isRescueLevelNumber(level: number): boolean {
  return level >= 3 && level % 3 === 0 && !isBossLevelNumber(level);
}
