import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ARMOR_CATALOG,
  AppPhase,
  BossPowerId,
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  ExtraArmorId,
  GameMode,
  GameSettings,
  GlitchOutcomeChoice,
  GrappleHookId,
  HudState,
  LASER_BOOM_MAX_AMMO,
  LevelClearSummary,
  MAX_LEVEL,
  MAX_WEAPON_SLOTS,
  PersistentProgress,
  SHIELD_CATALOG,
  SLOT_UPGRADE_COSTS,
  ShieldId,
  UPGRADE_CATALOG,
  UpgradeKey,
  WeaponId,
  getBossDamageForLevel,
  getLevelSubject,
  getPlayerMaxHp,
  getPlayerMaxMana,
  getUpgradeCost,
  getWeaponConfig,
} from './types/game';
import { ProceduralSoundEngine } from './audio/soundEngine';
import { FirstSwingCanvas } from './components/FirstSwingCanvas';
import { FirstSwingHud } from './components/FirstSwingHud';
import { TitleScreen } from './components/TitleScreen';
import { MenuUpgradesModal, ModalTab } from './components/MenuUpgradesModal';
import { LoadingScreen } from './components/LoadingScreen';
import { SherlcoAssistant } from './components/SherlcoAssistant';
import { TouchInputActions } from './components/MobileTouchControls';

const STORAGE_PROGRESS_KEY = 'first_swing_progress_v3';
const STORAGE_SETTINGS_KEY = 'first_swing_settings_v2';

function loadProgress(): PersistentProgress {
  try {
    const raw = localStorage.getItem(STORAGE_PROGRESS_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<PersistentProgress>;
    const maxSlots = Math.max(
      2,
      Math.min(MAX_WEAPON_SLOTS, parsed.maxWeaponSlots ?? DEFAULT_PROGRESS.maxWeaponSlots),
    );
    const ownedWeapons: WeaponId[] =
      Array.isArray(parsed.ownedWeapons) && parsed.ownedWeapons.length > 0
        ? (parsed.ownedWeapons as WeaponId[])
        : [...DEFAULT_PROGRESS.ownedWeapons];
    const weaponSlots: WeaponId[] =
      Array.isArray(parsed.weaponSlots) && parsed.weaponSlots.length > 0
        ? (parsed.weaponSlots.slice(0, maxSlots) as WeaponId[])
        : [...DEFAULT_PROGRESS.weaponSlots];

    return {
      ...DEFAULT_PROGRESS,
      ...parsed,
      upgrades: { ...DEFAULT_PROGRESS.upgrades, ...(parsed.upgrades ?? {}) },
      ownedWeapons,
      weaponSlots,
      maxWeaponSlots: maxSlots,
      activeWeaponSlot: Math.max(0, Math.min(weaponSlots.length - 1, parsed.activeWeaponSlot ?? 0)),
      ownedGrapples:
        Array.isArray(parsed.ownedGrapples) && parsed.ownedGrapples.length > 0
          ? (parsed.ownedGrapples as GrappleHookId[])
          : [...DEFAULT_PROGRESS.ownedGrapples],
      equippedGrapple: parsed.equippedGrapple ?? DEFAULT_PROGRESS.equippedGrapple,
      ownedShields:
        Array.isArray(parsed.ownedShields) && parsed.ownedShields.length > 0
          ? (parsed.ownedShields as ShieldId[])
          : [...DEFAULT_PROGRESS.ownedShields],
      equippedShield: parsed.equippedShield ?? DEFAULT_PROGRESS.equippedShield,
      ownedArmors:
        Array.isArray(parsed.ownedArmors) && parsed.ownedArmors.length > 0
          ? (parsed.ownedArmors as ExtraArmorId[])
          : [...DEFAULT_PROGRESS.ownedArmors],
      equippedArmor: parsed.equippedArmor ?? DEFAULT_PROGRESS.equippedArmor,
      claimedPowers: Array.isArray(parsed.claimedPowers) ? parsed.claimedPowers : [],
      equippedPower: parsed.equippedPower ?? null,
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<GameSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

const INITIAL_HUD: HudState = {
  level: 1,
  mode: 'campaign',
  arenaShapeName: 'Cross Spire Plaza',
  levelSubject: getLevelSubject(1, 'campaign'),
  suitEntered: true,
  outsideWorldActive: false,
  isBossLevel: false,
  isRescueLevel: false,
  levelTag: 'SECTOR LV 1 · CROSS SPIRE PLAZA',
  waveNumber: 1,
  ffaLeaderName: '',
  glitchChoice: 'pending',
  glitchChaseDistM: 0,
  glitchTitanSpeedMps: 0,
  tutorialStepIndex: 0,
  tutorialStepText: '',
  speedMph: 0,
  altitudeM: 0,
  health: 125,
  maxHealth: 125,
  shieldHp: 0,
  maxShieldHp: 0,
  armorReductionPct: 0,
  mana: 100,
  maxMana: 100,
  sloMo: false,
  sloMoRemainingSec: 0,
  sloMoCooldownSec: 0,
  activeWeaponId: 'katana',
  activeWeaponSlot: 0,
  weaponSlots: ['katana', 'sidearm'],
  maxWeaponSlots: 2,
  laserBoomAmmo: LASER_BOOM_MAX_AMMO,
  laserBoomMaxAmmo: LASER_BOOM_MAX_AMMO,
  laserBoomCooldownSec: 0,
  laserBoomChargePct: 0,
  barrageCooldownSec: 0,
  sniperZoomed: false,
  isBlocking: false,
  doubleJumpReady: true,
  playerShrunkSec: 0,
  movementState: 'idle',
  noiseLevel: 'silent',
  isCrouching: false,
  isSprinting: false,
  isSliding: false,
  isWallSliding: false,
  isSwinging: false,
  isZipping: false,
  zipRemainingSec: 0,
  zipCooldownSec: 0,
  dodgeCooldownSec: 0,
  dodgeActive: false,
  critSurgeCharge: 0,
  critSurgeActive: false,
  crosshairTarget: 'none',
  recoilBloom: 0,
  aimLocked: false,
  hasSwingTarget: false,
  swingTargetX: 0.5,
  swingTargetY: 0.5,
  hasZipTarget: false,
  zipTargetX: 0.5,
  zipTargetY: 0.5,
  zipIsEnemy: false,
  enemyTargetName: '',
  enemyTargetHpRatio: 0,
  enemiesRemaining: 0,
  enemiesTotal: 0,
  captivesRemaining: 0,
  allies: [],
  sideQuest: null,
  nearNpcPrompt: null,
  attackSensor: { active: false, incomingThreat: false, nearestDistanceM: 99, direction: 'front' },
  bossName: null,
  bossPower: null,
  bossHp: 0,
  bossMaxHp: 1,
  bossIsInfinite: false,
  bossShieldHp: 0,
  bossShieldMaxHp: 0,
  bossStunnedSec: 0,
  bossActiveAbilityName: null,
  bossDamage: getBossDamageForLevel(),
  bossAlerted: false,
  bossLockOnActive: false,
  bossUltChargingSec: 0,
  bossUltMaxSec: 2.5,
  bossUltDistanceM: 999,
  bossLaserActive: false,
  powerCooldowns: { fire: 0, water: 0, punch: 0, shrink: 0 },
  goalDistanceM: 0,
  goalUnlocked: false,
  portalChargePct: 0,
  goalScreenX: 0.5,
  goalScreenY: 0.5,
  goalVisible: false,
  hitMarkerTimer: 0,
  hitWasHeadshot: false,
  hitWasWeakPoint: false,
  killBannerTimer: 0,
  killBannerText: '',
  damageFlash: 0,
  glitchScreenIntensity: 0,
  pointerLocked: false,
  comboKills: 0,
  runPointsEarned: 0,
  runCreditsEarned: 0,
  aiOverchargeSec: 0,
  aiOverchargeCooldownSec: 0,
  aiWarningText: null,
};

export function App() {
  const [progress, setProgress] = useState<PersistentProgress>(loadProgress);
  const [settings, setSettings] = useState<GameSettings>(loadSettings);
  const [phase, setPhase] = useState<AppPhase>('title');
  const [mode, setMode] = useState<GameMode>('campaign');
  const [activeLevel, setActiveLevel] = useState<number>(() => loadProgress().currentLevel);
  const [glitchChoice, setGlitchChoice] = useState<GlitchOutcomeChoice>('pending');
  const [suitEntered, setSuitEntered] = useState<boolean>(true);
  const [resetCounter, setResetCounter] = useState(0);
  const [sloMoTriggerCounter] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>('upgrades');
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [sherlcoOpen, setSherlcoOpen] = useState(false);
  const [micTriggerCounter, setMicTriggerCounter] = useState(0);
  const [loadingState, setLoadingState] = useState<{
    headline: string;
    sublabel: string;
    onDone: () => void;
  } | null>(null);

  const soundEngine = useMemo(() => new ProceduralSoundEngine(), []);
  const powerTriggerRef = useRef<((id: BossPowerId) => void) | null>(null);
  const aiOverchargeTriggerRef = useRef<(() => void) | null>(null);
  const touchActionsRef = useRef<TouchInputActions | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(pointer: coarse)').matches ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
    );
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => {
      setIsTouchDevice(mq.matches || navigator.maxTouchPoints > 0);
    };
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  const touchActive =
    settings.touchControls === 'on'
      ? true
      : settings.touchControls === 'off'
        ? false
        : isTouchDevice;

  const touchActions = useMemo<TouchInputActions>(
    () => ({
      setAnalogMove: (x, y, sprint) => touchActionsRef.current?.setAnalogMove(x, y, sprint),
      setJumpHeld: (held) => touchActionsRef.current?.setJumpHeld(held),
      setSwingHeld: (held) => touchActionsRef.current?.setSwingHeld(held),
      setFireHeld: (held) => touchActionsRef.current?.setFireHeld(held),
      setBlockHeld: (held) => touchActionsRef.current?.setBlockHeld(held),
      toggleCrouch: () => touchActionsRef.current?.toggleCrouch(),
      toggleScope: () => touchActionsRef.current?.toggleScope(),
      triggerZipOrSuit: () => touchActionsRef.current?.triggerZipOrSuit(),
      triggerBarrage: () => touchActionsRef.current?.triggerBarrage(),
      triggerDodge: () => touchActionsRef.current?.triggerDodge(),
      triggerSloMo: () => touchActionsRef.current?.triggerSloMo(),
      triggerCritSurge: () => touchActionsRef.current?.triggerCritSurge(),
      triggerAiOvercharge: () => touchActionsRef.current?.triggerAiOvercharge(),
      applyTouchLook: (dx, dy) => touchActionsRef.current?.applyTouchLook(dx, dy),
    }),
    [],
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROGRESS_KEY, JSON.stringify(progress));
    } catch {
      // Ignore storage quota errors
    }
  }, [progress]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
  }, [settings]);

  const activeWeaponId: WeaponId =
    progress.weaponSlots[progress.activeWeaponSlot] ?? progress.weaponSlots[0] ?? 'katana';

  const triggerLoading = useCallback(
    (headline: string, sublabel: string, onDone: () => void) => {
      setLoadingState({ headline, sublabel, onDone });
    },
    [],
  );

  const launchMode = useCallback(
    (nextMode: GameMode, nextLevel = 1) => {
      soundEngine.init();
      setModalOpen(false);
      const subject = getLevelSubject(nextLevel, nextMode);
      triggerLoading(
        nextMode === 'outside_world'
          ? 'ENTERING OUTSIDE WORLD'
          : nextMode === 'tutorial'
            ? 'TUTORIAL MATRIX INITIALIZING'
            : nextMode === 'ffa'
              ? 'FREE-FOR-ALL COLOSSEUM'
              : nextMode === 'wave'
                ? 'WAVE SURVIVAL FORTRESS'
                : `SECTOR LV ${nextLevel} SYNCING`,
        `${subject} · Sherlco AI & Iron Suit online`,
        () => {
          setProgress((prev) => ({ ...prev, suitEnteredOnce: true }));
          setMode(nextMode);
          setActiveLevel(nextLevel);
          setGlitchChoice('pending');
          setSuitEntered(true);
          setResetCounter((c) => c + 1);
          setPhase('playing');
          setLoadingState(null);
        },
      );
    },
    [soundEngine, triggerLoading],
  );

  const handleEarnRewards = useCallback((pts: number, credits: number, rescuedDelta: number) => {
    setProgress((prev) => ({
      ...prev,
      upgradePoints: prev.upgradePoints + pts,
      credits: prev.credits + credits,
      totalRobotsDestroyed: prev.totalRobotsDestroyed + (credits > 0 && rescuedDelta === 0 ? 1 : 0),
      totalRescuedAllies: prev.totalRescuedAllies + rescuedDelta,
    }));
  }, []);

  const handleClaimBossPower = useCallback((power: BossPowerId) => {
    setProgress((prev) => {
      const already = prev.claimedPowers.includes(power);
      return {
        ...prev,
        totalBossesDefeated: prev.totalBossesDefeated + 1,
        claimedPowers: already ? prev.claimedPowers : [...prev.claimedPowers, power],
        equippedPower: prev.equippedPower ?? power,
      };
    });
  }, []);

  const handleLevelComplete = useCallback(
    (summary: LevelClearSummary) => {
      if (mode === 'tutorial') {
        triggerLoading(
          'TUTORIAL COMPLETE · SUIT MASTERED',
          'Deploying into Campaign Sector LV 1',
          () => {
            setMode('campaign');
            setActiveLevel(1);
            setSuitEntered(true);
            setResetCounter((c) => c + 1);
            setPhase('playing');
            setLoadingState(null);
          },
        );
        return;
      }

      if (mode === 'outside_world') {
        soundEngine.playGlitchWarp();
        triggerLoading(
          'ANOMALY DETECTED · REALITY GLITCH',
          '∞ HP 1,000,000x TITAN BREACHING LEVEL 0...',
          () => {
            setMode('glitch_lv0');
            setActiveLevel(0);
            setGlitchChoice('pending');
            setSuitEntered(true);
            setResetCounter((c) => c + 1);
            setPhase('playing');
            setLoadingState(null);
          },
        );
        return;
      }

      if (mode === 'campaign') {
        if (summary.clearedLevel >= MAX_LEVEL) {
          setProgress((prev) => ({
            ...prev,
            highestLevel: MAX_LEVEL,
            currentLevel: MAX_LEVEL,
          }));
          triggerLoading(
            'SECTOR 50 CLEARED · BREACHING BOUNDARY',
            'Entering the Outside World: 150 Bots, Returning Titans & 100x Boss',
            () => {
              setMode('outside_world');
              setActiveLevel(MAX_LEVEL);
              setSuitEntered(true);
              setResetCounter((c) => c + 1);
              setPhase('playing');
              setLoadingState(null);
            },
          );
          return;
        }

        const nextLvl = summary.clearedLevel + 1;
        setProgress((prev) => ({
          ...prev,
          currentLevel: nextLvl,
          highestLevel: Math.max(prev.highestLevel, nextLvl),
        }));
        triggerLoading(
          `PORTAL WARP · SECTOR LV ${nextLvl}`,
          `${getLevelSubject(nextLvl, 'campaign')} · New robots & hazards online`,
          () => {
            setMode('campaign');
            setActiveLevel(nextLvl);
            setSuitEntered(true);
            setResetCounter((c) => c + 1);
            setPhase('playing');
            setLoadingState(null);
          },
        );
        return;
      }

      // FFA win loop
      setPhase('level_clear');
    },
    [mode, soundEngine, triggerLoading],
  );

  const handlePlayerDefeated = useCallback(() => {
    if (mode === 'glitch_lv0') {
      setProgress((prev) => ({ ...prev, gameBeaten: true }));
      setPhase('the_end');
      return;
    }
    setPhase('game_over');
  }, [mode]);

  const handleSelectWeaponSlot = useCallback((slotIndex: number) => {
    setProgress((prev) => {
      if (slotIndex < 0 || slotIndex >= prev.maxWeaponSlots || slotIndex >= prev.weaponSlots.length) {
        return prev;
      }
      return { ...prev, activeWeaponSlot: slotIndex };
    });
  }, []);

  const handleSwapWeaponSlot = useCallback(() => {
    setProgress((prev) => {
      const len = Math.min(prev.maxWeaponSlots, prev.weaponSlots.length);
      if (len <= 1) return prev;
      return { ...prev, activeWeaponSlot: (prev.activeWeaponSlot + 1) % len };
    });
  }, []);

  const handlePurchaseUpgrade = useCallback((key: UpgradeKey) => {
    setProgress((prev) => {
      const def = UPGRADE_CATALOG.find((u) => u.key === key);
      if (!def) return prev;
      const lvl = prev.upgrades[key] ?? 0;
      const cost = getUpgradeCost(def, lvl);
      if (prev.upgradePoints < cost) return prev;
      return {
        ...prev,
        upgradePoints: prev.upgradePoints - cost,
        upgrades: { ...prev.upgrades, [key]: lvl + 1 },
      };
    });
  }, []);

  const handleBuySlot = useCallback(() => {
    setProgress((prev) => {
      if (prev.maxWeaponSlots >= MAX_WEAPON_SLOTS) return prev;
      const cost = SLOT_UPGRADE_COSTS[prev.maxWeaponSlots];
      if (prev.credits < cost) return prev;
      const unused = prev.ownedWeapons.find((w) => !prev.weaponSlots.includes(w)) ?? 'katana';
      return {
        ...prev,
        credits: prev.credits - cost,
        maxWeaponSlots: prev.maxWeaponSlots + 1,
        weaponSlots: [...prev.weaponSlots, unused],
      };
    });
  }, []);

  const handleBuyOrEquipWeapon = useCallback((id: WeaponId, targetSlotIndex?: number) => {
    const cfg = getWeaponConfig(id);
    setProgress((prev) => {
      const owned = prev.ownedWeapons.includes(id);
      if (!owned) {
        if (prev.credits < cfg.price) return prev;
        const nextOwned = [...prev.ownedWeapons, id];
        const nextSlots = [...prev.weaponSlots];
        let nextActive = prev.activeWeaponSlot;
        if (nextSlots.length < prev.maxWeaponSlots) {
          nextSlots.push(id);
          nextActive = nextSlots.length - 1;
        } else {
          nextSlots[nextActive] = id;
        }
        return {
          ...prev,
          credits: prev.credits - cfg.price,
          ownedWeapons: nextOwned,
          weaponSlots: nextSlots,
          activeWeaponSlot: nextActive,
        };
      }

      const slotIdx = targetSlotIndex ?? prev.activeWeaponSlot;
      if (slotIdx < 0 || slotIdx >= prev.maxWeaponSlots) return prev;
      const nextSlots = [...prev.weaponSlots];
      while (nextSlots.length <= slotIdx) {
        nextSlots.push('katana');
      }
      nextSlots[slotIdx] = id;
      return {
        ...prev,
        weaponSlots: nextSlots,
        activeWeaponSlot: slotIdx,
      };
    });
  }, []);

  const handleBuyOrEquipGrapple = useCallback((id: GrappleHookId) => {
    setProgress((prev) => {
      if (prev.ownedGrapples.includes(id)) {
        return { ...prev, equippedGrapple: id };
      }
      const price = id === 'titanium_winch' ? 260 : id === 'quantum_hook' ? 750 : 0;
      if (prev.credits < price) return prev;
      return {
        ...prev,
        credits: prev.credits - price,
        ownedGrapples: [...prev.ownedGrapples, id],
        equippedGrapple: id,
      };
    });
  }, []);

  const handleBuyOrEquipShield = useCallback((id: ShieldId) => {
    const cfg = SHIELD_CATALOG.find((s) => s.id === id);
    if (!cfg) return;
    setProgress((prev) => {
      if (prev.ownedShields.includes(id)) {
        return { ...prev, equippedShield: id };
      }
      if (prev.credits < cfg.price) return prev;
      return {
        ...prev,
        credits: prev.credits - cfg.price,
        ownedShields: [...prev.ownedShields, id],
        equippedShield: id,
      };
    });
  }, []);

  const handleBuyOrEquipArmor = useCallback((id: ExtraArmorId) => {
    const cfg = ARMOR_CATALOG.find((a) => a.id === id);
    if (!cfg) return;
    setProgress((prev) => {
      if (prev.ownedArmors.includes(id)) {
        return { ...prev, equippedArmor: id };
      }
      if (prev.credits < cfg.price) return prev;
      return {
        ...prev,
        credits: prev.credits - cfg.price,
        ownedArmors: [...prev.ownedArmors, id],
        equippedArmor: id,
      };
    });
  }, []);

  const handleTogglePause = useCallback(() => {
    setPhase((prev) => {
      if (prev === 'playing') {
        setModalTab('upgrades');
        setModalOpen(true);
        return 'paused';
      }
      if (prev === 'paused') {
        setModalOpen(false);
        return 'playing';
      }
      return prev;
    });
  }, []);

  const maxHp = getPlayerMaxHp(progress.upgrades, progress.equippedArmor);
  const maxMana = getPlayerMaxMana(progress.upgrades);
  void maxHp;
  void maxMana;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-white">
      <FirstSwingCanvas
        phase={phase}
        mode={mode}
        level={activeLevel}
        glitchChoice={glitchChoice}
        resetCounter={resetCounter}
        sloMoTriggerCounter={sloMoTriggerCounter}
        powerTriggerRef={powerTriggerRef}
        aiOverchargeTriggerRef={aiOverchargeTriggerRef}
        touchActive={touchActive}
        touchActionsRef={touchActionsRef}
        settings={settings}
        upgrades={progress.upgrades}
        activeWeaponId={activeWeaponId}
        activeWeaponSlot={progress.activeWeaponSlot}
        weaponSlots={progress.weaponSlots}
        maxWeaponSlots={progress.maxWeaponSlots}
        equippedGrapple={progress.equippedGrapple}
        equippedShield={progress.equippedShield}
        equippedArmor={progress.equippedArmor}
        claimedPowers={progress.claimedPowers}
        equippedPower={progress.equippedPower}
        suitEntered={suitEntered}
        soundEngine={soundEngine}
        onHudUpdate={setHud}
        onEarnRewards={handleEarnRewards}
        onClaimBossPower={handleClaimBossPower}
        onTogglePause={handleTogglePause}
        onOpenUpgrades={() => {
          setPhase('paused');
          setModalTab('upgrades');
          setModalOpen(true);
        }}
        onSelectWeaponSlot={handleSelectWeaponSlot}
        onSwapWeaponSlot={handleSwapWeaponSlot}
        onToggleSherlco={() => {
          if (document.pointerLockElement) document.exitPointerLock();
          setSherlcoOpen((o) => !o);
        }}
        onToggleSherlcoMic={() => setMicTriggerCounter((c) => c + 1)}
        onLevelComplete={handleLevelComplete}
        onPlayerDefeated={handlePlayerDefeated}
      />

      {phase === 'playing' && (
        <>
          <FirstSwingHud
            hud={hud}
            settings={settings}
            touchActive={touchActive}
            touchActions={touchActions}
            claimedPowers={progress.claimedPowers}
            equippedPower={progress.equippedPower}
            equippedGrapple={progress.equippedGrapple}
            onSelectWeaponSlot={handleSelectWeaponSlot}
            onUsePower={(pid) => powerTriggerRef.current?.(pid)}
            onSelectGlitchChoice={(choice) => {
              setGlitchChoice(choice);
              setResetCounter((c) => c + 1);
            }}
            onTriggerAiOvercharge={() => aiOverchargeTriggerRef.current?.()}
            onToggleControlMode={() => {
              const nextMode = touchActive ? 'off' : 'on';
              if (nextMode === 'on' && document.pointerLockElement) {
                document.exitPointerLock();
              }
              setSettings((s) => ({ ...s, touchControls: nextMode }));
            }}
            onOpenMenu={handleTogglePause}
          />
          <SherlcoAssistant
            hud={hud}
            open={sherlcoOpen}
            micTriggerCounter={micTriggerCounter}
            onToggleOpen={() => setSherlcoOpen((o) => !o)}
            onTriggerAiOvercharge={() => aiOverchargeTriggerRef.current?.()}
          />
        </>
      )}

      {phase === 'title' && (
        <TitleScreen
          progress={progress}
          difficulty={settings.difficulty}
          onChangeDifficulty={(difficulty) => setSettings((s) => ({ ...s, difficulty }))}
          touchControls={settings.touchControls}
          onChangeTouchControls={(touchControls) =>
            setSettings((s) => ({ ...s, touchControls }))
          }
          onStartCampaign={() => launchMode('campaign', 1)}
          onContinueCampaign={() => launchMode('campaign', progress.currentLevel)}
          onStartTutorial={() => launchMode('tutorial', 1)}
          onStartOutsideWorld={() => launchMode('outside_world', MAX_LEVEL)}
          onStartFfa={() => launchMode('ffa', 1)}
          onStartWave={() => launchMode('wave', 1)}
          onOpenModal={(tab) => {
            setModalTab(tab);
            setModalOpen(true);
          }}
        />
      )}

      {modalOpen && (
        <MenuUpgradesModal
          initialTab={modalTab}
          isPausedRun={phase === 'paused'}
          progress={progress}
          settings={settings}
          onClose={() => {
            setModalOpen(false);
            if (phase === 'paused') setPhase('playing');
          }}
          onResume={() => {
            setModalOpen(false);
            setPhase('playing');
          }}
          onReturnToTitle={() => {
            setModalOpen(false);
            setPhase('title');
          }}
          onRestartLevel={() => {
            setModalOpen(false);
            setResetCounter((c) => c + 1);
            setPhase('playing');
          }}
          onPurchaseUpgrade={handlePurchaseUpgrade}
          onBuySlot={handleBuySlot}
          onBuyOrEquipWeapon={handleBuyOrEquipWeapon}
          onBuyOrEquipGrapple={handleBuyOrEquipGrapple}
          onBuyOrEquipShield={handleBuyOrEquipShield}
          onBuyOrEquipArmor={handleBuyOrEquipArmor}
          onEquipPower={(id) => setProgress((prev) => ({ ...prev, equippedPower: id }))}
          onStartMode={(m, lvl) => launchMode(m, lvl ?? 1)}
          onUpdateSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
        />
      )}

      {phase === 'game_over' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/90 p-4">
          <div className="w-full max-w-md rounded-xl border border-rose-500/60 bg-slate-900 p-6 text-center shadow-2xl space-y-4">
            <h2 className="font-display text-3xl font-black text-rose-400">SUIT OFFLINE</h2>
            <p className="text-sm text-slate-300">
              Your Iron Armor took critical damage in{' '}
              <strong className="text-white">{hud.levelTag}</strong>.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setResetCounter((c) => c + 1);
                  setPhase('playing');
                }}
                className="rounded-lg bg-cyan-400 px-5 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-cyan-300"
              >
                REDEPLOY SECTOR
              </button>
              <button
                type="button"
                onClick={() => setPhase('title')}
                className="rounded-lg border border-slate-700 bg-slate-800 px-5 py-2.5 font-display text-sm font-bold text-slate-200 hover:border-cyan-400"
              >
                MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'level_clear' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/90 p-4">
          <div className="w-full max-w-md rounded-xl border border-emerald-500/60 bg-slate-900 p-6 text-center shadow-2xl space-y-4">
            <h2 className="font-display text-3xl font-black text-emerald-400">COLOSSEUM VICTOR</h2>
            <p className="text-sm text-slate-300">
              You defeated every rival robot and stood as the last survivor!
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={() => launchMode('ffa', 1)}
                className="rounded-lg bg-amber-400 px-5 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-amber-300"
              >
                PLAY AGAIN
              </button>
              <button
                type="button"
                onClick={() => setPhase('title')}
                className="rounded-lg border border-slate-700 bg-slate-800 px-5 py-2.5 font-display text-sm font-bold text-slate-200 hover:border-cyan-400"
              >
                MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'the_end' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/96 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-rose-500/70 bg-slate-900 p-8 text-center shadow-2xl space-y-5">
            <div className="font-mono-num text-xs font-bold uppercase tracking-widest text-rose-400">
              GLITCH REALITY LV 0 · TIMELINE TERMINATED
            </div>
            <h1 className="font-display text-5xl font-black tracking-tight text-white">THE END</h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              {glitchChoice === 'run'
                ? 'You sprinted across the endless collapsing corridor as the 1,000,000x Glitch Titan accelerated beyond light speed until reality gave way.'
                : 'You stood your ground against the indestructible ∞ HP Glitch Titan until the simulation shattered.'}
            </p>

            <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/35 p-4 text-left space-y-1">
              <div className="font-mono-num text-xs font-bold uppercase text-emerald-300">
                NEW POST-GAME MODES UNLOCKED
              </div>
              <p className="text-xs text-slate-200">
                • <strong>Free-For-All Mode</strong>: Multi-faction robot battle royale unlocked.
                <br />• <strong>Wave Survival Mode</strong>: Escalating waves getting faster and
                harder each round.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                type="button"
                onClick={() => launchMode('ffa', 1)}
                className="rounded-lg bg-amber-400 py-3 font-display text-sm font-bold text-slate-950 hover:bg-amber-300"
              >
                PLAY FREE-FOR-ALL
              </button>
              <button
                type="button"
                onClick={() => launchMode('wave', 1)}
                className="rounded-lg bg-violet-500 py-3 font-display text-sm font-bold text-white hover:bg-violet-400"
              >
                PLAY WAVE MODE
              </button>
              <button
                type="button"
                onClick={() => setPhase('title')}
                className="rounded-lg border border-slate-700 bg-slate-800 py-3 font-display text-sm font-bold text-slate-200 hover:border-cyan-400"
              >
                MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {loadingState && (
        <LoadingScreen
          headline={loadingState.headline}
          sublabel={loadingState.sublabel}
          onComplete={loadingState.onDone}
        />
      )}
    </div>
  );
}

export default App;
