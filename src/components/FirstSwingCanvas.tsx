import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AppPhase,
  BOSS_POWERS,
  BossPowerId,
  ExtraArmorId,
  GameMode,
  GameSettings,
  GlitchOutcomeChoice,
  GrappleHookId,
  HudState,
  LevelClearSummary,
  MAX_WEAPON_SLOTS,
  ShieldId,
  UpgradeLevels,
  WeaponId,
  getWeaponConfig,
} from '../types/game';
import { ArenaLevelData, buildArenaLevel } from '../game/arenaBuilder';
import { FirstPersonWeapons } from '../game/firstPersonWeapons';
import { RobotAndVfxManager } from '../game/robotManager';
import { FirstSwingPhysicsEngine, InputSnapshot } from '../game/firstSwingPhysics';
import { ProceduralSoundEngine } from '../audio/soundEngine';
import { TouchInputActions } from './MobileTouchControls';

interface FirstSwingCanvasProps {
  phase: AppPhase;
  mode: GameMode;
  level: number;
  glitchChoice: GlitchOutcomeChoice;
  resetCounter: number;
  sloMoTriggerCounter: number;
  powerTriggerRef: React.MutableRefObject<((id: BossPowerId) => void) | null>;
  aiOverchargeTriggerRef: React.MutableRefObject<(() => void) | null>;
  touchActive: boolean;
  touchActionsRef: React.MutableRefObject<TouchInputActions | null>;
  settings: GameSettings;
  upgrades: UpgradeLevels;
  activeWeaponId: WeaponId;
  activeWeaponSlot: number;
  weaponSlots: WeaponId[];
  maxWeaponSlots: number;
  equippedGrapple: GrappleHookId;
  equippedShield: ShieldId;
  equippedArmor: ExtraArmorId;
  claimedPowers: BossPowerId[];
  equippedPower: BossPowerId | null;
  suitEntered: boolean;
  soundEngine: ProceduralSoundEngine;
  onHudUpdate: (hud: HudState) => void;
  onEarnRewards: (pts: number, credits: number, rescuedDelta: number) => void;
  onClaimBossPower: (power: BossPowerId) => void;
  onTogglePause: () => void;
  onOpenUpgrades: () => void;
  onSelectWeaponSlot: (slotIndex: number) => void;
  onSwapWeaponSlot: () => void;
  onToggleSherlco: () => void;
  onToggleSherlcoMic: () => void;
  onLevelComplete: (summary: LevelClearSummary) => void;
  onPlayerDefeated: () => void;
}

function computePixelRatio(
  quality: GameSettings['quality'],
  touchActive: boolean,
  isSoftwareGl: boolean,
): number {
  if (isSoftwareGl || quality === 'low') return 1;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  if (touchActive || quality === 'medium') return Math.min(dpr, 1.35);
  return Math.min(dpr, 1.75);
}

export function FirstSwingCanvas({
  phase,
  mode,
  level,
  glitchChoice,
  resetCounter,
  sloMoTriggerCounter,
  powerTriggerRef,
  aiOverchargeTriggerRef,
  touchActive,
  touchActionsRef,
  settings,
  upgrades,
  activeWeaponId,
  activeWeaponSlot,
  weaponSlots,
  maxWeaponSlots,
  equippedGrapple,
  equippedShield,
  equippedArmor,
  claimedPowers,
  equippedPower,
  suitEntered,
  soundEngine,
  onHudUpdate,
  onEarnRewards,
  onClaimBossPower,
  onTogglePause,
  onOpenUpgrades,
  onSelectWeaponSlot,
  onSwapWeaponSlot,
  onToggleSherlco,
  onToggleSherlcoMic,
  onLevelComplete,
  onPlayerDefeated,
}: FirstSwingCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const propsRef = useRef({
    phase,
    mode,
    level,
    glitchChoice,
    touchActive,
    settings,
    upgrades,
    activeWeaponId,
    activeWeaponSlot,
    weaponSlots,
    maxWeaponSlots,
    equippedGrapple,
    equippedShield,
    equippedArmor,
    claimedPowers,
    equippedPower,
    suitEntered,
    soundEngine,
    onHudUpdate,
    onEarnRewards,
    onClaimBossPower,
    onTogglePause,
    onOpenUpgrades,
    onSelectWeaponSlot,
    onSwapWeaponSlot,
    onToggleSherlco,
    onToggleSherlcoMic,
    onLevelComplete,
    onPlayerDefeated,
  });

  propsRef.current = {
    phase,
    mode,
    level,
    glitchChoice,
    touchActive,
    settings,
    upgrades,
    activeWeaponId,
    activeWeaponSlot,
    weaponSlots,
    maxWeaponSlots,
    equippedGrapple,
    equippedShield,
    equippedArmor,
    claimedPowers,
    equippedPower,
    suitEntered,
    soundEngine,
    onHudUpdate,
    onEarnRewards,
    onClaimBossPower,
    onTogglePause,
    onOpenUpgrades,
    onSelectWeaponSlot,
    onSwapWeaponSlot,
    onToggleSherlco,
    onToggleSherlcoMic,
    onLevelComplete,
    onPlayerDefeated,
  };

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const arenaRef = useRef<ArenaLevelData | null>(null);
  const robotsRef = useRef<RobotAndVfxManager | null>(null);
  const weaponsRef = useRef<FirstPersonWeapons | null>(null);
  const physicsRef = useRef<FirstSwingPhysicsEngine | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fogRef = useRef<THREE.FogExp2 | null>(null);
  const softwareGlRef = useRef(false);
  const touchScopeResetRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect software WebGL (e.g., headless SwiftShader) to prevent heavy shader/DPR stalls
    let isSoftwareGl = false;
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        const glName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
        isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(glName);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    } catch {
      isSoftwareGl = false;
    }
    softwareGlRef.current = isSoftwareGl;

    const scene = new THREE.Scene();
    const bgColor = new THREE.Color(0x090f1d);
    scene.background = bgColor;
    const fog = new THREE.FogExp2(0x090f1d, 0.0024);
    scene.fog = fog;
    sceneRef.current = scene;
    fogRef.current = fog;

    const camera = new THREE.PerspectiveCamera(
      propsRef.current.settings.fovBase,
      window.innerWidth / window.innerHeight,
      0.1,
      900,
    );
    scene.add(camera);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(
      computePixelRatio(
        propsRef.current.settings.quality,
        propsRef.current.touchActive,
        isSoftwareGl,
      ),
    );
    renderer.shadowMap.enabled =
      !isSoftwareGl &&
      propsRef.current.settings.shadows &&
      propsRef.current.settings.quality !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Precomputed PMREM studio environment so PBR metallic Iron Armor & robots catch crisp reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    const handleContextRestored = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const hemi = new THREE.HemisphereLight(0xa5d8ff, 0x0f172a, 1.05);
    scene.add(hemi);

    const dirLight = new THREE.DirectionalLight(0xfff1e0, 1.65);
    dirLight.position.set(55, 130, 45);
    dirLight.castShadow =
      !isSoftwareGl &&
      propsRef.current.settings.shadows &&
      propsRef.current.settings.quality !== 'low';
    const shadowRes =
      propsRef.current.touchActive || propsRef.current.settings.quality !== 'high' ? 512 : 1024;
    dirLight.shadow.mapSize.width = shadowRes;
    dirLight.shadow.mapSize.height = shadowRes;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 360;
    const d = 110;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    const weapons = new FirstPersonWeapons(scene);
    camera.add(weapons.root);
    weapons.applyLoadout(propsRef.current.activeWeaponId, propsRef.current.equippedGrapple);
    weaponsRef.current = weapons;

    const robots = new RobotAndVfxManager(scene);
    robotsRef.current = robots;

    const physics = new FirstSwingPhysicsEngine(scene);
    physicsRef.current = physics;

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const initialArena = buildArenaLevel(
      propsRef.current.level,
      maxAniso,
      propsRef.current.mode,
      propsRef.current.glitchChoice,
    );
    scene.add(initialArena.group);
    arenaRef.current = initialArena;
    robots.spawnForArena(
      initialArena,
      propsRef.current.glitchChoice,
      propsRef.current.settings.difficulty,
    );
    physics.resetForLevel(
      initialArena,
      propsRef.current.upgrades,
      propsRef.current.equippedShield,
      propsRef.current.equippedArmor,
    );
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const keys = new Set<string>();
    let keyJump = false;
    let keySprint = false;
    let keyCrouch = false;
    let keyBlock = false;
    let keyZip = false;
    let mouseLeftDown = false;
    let mouseRightDown = false;

    let touchAnalogX = 0;
    let touchAnalogY = 0;
    let touchSprint = false;
    let touchJump = false;
    let touchSwing = false;
    let touchFire = false;
    let touchBlock = false;
    let touchCrouch = false;
    let touchScope = false;

    const input: InputSnapshot = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      analogX: 0,
      analogY: 0,
      jumpHeld: false,
      sprintHeld: false,
      crouchHeld: false,
      blockHeld: false,
      zipHeld: false,
      mouseLeftDown: false,
      mouseRightDown: false,
      swingHeld: false,
    };

    const syncInput = () => {
      input.forward = keys.has('KeyW') || keys.has('ArrowUp');
      input.backward = keys.has('KeyS') || keys.has('ArrowDown');
      input.left = keys.has('KeyA') || keys.has('ArrowLeft');
      input.right = keys.has('KeyD') || keys.has('ArrowRight');
      input.analogX = touchAnalogX;
      input.analogY = touchAnalogY;

      keyJump = keys.has('Space');
      keySprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
      keyCrouch = keys.has('KeyC') || keys.has('ControlLeft');
      keyBlock = keys.has('KeyB');
      keyZip = keys.has('KeyE');
      const keySwing = keys.has('KeyG');

      input.jumpHeld = keyJump || touchJump;
      input.sprintHeld = keySprint || touchSprint;
      input.crouchHeld = keyCrouch || touchCrouch;
      input.blockHeld = keyBlock || touchBlock;
      input.zipHeld = keyZip;
      input.swingHeld = keySwing || touchSwing;
      input.mouseLeftDown = mouseLeftDown || touchFire;
      const activeIsGun = getWeaponConfig(propsRef.current.activeWeaponId).category === 'gun';
      input.mouseRightDown = mouseRightDown || (activeIsGun && touchScope);
    };

    touchScopeResetRef.current = () => {
      touchScope = false;
      touchSwing = false;
      touchFire = false;
      touchBlock = false;
      touchJump = false;
      touchAnalogX = 0;
      touchAnalogY = 0;
      touchSprint = false;
      syncInput();
    };

    touchActionsRef.current = {
      setAnalogMove: (x: number, y: number, sprint: boolean) => {
        touchAnalogX = x;
        touchAnalogY = y;
        touchSprint = sprint;
        syncInput();
      },
      setJumpHeld: (held: boolean) => {
        if (held) propsRef.current.soundEngine.init();
        touchJump = held;
        syncInput();
      },
      setSwingHeld: (held: boolean) => {
        if (held) propsRef.current.soundEngine.init();
        touchSwing = held;
        syncInput();
      },
      setFireHeld: (held: boolean) => {
        if (held) propsRef.current.soundEngine.init();
        touchFire = held;
        syncInput();
      },
      setBlockHeld: (held: boolean) => {
        if (held) propsRef.current.soundEngine.init();
        touchBlock = held;
        syncInput();
      },
      toggleCrouch: () => {
        propsRef.current.soundEngine.init();
        touchCrouch = !touchCrouch;
        syncInput();
      },
      toggleScope: () => {
        propsRef.current.soundEngine.init();
        touchScope = !touchScope;
        syncInput();
      },
      triggerZipOrSuit: () => {
        const p = propsRef.current;
        p.soundEngine.init();
        if (!arenaRef.current) return;
        if (robots.getCaptivesRemaining() > 0) {
          physics.triggerInteract(
            arenaRef.current,
            robots,
            p.soundEngine,
            p.onEarnRewards,
          );
        }
        physics.triggerZip(
          arenaRef.current,
          robots,
          p.upgrades,
          p.equippedGrapple,
          p.soundEngine,
        );
      },
      triggerBarrage: () => {
        const p = propsRef.current;
        p.soundEngine.init();
        if (!arenaRef.current) return;
        physics.triggerSwordBarrage(
          arenaRef.current,
          weapons,
          p.upgrades,
          p.activeWeaponId,
          p.soundEngine,
        );
      },
      triggerDodge: () => {
        const p = propsRef.current;
        p.soundEngine.init();
        const moveDir = new THREE.Vector3();
        const fwd = new THREE.Vector3(-Math.sin(physics.yaw), 0, -Math.cos(physics.yaw));
        const right = new THREE.Vector3(Math.cos(physics.yaw), 0, -Math.sin(physics.yaw));
        if (Math.abs(touchAnalogX) > 0.1 || Math.abs(touchAnalogY) > 0.1) {
          moveDir.addScaledVector(fwd, -touchAnalogY);
          moveDir.addScaledVector(right, touchAnalogX);
        } else {
          if (input.forward) moveDir.add(fwd);
          if (input.backward) moveDir.sub(fwd);
          if (input.right) moveDir.add(right);
          if (input.left) moveDir.sub(right);
        }
        physics.triggerDodge(p.soundEngine, moveDir);
      },
      triggerSloMo: () => {
        const p = propsRef.current;
        p.soundEngine.init();
        physics.triggerSloMo(p.soundEngine);
      },
      triggerCritSurge: () => {
        const p = propsRef.current;
        p.soundEngine.init();
        physics.triggerCritSurge(p.soundEngine, p.upgrades);
      },
      triggerAiOvercharge: () => {
        const p = propsRef.current;
        p.soundEngine.init();
        physics.triggerAiOvercharge(p.soundEngine);
      },
      applyTouchLook: (dx: number, dy: number) => {
        if (propsRef.current.phase !== 'playing') return;
        physics.applyLookDelta(dx, dy, propsRef.current.settings.sensitivity);
      },
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      const p = propsRef.current;

      if (e.code === 'Tab' || e.code === 'KeyP') {
        e.preventDefault();
        if (p.phase === 'playing' || p.phase === 'paused') {
          if (document.pointerLockElement) document.exitPointerLock();
          p.onTogglePause();
        }
        return;
      }

      if (e.code === 'KeyU' && p.phase === 'playing') {
        if (document.pointerLockElement) document.exitPointerLock();
        p.onOpenUpgrades();
        return;
      }

      if (p.phase !== 'playing') return;

      if (e.code === 'KeyH' && !e.repeat) {
        p.onToggleSherlco();
        return;
      }

      if (e.code === 'KeyM' && !e.repeat) {
        p.onToggleSherlcoMic();
        return;
      }

      keys.add(e.code);
      syncInput();

      if (e.code === 'KeyT' && !e.repeat) {
        physics.triggerSloMo(p.soundEngine);
      }

      if (e.code === 'KeyY' && !e.repeat) {
        physics.triggerAiOvercharge(p.soundEngine);
      }

      if (e.code === 'KeyQ' && !e.repeat) {
        p.onSwapWeaponSlot();
      }

      const slotDigitMatch = /^Digit([1-6])$/.exec(e.code);
      if (slotDigitMatch && !e.repeat) {
        const idx = Number(slotDigitMatch[1]) - 1;
        if (idx < p.maxWeaponSlots && idx < MAX_WEAPON_SLOTS) {
          p.onSelectWeaponSlot(idx);
        }
      }

      if (!e.repeat) {
        const bossPowerByKey: Record<string, BossPowerId> = {
          Digit7: 'fire',
          Digit8: 'water',
          Digit9: 'punch',
          Digit0: 'shrink',
        };
        const chosenPower =
          bossPowerByKey[e.code] ?? (e.code === 'KeyX' ? p.equippedPower : null);
        if (chosenPower && arenaRef.current) {
          physics.triggerBossPower(
            chosenPower,
            p.claimedPowers,
            arenaRef.current,
            robots,
            p.upgrades,
            p.soundEngine,
            p.onEarnRewards,
            (bp) => {
              if (bp) p.onClaimBossPower(bp);
            },
          );
        }
      }

      if (e.code === 'KeyF' && !e.repeat && arenaRef.current) {
        physics.triggerSwordBarrage(
          arenaRef.current,
          weapons,
          p.upgrades,
          p.activeWeaponId,
          p.soundEngine,
        );
      }

      if (e.code === 'KeyZ' && !e.repeat) {
        physics.triggerCritSurge(p.soundEngine, p.upgrades);
      }

      if (e.code === 'KeyE' && !e.repeat && arenaRef.current) {
        physics.triggerZip(
          arenaRef.current,
          robots,
          p.upgrades,
          p.equippedGrapple,
          p.soundEngine,
        );
      }

      if (e.code === 'KeyR' && !e.repeat && arenaRef.current) {
        physics.triggerInteract(
          arenaRef.current,
          robots,
          p.soundEngine,
          p.onEarnRewards,
        );
      }

      if ((e.code === 'KeyV' || e.code === 'AltLeft') && !e.repeat) {
        e.preventDefault();
        const moveDir = new THREE.Vector3();
        const fwd = new THREE.Vector3(-Math.sin(physics.yaw), 0, -Math.cos(physics.yaw));
        const right = new THREE.Vector3(Math.cos(physics.yaw), 0, -Math.sin(physics.yaw));
        if (input.forward) moveDir.add(fwd);
        if (input.backward) moveDir.sub(fwd);
        if (input.right) moveDir.add(right);
        if (input.left) moveDir.sub(right);
        physics.triggerDodge(p.soundEngine, moveDir);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
      syncInput();
    };

    const handleBlur = () => {
      keys.clear();
      mouseLeftDown = false;
      mouseRightDown = false;
      touchJump = false;
      touchSwing = false;
      touchFire = false;
      touchBlock = false;
      touchAnalogX = 0;
      touchAnalogY = 0;
      touchSprint = false;
      syncInput();
    };

    const handleMouseDown = (e: MouseEvent) => {
      const p = propsRef.current;
      if (p.phase !== 'playing') return;
      if (p.touchActive) return;
      if (p.mode === 'glitch_lv0' && p.glitchChoice === 'pending') return;

      const target = e.target as HTMLElement | null;
      if (target && target !== renderer.domElement && target.closest('button, input, form')) {
        return;
      }

      p.soundEngine.init();

      if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock?.();
      }

      if (e.button === 0) {
        mouseLeftDown = true;
      } else if (e.button === 2) {
        mouseRightDown = true;
      }
      syncInput();
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseLeftDown = false;
      if (e.button === 2) mouseRightDown = false;
      syncInput();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const p = propsRef.current;
      if (p.phase !== 'playing' || p.touchActive) return;
      if (document.pointerLockElement === renderer.domElement) {
        physics.applyLookDelta(e.movementX, e.movementY, p.settings.sensitivity);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    powerTriggerRef.current = (powerId: BossPowerId) => {
      const p = propsRef.current;
      if (!arenaRef.current) return;
      physics.triggerBossPower(
        powerId,
        p.claimedPowers,
        arenaRef.current,
        robots,
        p.upgrades,
        p.soundEngine,
        p.onEarnRewards,
        (bp) => {
          if (bp) p.onClaimBossPower(bp);
        },
      );
    };

    aiOverchargeTriggerRef.current = () => {
      const p = propsRef.current;
      p.soundEngine.init();
      physics.triggerAiOvercharge(p.soundEngine);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('resize', handleResize);

    let rafId = 0;
    let lastTime = performance.now();
    let hudEmitTimer = 0;
    let lastAtmosphereKey = '';

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const realDt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const p = propsRef.current;
      const arena = arenaRef.current;
      if (!arena) return;

      if (p.phase !== 'playing') {
        p.soundEngine.updateContinuous(0, false, 0, false, false);
        p.soundEngine.updateBossMusic(false, realDt, false, false);
        renderer.render(scene, camera);
        return;
      }

      const atmosphereKey = `${arena.mode}_${arena.outsideWorldActive ? '1' : '0'}`;
      if (fogRef.current && atmosphereKey !== lastAtmosphereKey) {
        lastAtmosphereKey = atmosphereKey;
        if (arena.mode === 'glitch_lv0') {
          bgColor.setHex(0x18050b);
          fogRef.current.color.setHex(0x18050b);
          fogRef.current.density = 0.0028;
        } else if (arena.outsideWorldActive) {
          bgColor.setHex(0x071022);
          fogRef.current.color.setHex(0x071022);
          fogRef.current.density = 0.0013;
        } else {
          bgColor.setHex(0x0a101d);
          fogRef.current.color.setHex(0x0a101d);
          fogRef.current.density = 0.0022;
        }
      }

      const hudState = physics.step(
        realDt,
        input,
        camera,
        arena,
        robots,
        weapons,
        p.settings,
        p.upgrades,
        p.activeWeaponId,
        p.activeWeaponSlot,
        p.weaponSlots,
        p.maxWeaponSlots,
        p.equippedGrapple,
        p.equippedShield,
        p.equippedArmor,
        p.glitchChoice,
        p.suitEntered,
        p.soundEngine,
        p.onEarnRewards,
        (elapsedSec, robotsDestroyed, alliesRecruited) => {
          if (document.pointerLockElement) document.exitPointerLock();
          p.soundEngine.updateContinuous(0, false, 0, false, false);
          p.soundEngine.updateBossMusic(false, realDt, false, false);
          p.onLevelComplete({
            clearedLevel: arena.level,
            wasOutsideWorld: arena.outsideWorldActive,
            wasBossLevel: arena.isBossLevel,
            wasRescueLevel: arena.isRescueLevel,
            bossName: arena.bossName,
            claimedPowerReward: arena.isBossLevel ? arena.bossPower : null,
            pointsEarned: 0,
            creditsEarned: 0,
            robotsDestroyed,
            alliesRecruited,
            elapsedSec,
          });
        },
        () => {
          if (document.pointerLockElement) document.exitPointerLock();
          p.soundEngine.updateContinuous(0, false, 0, false, false);
          p.soundEngine.updateBossMusic(false, realDt, false, false);
          p.onPlayerDefeated();
        },
        (bp) => {
          if (bp) p.onClaimBossPower(bp);
        },
      );

      const bossMusicActive = Boolean(
        hudState.bossName &&
          (hudState.bossIsInfinite || hudState.bossHp > 0) &&
          !(p.mode === 'glitch_lv0' && p.glitchChoice === 'pending'),
      );
      p.soundEngine.updateBossMusic(
        bossMusicActive,
        realDt,
        hudState.sloMo,
        arena.outsideWorldActive || arena.mode === 'glitch_lv0',
      );

      renderer.render(scene, camera);

      hudEmitTimer += realDt;
      if (hudEmitTimer >= 0.045) {
        hudEmitTimer = 0;
        p.onHudUpdate(hudState);
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      powerTriggerRef.current = null;
      aiOverchargeTriggerRef.current = null;
      touchActionsRef.current = null;
      touchScopeResetRef.current = null;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      arenaRef.current?.dispose();
      robots.dispose();
      weapons.dispose();
      physics.dispose();
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Rebuild arena when level, mode, glitchChoice, or resetCounter changes
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    const robots = robotsRef.current;
    const weapons = weaponsRef.current;
    const physics = physicsRef.current;
    if (!scene || !camera || !renderer || !robots || !weapons || !physics) return;

    arenaRef.current?.dispose();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const nextArena = buildArenaLevel(level, maxAniso, mode, glitchChoice);
    scene.add(nextArena.group);
    arenaRef.current = nextArena;

    weapons.clearProjectiles();
    robots.spawnForArena(nextArena, glitchChoice, propsRef.current.settings.difficulty);
    physics.resetForLevel(
      nextArena,
      propsRef.current.upgrades,
      propsRef.current.equippedShield,
      propsRef.current.equippedArmor,
    );
    touchScopeResetRef.current?.();
    if (!softwareGlRef.current) {
      renderer.compile(scene, camera);
    }

    if (mode === 'glitch_lv0' && glitchChoice === 'pending' && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [level, mode, glitchChoice, resetCounter]);

  // Sync weapons & grapple visual loadout
  useEffect(() => {
    weaponsRef.current?.applyLoadout(activeWeaponId, equippedGrapple);
    if (getWeaponConfig(activeWeaponId).category !== 'gun') {
      touchScopeResetRef.current?.();
    }
  }, [activeWeaponId, equippedGrapple]);

  // Trigger Slo-Mo externally if incremented
  const prevSloMoTriggerRef = useRef(sloMoTriggerCounter);
  useEffect(() => {
    if (sloMoTriggerCounter !== prevSloMoTriggerRef.current) {
      prevSloMoTriggerRef.current = sloMoTriggerCounter;
      physicsRef.current?.triggerSloMo(propsRef.current.soundEngine);
    }
  }, [sloMoTriggerCounter]);

  // Sync audio, difficulty & graphics settings
  useEffect(() => {
    soundEngine.setVolume(settings.soundVolume, settings.muted);
    robotsRef.current?.setDifficulty(settings.difficulty);
    const isSoftware = softwareGlRef.current;
    const shadowsEnabled = !isSoftware && settings.shadows && settings.quality !== 'low';
    if (rendererRef.current) {
      rendererRef.current.shadowMap.enabled = shadowsEnabled;
      rendererRef.current.setPixelRatio(
        computePixelRatio(settings.quality, touchActive, isSoftware),
      );
    }
    if (dirLightRef.current) {
      dirLightRef.current.castShadow = shadowsEnabled;
    }
    if (touchActive && document.pointerLockElement) {
      document.exitPointerLock();
    }
    if (!touchActive) {
      touchScopeResetRef.current?.();
    }
  }, [settings, soundEngine, touchActive]);

  void BOSS_POWERS;

  return <div ref={containerRef} className="fixed inset-0 z-0 overflow-hidden bg-slate-950 touch-none" />;
}
