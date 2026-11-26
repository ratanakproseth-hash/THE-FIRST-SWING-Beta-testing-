import * as THREE from 'three';
import { ArenaLevelData, GrappleNode } from './arenaBuilder';
import { FirstPersonWeapons } from './firstPersonWeapons';
import { RobotAndVfxManager, RobotUnit, SwarmBot } from './robotManager';
import {
  BossPowerId,
  CrosshairTargetKind,
  ExtraArmorId,
  GameSettings,
  GlitchOutcomeChoice,
  GrappleHookId,
  GunWeaponId,
  HudState,
  LASER_BOOM_COOLDOWN_SEC,
  LASER_BOOM_DMG,
  LASER_BOOM_MAX_AMMO,
  NoiseLevel,
  PlayerMovementState,
  SLO_MO_COOLDOWN_SEC,
  SLO_MO_DURATION_SEC,
  SWORD_BARRAGE_COOLDOWN_SEC,
  SWORD_BARRAGE_MANA_COST,
  ShieldId,
  SideQuestHud,
  SwordWeaponId,
  UpgradeLevels,
  WeaponId,
  ZIP_COOLDOWN_SEC,
  getBossDamageForLevel,
  getBossPowerConfig,
  getCritMultiplierDamage,
  getDifficultyConfig,
  getExtraArmorConfig,
  getGrappleHookConfig,
  getLevelSubject,
  getManaRegenRate,
  getPlayerAttackDamage,
  getPlayerMaxHp,
  getPlayerMaxMana,
  getShieldConfig,
  getWeaponConfig,
  getZipStats,
} from '../types/game';
import { ProceduralSoundEngine } from '../audio/soundEngine';

const STRING_SEGMENTS = 22;
const GRAVITY = 31.0;
const LASER_BOOM_CHARGE_SEC = 0.85;

const TUTORIAL_STEPS = [
  'STEP 1/4 · Move with [W A S D], Sprint [Shift], Crouch-Stealth [C]',
  'STEP 2/4 · Hold [RMB] or [Space] to Grapple Swing · Press [E] for Slow-Start Zip',
  'STEP 3/4 · Press [F] for Sword Barrage · Cycle Weapons [Q]/[1-6] · Defeat Bots',
  'STEP 4/4 · Reach the Emerald Extraction Gate ahead to finish Tutorial!',
] as const;

export interface InputSnapshot {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  analogX?: number;
  analogY?: number;
  jumpHeld: boolean;
  sprintHeld: boolean;
  crouchHeld: boolean;
  blockHeld: boolean;
  zipHeld: boolean;
  mouseLeftDown: boolean;
  mouseRightDown: boolean;
  swingHeld?: boolean;
}

type SideQuestKind = 'headshots' | 'blocks' | 'zip_strikes' | 'rescues';

export class FirstSwingPhysicsEngine {
  public position = new THREE.Vector3(0, 1.85, 16);
  public velocity = new THREE.Vector3(0, 0, 0);
  public yaw = 0;
  public pitch = -0.04;

  private grounded = true;
  private airJumpsRemaining = 1;
  private wasJumpHeld = false;
  private wasMouseLeftDown = false;
  private doubleJumpVisualTimer = 0;
  private eyeHeight = 1.85;
  private isCrouching = false;
  private isBlocking = false;
  private slideTimer = 0;
  private footstepTimer = 0;

  private isSwinging = false;
  private swingAnchor = new THREE.Vector3();
  private ropeLength = 20;
  private springWiggleAmp = 0;
  private springWigglePhase = 0;
  private prevRadialVel = 0;

  private isZipping = false;
  private zipTargetPos = new THREE.Vector3();
  private zipEnemyTarget: RobotUnit | null = null;
  private zipSwarmTarget: SwarmBot | null = null;
  private zipCooldown = 0;
  private zipTimer = 0;
  private zipElapsedSec = 0;
  private zipDodgeChecked = false;

  private dodgeCooldown = 0;
  private dodgeIframesTimer = 0;
  private dodgeBurstTimer = 0;
  private critSurgeCharge = 0;
  private critSurgeActive = false;
  private sniperZoomed = false;

  private laserBoomAmmo = LASER_BOOM_MAX_AMMO;
  private laserBoomCooldownSec = 0;
  private laserChargeTimer = 0;
  private laserTickSoundAccum = 0;
  private barrageCooldownSec = 0;

  private tutorialStepIndex = 0;
  private tutorialDidMove = false;
  private tutorialDidSwingZip = false;
  private tutorialDidCombat = false;

  private waveNumber = 1;
  private waveClearDelay = 0;

  private isWallSliding = false;
  private wallSlideNormal = new THREE.Vector3(1, 0, 0);

  private health = 125;
  private maxHealth = 125;
  private shieldHp = 0;
  private maxShieldHp = 0;
  private shieldRegenDelay = 0;
  private armorReductionPct = 0;
  private mana = 100;
  private maxMana = 100;
  private weaponCooldown = 0;
  private recoilBloom = 0;
  private gunshotNoiseTimer = 0;
  private recentSlashTimer = 0;
  private lowManaNoticeTimer = 0;
  private warnCooldown = 0;
  private playerShrunkSec = 0;
  private cryoSlowTimer = 0;
  private laserHitCooldown = 0;
  private sensorAudioCooldown = 0;
  private hitMarkerTimer = 0;
  private hitWasHeadshot = false;
  private hitWasWeakPoint = false;
  private aiOverchargeSec = 0;
  private aiOverchargeCooldownSec = 0;
  private killBannerTimer = 0;
  private killBannerText = '';
  private damageFlash = 0;
  private criticalAlertCooldown = 0;
  private wasBelow20Pct = false;
  private glitchScreenIntensity = 0;
  private comboKills = 0;
  private comboDecay = 0;

  private sloMoRemainingSec = 0;
  private sloMoCooldownSec = 0;
  private powerCooldowns: Record<BossPowerId, number> = {
    fire: 0,
    water: 0,
    punch: 0,
    shrink: 0,
  };
  private bossClaimedInRun = false;

  private sideQuestKind: SideQuestKind = 'headshots';
  private sideQuest: SideQuestHud | null = null;

  private levelElapsedSec = 0;
  private robotsDestroyedInLevel = 0;
  private alliesRecruitedInLevel = 0;
  private runPointsEarned = 0;
  private runCreditsEarned = 0;
  private levelCompletedFlag = false;
  private playerDeadFlag = false;

  private hudRaycastTimer = 0;
  private cachedCrosshairKind: CrosshairTargetKind = 'none';
  private cachedSwingPos: THREE.Vector3 | null = null;
  private cachedZipPos: THREE.Vector3 | null = null;
  private cachedZipIsEnemy = false;
  private cachedZipEnemyName = '';
  private cachedZipEnemyHpRatio = 0;

  public readonly stringMesh: THREE.Mesh;
  private readonly stringPositions: Float32Array;
  private readonly stringGeo: THREE.BufferGeometry;
  private readonly stringMat: THREE.MeshBasicMaterial;

  private readonly raycaster = new THREE.Raycaster();
  private readonly tmpVecA = new THREE.Vector3();
  private readonly tmpVecB = new THREE.Vector3();
  private readonly tmpVecC = new THREE.Vector3();
  private readonly tmpVecD = new THREE.Vector3();
  private readonly tmpCamDir = new THREE.Vector3();
  private readonly tmpProj = new THREE.Vector3();
  private readonly upAxis = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene) {
    this.stringGeo = new THREE.BufferGeometry();
    const vertCount = STRING_SEGMENTS * 2;
    this.stringPositions = new Float32Array(vertCount * 3);
    const indices: number[] = [];
    for (let i = 0; i < STRING_SEGMENTS - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
    this.stringGeo.setAttribute('position', new THREE.BufferAttribute(this.stringPositions, 3));
    this.stringGeo.setIndex(indices);
    this.stringMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.96,
    });
    this.stringMesh = new THREE.Mesh(this.stringGeo, this.stringMat);
    this.stringMesh.frustumCulled = false;
    this.stringMesh.visible = false;
    scene.add(this.stringMesh);
  }

  public resetForLevel(
    arena: ArenaLevelData,
    upgrades: UpgradeLevels,
    equippedShield: ShieldId = 'none',
    equippedArmor: ExtraArmorId = 'none',
  ): void {
    this.position.copy(arena.spawnPos);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.04;
    this.grounded = true;
    this.airJumpsRemaining = 1;
    this.wasJumpHeld = false;
    this.wasMouseLeftDown = false;
    this.doubleJumpVisualTimer = 0;
    this.eyeHeight = 1.85;
    this.isCrouching = false;
    this.isBlocking = false;
    this.slideTimer = 0;
    this.isWallSliding = false;
    this.wallSlideNormal.set(1, 0, 0);

    this.isSwinging = false;
    this.isZipping = false;
    this.zipEnemyTarget = null;
    this.zipSwarmTarget = null;
    this.zipCooldown = 0;
    this.zipTimer = 0;
    this.zipElapsedSec = 0;
    this.zipDodgeChecked = false;
    this.dodgeCooldown = 0;
    this.dodgeIframesTimer = 0;
    this.dodgeBurstTimer = 0;
    this.critSurgeCharge = 0;
    this.critSurgeActive = false;
    this.sniperZoomed = false;
    this.stringMesh.visible = false;

    this.laserBoomAmmo = LASER_BOOM_MAX_AMMO;
    this.laserBoomCooldownSec = 0;
    this.laserChargeTimer = 0;
    this.laserTickSoundAccum = 0;
    this.barrageCooldownSec = 0;

    this.tutorialStepIndex = 0;
    this.tutorialDidMove = false;
    this.tutorialDidSwingZip = false;
    this.tutorialDidCombat = false;
    this.waveNumber = 1;
    this.waveClearDelay = 0;

    const shieldCfg = getShieldConfig(equippedShield);
    const armorCfg = getExtraArmorConfig(equippedArmor);
    this.maxHealth = getPlayerMaxHp(upgrades, equippedArmor);
    this.health = this.maxHealth;
    this.maxShieldHp = shieldCfg.maxShieldHp;
    this.shieldHp = shieldCfg.maxShieldHp;
    this.shieldRegenDelay = 0;
    this.armorReductionPct = armorCfg.damageReductionPct;

    this.maxMana = getPlayerMaxMana(upgrades);
    this.mana = this.maxMana;
    this.weaponCooldown = 0;
    this.recoilBloom = 0;
    this.gunshotNoiseTimer = 0;
    this.recentSlashTimer = 0;
    this.lowManaNoticeTimer = 0;
    this.warnCooldown = 0;
    this.playerShrunkSec = 0;
    this.cryoSlowTimer = 0;
    this.laserHitCooldown = 0;
    this.sensorAudioCooldown = 0;
    this.hitMarkerTimer = 0;
    this.hitWasHeadshot = false;
    this.hitWasWeakPoint = false;
    this.aiOverchargeSec = 0;
    this.aiOverchargeCooldownSec = 0;
    this.killBannerTimer = 0;
    this.damageFlash = 0;
    this.criticalAlertCooldown = 0;
    this.wasBelow20Pct = false;
    this.glitchScreenIntensity = arena.mode === 'glitch_lv0' ? 0.5 : 0;
    this.comboKills = 0;
    this.sloMoRemainingSec = 0;
    this.sloMoCooldownSec = 0;
    this.powerCooldowns = { fire: 0, water: 0, punch: 0, shrink: 0 };
    this.bossClaimedInRun = false;

    this.levelElapsedSec = 0;
    this.robotsDestroyedInLevel = 0;
    this.alliesRecruitedInLevel = 0;
    this.runPointsEarned = 0;
    this.runCreditsEarned = 0;
    this.levelCompletedFlag = false;
    this.playerDeadFlag = false;

    this.initSideQuest(arena);
  }

  public isSniperZoomed(activeWeaponId: WeaponId): boolean {
    return this.sniperZoomed && activeWeaponId === 'sniper';
  }

  public triggerSloMo(sound: ProceduralSoundEngine): void {
    if (this.sloMoRemainingSec > 0) {
      this.sloMoRemainingSec = 0;
      this.sloMoCooldownSec = SLO_MO_COOLDOWN_SEC;
      sound.playSloMoToggle(false);
      this.killBannerTimer = 1.1;
      this.killBannerText = `SLO-MO ENDED · ${SLO_MO_COOLDOWN_SEC}s COOLDOWN`;
      return;
    }
    if (this.sloMoCooldownSec > 0) {
      sound.playNoGrabError();
      this.killBannerTimer = 1.0;
      this.killBannerText = `SLO-MO COOLDOWN · ${Math.ceil(this.sloMoCooldownSec)}s`;
      return;
    }
    this.sloMoRemainingSec = SLO_MO_DURATION_SEC;
    sound.playSloMoToggle(true);
    this.killBannerTimer = 1.3;
    this.killBannerText = `CHRONO SLO-MO ACTIVE · ${SLO_MO_DURATION_SEC}s`;
  }

  public triggerDodge(sound: ProceduralSoundEngine, moveInput?: THREE.Vector3): boolean {
    if (this.dodgeCooldown > 0) return false;
    this.dodgeCooldown = 1.35;
    this.dodgeIframesTimer = 0.58;
    this.dodgeBurstTimer = 0.25;
    this.isSwinging = false;
    this.isZipping = false;
    this.zipEnemyTarget = null;
    this.zipSwarmTarget = null;

    const dir = new THREE.Vector3();
    if (moveInput && moveInput.lengthSq() > 0.01) {
      dir.copy(moveInput).normalize();
    } else {
      dir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    }

    const boost = 36;
    this.velocity.x = dir.x * boost;
    this.velocity.z = dir.z * boost;
    this.velocity.y = this.grounded ? 7.5 : Math.max(this.velocity.y + 4.5, 9.5);
    this.grounded = false;

    sound.playDodge();
    this.killBannerTimer = 0.75;
    this.killBannerText = 'KINETIC DODGE · INVULNERABLE';
    return true;
  }

  public triggerCritSurge(sound: ProceduralSoundEngine, upgrades: UpgradeLevels): boolean {
    if (this.critSurgeActive) return true;
    if (this.critSurgeCharge < 100) {
      sound.playNoGrabError();
      this.killBannerTimer = 0.9;
      this.killBannerText = `10x CRIT SURGE CHARGING · ${Math.floor(this.critSurgeCharge)}%`;
      return false;
    }
    this.critSurgeActive = true;
    sound.playCritUlt();
    const critDmg = getCritMultiplierDamage(upgrades);
    this.killBannerTimer = 1.65;
    this.killBannerText = `10x CRIT SURGE ARMED · ${critDmg.toLocaleString()} DMG ON NEXT HIT!`;
    return true;
  }

  public triggerAiOvercharge(sound: ProceduralSoundEngine): boolean {
    if (this.aiOverchargeCooldownSec > 0) {
      sound.playNoGrabError();
      this.killBannerTimer = 1.0;
      this.killBannerText = `AI OVERCHARGE RECHARGING · ${Math.ceil(this.aiOverchargeCooldownSec)}s`;
      return false;
    }
    this.aiOverchargeSec = 8.5;
    this.aiOverchargeCooldownSec = 18.0;
    const healAmt = Math.max(25, Math.round(this.maxHealth * 0.3));
    this.health = Math.min(this.maxHealth, this.health + healAmt);
    if (this.maxShieldHp > 0) {
      this.shieldHp = Math.min(this.maxShieldHp, this.shieldHp + Math.round(this.maxShieldHp * 0.6));
    }
    this.mana = Math.min(this.maxMana, this.mana + 35);
    sound.playCritUlt();
    this.killBannerTimer = 1.9;
    this.killBannerText = `SHERLCO AI OVERCHARGE · +${healAmt} HP · +25% DMG BOOST (8.5s)`;
    return true;
  }

  public triggerSwordBarrage(
    _arena: ArenaLevelData,
    weapons: FirstPersonWeapons,
    upgrades: UpgradeLevels,
    activeWeaponId: WeaponId,
    sound: ProceduralSoundEngine,
  ): boolean {
    if (this.barrageCooldownSec > 0) {
      if (this.warnCooldown <= 0) {
        this.warnCooldown = 0.5;
        sound.playNoGrabError();
        this.killBannerTimer = 0.85;
        this.killBannerText = `SWORD BARRAGE COOLDOWN · ${this.barrageCooldownSec.toFixed(1)}s`;
      }
      return false;
    }
    if (this.mana < SWORD_BARRAGE_MANA_COST) {
      if (this.lowManaNoticeTimer <= 0) {
        this.lowManaNoticeTimer = 0.85;
        sound.playNoGrabError();
        this.killBannerTimer = 0.9;
        this.killBannerText = `NEED ${SWORD_BARRAGE_MANA_COST} MANA FOR SWORD BARRAGE`;
      }
      return false;
    }

    this.mana = Math.max(0, this.mana - SWORD_BARRAGE_MANA_COST);
    this.barrageCooldownSec = SWORD_BARRAGE_COOLDOWN_SEC;
    this.recentSlashTimer = 0.55;
    this.tutorialDidCombat = true;

    const wCfg = getWeaponConfig(activeWeaponId);
    const swordMult = wCfg.category === 'sword' ? wCfg.dmgMultiplier : 1.0;
    const aiMult = this.aiOverchargeSec > 0 ? 1.25 : 1.0;
    const baseAtk = getPlayerAttackDamage(upgrades) * swordMult * aiMult;
    let waveDmg = Math.round(baseAtk * 1.45);
    if (this.critSurgeActive) {
      waveDmg = Math.max(waveDmg, getCritMultiplierDamage(upgrades));
      this.critSurgeActive = false;
      this.critSurgeCharge = 0;
      sound.playCritUlt();
    }

    const camDir = this.getCameraForward(this.tmpCamDir).clone();
    const sloMoActive = this.sloMoRemainingSec > 0;
    weapons.triggerSwordBarrage(this.position, camDir, waveDmg);
    sound.playSwordBarrage(sloMoActive);
    this.killBannerTimer = 1.25;
    this.killBannerText = `SWORD BARRAGE · 5 EXPLOSIVE WAVES (${waveDmg.toLocaleString()} DMG)`;
    return true;
  }

  public triggerBossPower(
    powerId: BossPowerId,
    claimedPowers: BossPowerId[],
    arena: ArenaLevelData,
    robots: RobotAndVfxManager,
    upgrades: UpgradeLevels,
    sound: ProceduralSoundEngine,
    onEarnRewards: (pts: number, credits: number, rescuedDelta: number) => void,
    onBossDefeated?: (power: BossPowerId | null) => void,
  ): boolean {
    if (!claimedPowers.includes(powerId)) {
      sound.playNoGrabError();
      this.killBannerTimer = 1.2;
      this.killBannerText = 'DEFEAT THIS BOSS TYPE TO CLAIM POWER';
      return false;
    }
    if (this.powerCooldowns[powerId] > 0) {
      sound.playNoGrabError();
      this.killBannerTimer = 0.9;
      this.killBannerText = `POWER RECHARGING · ${this.powerCooldowns[powerId].toFixed(1)}s`;
      return false;
    }
    const cfg = getBossPowerConfig(powerId);
    if (this.mana < cfg.manaCost) {
      sound.playNoGrabError();
      this.killBannerTimer = 0.9;
      this.killBannerText = `NEED ${cfg.manaCost} MANA FOR ${cfg.name.toUpperCase()}`;
      return false;
    }

    this.mana = Math.max(0, this.mana - cfg.manaCost);
    this.powerCooldowns[powerId] = cfg.cooldownSec;
    sound.playBossPower(powerId);

    const camDir = this.getCameraForward(this.tmpCamDir).clone();
    const baseAtk = getPlayerAttackDamage(upgrades);
    const sloMoActive = this.sloMoRemainingSec > 0;

    this.raycaster.set(this.position, camDir);
    this.raycaster.far = 90;
    const botHits = this.raycaster.intersectObjects(robots.robotRaycastMeshes, false);
    const wallHits = this.raycaster.intersectObjects(arena.raycastMeshes, false);
    let hitDist = 11;
    if (botHits.length > 0 && (wallHits.length === 0 || botHits[0].distance < wallHits[0].distance)) {
      hitDist = Math.min(68, botHits[0].distance);
    } else if (wallHits.length > 0) {
      hitDist = Math.min(54, wallHits[0].distance);
    }
    const blastCenter = this.position.clone().addScaledVector(camDir, hitDist);

    const colorHex =
      powerId === 'fire'
        ? 0xf97316
        : powerId === 'water'
          ? 0x0ea5e9
          : powerId === 'punch'
            ? 0xeab308
            : 0xd946ef;

    robots.spawnExplosion(blastCenter, true, colorHex);

    let wipedBuildings = 0;
    if (powerId === 'punch') {
      wipedBuildings = robots.wipeNearbyBuildings(blastCenter, 26, arena, sound);
      this.velocity.addScaledVector(camDir, 12);
    }

    const radius = powerId === 'shrink' ? 26 : powerId === 'punch' ? 22 : 18;
    const dmgMult =
      powerId === 'punch' ? 3.2 : powerId === 'fire' ? 2.4 : powerId === 'water' ? 1.8 : 0.75;

    let hitCount = 0;
    for (const r of robots.robots) {
      if (!r.alive) continue;
      const center = this.tmpVecA.set(r.position.x, r.position.y + r.height * 0.5, r.position.z);
      if (center.distanceTo(blastCenter) <= radius + r.radius) {
        hitCount++;
        if (powerId === 'shrink') {
          r.shrunkTimer = 9.0;
        } else if (powerId === 'water') {
          const push = center.clone().sub(this.position).setY(0).normalize().multiplyScalar(14);
          r.position.add(push);
          r.dashTimer = 0;
        }
        const res = robots.damageRobot(r, Math.round(baseAtk * dmgMult), sound, sloMoActive);
        this.recordHitOrKill(
          res.killed,
          r.name,
          false,
          false,
          res.pointsReward,
          res.creditsReward,
          onEarnRewards,
        );
        if (res.killed && res.isBoss && !this.bossClaimedInRun) {
          this.bossClaimedInRun = true;
          onBossDefeated?.(arena.bossPower);
        }
      }
    }

    for (const sb of robots.swarmBots) {
      if (!sb.alive) continue;
      const center = this.tmpVecA.set(sb.position.x, sb.position.y + sb.height * 0.5, sb.position.z);
      if (center.distanceTo(blastCenter) <= radius + sb.radius) {
        hitCount++;
        const res = robots.damageSwarmBot(sb, Math.round(baseAtk * dmgMult), sound, sloMoActive);
        this.recordHitOrKill(
          res.killed,
          sb.name,
          false,
          false,
          res.pointsReward,
          res.creditsReward,
          onEarnRewards,
        );
      }
    }

    this.killBannerTimer = 1.8;
    if (powerId === 'punch' && wipedBuildings > 0) {
      this.killBannerText = `COLOSSUS PUNCH · ${wipedBuildings} BUILDING(S) WIPED!`;
    } else if (powerId === 'shrink' && hitCount > 0) {
      this.killBannerText = `QUANTUM SHRINK · ${hitCount} FOE(S) SHRUNK (48% SIZE)`;
    } else {
      this.killBannerText = `${cfg.name.toUpperCase()} UNLEASHED!`;
    }
    return true;
  }

  private initSideQuest(arena: ArenaLevelData): void {
    if (arena.mode === 'glitch_lv0') {
      this.sideQuest = null;
      return;
    }
    if (arena.mode === 'ffa') {
      this.sideQuestKind = 'headshots';
      this.sideQuest = {
        title: 'Free-For-All Arena: Land 3 Headshots & Survive Last!',
        progress: 0,
        target: 3,
        rewardCredits: 350,
        rewardPoints: 4,
        completed: false,
      };
      return;
    }
    if (arena.mode === 'wave') {
      this.sideQuestKind = 'zip_strikes';
      this.sideQuest = {
        title: 'Escalating Wave Trial: Land 4 Zip-Strikes [E]',
        progress: 0,
        target: 4,
        rewardCredits: 300,
        rewardPoints: 3,
        completed: false,
      };
      return;
    }
    if (arena.outsideWorldActive) {
      this.sideQuestKind = 'headshots';
      this.sideQuest = {
        title: 'Final Trial: Land 5 Critical Headshots in Outside World',
        progress: 0,
        target: 5,
        rewardCredits: 600,
        rewardPoints: 8,
        completed: false,
      };
      return;
    }
    if (arena.trainingMode) {
      this.sideQuestKind = 'blocks';
      this.sideQuest = {
        title: 'Tutorial Bonus: Deflect 2 Training Bolts [B]',
        progress: 0,
        target: 2,
        rewardCredits: 60,
        rewardPoints: 1,
        completed: false,
      };
      return;
    }
    if (arena.isRescueLevel && arena.captiveSpawns.length > 0) {
      this.sideQuestKind = 'rescues';
      this.sideQuest = {
        title: `Side Quest: Rescue & Recruit ${arena.captiveSpawns.length} Operative(s)`,
        progress: 0,
        target: arena.captiveSpawns.length,
        rewardCredits: 90,
        rewardPoints: 2,
        completed: false,
      };
      return;
    }

    const cycle = arena.level % 3;
    if (cycle === 1) {
      this.sideQuestKind = 'headshots';
      this.sideQuest = {
        title: 'Side Quest: Land 2 Headshots (Red Crosshair)',
        progress: 0,
        target: 2,
        rewardCredits: 75 + arena.level * 2,
        rewardPoints: 1,
        completed: false,
      };
    } else if (cycle === 2) {
      this.sideQuestKind = 'zip_strikes';
      this.sideQuest = {
        title: 'Side Quest: Land 2 Zip-Strikes [E]',
        progress: 0,
        target: 2,
        rewardCredits: 85 + arena.level * 2,
        rewardPoints: 1,
        completed: false,
      };
    } else {
      this.sideQuestKind = 'blocks';
      this.sideQuest = {
        title: 'Side Quest: Deflect 2 Robot Bolts [B]',
        progress: 0,
        target: 2,
        rewardCredits: 95 + arena.level * 2,
        rewardPoints: 2,
        completed: false,
      };
    }
  }

  private advanceSideQuest(
    kind: SideQuestKind,
    amount: number,
    onEarnRewards?: (pts: number, credits: number, rescuedDelta: number) => void,
  ): void {
    if (!this.sideQuest || this.sideQuest.completed || this.sideQuestKind !== kind) return;
    this.sideQuest = {
      ...this.sideQuest,
      progress: Math.min(this.sideQuest.target, this.sideQuest.progress + amount),
    };
    if (this.sideQuest.progress >= this.sideQuest.target) {
      this.sideQuest.completed = true;
      this.runPointsEarned += this.sideQuest.rewardPoints;
      this.runCreditsEarned += this.sideQuest.rewardCredits;
      onEarnRewards?.(this.sideQuest.rewardPoints, this.sideQuest.rewardCredits, 0);
      this.killBannerTimer = 2.0;
      this.killBannerText = `SIDE QUEST COMPLETE · +$${this.sideQuest.rewardCredits} · +${this.sideQuest.rewardPoints} PT`;
    }
  }

  public applyLookDelta(dx: number, dy: number, sensitivity: number): void {
    const zoomScale = this.sniperZoomed ? 0.38 : 1.0;
    const scale = 0.0021 * sensitivity * zoomScale;
    this.yaw -= dx * scale;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * scale, -Math.PI * 0.47, Math.PI * 0.47);
  }

  private getCameraForward(out: THREE.Vector3): THREE.Vector3 {
    const cosPitch = Math.cos(this.pitch);
    return out
      .set(
        -Math.sin(this.yaw) * cosPitch,
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * cosPitch,
      )
      .normalize();
  }

  private inspectCrosshairTarget(
    arena: ArenaLevelData,
    robots: RobotAndVfxManager,
    dirOverride?: THREE.Vector3,
  ): {
    kind: CrosshairTargetKind;
    robot: RobotUnit | null;
    swarmBot: SwarmBot | null;
    point: THREE.Vector3 | null;
  } {
    const camDir = dirOverride ?? this.getCameraForward(this.tmpCamDir);
    this.raycaster.set(this.position, camDir);
    this.raycaster.far = 520;

    const botHits = this.raycaster.intersectObjects(robots.robotRaycastMeshes, false);
    const wallHits = this.raycaster.intersectObjects(arena.raycastMeshes, false);
    const wallDist = wallHits.length > 0 ? wallHits[0].distance : Infinity;

    for (const hit of botHits) {
      if (hit.distance >= wallDist) break;

      if (
        (hit.object.userData.isSwarmHead || hit.object.userData.isSwarmBody) &&
        hit.instanceId !== undefined
      ) {
        const sb = robots.getSwarmBotByIndex(hit.instanceId);
        if (!sb) continue;
        return {
          kind: hit.object.userData.isSwarmHead ? 'head' : 'body',
          robot: null,
          swarmBot: sb,
          point: hit.point.clone(),
        };
      }

      const robotId = hit.object.userData.robotId as number | undefined;
      if (robotId !== undefined) {
        const robot = robots.getRobotById(robotId);
        if (!robot) continue;
        const isWeakPoint = Boolean(hit.object.userData.isWeakPoint);
        const isHead = Boolean(hit.object.userData.isHead);
        return {
          kind: isWeakPoint ? 'weakpoint' : isHead ? 'head' : 'body',
          robot,
          swarmBot: null,
          point: hit.point.clone(),
        };
      }
    }

    return { kind: 'none', robot: null, swarmBot: null, point: null };
  }

  private findBestSwingNode(
    arena: ArenaLevelData,
    upgrades: UpgradeLevels,
    settings: GameSettings,
    grappleId: GrappleHookId,
  ): { pos: THREE.Vector3; node: GrappleNode | null } | null {

    const zipStats = getZipStats(upgrades);
    const gCfg = getGrappleHookConfig(grappleId);
    const maxRange =
      (arena.outsideWorldActive ? zipStats.maxRange + 65 : zipStats.maxRange) + gCfg.rangeBonus;
    const camDir = this.getCameraForward(this.tmpCamDir);
    let bestScore = -Infinity;
    let bestPos: THREE.Vector3 | null = null;
    let bestNode: GrappleNode | null = null;

    for (const node of arena.grappleNodes) {
      const toNode = this.tmpVecA.subVectors(node.position, this.position);
      const dist = toNode.length();
      if (dist < 5 || dist > maxRange) continue;
      toNode.divideScalar(dist);
      const dot = camDir.dot(toNode);
      const minDot = THREE.MathUtils.lerp(0.65, 0.2, settings.swingAssist / 100);
      if (dot < minDot) continue;

      const heightBonus = node.position.y > this.position.y + 3 ? 0.38 : 0;
      const score = dot * 2.2 + heightBonus - dist * 0.0045;
      if (score > bestScore) {
        bestScore = score;
        bestPos = node.position;
        bestNode = node;
      }
    }

    if (bestPos) {
      return { pos: bestPos, node: bestNode };
    }

    this.raycaster.set(this.position, camDir);
    this.raycaster.far = maxRange;
    const hits = this.raycaster.intersectObjects(arena.raycastMeshes, false);
    if (hits.length > 0 && hits[0].point.y > this.position.y + 2) {
      return { pos: hits[0].point.clone(), node: null };
    }
    return null;
  }

  private findBestZipTarget(
    arena: ArenaLevelData,
    robots: RobotAndVfxManager,
    upgrades: UpgradeLevels,
    grappleId: GrappleHookId,
  ): { pos: THREE.Vector3; enemy: RobotUnit | null; swarm: SwarmBot | null } | null {
    const zipStats = getZipStats(upgrades);
    const gCfg = getGrappleHookConfig(grappleId);
    const maxRange =
      (arena.outsideWorldActive ? 160 : zipStats.maxRange) + 12 + gCfg.rangeBonus;
    const camDir = this.getCameraForward(this.tmpCamDir);

    let bestScore = -Infinity;
    let bestEnemy: RobotUnit | null = null;
    let bestSwarm: SwarmBot | null = null;
    let bestPos: THREE.Vector3 | null = null;

    for (const r of robots.robots) {
      if (!r.alive) continue;
      const targetCenter = this.tmpVecA.set(
        r.position.x,
        r.position.y + r.height * 0.58,
        r.position.z,
      );
      const toBot = this.tmpVecB.subVectors(targetCenter, this.position);
      const dist = toBot.length();
      if (dist < 2.2 || dist > maxRange) continue;
      toBot.divideScalar(dist);
      const dot = camDir.dot(toBot);
      if (dot < 0.7) continue;
      const score =
        dot * 3.0 +
        (r.kind === 'boss' || r.kind === 'final_boss' || r.kind === 'giant_mimic' ? 0.3 : 0) -
        dist * 0.004;
      if (score > bestScore) {
        bestScore = score;
        bestEnemy = r;
        bestSwarm = null;
        bestPos = targetCenter.clone();
      }
    }

    for (const sb of robots.swarmBots) {
      if (!sb.alive) continue;
      const targetCenter = this.tmpVecA.set(
        sb.position.x,
        sb.position.y + sb.height * 0.58,
        sb.position.z,
      );
      const toBot = this.tmpVecB.subVectors(targetCenter, this.position);
      const dist = toBot.length();
      if (dist < 2.2 || dist > maxRange) continue;
      toBot.divideScalar(dist);
      const dot = camDir.dot(toBot);
      if (dot < 0.74) continue;
      const score = dot * 2.9 - dist * 0.0045;
      if (score > bestScore) {
        bestScore = score;
        bestEnemy = null;
        bestSwarm = sb;
        bestPos = targetCenter.clone();
      }
    }

    if ((bestEnemy || bestSwarm) && bestPos) {
      return { pos: bestPos, enemy: bestEnemy, swarm: bestSwarm };
    }

    for (const node of arena.grappleNodes) {
      const toNode = this.tmpVecB.subVectors(node.position, this.position);
      const dist = toNode.length();
      if (dist < 3 || dist > maxRange) continue;
      toNode.divideScalar(dist);
      const dot = camDir.dot(toNode);
      if (dot < 0.74) continue;
      const score = dot * 2.5 - dist * 0.004;
      if (score > bestScore) {
        bestScore = score;
        bestPos = node.position.clone();
      }
    }

    if (bestPos) {
      return { pos: bestPos, enemy: null, swarm: null };
    }

    this.raycaster.set(this.position, camDir);
    this.raycaster.far = maxRange;
    const hits = this.raycaster.intersectObjects(arena.raycastMeshes, false);
    if (hits.length > 0 && hits[0].distance > 3.5) {
      return { pos: hits[0].point.clone(), enemy: null, swarm: null };
    }

    return null;
  }

  public triggerZip(
    arena: ArenaLevelData,
    robots: RobotAndVfxManager,
    upgrades: UpgradeLevels,
    grappleId: GrappleHookId,
    sound: ProceduralSoundEngine,
  ): boolean {
    if (this.zipCooldown > 0) {
      if (this.warnCooldown <= 0) {
        this.warnCooldown = 0.45;
        sound.playNoGrabError();
        this.killBannerTimer = 0.75;
        this.killBannerText = `ZIP COOLDOWN · ${this.zipCooldown.toFixed(1)}s`;
      }
      return false;
    }

    const target = this.findBestZipTarget(arena, robots, upgrades, grappleId);
    if (!target) return false;

    const zipStats = getZipStats(upgrades);
    this.isSwinging = false;
    this.isZipping = true;
    this.grounded = false;
    this.isWallSliding = false;
    this.airJumpsRemaining = 1;
    this.zipTargetPos.copy(target.pos);
    this.zipEnemyTarget = target.enemy;
    this.zipSwarmTarget = target.swarm;
    this.zipTimer = zipStats.maxDuration;
    this.zipElapsedSec = 0;
    this.zipDodgeChecked = false;
    this.zipCooldown = ZIP_COOLDOWN_SEC;
    this.springWiggleAmp = 0.72;
    this.springWigglePhase = 0;
    this.tutorialDidSwingZip = true;

    if (this.mana >= 8) {
      this.mana = Math.max(0, this.mana - 8);
    }

    sound.playZipBoost(Boolean(target.enemy || target.swarm));
    return true;
  }

  public triggerInteract(
    arena: ArenaLevelData,
    robots: RobotAndVfxManager,
    sound: ProceduralSoundEngine,
    onEarnRewards: (pts: number, credits: number, rescuedDelta: number) => void,
  ): void {
    const rescued = robots.tryRescueNearby(this.position, sound, true);
    if (rescued) {
      this.alliesRecruitedInLevel++;
      this.runPointsEarned += 1;
      this.runCreditsEarned += 50;
      onEarnRewards(1, 50, 1);
      this.killBannerTimer = 2.0;
      this.killBannerText = `${rescued.name.toUpperCase()} RECRUITED (200 HP) · +$50`;
      this.advanceSideQuest('rescues', 1, onEarnRewards);
      return;
    }

    if (this.position.distanceTo(arena.npcQuestPos) < 8.5 && this.sideQuest) {
      this.killBannerTimer = 2.2;
      this.killBannerText = this.sideQuest.completed
        ? 'COMMANDER VEX: SIDE QUEST COMPLETE — PUSH FORWARD!'
        : `COMMANDER VEX: ${this.sideQuest.title.toUpperCase()}`;
      sound.playSensorAlert();
    }
  }

  public triggerPrimaryAction(
    arena: ArenaLevelData,
    robots: RobotAndVfxManager,
    weapons: FirstPersonWeapons,
    upgrades: UpgradeLevels,
    activeWeaponId: WeaponId,
    sound: ProceduralSoundEngine,
    sloMo: boolean,
    heavyZipStrike = false,
    onEarnRewards?: (pts: number, credits: number, rescuedDelta: number) => void,
    onBossDefeated?: (power: BossPowerId | null) => void,
  ): void {
    if (this.isBlocking && !heavyZipStrike) return;

    const wCfg = getWeaponConfig(activeWeaponId);
    if (wCfg.category === 'sword' || heavyZipStrike) {
      const swordId: SwordWeaponId =
        wCfg.category === 'sword' ? (wCfg.id as SwordWeaponId) : 'katana';
      this.executeSwordSlash(
        arena,
        robots,
        weapons,
        upgrades,
        swordId,
        sound,
        sloMo,
        heavyZipStrike,
        onEarnRewards,
        onBossDefeated,
      );
    } else if (!wCfg.isChargeLaserBoom) {
      this.executeGunFire(
        arena,
        robots,
        weapons,
        upgrades,
        wCfg.id as GunWeaponId,
        sound,
        sloMo,
        onEarnRewards,
        onBossDefeated,
      );
    }
  }

  private executeSwordSlash(
    arena: ArenaLevelData,
    robots: RobotAndVfxManager,
    weapons: FirstPersonWeapons,
    upgrades: UpgradeLevels,
    swordId: SwordWeaponId,
    sound: ProceduralSoundEngine,
    sloMo: boolean,
    heavyZipStrike: boolean,
    onEarnRewards?: (pts: number, credits: number, rescuedDelta: number) => void,
    onBossDefeated?: (power: BossPowerId | null) => void,
  ): void {
    if (!heavyZipStrike && this.weaponCooldown > 0) return;

    const swordCfg = getWeaponConfig(swordId);
    this.weaponCooldown = swordCfg.cooldown;
    this.recentSlashTimer = 0.45;
    this.tutorialDidCombat = true;
    weapons.triggerSwordSlash(heavyZipStrike);
    sound.playSwordSwing(sloMo, swordId);

    const aiMult = this.aiOverchargeSec > 0 ? 1.25 : 1.0;
    const baseAtk = getPlayerAttackDamage(upgrades) * swordCfg.dmgMultiplier * aiMult;
    const manaBonus = this.mana >= swordCfg.manaCost ? 1.2 : 1.0;
    if (this.mana >= swordCfg.manaCost && !heavyZipStrike) {
      this.mana = Math.max(0, this.mana - swordCfg.manaCost);
    }

    const aimCheck = this.inspectCrosshairTarget(arena, robots);
    const camDir = this.getCameraForward(this.tmpCamDir);
    const shrinkScale = this.playerShrunkSec > 0 ? 0.8 : 1.0;
    const reach = ((heavyZipStrike ? 9.5 : 7.0) + (swordCfg.reachBonus ?? 0.4)) * shrinkScale;
    const minAimDot = swordId === 'scythe' ? -0.22 : swordId === 'saber' ? 0.14 : 0.2;

    let hitAny = false;
    let headshotAny = false;
    let weakPointAny = false;
    let consumedCritSurge = false;
    let ultExplosionPos: THREE.Vector3 | null = null;

    for (const r of robots.robots) {
      if (!r.alive) continue;
      const center = this.tmpVecA.set(
        r.position.x,
        r.position.y + r.height * 0.55,
        r.position.z,
      );
      const toBot = this.tmpVecB.subVectors(center, this.position);
      const dist = toBot.length();
      if (dist > reach + r.radius) continue;

      if (!heavyZipStrike && dist > 2.4) {
        toBot.divideScalar(dist);
        if (camDir.dot(toBot) < minAimDot) continue;
      }

      const isWeakPoint =
        (aimCheck.robot === r && aimCheck.kind === 'weakpoint') || r.stunTimer > 0;
      const isHeadshot =
        !isWeakPoint &&
        ((aimCheck.robot === r && aimCheck.kind === 'head') ||
          this.position.y >= r.position.y + r.height * 0.68);
      if (isHeadshot) headshotAny = true;
      if (isWeakPoint) weakPointAny = true;

      let dmg = baseAtk * manaBonus;
      if (heavyZipStrike) dmg *= 2.0;
      if (isWeakPoint) dmg *= r.stunTimer > 0 ? 3.5 : 2.6;
      else if (isHeadshot) dmg *= 2.0;

      if (this.critSurgeActive) {
        dmg = Math.max(dmg, getCritMultiplierDamage(upgrades)) * (isWeakPoint ? 1.5 : 1.0);
        consumedCritSurge = true;
        ultExplosionPos = robots.getRobotWeakPointWorldPos(r, new THREE.Vector3());
      } else if (isWeakPoint) {
        const wpPos = robots.getRobotWeakPointWorldPos(r, new THREE.Vector3());
        robots.spawnExplosion(wpPos, false, 0xf43f5e, 7.5);
        sound.playWeakPointHit();
      }

      hitAny = true;
      const { killed, isBoss, pointsReward, creditsReward } = robots.damageRobot(
        r,
        Math.round(dmg),
        sound,
        sloMo,
        consumedCritSurge || isHeadshot || isWeakPoint,
      );
      this.recordHitOrKill(
        killed,
        r.name,
        isHeadshot,
        consumedCritSurge,
        pointsReward,
        creditsReward,
        onEarnRewards,
        isWeakPoint,
      );
      if (killed && isBoss && !this.bossClaimedInRun) {
        this.bossClaimedInRun = true;
        onBossDefeated?.(arena.bossPower);
      }
      if (heavyZipStrike) {
        this.advanceSideQuest('zip_strikes', 1, onEarnRewards);
      }
    }

    for (const sb of robots.swarmBots) {
      if (!sb.alive) continue;
      const center = this.tmpVecA.set(sb.position.x, sb.position.y + sb.height * 0.55, sb.position.z);
      const toBot = this.tmpVecB.subVectors(center, this.position);
      const dist = toBot.length();
      if (dist > reach + sb.radius) continue;
      if (!heavyZipStrike && dist > 2.2) {
        toBot.divideScalar(dist);
        if (camDir.dot(toBot) < minAimDot) continue;
      }

      const isHeadshot = aimCheck.swarmBot === sb && aimCheck.kind === 'head';
      if (isHeadshot) headshotAny = true;
      let dmg = baseAtk * manaBonus * (heavyZipStrike ? 2.0 : 1.0) * (isHeadshot ? 2.0 : 1.0);
      if (this.critSurgeActive) {
        dmg = Math.max(dmg, getCritMultiplierDamage(upgrades));
        consumedCritSurge = true;
      }

      hitAny = true;
      const res = robots.damageSwarmBot(sb, Math.round(dmg), sound, sloMo);
      this.recordHitOrKill(
        res.killed,
        sb.name,
        isHeadshot,
        consumedCritSurge,
        res.pointsReward,
        res.creditsReward,
        onEarnRewards,
        false,
      );
      if (heavyZipStrike) {
        this.advanceSideQuest('zip_strikes', 1, onEarnRewards);
      }
    }

    if (consumedCritSurge) {
      this.critSurgeActive = false;
      this.critSurgeCharge = 0;
      sound.playCritUlt();
      sound.playExplosion(true, sloMo);
      const blastPos = ultExplosionPos ?? this.position.clone().addScaledVector(camDir, 4.5);
      robots.spawnExplosion(blastPos, true, 0xf43f5e, 24);
      const ultSplash = Math.round(getCritMultiplierDamage(upgrades) * 0.48);
      for (const other of robots.robots) {
        if (!other.alive) continue;
        if (other.position.distanceTo(blastPos) <= 16 + other.radius) {
          const sRes = robots.damageRobot(other, ultSplash, sound, sloMo, true);
          if (sRes.killed) {
            this.recordHitOrKill(true, other.name, false, true, sRes.pointsReward, sRes.creditsReward, onEarnRewards, true);
          }
        }
      }
    }

    if (hitAny) {
      sound.playSwordMetalHit(heavyZipStrike || headshotAny || weakPointAny, sloMo, swordId);
    }
  }

  private executeGunFire(
    arena: ArenaLevelData,
    robots: RobotAndVfxManager,
    weapons: FirstPersonWeapons,
    upgrades: UpgradeLevels,
    gunId: GunWeaponId,
    sound: ProceduralSoundEngine,
    sloMo: boolean,
    onEarnRewards?: (pts: number, credits: number, rescuedDelta: number) => void,
    onBossDefeated?: (power: BossPowerId | null) => void,
  ): void {
    if (this.weaponCooldown > 0) return;
    const gunCfg = getWeaponConfig(gunId);
    if (this.mana < gunCfg.manaCost) {
      if (this.lowManaNoticeTimer <= 0) {
        this.lowManaNoticeTimer = 0.85;
        sound.playNoGrabError();
        this.killBannerTimer = 0.9;
        this.killBannerText = `NEED ${gunCfg.manaCost} MANA FOR ${gunCfg.name.toUpperCase()}`;
      }
      return;
    }

    this.mana = Math.max(0, this.mana - gunCfg.manaCost);
    this.weaponCooldown = gunCfg.cooldown;
    this.gunshotNoiseTimer = 0.45;
    this.tutorialDidCombat = true;

    const crouchFactor = this.isCrouching ? 0.58 : 1.0;
    const zoomFactor = this.sniperZoomed
      ? gunId === 'sniper' || gunId === 'railcannon'
        ? 0.12
        : 0.25
      : 1.0;
    const baseCamDir = this.getCameraForward(this.tmpCamDir).clone();
    const baseAtk = getPlayerAttackDamage(upgrades) * (this.aiOverchargeSec > 0 ? 1.25 : 1.0);
    const heavySound =
      gunId === 'shotgun' || gunId === 'railcannon' || gunId === 'sniper' || gunId === 'rpg';
    const isRocket = gunId === 'rpg';

    let consumedCritSurge = false;
    let ultGunImpactPos: THREE.Vector3 | null = null;
    const pellets = gunCfg.pellets ?? 1;
    const spread = gunCfg.spread ?? 0.006;

    for (let p = 0; p < pellets; p++) {
      const pelletDir = baseCamDir.clone();
      const spreadAngle = spread * crouchFactor * zoomFactor;
      if (spreadAngle > 0.0004) {
        pelletDir.x += (Math.random() - 0.5) * spreadAngle * 2;
        pelletDir.y += (Math.random() - 0.5) * spreadAngle * 2;
        pelletDir.z += (Math.random() - 0.5) * spreadAngle * 2;
        pelletDir.normalize();
      }

      const hitInfo = this.inspectCrosshairTarget(arena, robots, pelletDir);
      this.raycaster.set(this.position, pelletDir);
      this.raycaster.far = 520;
      const wallHits = this.raycaster.intersectObjects(arena.raycastMeshes, false);

      let impactPoint = this.position.clone().addScaledVector(pelletDir, 220);
      if ((hitInfo.robot || hitInfo.swarmBot) && hitInfo.point) {
        impactPoint = hitInfo.point;
        robots.spawnImpactSpark(impactPoint, heavySound ? 10 : 6);
        const isWeakPoint =
          hitInfo.kind === 'weakpoint' || Boolean(hitInfo.robot && hitInfo.robot.stunTimer > 0);
        const isHead = !isWeakPoint && hitInfo.kind === 'head';
        const mult = isWeakPoint
          ? hitInfo.robot && hitInfo.robot.stunTimer > 0
            ? 3.5
            : 2.6
          : isHead
            ? 2.0
            : 1.0;
        let dmg = Math.round(baseAtk * gunCfg.dmgMultiplier * mult);
        if (this.critSurgeActive) {
          dmg = Math.max(dmg, getCritMultiplierDamage(upgrades)) * (isWeakPoint ? 1.5 : 1.0);
          consumedCritSurge = true;
          ultGunImpactPos = impactPoint.clone();
        } else if (isWeakPoint) {
          robots.spawnExplosion(impactPoint, false, 0xf43f5e, 6.5);
          sound.playWeakPointHit();
        }

        if (hitInfo.robot) {
          const { killed, isBoss, pointsReward, creditsReward } = robots.damageRobot(
            hitInfo.robot,
            Math.round(dmg),
            sound,
            sloMo,
            consumedCritSurge || isHead || isWeakPoint,
          );
          this.recordHitOrKill(
            killed,
            hitInfo.robot.name,
            isHead,
            consumedCritSurge,
            pointsReward,
            creditsReward,
            onEarnRewards,
            isWeakPoint,
          );
          if (killed && isBoss && !this.bossClaimedInRun) {
            this.bossClaimedInRun = true;
            onBossDefeated?.(arena.bossPower);
          }
        } else if (hitInfo.swarmBot) {
          const res = robots.damageSwarmBot(hitInfo.swarmBot, Math.round(dmg), sound, sloMo);
          this.recordHitOrKill(
            res.killed,
            hitInfo.swarmBot.name,
            isHead,
            consumedCritSurge,
            res.pointsReward,
            res.creditsReward,
            onEarnRewards,
            false,
          );
        }
      } else if (wallHits.length > 0) {
        impactPoint = wallHits[0].point.clone();
        robots.spawnImpactSpark(impactPoint, 4);
      }

      if (gunCfg.blastRadius && gunCfg.blastRadius > 0) {
        const blastR = gunCfg.blastRadius;
        robots.spawnExplosion(impactPoint, true, 0xfb923c, blastR * 1.15);
        sound.playExplosion(true, sloMo);
        robots.wipeNearbyBuildings(impactPoint, blastR * 0.85, arena, sound);

        const splashDmgBase = Math.round(baseAtk * gunCfg.dmgMultiplier * 0.85);
        for (const r of robots.robots) {
          if (!r.alive || r === hitInfo.robot) continue;
          const c = this.tmpVecA.set(r.position.x, r.position.y + r.height * 0.5, r.position.z);
          const d = c.distanceTo(impactPoint);
          if (d <= blastR + r.radius) {
            const falloff = Math.max(0.35, 1 - d / (blastR + r.radius + 1));
            const res = robots.damageRobot(r, Math.round(splashDmgBase * falloff), sound, sloMo);
            this.recordHitOrKill(
              res.killed,
              r.name,
              false,
              false,
              res.pointsReward,
              res.creditsReward,
              onEarnRewards,
            );
            if (res.killed && res.isBoss && !this.bossClaimedInRun) {
              this.bossClaimedInRun = true;
              onBossDefeated?.(arena.bossPower);
            }
          }
        }
        for (const sb of robots.swarmBots) {
          if (!sb.alive || sb === hitInfo.swarmBot) continue;
          const c = this.tmpVecA.set(sb.position.x, sb.position.y + sb.height * 0.5, sb.position.z);
          const d = c.distanceTo(impactPoint);
          if (d <= blastR + sb.radius) {
            const falloff = Math.max(0.4, 1 - d / (blastR + sb.radius + 1));
            const res = robots.damageSwarmBot(sb, Math.round(splashDmgBase * falloff), sound, sloMo);
            this.recordHitOrKill(
              res.killed,
              sb.name,
              false,
              false,
              res.pointsReward,
              res.creditsReward,
              onEarnRewards,
            );
          }
        }
      }

      weapons.triggerGunShot(impactPoint, heavySound, isRocket);
    }

    if (consumedCritSurge) {
      this.critSurgeActive = false;
      this.critSurgeCharge = 0;
      sound.playCritUlt();
      if (ultGunImpactPos) {
        robots.spawnExplosion(ultGunImpactPos, true, 0xf43f5e, 18);
        sound.playExplosion(true, sloMo);
      }
    }

    const recoilMult = crouchFactor * (this.sniperZoomed ? 0.65 : 1.0);
    const rPitch = gunCfg.recoilPitch ?? 0.025;
    const rYaw = gunCfg.recoilYaw ?? 0.008;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + rPitch * recoilMult,
      -Math.PI * 0.47,
      Math.PI * 0.47,
    );
    this.yaw += (Math.random() - 0.5) * 2 * rYaw * recoilMult;
    this.recoilBloom = Math.min(30, this.recoilBloom + rPitch * 190 * recoilMult);

    sound.playGunShot(sloMo, gunId);
  }

  private fireLaserBoomBeam(
    arena: ArenaLevelData,
    robots: RobotAndVfxManager,
    weapons: FirstPersonWeapons,
    sound: ProceduralSoundEngine,
    sloMo: boolean,
    onEarnRewards?: (pts: number, credits: number, rescuedDelta: number) => void,
    onBossDefeated?: (power: BossPowerId | null) => void,
  ): void {
    if (this.laserBoomAmmo <= 0 || this.laserBoomCooldownSec > 0) return;

    this.laserBoomAmmo = Math.max(0, this.laserBoomAmmo - 1);
    if (this.laserBoomAmmo === 0) {
      this.laserBoomCooldownSec = LASER_BOOM_COOLDOWN_SEC;
    }
    this.laserChargeTimer = 0;
    this.weaponCooldown = 0.45;
    this.gunshotNoiseTimer = 0.7;
    this.tutorialDidCombat = true;

    const camDir = this.getCameraForward(this.tmpCamDir).clone();
    const beamOrigin = this.position.clone();
    const beamLen = 420;
    const beamEnd = beamOrigin.clone().addScaledVector(camDir, beamLen);

    weapons.triggerLaserBoomBeam(beamEnd);
    sound.playLaserBoomFire(sloMo);
    robots.spawnExplosion(beamOrigin.clone().addScaledVector(camDir, 18), true, 0xf472b6, 16);

    // Piercing capsule check: hits EVERY robot & swarm bot along the 420m beam for 100,000 DMG!
    const tmpPoint = new THREE.Vector3();
    const beamRay = new THREE.Ray(beamOrigin, camDir);
    let hitsCount = 0;

    for (const r of robots.robots) {
      if (!r.alive) continue;
      tmpPoint.set(r.position.x, r.position.y + r.height * 0.52, r.position.z);
      const along = tmpPoint.clone().sub(beamOrigin).dot(camDir);
      if (along < -2 || along > beamLen) continue;
      const distSq = beamRay.distanceSqToPoint(tmpPoint);
      const hitRad = Math.max(3.6, r.radius + 2.8);
      if (distSq <= hitRad * hitRad) {
        hitsCount++;
        robots.spawnExplosion(tmpPoint, true, 0xf472b6, 14);
        const res = robots.damageRobot(r, LASER_BOOM_DMG, sound, sloMo, true);
        this.recordHitOrKill(
          res.killed,
          r.name,
          false,
          false,
          res.pointsReward,
          res.creditsReward,
          onEarnRewards,
        );
        if (res.killed && res.isBoss && !this.bossClaimedInRun) {
          this.bossClaimedInRun = true;
          onBossDefeated?.(arena.bossPower);
        }
      }
    }

    for (const sb of robots.swarmBots) {
      if (!sb.alive) continue;
      tmpPoint.set(sb.position.x, sb.position.y + sb.height * 0.5, sb.position.z);
      const along = tmpPoint.clone().sub(beamOrigin).dot(camDir);
      if (along < -2 || along > beamLen) continue;
      const distSq = beamRay.distanceSqToPoint(tmpPoint);
      const hitRad = sb.radius + 3.0;
      if (distSq <= hitRad * hitRad) {
        hitsCount++;
        const res = robots.damageSwarmBot(sb, LASER_BOOM_DMG, sound, sloMo);
        this.recordHitOrKill(
          res.killed,
          sb.name,
          false,
          false,
          res.pointsReward,
          res.creditsReward,
          onEarnRewards,
        );
      }
    }

    this.pitch = THREE.MathUtils.clamp(this.pitch + 0.14, -Math.PI * 0.47, Math.PI * 0.47);
    this.recoilBloom = 28;
    this.killBannerTimer = 1.9;
    this.killBannerText =
      this.laserBoomAmmo === 0
        ? `OMEGA LASER BOOM (100K DMG · ${hitsCount} HIT) · 45s COOLDOWN!`
        : `OMEGA LASER BOOM FIRED · 100,000 DMG (${this.laserBoomAmmo}/${LASER_BOOM_MAX_AMMO} AMMO)`;
  }

  private recordHitOrKill(
    killed: boolean,
    enemyName: string,
    wasHeadshot: boolean,
    wasCritSurge: boolean,
    pointsReward: number,
    creditsReward: number,
    onEarnRewards?: (pts: number, credits: number, rescuedDelta: number) => void,
    wasWeakPoint = false,
  ): void {
    this.hitMarkerTimer = 0.2;
    this.hitWasHeadshot = wasHeadshot || wasCritSurge || wasWeakPoint;
    this.hitWasWeakPoint = wasWeakPoint;

    if (!this.critSurgeActive) {
      const chargeDelta = (wasWeakPoint ? 22 : wasHeadshot ? 16 : 6) + (killed ? 12 : 0);
      this.critSurgeCharge = Math.min(100, this.critSurgeCharge + chargeDelta);
    }

    if (wasHeadshot || wasWeakPoint) {
      this.advanceSideQuest('headshots', 1, onEarnRewards);
    }

    if (killed) {
      this.robotsDestroyedInLevel++;
      this.comboKills++;
      this.comboDecay = 4.2;
      if (pointsReward > 0 || creditsReward > 0) {
        this.runPointsEarned += pointsReward;
        this.runCreditsEarned += creditsReward;
        onEarnRewards?.(pointsReward, creditsReward, 0);
      }
      this.killBannerTimer = 1.75;
      const prefix = wasCritSurge ? '10x CRIT · ' : wasWeakPoint ? 'WEAK POINT · ' : wasHeadshot ? 'HEADSHOT · ' : '';
      const rewardSuffix = ` (+$${creditsReward}${pointsReward > 0 ? ` · +${pointsReward} PT` : ''})`;
      this.killBannerText =
        this.comboKills > 1
          ? `${prefix}${enemyName.toUpperCase()} DESTROYED · ${this.comboKills}x${rewardSuffix}`
          : `${prefix}${enemyName.toUpperCase()} DESTROYED${rewardSuffix}`;
    } else if (wasCritSurge) {
      this.killBannerTimer = 0.85;
      this.killBannerText = '10x CRIT ULT EXPLOSION LANDED!';
    } else if (wasWeakPoint) {
      this.killBannerTimer = 0.72;
      this.killBannerText = 'WEAK POINT STRIKE · CRIT EXPLOSION!';
    } else if (wasHeadshot) {
      this.killBannerTimer = 0.65;
      this.killBannerText = 'HEADSHOT CRIT (2x DMG)';
    }
  }

  public step(
    realDt: number,
    input: InputSnapshot,
    camera: THREE.PerspectiveCamera,
    arena: ArenaLevelData,
    robots: RobotAndVfxManager,
    weapons: FirstPersonWeapons,
    settings: GameSettings,
    upgrades: UpgradeLevels,
    activeWeaponId: WeaponId,
    activeWeaponSlot: number,
    weaponSlots: WeaponId[],
    maxWeaponSlots: number,
    equippedGrapple: GrappleHookId,
    equippedShield: ShieldId,
    equippedArmor: ExtraArmorId,
    glitchChoice: GlitchOutcomeChoice,
    suitEntered: boolean,
    sound: ProceduralSoundEngine,
    onEarnRewards: (pts: number, credits: number, rescuedDelta: number) => void,
    onGoalReached: (
      elapsedSec: number,
      robotsDestroyed: number,
      alliesRecruited: number,
    ) => void,
    onPlayerDead: () => void,
    onBossDefeated?: (power: BossPowerId | null) => void,
  ): HudState {
    const shieldCfg = getShieldConfig(equippedShield);
    const armorCfg = getExtraArmorConfig(equippedArmor);
    const targetMaxHp = getPlayerMaxHp(upgrades, equippedArmor);
    if (targetMaxHp > this.maxHealth) {
      this.health += targetMaxHp - this.maxHealth;
    }
    this.maxHealth = targetMaxHp;
    this.health = Math.min(this.maxHealth, this.health);
    this.armorReductionPct = armorCfg.damageReductionPct;

    if (shieldCfg.maxShieldHp > this.maxShieldHp) {
      this.shieldHp += shieldCfg.maxShieldHp - this.maxShieldHp;
    }
    this.maxShieldHp = shieldCfg.maxShieldHp;
    this.shieldHp = Math.min(this.maxShieldHp, this.shieldHp);

    this.maxMana = getPlayerMaxMana(upgrades);
    const manaRegen = getManaRegenRate(upgrades);

    if (this.shieldRegenDelay > 0) {
      this.shieldRegenDelay = Math.max(0, this.shieldRegenDelay - realDt);
    } else if (this.maxShieldHp > 0 && this.shieldHp < this.maxShieldHp) {
      this.shieldHp = Math.min(this.maxShieldHp, this.shieldHp + shieldCfg.regenPerSec * realDt);
    }

    this.aiOverchargeSec = Math.max(0, this.aiOverchargeSec - realDt);
    this.aiOverchargeCooldownSec = Math.max(0, this.aiOverchargeCooldownSec - realDt);
    this.cryoSlowTimer = Math.max(0, this.cryoSlowTimer - realDt);
    this.laserHitCooldown = Math.max(0, this.laserHitCooldown - realDt);

    // 45s Laser Boom Gun recharge cycle
    if (this.laserBoomCooldownSec > 0) {
      this.laserBoomCooldownSec = Math.max(0, this.laserBoomCooldownSec - realDt);
      if (this.laserBoomCooldownSec <= 0) {
        this.laserBoomAmmo = LASER_BOOM_MAX_AMMO;
        this.killBannerTimer = 1.4;
        this.killBannerText = `OMEGA LASER BOOM RECHARGED · ${LASER_BOOM_MAX_AMMO}/${LASER_BOOM_MAX_AMMO} AMMO`;
      }
    }

    if (this.sloMoRemainingSec > 0) {
      this.sloMoRemainingSec = Math.max(0, this.sloMoRemainingSec - realDt);
      if (this.sloMoRemainingSec <= 0) {
        this.sloMoCooldownSec = SLO_MO_COOLDOWN_SEC;
        sound.playSloMoToggle(false);
        this.killBannerTimer = 1.1;
        this.killBannerText = `SLO-MO FINISHED · ${SLO_MO_COOLDOWN_SEC}s COOLDOWN`;
      }
    } else if (this.sloMoCooldownSec > 0) {
      this.sloMoCooldownSec = Math.max(0, this.sloMoCooldownSec - realDt);
    }

    const powerKeys: BossPowerId[] = ['fire', 'water', 'punch', 'shrink'];
    for (const pk of powerKeys) {
      if (this.powerCooldowns[pk] > 0) {
        this.powerCooldowns[pk] = Math.max(0, this.powerCooldowns[pk] - realDt);
      }
    }

    this.zipCooldown = Math.max(0, this.zipCooldown - realDt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - realDt);
    this.dodgeIframesTimer = Math.max(0, this.dodgeIframesTimer - realDt);
    this.dodgeBurstTimer = Math.max(0, this.dodgeBurstTimer - realDt);
    this.weaponCooldown = Math.max(0, this.weaponCooldown - realDt);
    this.barrageCooldownSec = Math.max(0, this.barrageCooldownSec - realDt);
    this.recoilBloom = Math.max(0, this.recoilBloom - realDt * 42);
    this.gunshotNoiseTimer = Math.max(0, this.gunshotNoiseTimer - realDt);
    this.recentSlashTimer = Math.max(0, this.recentSlashTimer - realDt);
    this.lowManaNoticeTimer = Math.max(0, this.lowManaNoticeTimer - realDt);
    this.warnCooldown = Math.max(0, this.warnCooldown - realDt);
    this.playerShrunkSec = Math.max(0, this.playerShrunkSec - realDt);
    this.sensorAudioCooldown = Math.max(0, this.sensorAudioCooldown - realDt);
    this.doubleJumpVisualTimer = Math.max(0, this.doubleJumpVisualTimer - realDt);
    this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - realDt);
    this.killBannerTimer = Math.max(0, this.killBannerTimer - realDt);
    robots.setDifficulty(settings.difficulty);
    this.criticalAlertCooldown = Math.max(0, this.criticalAlertCooldown - realDt);
    this.damageFlash = Math.max(0, this.damageFlash - realDt * 2.8);
    if (this.comboDecay > 0) {
      this.comboDecay -= realDt;
      if (this.comboDecay <= 0) this.comboKills = 0;
    }

    const activeCfg = getWeaponConfig(activeWeaponId);
    const isGun = activeCfg.category === 'gun';

    this.isBlocking =
      input.blockHeld &&
      this.mana > 1 &&
      !this.isSwinging &&
      !this.isZipping;

    // Per-gun Right-Click / Touch ADS & Optic Zoom
    const nextZoomed =
      isGun &&
      Boolean(activeCfg.hasScopeZoom) &&
      input.mouseRightDown &&
      !this.isBlocking;
    if (nextZoomed !== this.sniperZoomed) {
      sound.playAdsZoom(nextZoomed, Boolean(activeCfg.isOpticScope));
      this.sniperZoomed = nextZoomed;
    }

    const sloMoActive = this.sloMoRemainingSec > 0;
    if (this.isBlocking) {
      this.mana = Math.max(0, this.mana - 6 * realDt);
    } else {
      this.mana = Math.min(this.maxMana, this.mana + manaRegen * realDt);
    }

    const glitchFrozen = arena.mode === 'glitch_lv0' && glitchChoice === 'pending';
    const timeScale = glitchFrozen ? 0.12 : sloMoActive ? 0.3 : 1.0;
    const simDt = Math.min(0.05, realDt * timeScale);
    this.levelElapsedSec += simDt;

    // Handle Omega Laser Boom Gun Charge-Up & Fire vs Standard Sword/Gun Trigger
    const mouseJustReleased = this.wasMouseLeftDown && !input.mouseLeftDown;
    this.wasMouseLeftDown = input.mouseLeftDown;

    if (!glitchFrozen) {
      if (activeCfg.isChargeLaserBoom) {
        if (input.mouseLeftDown && !this.isBlocking) {
          if (this.laserBoomCooldownSec > 0 || this.laserBoomAmmo <= 0) {
            if (this.warnCooldown <= 0) {
              this.warnCooldown = 0.7;
              sound.playNoGrabError();
              this.killBannerTimer = 0.9;
              this.killBannerText = `LASER BOOM COOLING DOWN · ${Math.ceil(this.laserBoomCooldownSec)}s`;
            }
          } else {
            this.laserChargeTimer = Math.min(LASER_BOOM_CHARGE_SEC, this.laserChargeTimer + realDt);
            this.laserTickSoundAccum += realDt;
            if (this.laserTickSoundAccum >= 0.13) {
              this.laserTickSoundAccum = 0;
              sound.playLaserChargeTick(this.laserChargeTimer / LASER_BOOM_CHARGE_SEC);
            }
            if (this.laserChargeTimer >= LASER_BOOM_CHARGE_SEC) {
              this.fireLaserBoomBeam(
                arena,
                robots,
                weapons,
                sound,
                sloMoActive,
                onEarnRewards,
                onBossDefeated,
              );
            }
          }
        } else if (mouseJustReleased && this.laserChargeTimer > 0) {
          if (this.laserChargeTimer >= LASER_BOOM_CHARGE_SEC * 0.45) {
            this.fireLaserBoomBeam(
              arena,
              robots,
              weapons,
              sound,
              sloMoActive,
              onEarnRewards,
              onBossDefeated,
            );
          } else {
            this.laserChargeTimer = 0;
          }
        }
      } else {
        this.laserChargeTimer = 0;
        if (input.mouseLeftDown && !this.isBlocking) {
          this.triggerPrimaryAction(
            arena,
            robots,
            weapons,
            upgrades,
            activeWeaponId,
            sound,
            sloMoActive,
            false,
            onEarnRewards,
            onBossDefeated,
          );
        }
      }
    }

    // Advance Sword Barrage Slash Waves — trigger Weak Point & Ult EXPLOSIONS!
    const critFloor = getCritMultiplierDamage(upgrades);
    for (const sw of weapons.slashWaves) {
      if (!sw.active) continue;
      for (const r of robots.robots) {
        if (!r.alive || sw.hitRobotIds.has(r.id)) continue;
        const ry = r.position.y + r.height * 0.52;
        const dx = sw.pos.x - r.position.x;
        const dy = sw.pos.y - ry;
        const dz = sw.pos.z - r.position.z;
        const hitR = r.radius + 3.4;
        if (dx * dx + dy * dy + dz * dz <= hitR * hitR) {
          sw.hitRobotIds.add(r.id);
          const wpWorld = robots.getRobotWeakPointWorldPos(r, this.tmpVecA);
          const wpDist = sw.pos.distanceTo(wpWorld);
          const hitWeakPoint = wpDist <= Math.max(3.8, r.radius * 0.95) || r.stunTimer > 0;
          const isUltBurst = sw.damage >= critFloor * 0.9;
          const finalWaveDmg = hitWeakPoint ? Math.round(sw.damage * (r.stunTimer > 0 ? 2.4 : 1.75)) : sw.damage;

          if (hitWeakPoint || isUltBurst) {
            robots.spawnExplosion(wpWorld, true, 0xf43f5e, isUltBurst ? 20 : 14);
            sound.playExplosion(true, sloMoActive);
            sound.playWeakPointHit();
            // Splash Weak Point / Ult explosion damage to nearby bots!
            const splashAmt = Math.round(finalWaveDmg * 0.45);
            for (const other of robots.robots) {
              if (!other.alive || other === r) continue;
              if (other.position.distanceTo(wpWorld) <= 14 + other.radius) {
                const sRes = robots.damageRobot(other, splashAmt, sound, sloMoActive, true);
                if (sRes.killed) {
                  this.recordHitOrKill(true, other.name, false, isUltBurst, sRes.pointsReward, sRes.creditsReward, onEarnRewards, true);
                }
              }
            }
          }

          const res = robots.damageRobot(r, finalWaveDmg, sound, sloMoActive, hitWeakPoint || isUltBurst);
          sound.playSwordMetalHit(true, sloMoActive, activeWeaponId);
          this.recordHitOrKill(
            res.killed,
            r.name,
            false,
            isUltBurst,
            res.pointsReward,
            res.creditsReward,
            onEarnRewards,
            hitWeakPoint,
          );
          if (res.killed && res.isBoss && !this.bossClaimedInRun) {
            this.bossClaimedInRun = true;
            onBossDefeated?.(arena.bossPower);
          }
        }
      }
      for (const sb of robots.swarmBots) {
        if (!sb.alive || sw.hitSwarmIds.has(sb.idx)) continue;
        const sy = sb.position.y + sb.height * 0.52;
        const dx = sw.pos.x - sb.position.x;
        const dy = sw.pos.y - sy;
        const dz = sw.pos.z - sb.position.z;
        const hitR = sb.radius + 3.0;
        if (dx * dx + dy * dy + dz * dz <= hitR * hitR) {
          sw.hitSwarmIds.add(sb.idx);
          const res = robots.damageSwarmBot(sb, sw.damage, sound, sloMoActive);
          this.recordHitOrKill(
            res.killed,
            sb.name,
            false,
            false,
            res.pointsReward,
            res.creditsReward,
            onEarnRewards,
            false,
          );
        }
      }
    }

    const wantsCrouch = input.crouchHeld;
    if (wantsCrouch && !this.isCrouching && this.grounded) {
      const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (horizSpeed > 15.5) {
        this.slideTimer = 0.58;
        this.velocity.x *= 1.24;
        this.velocity.z *= 1.24;
      }
    }
    this.isCrouching = wantsCrouch;
    if (!this.isCrouching) this.slideTimer = 0;
    else if (this.slideTimer > 0) this.slideTimer = Math.max(0, this.slideTimer - simDt);

    const shrinkScale = this.playerShrunkSec > 0 ? 0.62 : 1.0;
    const targetEyeHeight = (this.isCrouching ? 1.05 : 1.85) * shrinkScale;
    const prevEyeHeight = this.eyeHeight;
    this.eyeHeight = THREE.MathUtils.lerp(this.eyeHeight, targetEyeHeight, Math.min(1, realDt * 15));
    if (this.grounded) {
      this.position.y += this.eyeHeight - prevEyeHeight;
    }

    const fwd = this.tmpVecA.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = this.tmpVecB.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const moveInput = this.tmpVecC.set(0, 0, 0);
    if (input.analogX !== undefined && input.analogY !== undefined && (Math.abs(input.analogX) > 0.05 || Math.abs(input.analogY) > 0.05)) {
      moveInput.addScaledVector(fwd, -input.analogY);
      moveInput.addScaledVector(right, input.analogX);
    } else {
      if (input.forward) moveInput.add(fwd);
      if (input.backward) moveInput.sub(fwd);
      if (input.right) moveInput.add(right);
      if (input.left) moveInput.sub(right);
    }
    if (moveInput.lengthSq() > 0) {
      if (moveInput.lengthSq() > 1) moveInput.normalize();
      else if (input.analogX === undefined) moveInput.normalize();
      this.tutorialDidMove = true;
    }

    const jumpJustPressed = input.jumpHeld && !this.wasJumpHeld;
    this.wasJumpHeld = input.jumpHeld;

    // Wall-Kick when Wall Sliding OR standard Double Jump!
    if (
      !this.grounded &&
      !this.isSwinging &&
      !this.isZipping &&
      jumpJustPressed
    ) {
      if (this.isWallSliding) {
        this.isWallSliding = false;
        this.airJumpsRemaining = 1;
        this.velocity.x = this.wallSlideNormal.x * 21.5 + fwd.x * 7.5;
        this.velocity.z = this.wallSlideNormal.z * 21.5 + fwd.z * 7.5;
        this.velocity.y = 18.6;
        this.doubleJumpVisualTimer = 0.25;
        sound.playJump(false, true);
      } else if (this.airJumpsRemaining > 0) {
        this.velocity.y = Math.max(16.5, this.velocity.y * 0.25 + 16.5);
        this.velocity.addScaledVector(moveInput, 5.8);
        this.airJumpsRemaining = 0;
        this.doubleJumpVisualTimer = 0.35;
        sound.playJump(false, true);
      }
    }

    const zipStats = getZipStats(upgrades);
    const gCfg = getGrappleHookConfig(equippedGrapple);
    const allowRmbSwing = !isGun;
    const wantsSwing =
      !this.isZipping &&
      (Boolean(input.swingHeld) ||
        (allowRmbSwing && input.mouseRightDown) ||
        (!this.grounded && !this.isWallSliding && input.jumpHeld && this.airJumpsRemaining === 0 && !jumpJustPressed));

    if (wantsSwing && !this.isSwinging) {
      const candidate = this.findBestSwingNode(arena, upgrades, settings, equippedGrapple);
      if (candidate) {
        this.isSwinging = true;
        this.isWallSliding = false;
        this.grounded = false;
        this.airJumpsRemaining = 1;
        this.swingAnchor.copy(candidate.pos);
        const currentDist = this.position.distanceTo(this.swingAnchor);
        this.ropeLength = THREE.MathUtils.clamp(
          currentDist * 0.94,
          7,
          (arena.outsideWorldActive ? 115 : 74) + gCfg.rangeBonus,
        );
        this.springWiggleAmp = 1.08;
        this.springWigglePhase = 0;
        this.prevRadialVel = 0;
        this.tutorialDidSwingZip = true;
        sound.playStringShoot();
      }
    } else if (!wantsSwing && this.isSwinging) {
      this.isSwinging = false;
      const camDir = this.getCameraForward(this.tmpCamDir);
      const speedNow = this.velocity.length();
      const slingshotSpeed = Math.max(speedNow * 1.12, 24) * gCfg.speedBonus;
      if (camDir.y > 0.08) {
        const upBoost = THREE.MathUtils.clamp(camDir.y * 1.35, 0.25, 1.0);
        this.velocity.lerp(
          this.tmpVecD.copy(camDir).multiplyScalar(slingshotSpeed * (1 + upBoost * 0.48)),
          0.62,
        );
        this.velocity.y = Math.max(this.velocity.y + 11 * upBoost, 18 * upBoost + 7);
      } else {
        this.velocity.lerp(this.tmpVecD.copy(camDir).multiplyScalar(slingshotSpeed), 0.35);
        if (this.velocity.y < 10) {
          this.velocity.y += 5.8;
        }
      }
      sound.playStringSnap();
    }

    const moveSpeedMult =
      (this.playerShrunkSec > 0 ? 0.86 : 1.0) * (this.cryoSlowTimer > 0 ? 0.68 : 1.0);

    if (this.isZipping) {
      this.zipElapsedSec += simDt;
      // Slow-Start Zip ramp: 0.22 -> 1.0 over 0.45s
      const zipRamp = THREE.MathUtils.clamp(0.22 + (this.zipElapsedSec / 0.45) * 0.78, 0.22, 1.0);

      // Fast Robot Zip-Dodge Check mid-pull!
      if (!this.zipDodgeChecked && this.zipElapsedSec > 0.18 && this.zipEnemyTarget && this.zipEnemyTarget.alive) {
        this.zipDodgeChecked = true;
        if (robots.tryDodgeIncomingZip(this.zipEnemyTarget, sound)) {
          this.zipEnemyTarget = null;
          // 50% cancel zip, 50% redirect grapple hook to nearest arena wall/surface
          if (Math.random() < 0.5) {
            this.isZipping = false;
            this.killBannerTimer = 1.45;
            this.killBannerText = 'ROBOT DODGED ZIP · GRAPPLE CANCELLED!';
          } else {
            const camDir = this.getCameraForward(this.tmpCamDir);
            this.raycaster.set(this.position, camDir);
            this.raycaster.far = zipStats.maxRange + gCfg.rangeBonus;
            const wallHits = this.raycaster.intersectObjects(arena.raycastMeshes, false);
            if (wallHits.length > 0) {
              this.zipTargetPos.copy(wallHits[0].point);
              this.killBannerTimer = 1.45;
              this.killBannerText = 'ROBOT DODGED ZIP · REDIRECTED TO WALL!';
            } else {
              this.isZipping = false;
              this.killBannerTimer = 1.45;
              this.killBannerText = 'ROBOT DODGED ZIP · GRAPPLE CANCELLED!';
            }
          }
        }
      }

      if (this.isZipping) {
        if (this.zipEnemyTarget && this.zipEnemyTarget.alive) {
          this.zipTargetPos.set(
            this.zipEnemyTarget.position.x,
            this.zipEnemyTarget.position.y + this.zipEnemyTarget.height * 0.58,
            this.zipEnemyTarget.position.z,
          );
        } else if (this.zipSwarmTarget && this.zipSwarmTarget.alive) {
          this.zipTargetPos.set(
            this.zipSwarmTarget.position.x,
            this.zipSwarmTarget.position.y + this.zipSwarmTarget.height * 0.58,
            this.zipSwarmTarget.position.z,
          );
        }

        this.zipTimer -= simDt;
        const toZip = this.tmpVecD.subVectors(this.zipTargetPos, this.position);
        const dist = toZip.length();
        const zipSpeed = zipStats.pullSpeed * gCfg.speedBonus * settings.swingSpeedScale * zipRamp;

        const enemyDead =
          (this.zipEnemyTarget && !this.zipEnemyTarget.alive) ||
          (this.zipSwarmTarget && !this.zipSwarmTarget.alive);

        const strikeRadius = this.zipEnemyTarget
          ? this.zipEnemyTarget.radius + 3.2
          : this.zipSwarmTarget
            ? this.zipSwarmTarget.radius + 2.8
            : 2.8;

        if (enemyDead) {
          this.isZipping = false;
          this.zipEnemyTarget = null;
          this.zipSwarmTarget = null;
        } else if (dist <= strikeRadius || this.zipTimer <= 0) {
          this.isZipping = false;
          this.airJumpsRemaining = 1;
          if (
            (this.zipEnemyTarget && this.zipEnemyTarget.alive) ||
            (this.zipSwarmTarget && this.zipSwarmTarget.alive)
          ) {
            this.triggerPrimaryAction(
              arena,
              robots,
              weapons,
              upgrades,
              activeWeaponId,
              sound,
              sloMoActive,
              true,
              onEarnRewards,
              onBossDefeated,
            );
            this.velocity.set(toZip.x * 0.12, 16.5, toZip.z * 0.12);
            this.zipEnemyTarget = null;
            this.zipSwarmTarget = null;
          } else {
            if (dist > 0.1) toZip.divideScalar(dist);
            this.velocity.copy(toZip).multiplyScalar(25 * gCfg.speedBonus);
            this.velocity.y = Math.max(this.velocity.y, 13.5);
          }
        } else {
          toZip.divideScalar(dist);
          this.velocity.lerp(
            this.tmpVecC.copy(toZip).multiplyScalar(zipSpeed),
            Math.min(1, simDt * (7.5 + zipRamp * 11)),
          );
          this.position.addScaledVector(this.velocity, simDt);
        }
      }
    } else if (this.isSwinging) {
      this.velocity.y -= GRAVITY * simDt;
      const pumpForce = 24.5 * settings.swingSpeedScale * gCfg.speedBonus;
      this.velocity.addScaledVector(moveInput, pumpForce * simDt);

      const camDir = this.getCameraForward(this.tmpCamDir);
      this.velocity.addScaledVector(
        camDir,
        (camDir.y > 0 ? 15.5 : 10.5) * settings.swingSpeedScale * gCfg.speedBonus * simDt,
      );

      const toPlayer = this.tmpVecD.subVectors(this.position, this.swingAnchor);
      const currentDist = Math.max(0.1, toPlayer.length());
      const dirToPlayer = toPlayer.clone().divideScalar(currentDist);

      const stretch = currentDist - this.ropeLength;
      if (stretch > 0) {
        const k = THREE.MathUtils.lerp(180, 72, settings.webElasticity / 100);
        const radialVel = this.velocity.dot(dirToPlayer);
        const springForce = -k * stretch - 7.5 * radialVel;
        this.velocity.addScaledVector(dirToPlayer, springForce * simDt);

        const snapDelta = Math.abs(radialVel - this.prevRadialVel);
        if (snapDelta > 6) {
          this.springWiggleAmp = Math.min(1.4, this.springWiggleAmp + snapDelta * 0.04);
        }
        this.prevRadialVel = radialVel;

        if (stretch > 3.5) {
          this.position.copy(this.swingAnchor).addScaledVector(dirToPlayer, this.ropeLength + 3.5);
        }
      }

      this.velocity.multiplyScalar(1 - 0.1 * simDt);
      this.position.addScaledVector(this.velocity, simDt);
    } else {
      if (this.grounded) {
        const isSprinting =
          input.sprintHeld && !this.isCrouching && !this.isBlocking && moveInput.lengthSq() > 0;
        const baseTargetSpeed = this.isBlocking
          ? 7.8
          : this.isCrouching
            ? this.slideTimer > 0
              ? 24.5
              : 7.4
            : isSprinting
              ? 24.2
              : 14.5;
        const targetSpeed = baseTargetSpeed * moveSpeedMult;

        const desiredVx = moveInput.x * targetSpeed;
        const desiredVz = moveInput.z * targetSpeed;
        const accel = this.slideTimer > 0 ? 4.5 : 18.0;
        this.velocity.x = THREE.MathUtils.lerp(
          this.velocity.x,
          desiredVx,
          Math.min(1, simDt * accel),
        );
        this.velocity.z = THREE.MathUtils.lerp(
          this.velocity.z,
          desiredVz,
          Math.min(1, simDt * accel),
        );

        const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
        if (horizSpeed > 2.2 && this.slideTimer <= 0) {
          this.footstepTimer -= simDt * (isSprinting ? 1.45 : 1.0);
          if (this.footstepTimer <= 0) {
            sound.playFootstep(isSprinting, this.isCrouching);
            this.footstepTimer = 0.34;
          }
        }

        if (jumpJustPressed) {
          this.grounded = false;
          this.airJumpsRemaining = 1;
          this.velocity.y = 15.6;
          sound.playJump(false, false);
        }
      } else {
        if (this.isWallSliding) {
          this.velocity.y = Math.max(this.velocity.y - GRAVITY * 0.24 * simDt, -4.6);
          this.velocity.addScaledVector(moveInput, 14.0 * moveSpeedMult * simDt);
          this.velocity.x *= 1 - 1.2 * simDt;
          this.velocity.z *= 1 - 1.2 * simDt;
        } else {
          this.velocity.y -= GRAVITY * simDt;
          this.velocity.addScaledVector(moveInput, 23.0 * moveSpeedMult * simDt);
          this.velocity.x *= 1 - 0.22 * simDt;
          this.velocity.z *= 1 - 0.22 * simDt;
        }
      }

      this.position.addScaledVector(this.velocity, simDt);
    }

    this.resolveCollisions(arena, sound);

    const feetY = this.position.y - this.eyeHeight;

    // Damage helper with Armor % reduction + Energy Shield absorption
    const applyIncomingDamage = (rawDmg: number) => {
      if (glitchFrozen || this.playerDeadFlag) return;
      const mitigated = Math.max(
        1,
        Math.round(rawDmg * (1 - Math.min(0.65, this.armorReductionPct / 100))),
      );
      this.shieldRegenDelay = 3.5;

      let remaining = mitigated;
      if (this.shieldHp > 0) {
        const absorbed = Math.min(this.shieldHp, remaining);
        this.shieldHp = Math.max(0, this.shieldHp - absorbed);
        remaining -= absorbed;
        if (this.shieldHp <= 0 && absorbed > 0) {
          sound.playShieldBreak();
        }
      }

      if (remaining > 0) {
        this.health = Math.max(0, this.health - remaining);
        this.damageFlash = 1.0;
        sound.playPlayerDamage();
      } else {
        this.damageFlash = Math.max(this.damageFlash, 0.35);
      }

      const hpRatioNow = this.health / Math.max(1, this.maxHealth);
      if (this.health > 0 && hpRatioNow <= 0.2 && (!this.wasBelow20Pct || this.criticalAlertCooldown <= 0)) {
        this.wasBelow20Pct = true;
        this.criticalAlertCooldown = 3.2;
        sound.playSuitCriticalAlert();
      }
      if (this.health <= 0) {
        if (arena.trainingMode) {
          this.health = this.maxHealth;
          this.shieldHp = this.maxShieldHp;
          this.wasBelow20Pct = false;
          this.killBannerTimer = 1.2;
          this.killBannerText = 'TUTORIAL SHIELD RECHARGED';
        } else {
          this.playerDeadFlag = true;
          onPlayerDead();
        }
      }
    };

    // Check Active Arena Laser Hazard Obstacles
    let nearLaserThreat = false;
    for (let l = 0; l < arena.laserObstacles.length; l++) {
      const las = arena.laserObstacles[l];
      const segVec = this.tmpVecB.subVectors(las.p2, las.p1);
      const segLenSq = Math.max(0.001, segVec.lengthSq());
      const tProj = THREE.MathUtils.clamp(
        this.tmpVecC.subVectors(this.position, las.p1).dot(segVec) / segLenSq,
        0,
        1,
      );
      const closestPt = this.tmpVecD.copy(las.p1).addScaledVector(segVec, tProj);
      const horizD = Math.hypot(this.position.x - closestPt.x, this.position.z - closestPt.z);
      if (horizD < 8.5 && Math.abs(this.position.y - closestPt.y) < 3.5) {
        nearLaserThreat = true;
      }
      if (
        horizD < 1.1 &&
        closestPt.y >= feetY - 0.1 &&
        closestPt.y <= this.position.y + 0.15 &&
        this.dodgeIframesTimer <= 0 &&
        this.laserHitCooldown <= 0
      ) {
        this.laserHitCooldown = 0.65;
        sound.playLaserZap();
        if (this.isBlocking) {
          applyIncomingDamage(6);
        } else {
          applyIncomingDamage(24 + Math.round(arena.level * 0.5));
          this.velocity.y = Math.max(this.velocity.y, 7.5);
        }
      }
    }

    // Rescue nearby captive operatives
    const rescued = robots.tryRescueNearby(this.position, sound, false);
    if (rescued) {
      this.alliesRecruitedInLevel++;
      this.runPointsEarned += 1;
      this.runCreditsEarned += 50;
      onEarnRewards(1, 50, 1);
      this.killBannerTimer = 2.0;
      this.killBannerText = `${rescued.name.toUpperCase()} RESCUED & RECRUITED (200 HP) · +$50`;
      this.advanceSideQuest('rescues', 1, onEarnRewards);
    }

    // Tutorial progression tracking
    if (arena.mode === 'tutorial') {
      if (this.tutorialStepIndex === 0 && this.tutorialDidMove) {
        this.tutorialStepIndex = 1;
      } else if (this.tutorialStepIndex === 1 && this.tutorialDidSwingZip) {
        this.tutorialStepIndex = 2;
      } else if (
        this.tutorialStepIndex === 2 &&
        (this.tutorialDidCombat || this.robotsDestroyedInLevel > 0)
      ) {
        this.tutorialStepIndex = 3;
      }
    }

    // Wave Mode escalation when current wave cleared!
    let aliveRobots = robots.getAliveCount();
    if (arena.mode === 'wave' && aliveRobots === 0) {
      this.waveClearDelay += realDt;
      if (this.waveClearDelay >= 1.8) {
        this.waveClearDelay = 0;
        this.waveNumber++;
        const bonusPts = 2 + Math.floor(this.waveNumber / 2);
        const bonusCredits = 90 + this.waveNumber * 35;
        this.runPointsEarned += bonusPts;
        this.runCreditsEarned += bonusCredits;
        onEarnRewards(bonusPts, bonusCredits, 0);
        robots.spawnWaveBots(this.waveNumber, arena);
        aliveRobots = robots.getAliveCount();
        sound.playLevelClear(this.waveNumber % 3 === 0);
        this.killBannerTimer = 2.2;
        this.killBannerText = `WAVE ${this.waveNumber} INCOMING · +$${bonusCredits} · +${bonusPts} PTS`;
      }
    }

    const portalChargePct = robots.getPortalChargePct();
    const goalUnlocked =
      arena.mode === 'tutorial'
        ? true
        : arena.mode === 'wave'
          ? false
          : arena.mode === 'glitch_lv0'
            ? glitchChoice === 'run'
            : aliveRobots === 0 && portalChargePct >= 100;

    const horizGoalDist = Math.hypot(
      this.position.x - arena.goalPos.x,
      this.position.z - arena.goalPos.z,
    );
    const goalDist = this.position.distanceTo(arena.goalPos);
    if (
      goalUnlocked &&
      !this.levelCompletedFlag &&
      !this.playerDeadFlag &&
      horizGoalDist < (arena.outsideWorldActive ? 8.5 : 5.4) &&
      Math.abs(feetY - arena.goalPos.y) < 5.5
    ) {
      if (arena.mode === 'glitch_lv0') {
        // Reaching the far end of the Glitch Run corridor still triggers the Glitch Void outcome -> THE END
        this.playerDeadFlag = true;
        sound.playGlitchWarp();
        onPlayerDead();
      } else {
        this.levelCompletedFlag = true;
        sound.playLevelClear(arena.isBossLevel || arena.outsideWorldActive);
        onGoalReached(
          this.levelElapsedSec,
          this.robotsDestroyedInLevel,
          this.alliesRecruitedInLevel,
        );
      }
    }

    this.updateStringVisual(simDt, weapons, settings);

    const speedMps = this.velocity.length();
    const speedMph = Math.round(speedMps * 2.237);
    const isSprintingNow =
      this.grounded &&
      input.sprintHeld &&
      !this.isCrouching &&
      !this.isBlocking &&
      Math.hypot(this.velocity.x, this.velocity.z) > 15;

    const targetFov = this.sniperZoomed
      ? (activeCfg.zoomFov ?? 48)
      : settings.fovBase +
        (isSprintingNow ? 8 : 0) +
        (this.isZipping ? 13 : 0) +
        (this.dodgeBurstTimer > 0 ? 10 : 0) +
        Math.min(11, Math.max(0, speedMps - 18) * 0.28);
    const nextFov = THREE.MathUtils.lerp(
      camera.fov,
      targetFov,
      Math.min(1, realDt * (this.sniperZoomed ? 16 : 9)),
    );
    if (Math.abs(nextFov - camera.fov) > 0.05) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }

    camera.position.copy(this.position);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = this.yaw;
    camera.rotation.x = this.pitch;
    const targetRoll = this.isSwinging
      ? THREE.MathUtils.clamp(
          -this.velocity.dot(this.tmpVecB.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw))) *
            0.0045,
          -0.14,
          0.14,
        )
      : this.isWallSliding
        ? THREE.MathUtils.clamp(
            this.wallSlideNormal.dot(this.tmpVecB.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw))) *
              -0.13,
            -0.13,
            0.13,
          )
        : this.slideTimer > 0
          ? -0.055
          : 0;
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, targetRoll, Math.min(1, realDt * 8));

    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    let movementState: PlayerMovementState = 'idle';
    if (this.dodgeBurstTimer > 0) {
      movementState = 'dodge';
    } else if (this.isBlocking) {
      movementState = 'blocking';
    } else if (this.isZipping) {
      movementState = this.zipEnemyTarget || this.zipSwarmTarget ? 'zip_strike' : 'zipping';
    } else if (this.isSwinging) {
      movementState = 'swinging';
    } else if (this.isWallSliding) {
      movementState = 'wall_slide';
    } else if (this.doubleJumpVisualTimer > 0) {
      movementState = 'double_jump';
    } else if (!this.grounded) {
      movementState = 'airborne';
    } else if (this.slideTimer > 0) {
      movementState = 'slide';
    } else if (this.isCrouching) {
      movementState = 'crouch';
    } else if (isSprintingNow) {
      movementState = 'sprint';
    } else if (horizSpeed > 1.8) {
      movementState = 'walk';
    }

    const noiseLevel: NoiseLevel = this.isCrouching
      ? 'silent'
      : isSprintingNow || this.gunshotNoiseTimer > 0
        ? 'loud'
        : horizSpeed > 1.8
          ? 'normal'
          : 'silent';

    robots.update(
      arena,
      simDt,
      realDt,
      this.position,
      this.velocity,
      camera.quaternion,
      noiseLevel,
      this.gunshotNoiseTimer,
      {
        isSwinging: this.isSwinging,
        isZipping: this.isZipping,
        isBlocking: this.isBlocking,
        dodgeIframesActive: this.dodgeIframesTimer > 0 || glitchFrozen,
        gunEquipped: isGun,
        firedRecently: this.gunshotNoiseTimer > 0.15,
        slashedRecently: this.recentSlashTimer > 0,
      },
      settings.windEffects,
      sound,
      sloMoActive,
      (dmg) => {
        applyIncomingDamage(dmg);
      },
      () => {
        weapons.spawnDeflectSparks();
        sound.playBlockDeflect();
        if (!this.critSurgeActive) {
          this.critSurgeCharge = Math.min(100, this.critSurgeCharge + 18);
        }
        this.killBannerTimer = 0.8;
        this.killBannerText = 'GUARD DEFLECTED ATTACK!';
        this.advanceSideQuest('blocks', 1, onEarnRewards);
      },
      (power, pushVec) => {
        if (power === 'water' || power === 'punch') {
          this.velocity.add(pushVec);
          this.grounded = false;
        } else if (power === 'shrink') {
          this.playerShrunkSec = 7.5;
          this.killBannerTimer = 1.6;
          this.killBannerText = 'QUANTUM SHRUNK BY BOSS · DODGE & RECOVER!';
        }
      },
      (credits, pts) => {
        this.robotsDestroyedInLevel++;
        this.runCreditsEarned += credits;
        this.runPointsEarned += pts;
        onEarnRewards(pts, credits, 0);
      },
      () => {
        if (!this.critSurgeActive) {
          this.critSurgeCharge = Math.min(100, this.critSurgeCharge + 28);
        }
        this.killBannerTimer = 1.65;
        this.killBannerText = 'BOSS EXPLOSION ULT DODGED! +28% CRIT SURGE';
      },
      (effect, dir) => {
        if (effect === 'cryo') {
          this.cryoSlowTimer = 2.6;
        } else if (effect === 'gravity') {
          this.velocity.addScaledVector(dir, 14);
        } else if (effect === 'shockwave') {
          this.velocity.addScaledVector(dir, 18);
          this.velocity.y = Math.max(this.velocity.y, 9);
          this.grounded = false;
        }
      },
    );

    const curHpRatio = this.health / Math.max(1, this.maxHealth);
    if (this.health > 0 && curHpRatio <= 0.2) {
      if (this.criticalAlertCooldown <= 0) {
        this.criticalAlertCooldown = 3.4;
        sound.playSuitCriticalAlert();
      }
    } else if (curHpRatio > 0.2) {
      this.wasBelow20Pct = false;
    }

    const laserChargeRatio = activeCfg.isChargeLaserBoom
      ? this.laserChargeTimer / LASER_BOOM_CHARGE_SEC
      : 0;

    weapons.update(
      simDt,
      realDt,
      movementState,
      speedMps,
      this.isCrouching,
      this.isSwinging,
      this.isZipping,
      this.isBlocking,
      activeWeaponId,
      this.sniperZoomed,
      laserChargeRatio,
    );

    arena.goalRingMesh.rotation.y += realDt * (goalUnlocked ? 2.8 : 1.1);
    arena.goalRingMesh.position.y =
      arena.goalPos.y + 5.6 + Math.sin(performance.now() * 0.004) * 0.35;
    if (goalUnlocked) {
      arena.goalBeaconMat.color.setHex(0x10b981);
      arena.goalBeaconMat.emissive.setHex(0x059669);
      arena.goalBeamMat.color.setHex(0x34d399);
      arena.goalBeamMat.opacity = 0.44;
      arena.goalPortalDiscMat.color.setHex(0x10b981);
      arena.goalPortalDiscMat.opacity = 0.65;
      arena.goalLight.color.setHex(0x10b981);
      arena.goalLight.intensity = THREE.MathUtils.lerp(arena.goalLight.intensity, 48, realDt * 4);
    } else {
      const chargeT = portalChargePct / 100;
      arena.goalBeaconMat.color.setHex(chargeT > 0.4 ? 0xf59e0b : 0xef4444);
      arena.goalBeaconMat.emissive.setHex(chargeT > 0.4 ? 0xd97706 : 0x991b1b);
      arena.goalBeamMat.color.setHex(0x2dd4bf);
      arena.goalBeamMat.opacity = 0.07 + chargeT * 0.16;
      arena.goalPortalDiscMat.color.setHex(0x1e293b);
      arena.goalPortalDiscMat.opacity = 0.24 + chargeT * 0.25;
      arena.goalLight.color.setHex(0xf59e0b);
      arena.goalLight.intensity = THREE.MathUtils.lerp(
        arena.goalLight.intensity,
        12 + chargeT * 24,
        realDt * 4,
      );
    }

    const tensionRatio = this.isSwinging
      ? THREE.MathUtils.clamp(
          (this.position.distanceTo(this.swingAnchor) - this.ropeLength + 1.5) / 4,
          0.15,
          1,
        )
      : 0;
    sound.updateContinuous(speedMph, this.isSwinging, tensionRatio, this.isZipping, sloMoActive);

    const attackSensor = robots.computeAttackSensor(this.position, this.yaw);
    if (attackSensor.incomingThreat && this.sensorAudioCooldown <= 0) {
      this.sensorAudioCooldown = 0.72;
      sound.playSensorAlert();
    }

    let nearNpcPrompt: string | null = null;
    const captivesRemaining = robots.getCaptivesRemaining();
    if (captivesRemaining > 0) {
      for (const a of robots.allies) {
        if (!a.recruited && a.alive && this.position.distanceTo(a.position) < 9.5) {
          nearNpcPrompt = `[R] Rescue & Recruit ${a.name} (200 HP)`;
          break;
        }
      }
    }
    if (!nearNpcPrompt && this.position.distanceTo(arena.npcQuestPos) < 8.5) {
      nearNpcPrompt = '[R] Talk to Commander Vex (Side Quest)';
    }

    this.hudRaycastTimer -= realDt;
    if (this.hudRaycastTimer <= 0) {
      this.hudRaycastTimer = 0.055; // ~18 Hz passive targeting raycast
      const crosshairInspect = this.inspectCrosshairTarget(arena, robots);
      this.cachedCrosshairKind = crosshairInspect.kind;

      const swingCand = !this.isSwinging
        ? this.findBestSwingNode(arena, upgrades, settings, equippedGrapple)
        : null;
      this.cachedSwingPos = swingCand ? swingCand.pos.clone() : null;

      const zipCand = this.findBestZipTarget(arena, robots, upgrades, equippedGrapple);
      this.cachedZipPos = zipCand ? zipCand.pos.clone() : null;
      this.cachedZipIsEnemy = Boolean(zipCand?.enemy || zipCand?.swarm);
      this.cachedZipEnemyName = zipCand?.enemy?.name ?? zipCand?.swarm?.name ?? '';
      this.cachedZipEnemyHpRatio = zipCand?.enemy
        ? zipCand.enemy.hp / zipCand.enemy.maxHp
        : zipCand?.swarm
          ? zipCand.swarm.hp / zipCand.swarm.maxHp
          : 0;
    }

    let swingTargetX = 0.5;
    let swingTargetY = 0.5;
    if (this.cachedSwingPos && !this.isSwinging) {
      this.tmpProj.copy(this.cachedSwingPos).project(camera);
      swingTargetX = (this.tmpProj.x + 1) * 0.5;
      swingTargetY = (1 - this.tmpProj.y) * 0.5;
    }

    let zipTargetX = 0.5;
    let zipTargetY = 0.5;
    if (this.cachedZipPos) {
      this.tmpProj.copy(this.cachedZipPos).project(camera);
      zipTargetX = (this.tmpProj.x + 1) * 0.5;
      zipTargetY = (1 - this.tmpProj.y) * 0.5;
    }

    const goalCenter = this.tmpVecD.copy(arena.goalPos).setY(arena.goalPos.y + 5.2);
    this.tmpProj.copy(goalCenter).project(camera);
    const goalVisible = this.tmpProj.z > 0 && this.tmpProj.z < 1;
    const goalScreenX = THREE.MathUtils.clamp((this.tmpProj.x + 1) * 0.5, 0.06, 0.94);
    const goalScreenY = THREE.MathUtils.clamp((1 - this.tmpProj.y) * 0.5, 0.08, 0.92);

    const boss = robots.getBossUnit();
    const totalRobots = arena.robotSpawns.length;
    const bossUltDistanceM = boss ? Math.round(this.position.distanceTo(boss.position)) : 999;

    if (arena.mode === 'glitch_lv0') {
      const dist = boss ? this.position.distanceTo(boss.position) : 120;
      this.glitchScreenIntensity = THREE.MathUtils.clamp(1.15 - dist / 240, 0.28, 0.95);
    } else {
      this.glitchScreenIntensity = 0;
    }

    const targetUnitName = this.cachedZipEnemyName;
    const targetUnitHpRatio = this.cachedZipEnemyHpRatio;

    let aiWarningText: string | null = null;
    if (boss && boss.alive && boss.stunTimer > 0) {
      aiWarningText = 'SHERLCO AI: BOSS STUNNED! HIT GLOWING RED WEAK POINT FOR 3.5x EXPLOSIVE CRIT!';
    } else if (boss && boss.alive && boss.ultChargingTimer > 0) {
      aiWarningText = 'SHERLCO AI: BOSS EXPLOSION ULT INCOMING — DODGE OR GRAPPLE AWAY NOW!';
    } else if (curHpRatio <= 0.28) {
      aiWarningText =
        this.aiOverchargeCooldownSec <= 0
          ? 'SHERLCO AI: HULL CRITICAL! PRESS [Y] FOR EMERGENCY AI OVERCHARGE REPAIR!'
          : 'SHERLCO AI: HULL CRITICAL — EVADE FIRE & USE GUARD BLOCK [B]!';
    } else if (this.maxShieldHp > 0 && this.shieldHp <= 0) {
      aiWarningText = 'SHERLCO AI: SHIELD DEPLETED — REPOSITION FOR SHIELD RECHARGE!';
    } else if (nearLaserThreat) {
      aiWarningText = 'SHERLCO AI: ACTIVE LASER GRID AHEAD — JUMP OVER OR CROUCH UNDER!';
    } else if (goalUnlocked) {
      aiWarningText = 'SHERLCO AI: PORTAL CHARGED! DROP INTO THE UNDERGROUND VAULT TO ADVANCE!';
    }

    return {
      level: arena.level,
      mode: arena.mode,
      arenaShapeName: arena.shapeName,
      levelSubject: getLevelSubject(arena.level, arena.mode),
      suitEntered,
      outsideWorldActive: arena.outsideWorldActive,
      isBossLevel: arena.isBossLevel,
      isRescueLevel: arena.isRescueLevel,
      levelTag:
        arena.mode === 'glitch_lv0'
          ? 'LV 0 · GLITCH REALITY'
          : arena.mode === 'ffa'
            ? 'FREE-FOR-ALL COLOSSEUM'
            : arena.mode === 'wave'
              ? `WAVE FORTRESS · WAVE ${this.waveNumber}`
              : arena.outsideWorldActive
                ? 'OUTSIDE WORLD · FINAL BOSSES'
                : arena.trainingMode
                  ? 'TUTORIAL MATRIX'
                  : arena.isBossLevel
                    ? `BOSS ARENA · LV ${arena.level}`
                    : arena.isRescueLevel
                      ? `RESCUE SECTOR · LV ${arena.level}`
                      : `SECTOR LV ${arena.level} · ${arena.shapeName.toUpperCase()}`,
      waveNumber: this.waveNumber,
      ffaLeaderName: arena.mode === 'ffa' ? robots.getFfaLeaderName() : '',
      glitchChoice,
      glitchChaseDistM: boss ? Math.max(0, Math.round(this.position.distanceTo(boss.position))) : 0,
      glitchTitanSpeedMps: Math.round(robots.getGlitchTitanChaseSpeed()),
      tutorialStepIndex: this.tutorialStepIndex,
      tutorialStepText:
        arena.mode === 'tutorial'
          ? TUTORIAL_STEPS[Math.min(TUTORIAL_STEPS.length - 1, this.tutorialStepIndex)]
          : '',
      speedMph,
      altitudeM: Math.max(0, Math.round(this.position.y - this.eyeHeight)),
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      shieldHp: Math.round(this.shieldHp),
      maxShieldHp: this.maxShieldHp,
      armorReductionPct: this.armorReductionPct,
      mana: Math.round(this.mana),
      maxMana: this.maxMana,
      sloMo: sloMoActive,
      sloMoRemainingSec: this.sloMoRemainingSec,
      sloMoCooldownSec: this.sloMoCooldownSec,
      activeWeaponId,
      activeWeaponSlot,
      weaponSlots,
      maxWeaponSlots,
      laserBoomAmmo: this.laserBoomAmmo,
      laserBoomMaxAmmo: LASER_BOOM_MAX_AMMO,
      laserBoomCooldownSec: this.laserBoomCooldownSec,
      laserBoomChargePct: Math.round(laserChargeRatio * 100),
      barrageCooldownSec: this.barrageCooldownSec,
      sniperZoomed: this.sniperZoomed,
      isBlocking: this.isBlocking,
      isWallSliding: this.isWallSliding,
      doubleJumpReady: this.grounded || this.airJumpsRemaining > 0 || this.isWallSliding,
      playerShrunkSec: this.playerShrunkSec,
      movementState,
      noiseLevel,
      isCrouching: this.isCrouching,
      isSprinting: isSprintingNow,
      isSliding: this.slideTimer > 0,
      isSwinging: this.isSwinging,
      isZipping: this.isZipping,
      zipRemainingSec: this.isZipping ? Math.max(0, this.zipTimer) : 0,
      zipCooldownSec: this.zipCooldown,
      dodgeCooldownSec: this.dodgeCooldown,
      dodgeActive: this.dodgeIframesTimer > 0,
      critSurgeCharge: Math.floor(this.critSurgeCharge),
      critSurgeActive: this.critSurgeActive,
      crosshairTarget: this.cachedCrosshairKind,
      recoilBloom: this.recoilBloom,
      aimLocked: Boolean(this.cachedSwingPos || this.cachedZipPos),
      hasSwingTarget: Boolean(this.cachedSwingPos && !this.isSwinging),
      swingTargetX,
      swingTargetY,
      hasZipTarget: Boolean(this.cachedZipPos),
      zipTargetX,
      zipTargetY,
      zipIsEnemy: this.cachedZipIsEnemy,
      enemyTargetName: targetUnitName,
      enemyTargetHpRatio: targetUnitHpRatio,
      enemiesRemaining: aliveRobots,
      enemiesTotal: totalRobots,
      captivesRemaining: robots.getCaptivesRemaining(),
      allies: robots.getAllyHudList(),
      sideQuest: this.sideQuest,
      nearNpcPrompt,
      attackSensor,
      bossName: boss ? boss.name : null,
      bossPower: arena.bossPower,
      bossHp: boss ? Math.max(0, Math.round(boss.hp)) : 0,
      bossMaxHp: boss ? boss.maxHp : 1,
      bossIsInfinite: Boolean(boss?.isInfinite),
      bossShieldHp: boss ? Math.max(0, Math.round(boss.shieldHp)) : 0,
      bossShieldMaxHp: boss ? boss.shieldMaxHp : 0,
      bossStunnedSec: boss && boss.alive ? Math.max(0, boss.stunTimer) : 0,
      bossActiveAbilityName: boss && boss.alive ? boss.activeAbilityName : null,
      bossDamage: boss
        ? boss.attackDamage
        : Math.round(getBossDamageForLevel() * getDifficultyConfig(settings.difficulty).enemyDamageMult),
      bossAlerted: Boolean(boss?.alerted),
      bossLockOnActive: Boolean(boss?.alive && boss?.alerted && !boss?.isInfinite),
      bossUltChargingSec: boss && boss.alive ? Math.max(0, boss.ultChargingTimer) : 0,
      bossUltMaxSec: boss ? boss.ultMaxTimer : 2.5,
      bossUltDistanceM,
      bossLaserActive: Boolean(boss && boss.alive && boss.laserActiveTimer > 0),
      powerCooldowns: { ...this.powerCooldowns },
      goalDistanceM: Math.round(goalDist),
      goalUnlocked,
      portalChargePct,
      goalScreenX,
      goalScreenY,
      goalVisible,
      hitMarkerTimer: this.hitMarkerTimer,
      hitWasHeadshot: this.hitWasHeadshot,
      hitWasWeakPoint: this.hitWasWeakPoint,
      aiOverchargeSec: this.aiOverchargeSec,
      aiOverchargeCooldownSec: this.aiOverchargeCooldownSec,
      aiWarningText,
      killBannerTimer: this.killBannerTimer,
      killBannerText: this.killBannerText,
      damageFlash: this.damageFlash,
      glitchScreenIntensity: this.glitchScreenIntensity,
      pointerLocked: document.pointerLockElement !== null,
      comboKills: this.comboKills,
      runPointsEarned: this.runPointsEarned,
      runCreditsEarned: this.runCreditsEarned,
    };
  }

  private resolveCollisions(arena: ArenaLevelData, sound: ProceduralSoundEngine): void {
    const r = 0.65;
    let onGround = false;
    let touchingWall = false;
    let nx = 0;
    let nz = 0;
    const feetY = this.position.y - this.eyeHeight;

    for (const box of arena.colliders) {
      if (
        box.buildingId !== undefined &&
        arena.destructibleBuildings[box.buildingId]?.destroyed
      ) {
        continue;
      }

      if (
        this.position.x + r > box.minX &&
        this.position.x - r < box.maxX &&
        this.position.z + r > box.minZ &&
        this.position.z - r < box.maxZ
      ) {
        if (feetY <= box.maxY + 0.16 && feetY >= box.maxY - 1.75 && this.velocity.y <= 2.5) {
          this.position.y = box.maxY + this.eyeHeight;
          this.airJumpsRemaining = 1;
          if (box.isBoostPad) {
            this.velocity.y = box.boostVelocity ?? 36;
            onGround = false;
            this.isSwinging = false;
            sound.playJump(true, false);
          } else {
            this.velocity.y = 0;
            onGround = true;
          }
          continue;
        }

        if (this.position.y > box.minY && feetY < box.maxY - 0.35) {
          const isTallWall = box.maxY - box.minY >= 3.2;
          const overlapLeft = this.position.x + r - box.minX;
          const overlapRight = box.maxX - (this.position.x - r);
          const overlapBack = this.position.z + r - box.minZ;
          const overlapFront = box.maxZ - (this.position.z - r);
          const minOverlap = Math.min(overlapLeft, overlapRight, overlapBack, overlapFront);
          if (minOverlap === overlapLeft) {
            this.position.x = box.minX - r;
            if (this.velocity.x > 0) this.velocity.x = 0;
            if (isTallWall) { touchingWall = true; nx = -1; nz = 0; }
          } else if (minOverlap === overlapRight) {
            this.position.x = box.maxX + r;
            if (this.velocity.x < 0) this.velocity.x = 0;
            if (isTallWall) { touchingWall = true; nx = 1; nz = 0; }
          } else if (minOverlap === overlapBack) {
            this.position.z = box.minZ - r;
            if (this.velocity.z > 0) this.velocity.z = 0;
            if (isTallWall) { touchingWall = true; nx = 0; nz = -1; }
          } else {
            this.position.z = box.maxZ + r;
            if (this.velocity.z < 0) this.velocity.z = 0;
            if (isTallWall) { touchingWall = true; nx = 0; nz = 1; }
          }
        }
      }
    }

    this.grounded = onGround;

    const zRange = arena.getCorridorXRangeAtZ(this.position.z);
    if (this.position.x <= zRange.minX + 0.08) {
      this.position.x = zRange.minX;
      if (this.velocity.x < 0) this.velocity.x = 0;
      if (!onGround && feetY > 1.2) {
        touchingWall = true;
        nx = 1;
        nz = 0;
      }
    } else if (this.position.x >= zRange.maxX - 0.08) {
      this.position.x = zRange.maxX;
      if (this.velocity.x > 0) this.velocity.x = 0;
      if (!onGround && feetY > 1.2) {
        touchingWall = true;
        nx = -1;
        nz = 0;
      }
    }

    this.isWallSliding =
      !onGround && !this.isSwinging && !this.isZipping && touchingWall && this.velocity.y < 3.5;
    if (this.isWallSliding) {
      this.wallSlideNormal.set(nx, 0, nz);
      this.airJumpsRemaining = 1;
    }

    const b = arena.bounds;
    if (this.position.z < b.minZ) {
      this.position.z = b.minZ;
      if (this.velocity.z < 0) this.velocity.z = 0;
    } else if (this.position.z > b.maxZ) {
      this.position.z = b.maxZ;
      if (this.velocity.z > 0) this.velocity.z = 0;
    }

    if (this.position.y > b.maxY) {
      this.position.y = b.maxY;
      if (this.velocity.y > 0) this.velocity.y = 0;
    }
  }

  private updateStringVisual(
    simDt: number,
    weapons: FirstPersonWeapons,
    settings: GameSettings,
  ): void {
    if (!this.isSwinging && !this.isZipping) {
      this.stringMesh.visible = false;
      return;
    }

    this.stringMesh.visible = true;
    this.springWigglePhase += simDt * 24;
    this.springWiggleAmp = Math.max(0.06, this.springWiggleAmp - simDt * 1.15);

    const start = weapons.getStringEmitterWorldPos(this.tmpVecA);
    const end = this.isZipping ? this.zipTargetPos : this.swingAnchor;

    const dir = this.tmpVecB.subVectors(end, start);
    const len = Math.max(0.1, dir.length());
    dir.divideScalar(len);

    const side = this.tmpVecC.crossVectors(dir, this.upAxis);
    if (side.lengthSq() < 0.001) side.set(1, 0, 0);
    else side.normalize();

    const perp = this.tmpVecD.crossVectors(side, dir).normalize();
    const halfWidth = this.isZipping ? 0.048 : 0.036;

    const waveAmp = settings.pendulumWave
      ? this.springWiggleAmp *
        (settings.adaptiveWave ? Math.min(1.4, 0.35 + len * 0.015) : 0.65)
      : 0.04;

    for (let i = 0; i < STRING_SEGMENTS; i++) {
      const t = i / (STRING_SEGMENTS - 1);
      const envelope = Math.sin(t * Math.PI);
      const waveA = Math.sin(t * Math.PI * 3.5 - this.springWigglePhase) * waveAmp * envelope;
      const waveB =
        Math.cos(t * Math.PI * 2.5 - this.springWigglePhase * 0.8) * waveAmp * 0.55 * envelope;

      const px = THREE.MathUtils.lerp(start.x, end.x, t) + side.x * waveA + perp.x * waveB;
      const py = THREE.MathUtils.lerp(start.y, end.y, t) + side.y * waveA + perp.y * waveB;
      const pz = THREE.MathUtils.lerp(start.z, end.z, t) + side.z * waveA + perp.z * waveB;

      const idx = i * 6;
      this.stringPositions[idx] = px - side.x * halfWidth;
      this.stringPositions[idx + 1] = py - side.y * halfWidth;
      this.stringPositions[idx + 2] = pz - side.z * halfWidth;

      this.stringPositions[idx + 3] = px + side.x * halfWidth;
      this.stringPositions[idx + 4] = py + side.y * halfWidth;
      this.stringPositions[idx + 5] = pz + side.z * halfWidth;
    }

    (this.stringGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  public dispose(): void {
    this.stringGeo.dispose();
    this.stringMat.dispose();
    this.stringMesh.removeFromParent();
  }
}
