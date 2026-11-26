import * as THREE from 'three';
import {
  ArenaLevelData,
  ArenaPlatformBox,
  DestructibleBuilding,
  GrappleNode,
  RobotSpawnSpec,
} from './arenaBuilder';
import {
  AllyNpcHud,
  AttackSensorState,
  BossPowerId,
  DifficultyMode,
  ENEMY_ABILITY_CATALOG,
  EnemyAbilitySpec,
  GameMode,
  GlitchOutcomeChoice,
  NoiseLevel,
  OUTSIDE_WORLD_BOT_COUNT,
  SensorDirection,
  getBossDamageForLevel,
  getBossHpForLevel,
  getBossPowerForLevel,
  getBossScaleForLevel,
  getDifficultyConfig,
  getEnemyAbilitySpec,
} from '../types/game';
import { ProceduralSoundEngine } from '../audio/soundEngine';

export interface PlayerCombatHints {
  isSwinging: boolean;
  isZipping: boolean;
  isBlocking: boolean;
  dodgeIframesActive: boolean;
  gunEquipped: boolean;
  firedRecently: boolean;
  slashedRecently: boolean;
}

export interface RobotUnit {
  id: number;
  kind: RobotSpawnSpec['kind'];
  name: string;
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  headGroup: THREE.Group;
  weakPointMesh: THREE.Mesh;
  weakPointMat: THREE.MeshStandardMaterial;
  weakPointLocalPos: THREE.Vector3;
  spiderLegs?: THREE.Group[];
  blockShieldMesh?: THREE.Mesh;
  bossShieldDome?: THREE.Mesh;
  bossSwordPivot?: THREE.Group;
  bossUltSphere?: THREE.Mesh;
  position: THREE.Vector3;
  homePos: THREE.Vector3;
  patrolRadius: number;
  patrolPhase: number;
  strafeSign: number;
  flankFlipTimer: number;
  dashCooldown: number;
  dashTimer: number;
  dashVel: THREE.Vector3;
  blinkCooldown: number;
  zipDodgeCooldown: number;
  hp: number;
  maxHp: number;
  isInfinite: boolean;
  shieldHp: number;
  shieldMaxHp: number;
  attackDamage: number;
  pointsReward: number;
  creditsReward: number;
  radius: number;
  height: number;
  baseScale: number;
  alive: boolean;
  respawnTimer: number;
  alerted: boolean;
  fireCooldown: number;
  meleeCooldown: number;
  flashTimer: number;
  stunCooldown: number;
  stunTimer: number;
  stunMaxTimer: number;
  abilityPoolStart: number;
  abilityOffset: number;
  activeAbilityName: string | null;
  bossPower: BossPowerId | null;
  powerCooldown: number;
  lockOnTimer: number;
  shrunkTimer: number;
  ultCooldown: number;
  ultChargingTimer: number;
  ultMaxTimer: number;
  laserCooldown: number;
  laserActiveTimer: number;
  laserSweepAngle: number;
  swordSwingTimer: number;
  mimicBlocking: boolean;
  mimicSwingingNode: GrappleNode | null;
  ffaTargetId: number | null;
  hitboxes: THREE.Object3D[];
}

export interface SwarmBot {
  idx: number;
  kind: 'scout' | 'trooper' | 'drone' | 'hunter';
  name: string;
  position: THREE.Vector3;
  homePos: THREE.Vector3;
  patrolRadius: number;
  phase: number;
  hp: number;
  maxHp: number;
  attackDamage: number;
  radius: number;
  height: number;
  scale: number;
  alive: boolean;
  fireCooldown: number;
  yaw: number;
}

export interface OperativeNpc {
  id: number;
  name: string;
  group: THREE.Group;
  cageGroup: THREE.Group;
  visorMat: THREE.MeshStandardMaterial;
  position: THREE.Vector3;
  hp: number;
  maxHp: number;
  recruited: boolean;
  alive: boolean;
  fireCooldown: number;
}

interface PlasmaBolt {
  active: boolean;
  fromAlly: boolean;
  ownerRobotId: number;
  powerKind: BossPowerId | null;
  homing: boolean;
  cryoSlow: boolean;
  explosive: boolean;
  gravityPull: boolean;
  shockwaveRadius: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  damage: number;
  life: number;
  mesh: THREE.Mesh;
}

interface ExplosionEvent {
  active: boolean;
  pos: THREE.Vector3;
  age: number;
  duration: number;
  maxRadius: number;
  sphere: THREE.Mesh;
  ring: THREE.Mesh;
}

interface DebrisShard {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  rotVel: THREE.Vector3;
  scale: number;
  life: number;
  maxLife: number;
}

interface WindNeedle {
  pos: THREE.Vector3;
  len: number;
}

interface PortalLightStream {
  active: boolean;
  progress: number;
  duration: number;
  startPos: THREE.Vector3;
  ctrlPos: THREE.Vector3;
  endPos: THREE.Vector3;
  mesh: THREE.Mesh;
}

export class RobotAndVfxManager {
  public readonly root = new THREE.Group();
  public robots: RobotUnit[] = [];
  public swarmBots: SwarmBot[] = [];
  public allies: OperativeNpc[] = [];
  public readonly robotRaycastMeshes: THREE.Object3D[] = [];

  private questNpcGroup: THREE.Group | null = null;
  private questBeaconMesh: THREE.Mesh | null = null;
  private currentMode: GameMode = 'campaign';
  private trainingMode = false;
  private outsideWorldMode = false;
  private glitchChoice: GlitchOutcomeChoice = 'pending';
  private glitchChaseTime = 0;
  private nextRobotId = 1;
  private difficultyMults = getDifficultyConfig('normal');

  // High-speed 150-robot InstancedMesh swarm layers
  private readonly swarmBodyMesh: THREE.InstancedMesh;
  private readonly swarmHeadMesh: THREE.InstancedMesh;
  private readonly swarmVisorMesh: THREE.InstancedMesh;

  private readonly bossLockLine: THREE.Line;
  private readonly bossLockPositions: Float32Array;
  private readonly bossLaserMesh: THREE.Mesh;
  private readonly mimicTetherLines: THREE.Line[] = [];
  private readonly mimicTetherPositions: Float32Array[] = [];

  private readonly bolts: PlasmaBolt[] = [];
  private readonly allyBolts: PlasmaBolt[] = [];
  private readonly powerBolts: PlasmaBolt[] = [];
  private readonly explosions: ExplosionEvent[] = [];
  private readonly shards: DebrisShard[] = [];
  private readonly shardMesh: THREE.InstancedMesh;
  private readonly windMesh: THREE.InstancedMesh;
  private readonly windNeedles: WindNeedle[] = [];
  private readonly portalStreams: PortalLightStream[] = [];
  private currentGoalPos = new THREE.Vector3(0, -14, -180);
  private totalSpawnedEnemies = 0;
  private arrivedLightStreams = 0;
  private pendingLightStreams = 0;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  private readonly tmpMat4 = new THREE.Matrix4();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpEuler = new THREE.Euler();
  private readonly tmpScale = new THREE.Vector3();
  private readonly tmpVecA = new THREE.Vector3();
  private readonly tmpVecB = new THREE.Vector3();
  private readonly tmpVecC = new THREE.Vector3();
  private readonly tmpVecD = new THREE.Vector3();
  private readonly tmpVecE = new THREE.Vector3();
  private readonly tmpAxisY = new THREE.Vector3(0, 1, 0);
  private readonly tmpPos = new THREE.Vector3();

  private readonly darkArmorMat: THREE.MeshStandardMaterial;
  private readonly crimsonArmorMat: THREE.MeshStandardMaterial;
  private readonly whiteShellMat: THREE.MeshStandardMaterial;
  private readonly gunmetalMat: THREE.MeshStandardMaterial;
  private readonly redEyeMat: THREE.MeshStandardMaterial;
  private readonly amberBossMat: THREE.MeshStandardMaterial;
  private readonly mimicGlowMat: THREE.MeshStandardMaterial;
  private readonly spiderChitinMat: THREE.MeshStandardMaterial;
  private readonly cryoMat: THREE.MeshStandardMaterial;
  private readonly pyroMat: THREE.MeshStandardMaterial;
  private readonly voltMat: THREE.MeshStandardMaterial;
  private readonly voidMat: THREE.MeshStandardMaterial;
  private readonly aegisMat: THREE.MeshStandardMaterial;
  private readonly lancerMat: THREE.MeshStandardMaterial;
  private readonly proxyMat: THREE.MeshBasicMaterial;
  private readonly glitchWireMat: THREE.MeshBasicMaterial;
  private readonly mimicShieldMat: THREE.MeshBasicMaterial;
  private readonly titanShieldMat: THREE.MeshBasicMaterial;
  private readonly allySuitMat: THREE.MeshStandardMaterial;
  private readonly cageGlassMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    scene.add(this.root);

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      this.geometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      this.materials.push(m);
      return m;
    };

    this.darkArmorMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.36, metalness: 0.84 }),
    );
    this.crimsonArmorMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.28, metalness: 0.78 }),
    );
    this.whiteShellMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.28 }),
    );
    this.gunmetalMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.22, metalness: 0.9 }),
    );
    this.redEyeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfb7185,
        emissive: 0xef4444,
        emissiveIntensity: 2.8,
        roughness: 0.18,
        metalness: 0.15,
      }),
    );
    this.amberBossMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 2.5,
        roughness: 0.18,
        metalness: 0.25,
      }),
    );
    this.mimicGlowMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 2.9,
        roughness: 0.16,
        metalness: 0.2,
      }),
    );
    this.spiderChitinMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x312e81,
        roughness: 0.26,
        metalness: 0.86,
      }),
    );
    this.cryoMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 1.8,
        roughness: 0.2,
        metalness: 0.55,
      }),
    );
    this.pyroMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xea580c,
        emissiveIntensity: 1.9,
        roughness: 0.25,
        metalness: 0.6,
      }),
    );
    this.voltMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xeab308,
        emissiveIntensity: 2.1,
        roughness: 0.2,
        metalness: 0.5,
      }),
    );
    this.voidMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x7e22ce,
        emissive: 0xa855f7,
        emissiveIntensity: 2.0,
        roughness: 0.22,
        metalness: 0.72,
      }),
    );
    this.aegisMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 1.6,
        roughness: 0.28,
        metalness: 0.82,
      }),
    );
    this.lancerMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x06b6d4,
        emissiveIntensity: 1.9,
        roughness: 0.2,
        metalness: 0.75,
      }),
    );
    this.proxyMat = trackMat(new THREE.MeshBasicMaterial({ visible: false }));
    this.glitchWireMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        wireframe: true,
        transparent: true,
        opacity: 0.72,
      }),
    );
    this.mimicShieldMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
      }),
    );
    this.titanShieldMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.24,
        wireframe: true,
      }),
    );
    this.allySuitMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.32, metalness: 0.55 }),
    );
    this.cageGlassMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.36,
        roughness: 0.18,
        side: THREE.DoubleSide,
      }),
    );

    const swarmBodyGeo = trackGeo(new THREE.BoxGeometry(1.35, 1.85, 0.9));
    swarmBodyGeo.translate(0, 0.925, 0);
    this.swarmBodyMesh = new THREE.InstancedMesh(
      swarmBodyGeo,
      this.darkArmorMat,
      OUTSIDE_WORLD_BOT_COUNT,
    );
    this.swarmBodyMesh.frustumCulled = false;
    this.swarmBodyMesh.userData.isSwarmBody = true;
    this.swarmBodyMesh.visible = false;
    this.root.add(this.swarmBodyMesh);

    const swarmHeadGeo = trackGeo(new THREE.BoxGeometry(0.86, 0.68, 0.78));
    swarmHeadGeo.translate(0, 2.25, 0);
    this.swarmHeadMesh = new THREE.InstancedMesh(
      swarmHeadGeo,
      this.whiteShellMat,
      OUTSIDE_WORLD_BOT_COUNT,
    );
    this.swarmHeadMesh.frustumCulled = false;
    this.swarmHeadMesh.userData.isSwarmHead = true;
    this.swarmHeadMesh.visible = false;
    this.root.add(this.swarmHeadMesh);

    const swarmVisorGeo = trackGeo(new THREE.BoxGeometry(0.74, 0.22, 0.18));
    swarmVisorGeo.translate(0, 2.28, 0.38);
    this.swarmVisorMesh = new THREE.InstancedMesh(
      swarmVisorGeo,
      this.redEyeMat,
      OUTSIDE_WORLD_BOT_COUNT,
    );
    this.swarmVisorMesh.frustumCulled = false;
    this.swarmVisorMesh.visible = false;
    this.root.add(this.swarmVisorMesh);

    this.bossLockPositions = new Float32Array(6);
    const lockGeo = trackGeo(new THREE.BufferGeometry());
    lockGeo.setAttribute('position', new THREE.BufferAttribute(this.bossLockPositions, 3));
    const lockMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xff2244,
        transparent: true,
        opacity: 0.88,
      }),
    );
    this.bossLockLine = new THREE.Line(lockGeo, lockMat);
    this.bossLockLine.frustumCulled = false;
    this.bossLockLine.visible = false;
    this.root.add(this.bossLockLine);

    const laserGeo = trackGeo(new THREE.CylinderGeometry(2.2, 3.4, 480, 12));
    laserGeo.translate(0, 240, 0);
    laserGeo.rotateX(Math.PI * 0.5);
    const laserMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      }),
    );
    this.bossLaserMesh = new THREE.Mesh(laserGeo, laserMat);
    this.bossLaserMesh.visible = false;
    this.root.add(this.bossLaserMesh);

    const mimicLineMat = trackMat(
      new THREE.LineBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.9 }),
    );
    for (let i = 0; i < 6; i++) {
      const posArr = new Float32Array(6);
      const lGeo = trackGeo(new THREE.BufferGeometry());
      lGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      const line = new THREE.Line(lGeo, mimicLineMat);
      line.frustumCulled = false;
      line.visible = false;
      this.root.add(line);
      this.mimicTetherLines.push(line);
      this.mimicTetherPositions.push(posArr);
    }

    const boltGeo = trackGeo(new THREE.SphereGeometry(0.42, 8, 8));
    for (let i = 0; i < 120; i++) {
      const boltMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xff3b3b }));
      const mesh = new THREE.Mesh(boltGeo, boltMat);
      mesh.visible = false;
      this.root.add(mesh);
      this.bolts.push({
        active: false,
        fromAlly: false,
        ownerRobotId: -1,
        powerKind: null,
        homing: false,
        cryoSlow: false,
        explosive: false,
        gravityPull: false,
        shockwaveRadius: 0,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        damage: 10,
        life: 0,
        mesh,
      });
    }

    const allyBoltMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(boltGeo, allyBoltMat);
      mesh.visible = false;
      this.root.add(mesh);
      this.allyBolts.push({
        active: false,
        fromAlly: true,
        ownerRobotId: -1,
        powerKind: null,
        homing: false,
        cryoSlow: false,
        explosive: false,
        gravityPull: false,
        shockwaveRadius: 0,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        damage: 24,
        life: 0,
        mesh,
      });
    }

    const powerOrbGeo = trackGeo(new THREE.SphereGeometry(1.35, 12, 10));
    for (let i = 0; i < 16; i++) {
      const pMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xf97316 }));
      const mesh = new THREE.Mesh(powerOrbGeo, pMat);
      mesh.visible = false;
      this.root.add(mesh);
      this.powerBolts.push({
        active: false,
        fromAlly: false,
        ownerRobotId: -1,
        powerKind: 'fire',
        homing: false,
        cryoSlow: false,
        explosive: false,
        gravityPull: false,
        shockwaveRadius: 0,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        damage: 400,
        life: 0,
        mesh,
      });
    }

    const expSphereGeo = trackGeo(new THREE.SphereGeometry(1, 16, 12));
    const expRingGeo = trackGeo(new THREE.TorusGeometry(1, 0.09, 10, 28));
    expRingGeo.rotateX(Math.PI * 0.5);

    for (let i = 0; i < 20; i++) {
      const sMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      const rMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xf97316,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      const sphere = new THREE.Mesh(expSphereGeo, sMat);
      const ring = new THREE.Mesh(expRingGeo, rMat);
      sphere.visible = false;
      ring.visible = false;
      this.root.add(sphere, ring);
      this.explosions.push({
        active: false,
        pos: new THREE.Vector3(),
        age: 0,
        duration: 0.65,
        maxRadius: 6,
        sphere,
        ring,
      });
    }

    const shardGeo = trackGeo(new THREE.OctahedronGeometry(0.32, 0));
    const shardMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xea580c,
        emissiveIntensity: 1.6,
        roughness: 0.3,
        metalness: 0.85,
      }),
    );
    this.shardMesh = new THREE.InstancedMesh(shardGeo, shardMat, 220);
    this.shardMesh.frustumCulled = false;
    this.root.add(this.shardMesh);

    for (let i = 0; i < 220; i++) {
      this.shards.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        rotVel: new THREE.Vector3(),
        scale: 0,
        life: 0,
        maxLife: 1,
      });
      this.tmpMat4.makeScale(0, 0, 0);
      this.shardMesh.setMatrixAt(i, this.tmpMat4);
    }
    this.shardMesh.instanceMatrix.needsUpdate = true;

    const windGeo = trackGeo(new THREE.BoxGeometry(0.032, 0.032, 1.0));
    const windMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    this.windMesh = new THREE.InstancedMesh(windGeo, windMat, 80);
    this.windMesh.frustumCulled = false;
    this.root.add(this.windMesh);

    for (let i = 0; i < 80; i++) {
      this.windNeedles.push({
        pos: new THREE.Vector3(
          (Math.random() - 0.5) * 40,
          Math.random() * 25,
          (Math.random() - 0.5) * 40,
        ),
        len: 1.5 + Math.random() * 2.5,
      });
      this.tmpMat4.makeScale(0, 0, 0);
      this.windMesh.setMatrixAt(i, this.tmpMat4);
    }
    this.windMesh.instanceMatrix.needsUpdate = true;

    const portalOrbGeo = trackGeo(new THREE.SphereGeometry(0.55, 10, 8));
    const portalOrbMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.95,
      }),
    );
    for (let i = 0; i < 36; i++) {
      const mesh = new THREE.Mesh(portalOrbGeo, portalOrbMat);
      mesh.visible = false;
      this.root.add(mesh);
      this.portalStreams.push({
        active: false,
        progress: 0,
        duration: 1.15,
        startPos: new THREE.Vector3(),
        ctrlPos: new THREE.Vector3(),
        endPos: new THREE.Vector3(),
        mesh,
      });
    }
  }

  public setDifficulty(diff: DifficultyMode): void {
    this.difficultyMults = getDifficultyConfig(diff);
  }

  public spawnForArena(
    arena: ArenaLevelData,
    glitchChoice: GlitchOutcomeChoice = 'pending',
    difficulty?: DifficultyMode,
  ): void {
    if (difficulty) {
      this.difficultyMults = getDifficultyConfig(difficulty);
    }
    this.clearLevelUnits();
    this.currentMode = arena.mode;
    this.trainingMode = arena.trainingMode;
    this.outsideWorldMode = arena.outsideWorldActive;
    this.glitchChoice = glitchChoice;
    this.glitchChaseTime = 0;
    this.nextRobotId = 1;
    this.currentGoalPos.copy(arena.goalPos);
    this.totalSpawnedEnemies = 0;
    this.arrivedLightStreams = 0;
    this.pendingLightStreams = 0;

    if (arena.outsideWorldActive) {
      let swarmIdx = 0;
      arena.robotSpawns.forEach((spec) => {
        if (
          spec.kind === 'final_boss' ||
          spec.kind === 'boss' ||
          spec.kind === 'giant_mimic' ||
          spec.kind === 'spider'
        ) {
          const id = this.nextRobotId++;
          const tier = spec.bossTier ?? arena.level;
          const power = spec.kind === 'boss' ? getBossPowerForLevel(tier) : arena.bossPower;
          const unit = this.createRobotMesh(tier, spec, id, arena.bossName, power);
          this.robots.push(unit);
          this.root.add(unit.group);
          this.robotRaycastMeshes.push(...unit.hitboxes);
        } else if (swarmIdx < OUTSIDE_WORLD_BOT_COUNT) {
          const bot = this.createSwarmBot(arena.level, spec, swarmIdx);
          this.swarmBots.push(bot);
          swarmIdx++;
        }
      });

      this.swarmBodyMesh.count = this.swarmBots.length;
      this.swarmHeadMesh.count = this.swarmBots.length;
      this.swarmVisorMesh.count = this.swarmBots.length;
      this.swarmBodyMesh.visible = this.swarmBots.length > 0;
      this.swarmHeadMesh.visible = this.swarmBots.length > 0;
      this.swarmVisorMesh.visible = this.swarmBots.length > 0;
      if (this.swarmBots.length > 0) {
        this.robotRaycastMeshes.push(this.swarmHeadMesh, this.swarmBodyMesh);
        this.syncSwarmMatrices();
      }
    } else {
      arena.robotSpawns.forEach((spec) => {
        const id = this.nextRobotId++;
        const unit = this.createRobotMesh(
          spec.bossTier ?? arena.level,
          spec,
          id,
          arena.bossName,
          arena.bossPower,
        );
        this.robots.push(unit);
        this.root.add(unit.group);
        this.robotRaycastMeshes.push(...unit.hitboxes);
      });
    }

    this.spawnQuestNpc(arena.npcQuestPos);

    const callSigns = ['Valkyrie-7', 'Spectre-4'];
    arena.captiveSpawns.forEach((pos, idx) => {
      const ally = this.createCaptiveOperative(idx, callSigns[idx % callSigns.length], pos);
      this.allies.push(ally);
      this.root.add(ally.group);
    });
    this.totalSpawnedEnemies = this.robots.length + this.swarmBots.length;
  }

  public spawnWaveBots(waveNum: number, arena: ArenaLevelData): void {
    const count = Math.min(18, 4 + waveNum * 2);
    const hasBoss = waveNum % 3 === 0;
    const hpMult = 1 + (waveNum - 1) * 0.25;

    const waveRoster: RobotSpawnSpec['kind'][] = [
      'cryo_stalker',
      'pyro_bomber',
      'volt_sniper',
      'void_assassin',
      'aegis_juggernaut',
      'mecha_lancer',
      'spider',
      'mimic',
      'hunter',
      'drone',
      'trooper',
    ];
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const dist = 48 + (i % 3) * 18;
      const kind: RobotSpawnSpec['kind'] = waveRoster[(i + waveNum) % waveRoster.length];
      const spec: RobotSpawnSpec = {
        kind,
        position: new THREE.Vector3(
          Math.cos(ang) * dist,
          kind === 'drone' || kind === 'mecha_lancer' ? 22 : 0.4,
          Math.sin(ang) * dist,
        ),
        patrolRadius: 95,
        hpMultiplier: hpMult,
        levelVariantIdx: waveNum * 4 + i,
      };
      const id = this.nextRobotId++;
      const unit = this.createRobotMesh(Math.min(50, waveNum * 4), spec, id, null, null);
      unit.alerted = true;
      this.robots.push(unit);
      this.root.add(unit.group);
      this.robotRaycastMeshes.push(...unit.hitboxes);
    }

    if (hasBoss) {
      const bossTier = Math.min(50, Math.max(5, waveNum * 5));
      const spec: RobotSpawnSpec = {
        kind: 'boss',
        position: new THREE.Vector3(0, 6, -55),
        patrolRadius: 90,
        hpMultiplier: hpMult,
        bossTier,
      };
      const id = this.nextRobotId++;
      const bossUnit = this.createRobotMesh(
        bossTier,
        spec,
        id,
        `WAVE ${waveNum} TITAN`,
        getBossPowerForLevel(bossTier),
      );
      bossUnit.alerted = true;
      this.robots.push(bossUnit);
      this.root.add(bossUnit.group);
      this.robotRaycastMeshes.push(...bossUnit.hitboxes);
    }
    this.totalSpawnedEnemies += count + (hasBoss ? 1 : 0);
    void arena;
  }

  public tryDodgeIncomingZip(robot: RobotUnit, sound: ProceduralSoundEngine): boolean {
    if (!robot.alive || robot.zipDodgeCooldown > 0) return false;
    if (robot.kind === 'final_boss' || robot.kind === 'glitch_titan') return false;

    const dodgeChance =
      robot.kind === 'giant_mimic'
        ? 0.72
        : robot.kind === 'spider' || robot.kind === 'mimic'
          ? 0.58
          : robot.kind === 'boss'
            ? 0.44
            : 0.36;

    robot.zipDodgeCooldown = 3.2;
    if (Math.random() > dodgeChance) return false;

    // Fast evasive sidestep!
    const sideAngle = (Math.random() > 0.5 ? 1 : -1) * Math.PI * 0.5;
    const dodgeDir = new THREE.Vector3(
      Math.cos(robot.group.rotation.y + sideAngle),
      0,
      Math.sin(robot.group.rotation.y + sideAngle),
    ).normalize();
    const leapDist = robot.kind === 'giant_mimic' ? 28 : 11;
    robot.position.addScaledVector(dodgeDir, leapDist);
    robot.group.position.copy(robot.position);
    sound.playZipDodgeRedirect();
    return true;
  }

  public getGlitchTitanChaseSpeed(): number {
    return 24 + this.glitchChaseTime * 3.8;
  }

  public getFfaLeaderName(): string {
    const alive = this.robots.filter((r) => r.alive);
    if (alive.length === 0) return 'YOU (CHAMPION)';
    let best = alive[0];
    for (const r of alive) {
      if (r.hp > best.hp) best = r;
    }
    return best.name;
  }

  private createSwarmBot(level: number, spec: RobotSpawnSpec, idx: number): SwarmBot {
    const kind =
      spec.kind === 'hunter' || spec.kind === 'drone' || spec.kind === 'trooper'
        ? spec.kind
        : 'scout';
    const scale = kind === 'hunter' ? 1.45 : kind === 'trooper' ? 1.15 : 1.0;
    const baseHp =
      kind === 'hunter'
        ? 450
        : kind === 'trooper'
          ? 240
          : kind === 'drone'
            ? 160
            : 140;
    const hp = Math.max(
      10,
      Math.round(baseHp * (1 + level * 0.004) * this.difficultyMults.enemyHpMult),
    );
    const dmg = Math.max(
      2,
      Math.round(
        (kind === 'hunter' ? 28 : kind === 'trooper' ? 18 : 12) *
          this.difficultyMults.enemyDamageMult,
      ),
    );

    return {
      idx,
      kind,
      name:
        kind === 'hunter'
          ? 'Omega Hunter'
          : kind === 'drone'
            ? 'Sky Drone'
            : kind === 'trooper'
              ? 'Titan Trooper'
              : 'Legion Scout',
      position: spec.position.clone(),
      homePos: spec.position.clone(),
      patrolRadius: spec.patrolRadius,
      phase: idx * 0.73,
      hp,
      maxHp: hp,
      attackDamage: dmg,
      radius: 1.2 * scale,
      height: 2.55 * scale,
      scale,
      alive: true,
      fireCooldown: 1.5 + (idx % 10) * 0.35,
      yaw: 0,
    };
  }

  private syncSwarmMatrices(): void {
    for (let i = 0; i < this.swarmBots.length; i++) {
      const b = this.swarmBots[i];
      if (!b.alive) {
        this.tmpMat4.makeScale(0, 0, 0);
        this.swarmBodyMesh.setMatrixAt(i, this.tmpMat4);
        this.swarmHeadMesh.setMatrixAt(i, this.tmpMat4);
        this.swarmVisorMesh.setMatrixAt(i, this.tmpMat4);
        continue;
      }
      this.tmpEuler.set(0, b.yaw, 0);
      this.tmpQuat.setFromEuler(this.tmpEuler);
      this.tmpScale.setScalar(b.scale);
      this.tmpMat4.compose(b.position, this.tmpQuat, this.tmpScale);
      this.swarmBodyMesh.setMatrixAt(i, this.tmpMat4);
      this.swarmHeadMesh.setMatrixAt(i, this.tmpMat4);
      this.swarmVisorMesh.setMatrixAt(i, this.tmpMat4);
    }
    this.swarmBodyMesh.instanceMatrix.needsUpdate = true;
    this.swarmHeadMesh.instanceMatrix.needsUpdate = true;
    this.swarmVisorMesh.instanceMatrix.needsUpdate = true;
    this.swarmBodyMesh.computeBoundingSphere();
    this.swarmHeadMesh.computeBoundingSphere();
  }

  private spawnQuestNpc(pos: THREE.Vector3): void {
    const npc = new THREE.Group();
    npc.position.copy(pos);

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 0.5), this.darkArmorMat);
    legs.position.y = 0.48;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.92, 0.6), this.allySuitMat);
    torso.position.y = 1.4;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.52), this.whiteShellMat);
    head.position.y = 2.15;
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.5,
    });
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.14), visorMat);
    visor.position.set(0, 2.18, 0.25);

    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32, 0),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    );
    beacon.position.y = 3.05;

    npc.add(legs, torso, head, visor, beacon);
    this.root.add(npc);
    this.questNpcGroup = npc;
    this.questBeaconMesh = beacon;
  }

  private createCaptiveOperative(id: number, name: string, pos: THREE.Vector3): OperativeNpc {
    const group = new THREE.Group();
    group.position.copy(pos);

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.9, 0.48), this.darkArmorMat);
    legs.position.y = 0.45;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.85, 0.55), this.allySuitMat);
    torso.position.y = 1.32;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.46, 0.48), this.whiteShellMat);
    head.position.y = 2.02;

    const visorMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 2.2,
    });
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.12), visorMat);
    visor.position.set(0, 2.05, 0.22);

    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.72), this.gunmetalMat);
    rifle.position.set(0.45, 1.32, 0.26);

    const cageGroup = new THREE.Group();
    const cageCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.55, 2.9, 8, 1, false),
      this.cageGlassMat,
    );
    cageCyl.position.y = 1.45;
    const cageRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.58, 0.08, 8, 20),
      this.amberBossMat,
    );
    cageRing.rotation.x = Math.PI * 0.5;
    cageRing.position.y = 2.85;
    cageGroup.add(cageCyl, cageRing);

    group.add(legs, torso, head, visor, rifle, cageGroup);

    return {
      id,
      name,
      group,
      cageGroup,
      visorMat,
      position: pos.clone(),
      hp: 200,
      maxHp: 200,
      recruited: false,
      alive: true,
      fireCooldown: 0.8,
    };
  }

  private clearLevelUnits(): void {
    for (const r of this.robots) {
      r.group.removeFromParent();
    }
    this.robots = [];
    this.swarmBots = [];
    this.swarmBodyMesh.visible = false;
    this.swarmHeadMesh.visible = false;
    this.swarmVisorMesh.visible = false;
    this.robotRaycastMeshes.length = 0;

    for (const a of this.allies) {
      a.group.removeFromParent();
    }
    this.allies = [];

    if (this.questNpcGroup) {
      this.questNpcGroup.removeFromParent();
      this.questNpcGroup = null;
      this.questBeaconMesh = null;
    }

    this.bossLockLine.visible = false;
    this.bossLaserMesh.visible = false;
    for (const line of this.mimicTetherLines) {
      line.visible = false;
    }

    for (const b of this.bolts) {
      b.active = false;
      b.mesh.visible = false;
    }
    for (const b of this.allyBolts) {
      b.active = false;
      b.mesh.visible = false;
    }
    for (const b of this.powerBolts) {
      b.active = false;
      b.mesh.visible = false;
    }
    for (const e of this.explosions) {
      e.active = false;
      e.sphere.visible = false;
      e.ring.visible = false;
    }
    for (let i = 0; i < this.shards.length; i++) {
      this.shards[i].active = false;
      this.tmpMat4.makeScale(0, 0, 0);
      this.shardMesh.setMatrixAt(i, this.tmpMat4);
    }
    this.shardMesh.instanceMatrix.needsUpdate = true;
    for (const ps of this.portalStreams) {
      ps.active = false;
      ps.mesh.visible = false;
    }
  }

  private createRobotMesh(
    level: number,
    spec: RobotSpawnSpec,
    id: number,
    bossName: string | null,
    bossPower: BossPowerId | null,
  ): RobotUnit {
    const group = new THREE.Group();
    group.position.copy(spec.position);
    const headGroup = new THREE.Group();
    const hitboxes: THREE.Object3D[] = [];
    const proxyMat = this.proxyMat;

    let coreMesh: THREE.Mesh;
    let spiderLegs: THREE.Group[] | undefined;
    let blockShieldMesh: THREE.Mesh | undefined;
    let bossShieldDome: THREE.Mesh | undefined;
    let bossSwordPivot: THREE.Group | undefined;
    let bossUltSphere: THREE.Mesh | undefined;
    const weakPointLocalPos = new THREE.Vector3(0, 1.85, 0.56);

    let baseHp = 22;
    let isInfinite = false;
    let shieldMaxHp = 0;
    let attackDamage = 8;
    let pointsReward = 1;
    let creditsReward = 18;
    let radius = 1.15;
    let height = 2.6;
    let baseScale = 1;
    let name = 'Scout Unit';

    const levelProgress = Math.max(0, Math.min(1, (level - 1) / 50));
    const earlyCurve = Math.pow(levelProgress, 0.85);

    if (spec.kind === 'glitch_titan') {
      // --- 1,000,000x COLOSSAL GLITCH TITAN (INFINITE HP) ---
      baseScale = 46;
      baseHp = 999_999_999;
      isInfinite = true;
      shieldMaxHp = 0;
      attackDamage = 400;
      pointsReward = 0;
      creditsReward = 0;
      radius = 3.5 * baseScale;
      height = 7.6 * baseScale;
      name = 'GLITCH TITAN NULL-0 · ∞ HP (1,000,000x)';

      group.scale.setScalar(baseScale);

      const torso = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.2, 2.8), this.darkArmorMat);
      torso.position.y = 4.4;
      const glitchShell = new THREE.Mesh(new THREE.BoxGeometry(4.9, 3.6, 3.2), this.glitchWireMat);
      glitchShell.position.y = 4.4;
      const legL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 1.4), this.crimsonArmorMat);
      legL.position.set(-1.2, 1.25, 0);
      const legR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 1.4), this.crimsonArmorMat);
      legR.position.set(1.2, 1.25, 0);
      const armL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, 1.2), this.darkArmorMat);
      armL.position.set(-3.2, 3.8, 0.5);
      const armR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, 1.2), this.darkArmorMat);
      armR.position.set(3.2, 3.8, 0.5);
      group.add(torso, glitchShell, legL, legR, armL, armR);

      coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.3, 1), this.mimicGlowMat);
      coreMesh.position.set(0, 4.45, 1.7);
      group.add(coreMesh);

      headGroup.position.set(0, 6.65, 0.2);
      const helm = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.35, 1.7), this.darkArmorMat);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.45, 0.3), this.mimicGlowMat);
      visor.position.set(0, 0.05, 0.84);
      headGroup.add(helm, visor);
      group.add(headGroup);

      const headProxy = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 8), proxyMat);
      headProxy.position.set(0, 6.65, 0.2);
      headProxy.userData.robotId = id;
      headProxy.userData.isHead = true;
      group.add(headProxy);

      const bodyProxy = new THREE.Mesh(new THREE.BoxGeometry(6.4, 6.0, 4.5), proxyMat);
      bodyProxy.position.y = 3.1;
      bodyProxy.userData.robotId = id;
      bodyProxy.userData.isHead = false;
      group.add(bodyProxy);

      hitboxes.push(headProxy, bodyProxy);
    } else if (spec.kind === 'final_boss') {
      baseScale = 24;
      baseHp = 1_000_000;
      shieldMaxHp = 180_000;
      attackDamage = getBossDamageForLevel();
      pointsReward = 50;
      creditsReward = 5000;
      radius = 3.5 * baseScale;
      height = 7.6 * baseScale;
      name = bossName ?? 'OMEGA-TITAN · WORLD ENDER (100x)';

      group.scale.setScalar(baseScale);

      const pelvis = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.1, 2.0), this.darkArmorMat);
      pelvis.position.y = 2.3;
      group.add(pelvis);

      const legL = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.4, 1.35), this.gunmetalMat);
      legL.position.set(-1.15, 1.2, 0);
      const legR = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.4, 1.35), this.gunmetalMat);
      legR.position.set(1.15, 1.2, 0);
      group.add(legL, legR);

      const torso = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.1, 2.8), this.crimsonArmorMat);
      torso.position.y = 4.45;
      const armorChest = new THREE.Mesh(new THREE.BoxGeometry(4.7, 1.6, 3.05), this.darkArmorMat);
      armorChest.position.set(0, 4.95, 0.15);
      const pauldronL = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.85, 2.7), this.darkArmorMat);
      pauldronL.position.set(-2.95, 5.25, 0);
      const pauldronR = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.85, 2.7), this.darkArmorMat);
      pauldronR.position.set(2.95, 5.25, 0);
      group.add(torso, armorChest, pauldronL, pauldronR);

      const leftArm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.7, 1.1), this.gunmetalMat);
      leftArm.position.set(-3.1, 3.4, 0.4);
      const fistL = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.4, 1.55), this.amberBossMat);
      fistL.position.set(-3.1, 1.9, 0.7);
      group.add(leftArm, fistL);

      bossSwordPivot = new THREE.Group();
      bossSwordPivot.position.set(3.2, 4.5, 0.4);
      const rightArm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 1.1), this.gunmetalMat);
      rightArm.position.set(0, -1.0, 0);
      const swordHilt = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, 0.45), this.darkArmorMat);
      swordHilt.position.set(0, -2.0, 1.1);
      swordHilt.rotation.x = Math.PI * 0.42;
      const titanBlade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 6.2, 1.1), this.whiteShellMat);
      titanBlade.position.set(0, -1.8, 4.2);
      titanBlade.rotation.x = Math.PI * 0.48;
      const titanEdge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6.3, 0.25), this.redEyeMat);
      titanEdge.position.set(0, -2.35, 4.2);
      titanEdge.rotation.x = Math.PI * 0.48;
      bossSwordPivot.add(rightArm, swordHilt, titanBlade, titanEdge);
      group.add(bossSwordPivot);

      coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 1), this.amberBossMat);
      coreMesh.position.set(0, 4.45, 1.68);
      group.add(coreMesh);

      headGroup.position.set(0, 6.6, 0.2);
      const helm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 1.65), this.darkArmorMat);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.42, 0.3), this.redEyeMat);
      visor.position.set(0, 0.05, 0.8);
      headGroup.add(helm, visor);
      group.add(headGroup);

      bossShieldDome = new THREE.Mesh(new THREE.IcosahedronGeometry(5.2, 1), this.titanShieldMat);
      bossShieldDome.position.set(0, 3.8, 0);
      group.add(bossShieldDome);

      const ultMat = new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.35,
        wireframe: true,
      });
      this.materials.push(ultMat);
      bossUltSphere = new THREE.Mesh(new THREE.SphereGeometry(5.8, 16, 12), ultMat);
      bossUltSphere.position.set(0, 3.8, 0);
      bossUltSphere.visible = false;
      group.add(bossUltSphere);

      const headProxy = new THREE.Mesh(new THREE.SphereGeometry(1.45, 8, 8), proxyMat);
      headProxy.position.set(0, 6.6, 0.2);
      headProxy.userData.robotId = id;
      headProxy.userData.isHead = true;
      group.add(headProxy);

      const bodyProxy = new THREE.Mesh(new THREE.BoxGeometry(6.2, 5.8, 4.4), proxyMat);
      bodyProxy.position.y = 3.0;
      bodyProxy.userData.robotId = id;
      bodyProxy.userData.isHead = false;
      group.add(bodyProxy);

      hitboxes.push(headProxy, bodyProxy);
    } else if (spec.kind === 'boss') {
      baseScale = getBossScaleForLevel(level);
      baseHp = Math.round(getBossHpForLevel(level, false) * spec.hpMultiplier);
      shieldMaxHp = Math.round(baseHp * 0.15);
      attackDamage = getBossDamageForLevel();
      pointsReward = 5 + Math.floor(level / 10);
      creditsReward = 140 + level * 6;
      radius = 3.5 * baseScale;
      height = 7.4 * baseScale;
      name = `${bossName ?? 'TITAN SENTINEL'} (LV ${level})`;

      group.scale.setScalar(baseScale);

      const pelvis = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.1, 2.0), this.darkArmorMat);
      pelvis.position.y = 2.3;
      group.add(pelvis);

      const legL = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.3, 1.2), this.gunmetalMat);
      legL.position.set(-1.1, 1.15, 0);
      const legR = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.3, 1.2), this.gunmetalMat);
      legR.position.set(1.1, 1.15, 0);
      group.add(legL, legR);

      const torso = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.9, 2.6), this.crimsonArmorMat);
      torso.position.y = 4.35;
      group.add(torso);

      const pauldronL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, 2.5), this.darkArmorMat);
      pauldronL.position.set(-2.65, 5.1, 0);
      const pauldronR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, 2.5), this.darkArmorMat);
      pauldronR.position.set(2.65, 5.1, 0);
      group.add(pauldronL, pauldronR);

      const cannonL = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 2.2, 10), this.gunmetalMat);
      cannonL.rotation.x = Math.PI * 0.5;
      cannonL.position.set(-2.65, 6.1, 0.8);
      const cannonR = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 2.2, 10), this.gunmetalMat);
      cannonR.rotation.x = Math.PI * 0.5;
      cannonR.position.set(2.65, 6.1, 0.8);
      group.add(cannonL, cannonR);

      const powerHex =
        bossPower === 'water'
          ? 0x0ea5e9
          : bossPower === 'punch'
            ? 0xeab308
            : bossPower === 'shrink'
              ? 0xd946ef
              : 0xf97316;
      const bossCoreMat = new THREE.MeshStandardMaterial({
        color: powerHex,
        emissive: powerHex,
        emissiveIntensity: 2.6,
        roughness: 0.18,
        metalness: 0.25,
      });
      this.materials.push(bossCoreMat);

      coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.05, 1), bossCoreMat);
      coreMesh.position.set(0, 4.4, 1.42);
      group.add(coreMesh);

      headGroup.position.set(0, 6.3, 0.15);
      const helm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.15, 1.5), this.darkArmorMat);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.34, 0.25), this.redEyeMat);
      visor.position.set(0, 0.05, 0.72);
      headGroup.add(helm, visor);
      group.add(headGroup);

      bossShieldDome = new THREE.Mesh(new THREE.IcosahedronGeometry(4.4, 1), this.titanShieldMat);
      bossShieldDome.position.set(0, 3.6, 0);
      group.add(bossShieldDome);

      const ultMat = new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.35,
        wireframe: true,
      });
      this.materials.push(ultMat);
      bossUltSphere = new THREE.Mesh(new THREE.SphereGeometry(5.2, 14, 10), ultMat);
      bossUltSphere.position.set(0, 3.6, 0);
      bossUltSphere.visible = false;
      group.add(bossUltSphere);

      const headProxy = new THREE.Mesh(new THREE.SphereGeometry(1.3, 8, 8), proxyMat);
      headProxy.position.set(0, 6.35, 0.15);
      headProxy.userData.robotId = id;
      headProxy.userData.isHead = true;
      group.add(headProxy);

      const bodyProxy = new THREE.Mesh(new THREE.BoxGeometry(5.6, 5.5, 4.2), proxyMat);
      bodyProxy.position.y = 2.85;
      bodyProxy.userData.robotId = id;
      bodyProxy.userData.isHead = false;
      group.add(bodyProxy);

      hitboxes.push(headProxy, bodyProxy);
    } else if (spec.kind === 'spider') {
      // --- NEW ARACHNID SPIDER ROBOT (8 ARTICULATED LEGS + ULTRA FAST SCUTTLE) ---
      baseHp = this.trainingMode ? 32 : Math.round((34 + earlyCurve * 900) * spec.hpMultiplier);
      attackDamage = this.trainingMode ? 8 : Math.round(16 + earlyCurve * 110);
      pointsReward = this.trainingMode ? 0 : 2;
      creditsReward = this.trainingMode ? 12 : 42 + level * 2;
      radius = 1.65;
      height = 2.1;
      name = 'Arachno-Mech Spider';

      const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.92, 12, 10), this.spiderChitinMat);
      abdomen.scale.set(1.05, 0.8, 1.35);
      abdomen.position.set(0, 1.05, -0.75);
      group.add(abdomen);

      const thorax = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.72, 1.15), this.darkArmorMat);
      thorax.position.set(0, 1.0, 0.35);
      group.add(thorax);

      coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), this.redEyeMat);
      coreMesh.position.set(0, 1.42, 0.35);
      group.add(coreMesh);

      headGroup.position.set(0, 1.1, 1.02);
      const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.24, 0.25), this.redEyeMat);
      headGroup.add(eyes);
      group.add(headGroup);

      spiderLegs = [];
      for (let l = 0; l < 8; l++) {
        const side = l < 4 ? -1 : 1;
        const row = l % 4;
        const legPivot = new THREE.Group();
        legPivot.position.set(side * 0.55, 0.95, 0.55 - row * 0.42);
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.16), this.gunmetalMat);
        upper.position.set(side * 0.48, 0.22, 0);
        upper.rotation.z = side * 0.42;
        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.15, 0.15), this.crimsonArmorMat);
        lower.position.set(side * 0.98, -0.25, 0);
        lower.rotation.z = -side * 0.18;
        legPivot.add(upper, lower);
        group.add(legPivot);
        spiderLegs.push(legPivot);
      }

      const headProxy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 8), proxyMat);
      headProxy.position.set(0, 1.15, 1.02);
      headProxy.userData.robotId = id;
      headProxy.userData.isHead = true;
      group.add(headProxy);

      const bodyProxy = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.7, 2.6), proxyMat);
      bodyProxy.position.y = 0.95;
      bodyProxy.userData.robotId = id;
      bodyProxy.userData.isHead = false;
      group.add(bodyProxy);

      hitboxes.push(headProxy, bodyProxy);
    } else if (spec.kind === 'mimic' || spec.kind === 'giant_mimic') {
      const isGiant = spec.kind === 'giant_mimic';
      baseScale = isGiant ? 18.5 : 1; // 50-meter colossal fast mimic!
      baseHp = isGiant
        ? 185_000
        : this.trainingMode
          ? 48
          : Math.round((40 + earlyCurve * 920) * spec.hpMultiplier);
      attackDamage = isGiant ? 280 : this.trainingMode ? 9 : Math.round(16 + earlyCurve * 135);
      pointsReward = isGiant ? 18 : this.trainingMode ? 0 : 3;
      creditsReward = isGiant ? 1600 : this.trainingMode ? 15 : 52 + Math.floor(level * 1.5);
      radius = 1.25 * baseScale;
      height = 2.7 * baseScale;
      name = isGiant ? '50m Hyper-Mimic Phantom' : 'Shadow Mimic';

      group.scale.setScalar(baseScale);

      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.05, 0.56), this.darkArmorMat);
      legs.position.y = 0.52;
      group.add(legs);

      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.16, 1.02, 0.7), this.crimsonArmorMat);
      torso.position.y = 1.54;
      group.add(torso);

      const swordBlade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.75, 0.22), this.mimicGlowMat);
      swordBlade.position.set(0.75, 1.95, 0.55);
      swordBlade.rotation.x = 0.65;
      group.add(swordBlade);

      const copyGun = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.72), this.gunmetalMat);
      copyGun.position.set(-0.72, 1.55, 0.42);
      group.add(copyGun);

      coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), this.mimicGlowMat);
      coreMesh.position.set(0, 1.58, 0.4);
      group.add(coreMesh);

      blockShieldMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.3), this.mimicShieldMat);
      blockShieldMesh.position.set(0, 1.55, 0.95);
      blockShieldMesh.visible = false;
      group.add(blockShieldMesh);

      headGroup.position.set(0, 2.32, 0);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.54, 0.6), this.darkArmorMat);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.2, 0.16), this.mimicGlowMat);
      visor.position.set(0, 0.04, 0.28);
      headGroup.add(head, visor);
      group.add(headGroup);

      const headProxy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 8), proxyMat);
      headProxy.position.set(0, 2.34, 0);
      headProxy.userData.robotId = id;
      headProxy.userData.isHead = true;
      group.add(headProxy);

      const bodyProxy = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.1, 1.7), proxyMat);
      bodyProxy.position.y = 1.05;
      bodyProxy.userData.robotId = id;
      bodyProxy.userData.isHead = false;
      group.add(bodyProxy);

      hitboxes.push(headProxy, bodyProxy);
    } else if (spec.kind === 'hunter') {
      baseHp = Math.round((45 + earlyCurve * 1120) * spec.hpMultiplier);
      attackDamage = Math.round(22 + earlyCurve * 168);
      pointsReward = 3;
      creditsReward = 45 + Math.floor(level * 1.4);
      radius = 1.6;
      height = 3.6;
      name = 'Juggernaut Hunter';

      const legs = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.45, 0.95), this.darkArmorMat);
      legs.position.y = 0.72;
      group.add(legs);

      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.4, 1.2), this.crimsonArmorMat);
      torso.position.y = 2.05;
      group.add(torso);

      const bladeL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.45, 0.7), this.gunmetalMat);
      bladeL.position.set(-1.2, 2.2, 0.35);
      bladeL.rotation.x = 0.35;
      const bladeR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.45, 0.7), this.gunmetalMat);
      bladeR.position.set(1.2, 2.2, 0.35);
      bladeR.rotation.x = 0.35;
      group.add(bladeL, bladeR);

      coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.44, 0), this.amberBossMat);
      coreMesh.position.set(0, 2.1, 0.65);
      group.add(coreMesh);

      headGroup.position.set(0, 3.1, 0.05);
      const helm = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.72, 0.85), this.darkArmorMat);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.24, 0.2), this.redEyeMat);
      visor.position.set(0, 0.04, 0.42);
      headGroup.add(helm, visor);
      group.add(headGroup);

      const headProxy = new THREE.Mesh(new THREE.SphereGeometry(0.76, 8, 8), proxyMat);
      headProxy.position.set(0, 3.12, 0.05);
      headProxy.userData.robotId = id;
      headProxy.userData.isHead = true;
      group.add(headProxy);

      const bodyProxy = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.75, 2.2), proxyMat);
      bodyProxy.position.y = 1.38;
      bodyProxy.userData.robotId = id;
      bodyProxy.userData.isHead = false;
      group.add(bodyProxy);

      hitboxes.push(headProxy, bodyProxy);
    } else if (spec.kind === 'drone') {
      baseHp = this.trainingMode ? 22 : Math.round((14 + earlyCurve * 540) * spec.hpMultiplier);
      attackDamage = this.trainingMode ? 6 : Math.round(7 + earlyCurve * 95);
      pointsReward = this.trainingMode ? 0 : 1;
      creditsReward = this.trainingMode ? 8 : 18 + Math.floor(level * 0.7);
      radius = 1.25;
      height = 1.6;
      name = this.trainingMode ? 'Practice Drone' : 'Aero-Drone';

      const chassis = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 1), this.whiteShellMat);
      group.add(chassis);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.14, 8, 20), this.gunmetalMat);
      ring.rotation.x = Math.PI * 0.5;
      group.add(ring);
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.5), this.darkArmorMat);
      wingL.position.set(-1.35, 0, 0);
      const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.5), this.darkArmorMat);
      wingR.position.set(1.35, 0, 0);
      group.add(wingL, wingR);

      coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), this.redEyeMat);
      coreMesh.position.set(0, 0, 0.72);
      headGroup.add(coreMesh);
      group.add(headGroup);

      const headProxy = new THREE.Mesh(new THREE.SphereGeometry(0.78, 8, 8), proxyMat);
      headProxy.userData.robotId = id;
      headProxy.userData.isHead = true;
      group.add(headProxy);

      const bodyProxy = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 1.2, 8), proxyMat);
      bodyProxy.userData.robotId = id;
      bodyProxy.userData.isHead = false;
      group.add(bodyProxy);

      hitboxes.push(headProxy, bodyProxy);
    } else if (spec.kind === 'cryo_stalker') {
      baseHp = Math.round((34 + earlyCurve * 880) * spec.hpMultiplier);
      attackDamage = Math.round(14 + earlyCurve * 125);
      pointsReward = 2;
      creditsReward = 40 + Math.floor(level * 1.2);
      radius = 1.25;
      height = 2.55;
      name = spec.variantName ?? 'Cryo Stalker';
      weakPointLocalPos.set(0, 1.58, 0.54);

      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.0, 0.65), this.darkArmorMat);
      legs.position.y = 0.52;
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.95, 0.78), this.cryoMat);
      torso.position.y = 1.48;
      const finL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.15, 0.45), this.whiteShellMat);
      finL.position.set(-0.75, 1.75, -0.1);
      finL.rotation.z = 0.35;
      const finR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.15, 0.45), this.whiteShellMat);
      finR.position.set(0.75, 1.75, -0.1);
      finR.rotation.z = -0.35;
      group.add(legs, torso, finL, finR);

      coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), this.cryoMat);
      coreMesh.position.set(0, 1.56, 0.45);
      group.add(coreMesh);

      headGroup.position.set(0, 2.26, 0.08);
      const helm = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.75, 6), this.darkArmorMat);
      helm.rotation.x = Math.PI * 0.5;
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.18), this.cryoMat);
      visor.position.set(0, 0.04, 0.28);
      headGroup.add(helm, visor);
      group.add(headGroup);

      const headProxy = new THREE.Mesh(new THREE.SphereGeometry(0.58, 8, 8), proxyMat);
      headProxy.position.set(0, 2.26, 0.08);
      headProxy.userData.robotId = id;
      headProxy.userData.isHead = true;
      group.add(headProxy);

      const bodyProxy = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.0, 1.7), proxyMat);
      bodyProxy.position.y = 1.02;
      bodyProxy.userData.robotId = id;
      bodyProxy.userData.isHead = false;
      group.add(bodyProxy);
      hitboxes.push(headProxy, bodyProxy);
    } else if (spec.kind === 'pyro_bomber') {
      baseHp = Math.round((46 + earlyCurve * 1020) * spec.hpMultiplier);
      attackDamage = Math.round(20 + earlyCurve * 155);
      pointsReward = 2;
      creditsReward = 48 + Math.floor(level * 1.4);
      radius = 1.55;
      height = 3.1;
      name = spec.variantName ?? 'Pyro Bomber';
      weakPointLocalPos.set(0, 1.9, 0.65);

      const legs = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.15, 0.9), this.darkArmorMat);
      legs.position.y = 0.58;
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.32, 1.12), this.pyroMat);
      torso.position.y = 1.82;
      const podL = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.95, 10), this.crimsonArmorMat);
      podL.position.set(-1.12, 2.38, 0.1);
      const podR = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.95, 10), this.crimsonArmorMat);
      podR.position.set(1.12, 2.38, 0.1);
      group.add(legs, torso, podL, podR);

      coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), this.pyroMat);
      coreMesh.position.set(0, 1.85, 0.6);
      group.add(coreMesh);

      headGroup.position.set(0, 2.74, 0.08);
      const helm = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.6, 0.78), this.darkArmorMat);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.2, 0.18), this.pyroMat);
      visor.position.set(0, 0.04, 0.36);
      headGroup.add(helm, visor);
      group.add(headGroup);

      const headProxy = new THREE.Mesh(new THREE.SphereGeometry(0.68, 8, 8), proxyMat);
      headProxy.position.set(0, 2.74, 0.08);
      headProxy.userData.robotId = id;
      headProxy.userData.isHead = true;
      group.add(headProxy);

      const bodyProxy = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.5, 2.0), proxyMat);
      bodyProxy.position.y = 1.25;
      bodyProxy.userData.robotId = id;
      bodyProxy.userData.isHead = false;
      group.add(bodyProxy);
      hitboxes.push(headProxy, bodyProxy);
    } else if (spec.kind === 'volt_sniper') {
      baseHp = Math.round((28 + earlyCurve * 760) * spec.hpMultiplier);
      attackDamage = Math.round(22 + earlyCurve * 165);
      pointsReward = 2;
      creditsReward = 44 + Math.floor(level * 1.3);
      radius = 1.15;
      height = 3.0;
      name = spec.variantName ?? 'Volt Rail Sniper';
      weakPointLocalPos.set(0, 1.75, 0.5);

      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.2, 0.58), this.darkArmorMat);
      legs.position.y = 0.6;
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.05, 0.7), this.darkArmorMat);
      torso.position.y = 1.72;
      const railBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 1.95), this.voltMat);
      railBarrel.position.set(0.62, 1.82, 0.75);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.1, 6), this.voltMat);
      antenna.position.set(-0.4, 2.9, -0.15);
      group.add(legs, torso, railBarrel, antenna);

      coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), this.voltMat);
      coreMesh.position.set(0, 1.72, 0.42);
      group.add(coreMesh);

      headGroup.position.set(0, 2.58, 0);
      const helm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.56, 0.68), this.whiteShellMat);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.18), this.voltMat);
      visor.position.set(0, 0.04, 0.34);
      headGroup.add(helm, visor);
      group.add(headGroup);

      const headProxy = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), proxyMat);
      headProxy.position.set(0, 2.58, 0);
      headProxy.userData.robotId = id;
      headProxy.userData.isHead = true;
      group.add(headProxy);

      const bodyProxy = new THREE.Mesh(new THREE.BoxGeometry(1.85, 2.25, 1.7), proxyMat);
      bodyProxy.position.y = 1.15;
      bodyProxy.userData.robotId = id;
      bodyProxy.userData.isHead = false;
      group.add(bodyProxy);
      hitboxes.push(headProxy, bodyProxy);
    } else if (spec.kind === 'void_assassin') {
      baseHp = Math.round((36 + earlyCurve * 900) * spec.hpMultiplier);
      attackDamage = Math.round(18 + earlyCurve * 150);
      pointsReward = 3;
      creditsReward = 55 + Math.floor(level * 1.5);
      radius = 1.15;
      height = 2.65;
      name = spec.variantName ?? 'Void Blink Assassin';
      weakPointLocalPos.set(0, 1.56, 0.52);

      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.02, 0.54), this.darkArmorMat);
      legs.position.y = 0.52;
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.0, 0.68), this.voidMat);
      torso.position.y = 1.54;
      const bladeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.45, 0.2), this.voidMat);
      bladeL.position.set(-0.74, 1.68, 0.5);
      bladeL.rotation.x = 0.65;
      const bladeR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.45, 0.2), this.voidMat);
      bladeR.position.set(0.74, 1.68, 0.5);
      bladeR.rotation.x = 0.65;
      group.add(legs, torso, bladeL, bladeR);

      coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), this.voidMat);
      coreMesh.position.set(0, 1.56, 0.42);
      group.add(coreMesh);

      headGroup.position.set(0, 2.34, 0);
      const helm = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 1), this.darkArmorMat);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.18), this.voidMat);
      visor.position.set(0, 0.02, 0.34);
      headGroup.add(helm, visor);
      group.add(headGroup);

      const headProxy = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), proxyMat);
      headProxy.position.set(0, 2.34, 0);
      headProxy.userData.robotId = id;
      headProxy.userData.isHead = true;
      group.add(headProxy);

      const bodyProxy = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.05, 1.7), proxyMat);
      bodyProxy.position.y = 1.02;
      bodyProxy.userData.robotId = id;
      bodyProxy.userData.isHead = false;
      group.add(bodyProxy);
      hitboxes.push(headProxy, bodyProxy);
    } else if (spec.kind === 'aegis_juggernaut') {
      baseHp = Math.round((78 + earlyCurve * 1550) * spec.hpMultiplier);
      shieldMaxHp = Math.round(baseHp * 0.35);
      attackDamage = Math.round(24 + earlyCurve * 175);
      pointsReward = 3;
      creditsReward = 62 + Math.floor(level * 1.6);
      radius = 1.75;
      height = 3.7;
      name = spec.variantName ?? 'Aegis Juggernaut';
      weakPointLocalPos.set(0, 2.18, 0.78);

      const legs = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.45, 1.05), this.darkArmorMat);
      legs.position.y = 0.72;
      const torso = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.55, 1.35), this.aegisMat);
      torso.position.y = 2.15;
      const pauldronL = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 1.2), this.darkArmorMat);
      pauldronL.position.set(-1.35, 2.65, 0);
      const pauldronR = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 1.2), this.darkArmorMat);
      pauldronR.position.set(1.35, 2.65, 0);
      group.add(legs, torso, pauldronL, pauldronR);

      bossShieldDome = new THREE.Mesh(new THREE.IcosahedronGeometry(2.45, 1), this.titanShieldMat);
      bossShieldDome.position.set(0, 1.9, 0);
      group.add(bossShieldDome);

      coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.46, 0), this.aegisMat);
      coreMesh.position.set(0, 2.18, 0.72);
      group.add(coreMesh);

      headGroup.position.set(0, 3.22, 0.05);
      const helm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.72, 0.88), this.darkArmorMat);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.24, 0.2), this.aegisMat);
      visor.position.set(0, 0.04, 0.44);
      headGroup.add(helm, visor);
      group.add(headGroup);

      const headProxy = new THREE.Mesh(new THREE.SphereGeometry(0.78, 8, 8), proxyMat);
      headProxy.position.set(0, 3.22, 0.05);
      headProxy.userData.robotId = id;
      headProxy.userData.isHead = true;
      group.add(headProxy);

      const bodyProxy = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.85, 2.3), proxyMat);
      bodyProxy.position.y = 1.45;
      bodyProxy.userData.robotId = id;
      bodyProxy.userData.isHead = false;
      group.add(bodyProxy);
      hitboxes.push(headProxy, bodyProxy);
    } else if (spec.kind === 'mecha_lancer') {
      baseHp = Math.round((32 + earlyCurve * 840) * spec.hpMultiplier);
      attackDamage = Math.round(15 + earlyCurve * 135);
      pointsReward = 2;
      creditsReward = 45 + Math.floor(level * 1.3);
      radius = 1.4;
      height = 2.1;
      name = spec.variantName ?? 'Mecha Sky Lancer';
      weakPointLocalPos.set(0, 0.15, 0.72);

      const chassis = new THREE.Mesh(new THREE.ConeGeometry(0.82, 2.1, 6), this.lancerMat);
      chassis.rotation.x = Math.PI * 0.5;
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.14, 0.65), this.darkArmorMat);
      wingL.position.set(-1.35, 0.15, -0.15);
      wingL.rotation.z = 0.22;
      const wingR = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.14, 0.65), this.darkArmorMat);
      wingR.position.set(1.35, 0.15, -0.15);
      wingR.rotation.z = -0.22;
      const lance = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.9, 6), this.whiteShellMat);
      lance.rotation.x = Math.PI * 0.5;
      lance.position.set(0, -0.15, 1.35);
      group.add(chassis, wingL, wingR, lance);

      coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), this.lancerMat);
      coreMesh.position.set(0, 0.15, 0.65);
      headGroup.add(coreMesh);
      group.add(headGroup);

      const headProxy = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 8), proxyMat);
      headProxy.userData.robotId = id;
      headProxy.userData.isHead = true;
      group.add(headProxy);

      const bodyProxy = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.4, 2.4), proxyMat);
      bodyProxy.userData.robotId = id;
      bodyProxy.userData.isHead = false;
      group.add(bodyProxy);
      hitboxes.push(headProxy, bodyProxy);
    } else {
      const isTrooper = spec.kind === 'trooper';
      baseHp = this.trainingMode
        ? isTrooper
          ? 28
          : 20
        : Math.round(((isTrooper ? 26 : 16) + earlyCurve * (isTrooper ? 850 : 600)) * spec.hpMultiplier);
      attackDamage = this.trainingMode
        ? 6
        : Math.round((isTrooper ? 13 : 8) + earlyCurve * (isTrooper ? 120 : 88));
      pointsReward = this.trainingMode ? 0 : isTrooper ? 2 : 1;
      creditsReward = this.trainingMode ? 8 : (isTrooper ? 28 : 18) + Math.floor(level * 0.8);
      radius = isTrooper ? 1.25 : 1.05;
      height = isTrooper ? 2.75 : 2.35;
      name =
        spec.variantName ??
        (this.trainingMode
          ? isTrooper
            ? 'Practice Trooper'
            : 'Practice Scout'
          : isTrooper
            ? 'Enforcer Bot'
            : 'Scout Bot');

      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, 0.65), this.gunmetalMat);
      legs.position.y = 0.55;
      group.add(legs);

      const torso = new THREE.Mesh(
        new THREE.BoxGeometry(isTrooper ? 1.35 : 1.05, 1.05, 0.8),
        isTrooper ? this.darkArmorMat : this.whiteShellMat,
      );
      torso.position.y = 1.55;
      group.add(torso);

      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.85, 0.34), this.gunmetalMat);
      armL.position.set(-0.78, 1.5, 0.15);
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.55), this.gunmetalMat);
      armR.position.set(0.78, 1.5, 0.25);
      group.add(armL, armR);

      coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), this.redEyeMat);
      coreMesh.position.set(0, 1.6, 0.42);
      group.add(coreMesh);

      headGroup.position.set(0, 2.32, 0);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.52, 0.62), this.whiteShellMat);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.16), this.redEyeMat);
      visor.position.set(0, 0.02, 0.3);
      headGroup.add(head, visor);
      group.add(headGroup);

      const headProxy = new THREE.Mesh(new THREE.SphereGeometry(0.56, 8, 8), proxyMat);
      headProxy.position.set(0, 2.34, 0);
      headProxy.userData.robotId = id;
      headProxy.userData.isHead = true;
      group.add(headProxy);

      const bodyProxy = new THREE.Mesh(new THREE.BoxGeometry(1.85, 2.0, 1.7), proxyMat);
      bodyProxy.position.y = 1.0;
      bodyProxy.userData.robotId = id;
      bodyProxy.userData.isHead = false;
      group.add(bodyProxy);

      hitboxes.push(headProxy, bodyProxy);
    }

    const isAnyBoss =
      spec.kind === 'boss' || spec.kind === 'final_boss' || spec.kind === 'glitch_titan';

    // Set exact weakPointLocalPos for existing classes & bosses
    if (spec.kind === 'boss' || spec.kind === 'final_boss' || spec.kind === 'glitch_titan') {
      weakPointLocalPos.set(0, 4.45, 1.78);
    } else if (spec.kind === 'spider') {
      weakPointLocalPos.set(0, 1.52, -0.55);
    } else if (spec.kind === 'hunter') {
      weakPointLocalPos.set(0, 2.1, 0.78);
    } else if (spec.kind === 'drone') {
      weakPointLocalPos.set(0, 0.15, 0.85);
    } else if (spec.kind === 'mimic' || spec.kind === 'giant_mimic') {
      weakPointLocalPos.set(0, 1.58, 0.56);
    } else if (spec.kind === 'scout' || spec.kind === 'trooper') {
      weakPointLocalPos.set(0, 1.62, 0.52);
    }

    // Glowing Crimson Weak Point Crystal + Raycast Proxy (inserted first in hitboxes!)
    const weakPointMat = new THREE.MeshStandardMaterial({
      color: 0xff1e3c,
      emissive: 0xff002b,
      emissiveIntensity: 0.7,
      roughness: 0.12,
      metalness: 0.25,
    });
    this.materials.push(weakPointMat);
    const wpRadius = isAnyBoss ? 1.05 : spec.kind === 'aegis_juggernaut' || spec.kind === 'hunter' ? 0.44 : 0.34;
    const weakPointMesh = new THREE.Mesh(new THREE.OctahedronGeometry(wpRadius, 0), weakPointMat);
    weakPointMesh.position.copy(weakPointLocalPos);
    group.add(weakPointMesh);

    const weakPointProxy = new THREE.Mesh(
      new THREE.SphereGeometry(wpRadius * 1.48, 8, 8),
      proxyMat,
    );
    weakPointProxy.position.copy(weakPointLocalPos);
    weakPointProxy.userData.robotId = id;
    weakPointProxy.userData.isWeakPoint = true;
    weakPointProxy.userData.isHead = false;
    group.add(weakPointProxy);
    hitboxes.unshift(weakPointProxy);

    if (!isInfinite) {
      baseHp = Math.max(8, Math.round(baseHp * this.difficultyMults.enemyHpMult));
      if (shieldMaxHp > 0) {
        shieldMaxHp = Math.max(10, Math.round(shieldMaxHp * this.difficultyMults.enemyHpMult));
      }
      attackDamage = Math.max(2, Math.round(attackDamage * this.difficultyMults.enemyDamageMult));
      if (creditsReward > 0) {
        creditsReward = Math.max(1, Math.round(creditsReward * this.difficultyMults.rewardMult));
      }
      if (pointsReward > 0 && this.difficultyMults.rewardMult > 1.1) {
        pointsReward = Math.max(1, Math.round(pointsReward * this.difficultyMults.rewardMult));
      }
    }

    const variantBase = spec.levelVariantIdx ?? level + id;
    const abilityPoolStart = ((variantBase * 17 + id * 7) % ENEMY_ABILITY_CATALOG.length);

    return {
      id,
      kind: spec.kind,
      name,
      group,
      coreMesh,
      headGroup,
      weakPointMesh,
      weakPointMat,
      weakPointLocalPos,
      spiderLegs,
      blockShieldMesh,
      bossShieldDome,
      bossSwordPivot,
      bossUltSphere,
      position: spec.position.clone(),
      homePos: spec.position.clone(),
      patrolRadius: spec.patrolRadius,
      patrolPhase: id * 1.37,
      strafeSign: id % 2 === 0 ? 1 : -1,
      flankFlipTimer: 2.2 + (id % 3) * 0.8,
      dashCooldown: isAnyBoss ? 1.4 : 1.9,
      dashTimer: 0,
      dashVel: new THREE.Vector3(),
      blinkCooldown: 3.0 + (id % 2),
      zipDodgeCooldown: 0,
      hp: baseHp,
      maxHp: baseHp,
      isInfinite,
      shieldHp: shieldMaxHp,
      shieldMaxHp,
      attackDamage,
      pointsReward,
      creditsReward,
      radius,
      height,
      baseScale,
      alive: true,
      respawnTimer: 0,
      alerted: spec.kind === 'final_boss' || spec.kind === 'glitch_titan' || spec.kind === 'giant_mimic',
      fireCooldown: isAnyBoss
        ? 0.95
        : level === 1
          ? 1.55 + Math.random() * 0.7
          : 0.75 + Math.random() * 0.65,
      meleeCooldown: 0,
      flashTimer: 0,
      stunCooldown: isAnyBoss ? 9.5 : 999,
      stunTimer: 0,
      stunMaxTimer: 4.0,
      abilityPoolStart,
      abilityOffset: 0,
      activeAbilityName: null,
      bossPower: isAnyBoss ? bossPower : null,
      powerCooldown: 3.1,
      lockOnTimer: 0,
      shrunkTimer: 0,
      ultCooldown: spec.kind === 'final_boss' ? 8.5 : 10.5,
      ultChargingTimer: 0,
      ultMaxTimer: 2.5,
      laserCooldown: 5.5,
      laserActiveTimer: 0,
      laserSweepAngle: 0,
      swordSwingTimer: 0,
      mimicBlocking: false,
      mimicSwingingNode: null,
      ffaTargetId: null,
      hitboxes,
    };
  }

  public getRobotById(id: number): RobotUnit | undefined {
    return this.robots.find((r) => r.id === id && r.alive);
  }

  public getRobotWeakPointWorldPos(robot: RobotUnit, out: THREE.Vector3): THREE.Vector3 {
    out.copy(robot.weakPointLocalPos);
    robot.group.localToWorld(out);
    return out;
  }

  public getPortalChargePct(): number {
    if (this.currentMode === 'wave' || this.currentMode === 'ffa') {
      return this.getAliveCount() === 0 && this.pendingLightStreams === 0 ? 100 : 0;
    }
    if (this.totalSpawnedEnemies <= 0) return 100;
    const alive = this.getAliveCount();
    if (alive === 0 && this.pendingLightStreams === 0) return 100;
    const arrivedRatio =
      (this.totalSpawnedEnemies - alive - this.pendingLightStreams * 0.34) /
      Math.max(1, this.totalSpawnedEnemies);
    return Math.max(0, Math.min(99, Math.round(arrivedRatio * 100)));
  }

  public spawnPortalLightStream(originPos: THREE.Vector3): void {
    const count = 3;
    for (let k = 0; k < count; k++) {
      const slot = this.portalStreams.find((s) => !s.active) ?? this.portalStreams[0];
      if (!slot.active) {
        this.pendingLightStreams++;
      }
      slot.active = true;
      slot.progress = 0;
      slot.duration = 0.85 + k * 0.16;
      slot.startPos.copy(originPos);
      slot.endPos.set(
        this.currentGoalPos.x + (k - 1) * 1.4,
        this.currentGoalPos.y + 4.8,
        this.currentGoalPos.z,
      );
      slot.ctrlPos.set(
        (originPos.x + slot.endPos.x) * 0.5 + (k - 1) * 11,
        Math.max(originPos.y + 18, 22 + k * 5),
        (originPos.z + slot.endPos.z) * 0.5,
      );
      slot.mesh.position.copy(originPos);
      slot.mesh.scale.setScalar(1.35);
      slot.mesh.visible = true;
    }
  }

  public getSwarmBotByIndex(idx: number): SwarmBot | undefined {
    const b = this.swarmBots[idx];
    return b && b.alive ? b : undefined;
  }

  public tryRescueNearby(
    playerPos: THREE.Vector3,
    sound: ProceduralSoundEngine,
    forceTrigger = false,
  ): OperativeNpc | null {
    for (const a of this.allies) {
      if (a.recruited || !a.alive) continue;
      const dist = playerPos.distanceTo(a.position);
      if (dist < (forceTrigger ? 8.5 : 5.2)) {
        a.recruited = true;
        a.hp = 200;
        a.maxHp = 200;
        a.cageGroup.visible = false;
        a.visorMat.color.setHex(0x10b981);
        a.visorMat.emissive.setHex(0x059669);
        sound.playRescueRecruit();
        return a;
      }
    }
    return null;
  }

  public getCaptivesRemaining(): number {
    return this.allies.filter((a) => !a.recruited && a.alive).length;
  }

  public getAllyHudList(): AllyNpcHud[] {
    return this.allies.map((a) => ({
      id: a.id,
      name: a.name,
      hp: Math.max(0, Math.round(a.hp)),
      maxHp: a.maxHp,
      recruited: a.recruited,
    }));
  }

  public computeAttackSensor(playerPos: THREE.Vector3, yaw: number): AttackSensorState {
    const camFwdX = -Math.sin(yaw);
    const camFwdZ = -Math.cos(yaw);
    const camRightX = Math.cos(yaw);
    const camRightZ = -Math.sin(yaw);

    let bestDist = Infinity;
    let bestDx = 0;
    let bestDz = 0;
    let incomingThreat = false;

    for (let i = 0; i < this.bolts.length; i++) {
      const b = this.bolts[i];
      if (!b.active) continue;
      const d = b.pos.distanceTo(playerPos);
      if (d < 36 && d < bestDist) {
        const toPlayerX = playerPos.x - b.pos.x;
        const toPlayerZ = playerPos.z - b.pos.z;
        const headingDot = toPlayerX * b.vel.x + toPlayerZ * b.vel.z;
        if (headingDot > 0) {
          bestDist = d;
          bestDx = b.pos.x - playerPos.x;
          bestDz = b.pos.z - playerPos.z;
          incomingThreat = true;
        }
      }
    }
    for (let i = 0; i < this.powerBolts.length; i++) {
      const b = this.powerBolts[i];
      if (!b.active) continue;
      const d = b.pos.distanceTo(playerPos);
      if (d < 36 && d < bestDist) {
        const toPlayerX = playerPos.x - b.pos.x;
        const toPlayerZ = playerPos.z - b.pos.z;
        const headingDot = toPlayerX * b.vel.x + toPlayerZ * b.vel.z;
        if (headingDot > 0) {
          bestDist = d;
          bestDx = b.pos.x - playerPos.x;
          bestDz = b.pos.z - playerPos.z;
          incomingThreat = true;
        }
      }
    }

    if (!incomingThreat) {
      for (const r of this.robots) {
        if (!r.alive || !r.alerted) continue;
        const d = r.position.distanceTo(playerPos);
        if (
          d < 42 &&
          (r.fireCooldown < 0.55 || r.dashTimer > 0 || r.ultChargingTimer > 0 || r.kind === 'glitch_titan') &&
          d < bestDist
        ) {
          bestDist = d;
          bestDx = r.position.x - playerPos.x;
          bestDz = r.position.z - playerPos.z;
          incomingThreat = true;
        }
      }
    }

    if (!incomingThreat) {
      return {
        active: false,
        incomingThreat: false,
        nearestDistanceM: 99,
        direction: 'front',
      };
    }

    const fwdDot = bestDx * camFwdX + bestDz * camFwdZ;
    const rightDot = bestDx * camRightX + bestDz * camRightZ;
    let direction: SensorDirection = 'front';
    if (Math.abs(fwdDot) >= Math.abs(rightDot)) {
      direction = fwdDot >= 0 ? 'front' : 'back';
    } else {
      direction = rightDot >= 0 ? 'right' : 'left';
    }

    return {
      active: true,
      incomingThreat: true,
      nearestDistanceM: Math.round(bestDist),
      direction,
    };
  }

  public damageRobot(
    robot: RobotUnit,
    amount: number,
    sound: ProceduralSoundEngine,
    sloMo: boolean,
    bypassShield = false,
  ): { killed: boolean; isBoss: boolean; pointsReward: number; creditsReward: number } {
    if (!robot.alive) {
      return { killed: false, isBoss: false, pointsReward: 0, creditsReward: 0 };
    }

    robot.alerted = true;
    robot.flashTimer = 0.14;

    if (robot.isInfinite) {
      // Glitch Titan has Infinite HP — cannot be killed!
      return { killed: false, isBoss: false, pointsReward: 0, creditsReward: 0 };
    }

    const mimicMult = robot.mimicBlocking ? 0.45 : 1.0;
    const shrinkMult = robot.shrunkTimer > 0 ? 1.5 : 1.0;
    let remainingDmg = Math.max(1, Math.round(amount * mimicMult * shrinkMult));

    if (robot.shieldHp > 0 && !bypassShield) {
      const shieldAbsorb = Math.min(robot.shieldHp, Math.round(remainingDmg * 0.72));
      robot.shieldHp = Math.max(0, robot.shieldHp - shieldAbsorb);
      remainingDmg = Math.max(1, remainingDmg - Math.round(shieldAbsorb * 0.75));
      if (robot.bossShieldDome) {
        robot.bossShieldDome.visible = robot.shieldHp > 0;
      }
    }

    robot.hp = Math.max(0, robot.hp - remainingDmg);

    if (robot.hp <= 0) {
      robot.alive = false;
      robot.group.visible = false;
      robot.respawnTimer = this.trainingMode ? 3.2 : 0;
      const isBoss = robot.kind === 'boss' || robot.kind === 'final_boss';
      this.spawnExplosion(
        this.tmpVecA.set(
          robot.position.x,
          robot.position.y + robot.height * 0.5,
          robot.position.z,
        ),
        isBoss,
        isBoss ? 0xf59e0b : 0x38bdf8,
        robot.kind === 'final_boss' ? 42 : undefined,
      );
      if (!this.trainingMode) {
        this.spawnPortalLightStream(
          this.tmpVecA.set(robot.position.x, robot.position.y + robot.height * 0.5, robot.position.z),
        );
      }
      sound.playExplosion(isBoss, sloMo);
      return {
        killed: true,
        isBoss,
        pointsReward: robot.pointsReward,
        creditsReward: robot.creditsReward,
      };
    }
    return { killed: false, isBoss: false, pointsReward: 0, creditsReward: 0 };
  }

  public damageSwarmBot(
    bot: SwarmBot,
    amount: number,
    sound: ProceduralSoundEngine,
    sloMo: boolean,
  ): { killed: boolean; pointsReward: number; creditsReward: number } {
    if (!bot.alive) return { killed: false, pointsReward: 0, creditsReward: 0 };
    bot.hp = Math.max(0, bot.hp - Math.max(1, Math.round(amount)));
    if (bot.hp <= 0) {
      bot.alive = false;
      this.tmpMat4.makeScale(0, 0, 0);
      this.swarmBodyMesh.setMatrixAt(bot.idx, this.tmpMat4);
      this.swarmHeadMesh.setMatrixAt(bot.idx, this.tmpMat4);
      this.swarmVisorMesh.setMatrixAt(bot.idx, this.tmpMat4);
      this.swarmBodyMesh.instanceMatrix.needsUpdate = true;
      this.swarmHeadMesh.instanceMatrix.needsUpdate = true;
      this.swarmVisorMesh.instanceMatrix.needsUpdate = true;

      this.spawnExplosion(
        this.tmpVecA.set(bot.position.x, bot.position.y + bot.height * 0.5, bot.position.z),
        false,
        0x38bdf8,
      );
      this.spawnPortalLightStream(
        this.tmpVecA.set(bot.position.x, bot.position.y + bot.height * 0.5, bot.position.z),
      );
      sound.playExplosion(false, sloMo);
      const swarmPts = bot.kind === 'hunter' ? 2 : 1;
      const swarmCredits = Math.round((bot.kind === 'hunter' ? 65 : 30) * this.difficultyMults.rewardMult);
      return {
        killed: true,
        pointsReward:
          this.difficultyMults.rewardMult > 1.1
            ? Math.max(1, Math.round(swarmPts * this.difficultyMults.rewardMult))
            : swarmPts,
        creditsReward: swarmCredits,
      };
    }
    return { killed: false, pointsReward: 0, creditsReward: 0 };
  }

  public spawnImpactSpark(center: THREE.Vector3, count = 7): void {
    let spawned = 0;
    for (const s of this.shards) {
      if (s.active) continue;
      s.active = true;
      s.pos.copy(center);
      const speed = 7 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.3) * Math.PI;
      s.vel.set(
        Math.cos(theta) * Math.cos(phi) * speed,
        Math.abs(Math.sin(phi)) * speed + 2,
        Math.sin(theta) * Math.cos(phi) * speed,
      );
      s.rot.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      s.rotVel.set(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18,
      );
      s.scale = 0.36;
      s.maxLife = 0.28 + Math.random() * 0.14;
      s.life = s.maxLife;
      spawned++;
      if (spawned >= count) break;
    }
  }

  public wipeNearbyBuildings(
    center: THREE.Vector3,
    radius: number,
    arena: ArenaLevelData,
    sound: ProceduralSoundEngine,
  ): number {
    let wipedCount = 0;
    for (const b of arena.destructibleBuildings) {
      if (b.destroyed) continue;
      if (b.center.distanceTo(center) <= radius + Math.max(b.width, b.depth) * 0.5) {
        b.destroyed = true;
        b.group.visible = false;
        wipedCount++;
        this.spawnExplosion(b.center, true, 0xeab308);
      }
    }
    if (wipedCount > 0) {
      sound.playBuildingCollapse();
    }
    return wipedCount;
  }

  public spawnExplosion(
    center: THREE.Vector3,
    isBoss = false,
    colorHex = 0x38bdf8,
    radiusOverride?: number,
  ): void {
    const slot = this.explosions.find((e) => !e.active) ?? this.explosions[0];
    slot.active = true;
    slot.pos.copy(center);
    slot.age = 0;
    slot.duration = isBoss ? 1.15 : 0.65;
    slot.maxRadius = radiusOverride ?? (isBoss ? 18 : 7.5);
    slot.sphere.position.copy(center);
    slot.ring.position.copy(center);
    (slot.sphere.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
    (slot.ring.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
    slot.sphere.visible = true;
    slot.ring.visible = true;

    const shardCount = isBoss ? 40 : 14;
    let spawned = 0;
    for (const s of this.shards) {
      if (s.active) continue;
      s.active = true;
      s.pos.copy(center);
      const speed = (isBoss ? 24 : 13) + Math.random() * 16;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.25) * Math.PI;
      s.vel.set(
        Math.cos(theta) * Math.cos(phi) * speed,
        Math.abs(Math.sin(phi)) * speed + 5,
        Math.sin(theta) * Math.cos(phi) * speed,
      );
      s.rot.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      s.rotVel.set(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
      );
      s.scale = radiusOverride ? 2.4 : isBoss ? 1.55 : 0.9;
      s.maxLife = (isBoss ? 1.15 : 0.75) + Math.random() * 0.35;
      s.life = s.maxLife;
      spawned++;
      if (spawned >= shardCount) break;
    }
  }

  private hasLineOfSight(
    from: THREE.Vector3,
    to: THREE.Vector3,
    colliders: ArenaPlatformBox[],
    buildings: DestructibleBuilding[],
  ): boolean {
    if (this.outsideWorldMode) return true;
    const steps = 6;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = THREE.MathUtils.lerp(from.x, to.x, t);
      const py = THREE.MathUtils.lerp(from.y, to.y, t);
      const pz = THREE.MathUtils.lerp(from.z, to.z, t);
      for (const box of colliders) {
        if (box.buildingId !== undefined && buildings[box.buildingId]?.destroyed) continue;
        if (
          px > box.minX &&
          px < box.maxX &&
          py > box.minY &&
          py < box.maxY &&
          pz > box.minZ &&
          pz < box.maxZ
        ) {
          return false;
        }
      }
    }
    return true;
  }

  public update(
    arena: ArenaLevelData,
    simDt: number,
    realDt: number,
    playerEyePos: THREE.Vector3,
    playerVel: THREE.Vector3,
    cameraQuat: THREE.Quaternion,
    noiseLevel: NoiseLevel,
    gunshotNoiseTimer: number,
    playerHints: PlayerCombatHints,
    windEffectsEnabled: boolean,
    sound: ProceduralSoundEngine,
    sloMo: boolean,
    onPlayerHit: (dmg: number) => void,
    onBlockDeflect: () => void,
    onBossPowerEffect: (power: BossPowerId, pushVec: THREE.Vector3) => void,
    onAllyKilledRobot: (credits: number, pts: number) => void,
    onUltDodged?: () => void,
    onElementalHit?: (effect: 'cryo' | 'gravity' | 'shockwave', dir: THREE.Vector3) => void,
  ): void {
    const level = arena.level;
    const isFfa = arena.mode === 'ffa';
    if (arena.mode === 'glitch_lv0' && this.glitchChoice === 'run') {
      this.glitchChaseTime += simDt;
    }

    const hearingRadius =
      gunshotNoiseTimer > 0
        ? 72
        : noiseLevel === 'silent'
          ? 0
          : noiseLevel === 'loud'
            ? 60
            : 28;

    const speedScale = (1.12 + Math.min(1.25, level * 0.017)) * this.difficultyMults.enemySpeedMult;
    const boltSpeedBase = this.trainingMode
      ? 29
      : level <= 1
        ? 34
        : Math.min(76, 40 + level * 0.46);

    if (this.questBeaconMesh) {
      this.questBeaconMesh.rotation.y += realDt * 2.4;
      this.questBeaconMesh.position.y = 3.05 + Math.sin(performance.now() * 0.004) * 0.16;
    }

    // Animate Arena Laser Hazard Obstacles
    for (let l = 0; l < arena.laserObstacles.length; l++) {
      const las = arena.laserObstacles[l];
      las.phase += simDt * las.speed;
      if (las.kind === 'sweep') {
        const yOff = 1.6 + Math.sin(las.phase) * 1.45;
        las.p1.set(las.origin.x - las.length * 0.5, las.origin.y + yOff, las.origin.z);
        las.p2.set(las.origin.x + las.length * 0.5, las.origin.y + yOff, las.origin.z);
      } else if (las.kind === 'spinner') {
        const half = las.length * 0.5;
        const dx = Math.cos(las.phase) * half;
        const dz = Math.sin(las.phase) * half;
        las.p1.set(las.origin.x - dx, las.origin.y + 1.65, las.origin.z - dz);
        las.p2.set(las.origin.x + dx, las.origin.y + 1.65, las.origin.z + dz);
      }
      this.tmpVecA.addVectors(las.p1, las.p2).multiplyScalar(0.5);
      las.beamMesh.position.copy(this.tmpVecA);
      this.tmpVecB.subVectors(las.p2, las.p1);
      const beamLen = Math.max(0.5, this.tmpVecB.length());
      this.tmpVecB.divideScalar(beamLen);
      las.beamMesh.quaternion.setFromUnitVectors(this.tmpAxisY, this.tmpVecB);
      las.beamMesh.scale.set(1, beamLen, 1);
    }

    // Animate Flowing Light Streams heading into the Underground Portal!
    for (let i = 0; i < this.portalStreams.length; i++) {
      const ps = this.portalStreams[i];
      if (!ps.active) continue;
      ps.progress += realDt / ps.duration;
      if (ps.progress >= 1) {
        ps.active = false;
        ps.mesh.visible = false;
        this.pendingLightStreams = Math.max(0, this.pendingLightStreams - 1);
        this.arrivedLightStreams++;
        arena.goalLight.intensity = 65;
        continue;
      }
      const u = ps.progress;
      const inv = 1 - u;
      ps.mesh.position.set(
        inv * inv * ps.startPos.x + 2 * inv * u * ps.ctrlPos.x + u * u * ps.endPos.x,
        inv * inv * ps.startPos.y + 2 * inv * u * ps.ctrlPos.y + u * u * ps.endPos.y,
        inv * inv * ps.startPos.z + 2 * inv * u * ps.ctrlPos.z + u * u * ps.endPos.z,
      );
      ps.mesh.scale.setScalar(1.4 - u * 0.5);
    }

    this.bossLockLine.visible = false;
    this.bossLaserMesh.visible = false;
    let mimicLineIdx = 0;
    for (const line of this.mimicTetherLines) {
      line.visible = false;
    }

    const nowSec = performance.now() * 0.001;

    for (const r of this.robots) {
      if (!r.alive) {
        if (this.trainingMode && r.respawnTimer > 0) {
          r.respawnTimer -= realDt;
          if (r.respawnTimer <= 0) {
            r.alive = true;
            r.hp = r.maxHp;
            r.shrunkTimer = 0;
            r.stunTimer = 0;
            r.group.scale.setScalar(r.baseScale);
            r.position.copy(r.homePos);
            r.group.position.copy(r.position);
            r.group.rotation.x = 0;
            r.group.visible = true;
            r.alerted = false;
            r.fireCooldown = 1.4;
          }
        }
        continue;
      }

      if (r.zipDodgeCooldown > 0) {
        r.zipDodgeCooldown = Math.max(0, r.zipDodgeCooldown - simDt);
      }

      r.flankFlipTimer -= simDt;
      if (r.flankFlipTimer <= 0) {
        r.flankFlipTimer = 1.9 + Math.random() * 1.6;
        r.strafeSign *= -1;
      }

      const effScale = r.shrunkTimer > 0 ? r.baseScale * 0.48 : r.baseScale;
      if (r.shrunkTimer > 0) {
        r.shrunkTimer = Math.max(0, r.shrunkTimer - simDt);
      }
      r.group.scale.setScalar(effScale);

      if (r.flashTimer > 0) {
        r.flashTimer = Math.max(0, r.flashTimer - realDt);
        r.coreMesh.scale.setScalar(1.38);
      } else {
        r.coreMesh.scale.setScalar(1.0);
      }

      // Red Weak Point shines brighter whenever fighting & blazes crimson when boss is stunned!
      const isBossKind = r.kind === 'boss' || r.kind === 'final_boss';
      if (isBossKind && r.alerted) {
        if (r.stunTimer > 0) {
          r.stunTimer = Math.max(0, r.stunTimer - simDt);
          r.weakPointMat.emissiveIntensity = 5.4;
          r.weakPointMesh.scale.setScalar(1.42 + Math.sin(nowSec * 16) * 0.14);
          r.group.rotation.x = 0.28;
          if (r.bossUltSphere) r.bossUltSphere.visible = false;
          if (r.stunTimer <= 0) {
            r.group.rotation.x = 0;
            r.weakPointMesh.scale.setScalar(1.0);
          }
        } else {
          r.group.rotation.x = 0;
          r.weakPointMesh.scale.setScalar(1.0);
          r.stunCooldown -= simDt;
          if (r.stunCooldown <= 0 && r.ultChargingTimer <= 0 && r.laserActiveTimer <= 0) {
            r.stunTimer = r.stunMaxTimer;
            r.stunCooldown = 14.5;
            r.activeAbilityName = 'CORE OVERHEATED · STUNNED!';
            sound.playBossStun();
            this.spawnImpactSpark(this.getRobotWeakPointWorldPos(r, this.tmpVecA), 16);
          }
          r.weakPointMat.emissiveIntensity = 2.6 + Math.sin(nowSec * 8 + r.id) * 1.1;
        }
      } else {
        r.group.rotation.x = 0;
        r.weakPointMat.emissiveIntensity = r.alerted
          ? 2.4 + Math.sin(nowSec * 7.5 + r.id) * 1.15
          : 0.55;
        r.weakPointMesh.scale.setScalar(r.alerted ? 1.12 : 1.0);
      }

      if (r.meleeCooldown > 0) r.meleeCooldown = Math.max(0, r.meleeCooldown - simDt);

      // Acquire Target: in FFA bots can lock onto other living bots OR player!
      let targetPos = playerEyePos;
      let targetRobot: RobotUnit | null = null;
      if (isFfa) {
        r.alerted = true;
        let bestTargetDist = playerEyePos.distanceTo(r.position);
        for (const other of this.robots) {
          if (!other.alive || other.id === r.id) continue;
          const od = other.position.distanceTo(r.position);
          if (od < bestTargetDist * 0.92) {
            bestTargetDist = od;
            targetRobot = other;
          }
        }
        if (targetRobot) {
          targetPos = this.tmpPos.set(
            targetRobot.position.x,
            targetRobot.position.y + targetRobot.height * 0.55,
            targetRobot.position.z,
          );
        }
      }

      const toTarget = this.tmpVecA.subVectors(targetPos, r.position);
      const dist = toTarget.length();

      if (!r.alerted) {
        const heard = hearingRadius > 0 && dist <= hearingRadius;
        let seen = false;
        const sightRange =
          r.kind === 'final_boss' || r.kind === 'glitch_titan' || r.kind === 'giant_mimic'
            ? 500
            : r.kind === 'boss'
              ? 110
              : r.kind === 'mimic' || r.kind === 'hunter' || r.kind === 'spider'
                ? 68
                : 46;
        if (dist <= sightRange) {
          if (r.kind === 'boss' || r.kind === 'final_boss' || r.kind === 'glitch_titan') {
            seen = true;
          } else {
            const forward = this.tmpVecB.set(0, 0, 1).applyQuaternion(r.group.quaternion);
            const dirFlat = this.tmpVecC.set(toTarget.x, 0, toTarget.z).normalize();
            if (forward.dot(dirFlat) > 0.15) {
              const eyeOrigin = this.tmpVecC.set(
                r.position.x,
                r.position.y + r.height * 0.72,
                r.position.z,
              );
              seen = this.hasLineOfSight(
                eyeOrigin,
                targetPos,
                arena.colliders,
                arena.destructibleBuildings,
              );
            }
          }
        }
        if (heard || seen) r.alerted = true;
      } else if (
        noiseLevel === 'silent' &&
        dist > 82 &&
        r.kind !== 'boss' &&
        r.kind !== 'final_boss' &&
        r.kind !== 'glitch_titan' &&
        r.kind !== 'giant_mimic'
      ) {
        r.alerted = false;
      }

      r.patrolPhase += simDt * (r.kind === 'drone' || r.kind === 'spider' ? 2.6 : 1.75) * speedScale;

      if (r.kind === 'glitch_titan') {
        // Glitch Titan relentlessly pursues!
        const flatDir = this.tmpVecB.set(toTarget.x, 0, toTarget.z);
        const flatDist = Math.max(0.1, flatDir.length());
        flatDir.divideScalar(flatDist);
        if (this.glitchChoice === 'run') {
          const chaseSpd = this.getGlitchTitanChaseSpeed();
          r.position.x += flatDir.x * chaseSpd * simDt;
          r.position.z += flatDir.z * chaseSpd * simDt;
          if (flatDist < 42) {
            onPlayerHit(999999);
          }
        } else if (this.glitchChoice === 'fight') {
          const chaseSpd = 26;
          r.position.x += flatDir.x * chaseSpd * simDt;
          r.position.z += flatDir.z * chaseSpd * simDt;
        }
      } else if (r.kind === 'spider') {
        // Articulated 8-leg scutter animation + fast sprint-tier chase!
        if (r.spiderLegs) {
          for (let l = 0; l < r.spiderLegs.length; l++) {
            const side = l < 4 ? -1 : 1;
            const swing = Math.sin(r.patrolPhase * 3.8 + l * 1.1) * 0.36;
            r.spiderLegs[l].rotation.y = swing * side;
            r.spiderLegs[l].rotation.z = Math.cos(r.patrolPhase * 3.8 + l * 1.1) * 0.14;
          }
        }
        if (r.alerted) {
          const flatDir = this.tmpVecB.set(toTarget.x, 0, toTarget.z);
          const flatDist = Math.max(0.1, flatDir.length());
          flatDir.divideScalar(flatDist);
          const strafeX = -flatDir.z * Math.sin(r.patrolPhase * 1.3) * r.strafeSign;
          const strafeZ = flatDir.x * Math.sin(r.patrolPhase * 1.3) * r.strafeSign;
          const spd = 22.5 * speedScale;
          const chase = flatDist > 5 ? 0.96 : -0.3;
          r.position.x += (flatDir.x * chase + strafeX * 0.6) * spd * simDt;
          r.position.z += (flatDir.z * chase + strafeZ * 0.6) * spd * simDt;
        } else {
          const px = r.homePos.x + Math.sin(r.patrolPhase) * r.patrolRadius * 0.8;
          r.position.x = THREE.MathUtils.lerp(r.position.x, px, Math.min(1, simDt * 3.2));
        }
      } else if (r.kind === 'drone') {
        const orbitR = r.alerted ? 15 : r.patrolRadius;
        const centerX = r.alerted ? THREE.MathUtils.lerp(r.homePos.x, targetPos.x, 0.55) : r.homePos.x;
        const centerZ = r.alerted ? THREE.MathUtils.lerp(r.homePos.z, targetPos.z, 0.55) : r.homePos.z;
        const targetX = centerX + Math.cos(r.patrolPhase) * orbitR;
        const targetZ = centerZ + Math.sin(r.patrolPhase) * orbitR;
        const targetY = r.alerted
          ? Math.max(4, targetPos.y + 4 + Math.sin(r.patrolPhase * 2) * 3)
          : r.homePos.y + Math.sin(r.patrolPhase * 2.1) * 2.2;
        r.position.x = THREE.MathUtils.lerp(r.position.x, targetX, Math.min(1, simDt * 4.2));
        r.position.y = THREE.MathUtils.lerp(r.position.y, targetY, Math.min(1, simDt * 3.6));
        r.position.z = THREE.MathUtils.lerp(r.position.z, targetZ, Math.min(1, simDt * 4.2));
      } else if (r.kind === 'mimic' || r.kind === 'giant_mimic') {
        const isGiant = r.kind === 'giant_mimic';
        r.mimicBlocking = r.alerted && playerHints.isBlocking;
        if (r.blockShieldMesh) r.blockShieldMesh.visible = r.mimicBlocking;

        if (r.alerted) {
          const flatDir = this.tmpVecB.set(toTarget.x, 0, toTarget.z);
          const flatDist = Math.max(0.1, flatDir.length());
          flatDir.divideScalar(flatDist);

          if ((playerHints.isSwinging || playerHints.isZipping) && arena.grappleNodes.length > 0) {
            if (!r.mimicSwingingNode || r.mimicSwingingNode.position.distanceTo(r.position) > 90) {
              let bestNode: GrappleNode | null = null;
              let bestD = 95;
              for (const node of arena.grappleNodes) {
                const nd = node.position.distanceTo(r.position);
                if (nd < bestD) {
                  bestD = nd;
                  bestNode = node;
                }
              }
              r.mimicSwingingNode = bestNode;
            }
            const swingSpeed = (isGiant ? 32 : 23.5) * speedScale;
            r.position.x += flatDir.x * swingSpeed * simDt;
            r.position.z += flatDir.z * swingSpeed * simDt;
            if (!isGiant) {
              const targetY = Math.max(r.homePos.y, targetPos.y - 1.5);
              r.position.y = THREE.MathUtils.lerp(r.position.y, targetY, Math.min(1, simDt * 4.5));
            }

            if (r.mimicSwingingNode && mimicLineIdx < this.mimicTetherLines.length) {
              const line = this.mimicTetherLines[mimicLineIdx];
              const arr = this.mimicTetherPositions[mimicLineIdx];
              arr[0] = r.position.x;
              arr[1] = r.position.y + (isGiant ? 28 : 1.8);
              arr[2] = r.position.z;
              arr[3] = r.mimicSwingingNode.position.x;
              arr[4] = r.mimicSwingingNode.position.y;
              arr[5] = r.mimicSwingingNode.position.z;
              (line.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
              line.visible = true;
              mimicLineIdx++;
            }
          } else {
            r.mimicSwingingNode = null;
            r.position.y = THREE.MathUtils.lerp(r.position.y, r.homePos.y, Math.min(1, simDt * 6));
            const strafeX = -flatDir.z * r.strafeSign;
            const strafeZ = flatDir.x * r.strafeSign;
            const mimicSpd = (isGiant ? 29 : playerHints.slashedRecently ? 23 : 19) * speedScale;
            const chase = flatDist > (isGiant ? 18 : 3.5) ? 0.95 : -0.25;
            r.position.x += (flatDir.x * chase + strafeX * 0.55) * mimicSpd * simDt;
            r.position.z += (flatDir.z * chase + strafeZ * 0.55) * mimicSpd * simDt;
          }
        } else {
          r.mimicSwingingNode = null;
          const px = r.homePos.x + Math.sin(r.patrolPhase) * r.patrolRadius * 0.65;
          r.position.x = THREE.MathUtils.lerp(r.position.x, px, Math.min(1, simDt * 2.5));
        }
      } else if (r.kind === 'hunter') {
        if (r.alerted) {
          const flatDir = this.tmpVecB.set(toTarget.x, 0, toTarget.z);
          const flatDist = Math.max(0.1, flatDir.length());
          flatDir.divideScalar(flatDist);

          r.dashCooldown -= simDt;
          if (r.dashTimer > 0) {
            r.dashTimer -= simDt;
            r.position.x += r.dashVel.x * simDt;
            r.position.z += r.dashVel.z * simDt;
          } else if (r.dashCooldown <= 0 && flatDist < 34 && flatDist > 5) {
            r.dashTimer = 0.42;
            r.dashCooldown = 2.8;
            r.dashVel.copy(flatDir).multiplyScalar(27 * speedScale);
          } else {
            const strafeX = -flatDir.z * r.strafeSign;
            const strafeZ = flatDir.x * r.strafeSign;
            const moveSpd = 17.5 * speedScale;
            const chaseFactor = flatDist > 5 ? 1 : -0.3;
            r.position.x += (flatDir.x * chaseFactor + strafeX * 0.45) * moveSpd * simDt;
            r.position.z += (flatDir.z * chaseFactor + strafeZ * 0.45) * moveSpd * simDt;
          }
        } else {
          const px = r.homePos.x + Math.sin(r.patrolPhase) * r.patrolRadius * 0.78;
          const pz = r.homePos.z + Math.cos(r.patrolPhase * 0.7) * r.patrolRadius * 0.45;
          r.position.x = THREE.MathUtils.lerp(r.position.x, px, Math.min(1, simDt * 2.4));
          r.position.z = THREE.MathUtils.lerp(r.position.z, pz, Math.min(1, simDt * 2.4));
        }
      } else if (r.kind === 'boss' || r.kind === 'final_boss') {
        const isFinalTitan = r.kind === 'final_boss';
        if (r.bossShieldDome) {
          r.bossShieldDome.rotation.y += realDt * 0.55;
          r.bossShieldDome.visible = r.shieldHp > 0;
        }
        if (r.bossSwordPivot) {
          if (r.swordSwingTimer > 0) {
            r.swordSwingTimer = Math.max(0, r.swordSwingTimer - simDt);
            const sp = 1 - r.swordSwingTimer / 0.9;
            r.bossSwordPivot.rotation.x = Math.sin(sp * Math.PI) * 1.45;
            r.bossSwordPivot.rotation.y = Math.cos(sp * Math.PI) * 0.85;
          } else {
            r.bossSwordPivot.rotation.x = Math.sin(r.patrolPhase * 0.7) * 0.12;
            r.bossSwordPivot.rotation.y = 0;
          }
        }

        if (r.stunTimer > 0) {
          // Stunned boss stays knelt and vulnerable!
          r.group.position.copy(r.position);
          continue;
        }
        if (r.alerted) {
          const flatDir = this.tmpVecB.set(toTarget.x, 0, toTarget.z);
          const flatDist = Math.max(0.1, flatDir.length());
          flatDir.divideScalar(flatDist);

          if (!isFinalTitan) {
            r.dashCooldown -= simDt;
            if (r.dashTimer > 0) {
              r.dashTimer -= simDt;
              r.position.x += r.dashVel.x * simDt;
              r.position.z += r.dashVel.z * simDt;
            } else if (r.dashCooldown <= 0 && flatDist < 58 && flatDist > 7) {
              r.dashTimer = 0.42;
              r.dashCooldown = 2.0;
              r.dashVel.copy(flatDir).multiplyScalar(32 * speedScale);
            } else {
              const strafeX = -flatDir.z * Math.sin(r.patrolPhase * 1.45);
              const strafeZ = flatDir.x * Math.sin(r.patrolPhase * 1.45);
              const bossSpd = 21.5 * speedScale;
              const chase = flatDist > 10 ? 0.92 : -0.35;
              r.position.x += (flatDir.x * chase + strafeX * 0.75) * bossSpd * simDt;
              r.position.z += (flatDir.z * chase + strafeZ * 0.75) * bossSpd * simDt;
            }
          } else {
            const strafeX = -flatDir.z * Math.sin(r.patrolPhase * 0.55);
            const strafeZ = flatDir.x * Math.sin(r.patrolPhase * 0.55);
            const chase = flatDist > 135 ? 0.85 : flatDist < 95 ? -0.3 : 0.1;
            r.position.x += (flatDir.x * chase + strafeX * 0.55) * 16 * simDt;
            r.position.z += (flatDir.z * chase + strafeZ * 0.55) * 16 * simDt;
          }

          r.lockOnTimer += simDt;
          const bossEye = this.tmpVecC.set(r.position.x, r.position.y + r.height * 0.78, r.position.z);
          const leadTime = Math.min(0.45, dist / 74);
          const predictedPos = this.tmpVecD
            .copy(targetPos)
            .addScaledVector(playerVel, targetRobot ? 0 : leadTime * 0.65);

          if (!targetRobot) {
            this.bossLockPositions[0] = bossEye.x;
            this.bossLockPositions[1] = bossEye.y;
            this.bossLockPositions[2] = bossEye.z;
            this.bossLockPositions[3] = predictedPos.x;
            this.bossLockPositions[4] = predictedPos.y;
            this.bossLockPositions[5] = predictedPos.z;
            (this.bossLockLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
            this.bossLockLine.visible = true;
          }

          const ultBlastRadius = isFinalTitan ? 135 : 34;
          if (r.ultChargingTimer > 0) {
            r.ultChargingTimer -= simDt;
            if (r.bossUltSphere) {
              r.bossUltSphere.visible = true;
              const prog = 1 - Math.max(0, r.ultChargingTimer) / r.ultMaxTimer;
              r.bossUltSphere.scale.setScalar(1 + prog * 1.8);
              r.bossUltSphere.rotation.y += realDt * 4;
            }
            if (r.ultChargingTimer <= 0) {
              if (r.bossUltSphere) r.bossUltSphere.visible = false;
              const ultCenter = r.position.clone().setY(r.position.y + r.height * 0.35);
              this.spawnExplosion(ultCenter, true, 0xf43f5e, isFinalTitan ? 65 : 26);
              sound.playExplosion(true, sloMo);
              this.wipeNearbyBuildings(r.position, isFinalTitan ? 75 : 22, arena, sound);

              if (!targetRobot && dist <= ultBlastRadius) {
                if (playerHints.dodgeIframesActive) {
                  onUltDodged?.();
                } else {
                  const rawUltDmg = Math.round(
                    r.attackDamage * (playerHints.isBlocking ? 0.35 : 1.0),
                  );
                  if (playerHints.isBlocking) onBlockDeflect();
                  onPlayerHit(rawUltDmg);
                  const push = flatDir.clone().multiplyScalar(isFinalTitan ? 44 : 28);
                  push.y = 18;
                  onBossPowerEffect('punch', push);
                }
              }
            }
          } else {
            r.ultCooldown -= simDt;
            if (r.ultCooldown <= 0 && dist < ultBlastRadius + 60) {
              r.ultChargingTimer = r.ultMaxTimer;
              r.ultCooldown = isFinalTitan ? 11.5 : 13.0;
              sound.playBossUltWarning();
            }
          }

          if (isFinalTitan) {
            if (r.laserActiveTimer > 0) {
              r.laserActiveTimer -= simDt;
              r.laserSweepAngle += simDt * 0.65;
              const aimTarget = targetPos.clone();
              aimTarget.x += Math.sin(r.laserSweepAngle) * 28;
              this.bossLaserMesh.position.copy(bossEye);
              this.bossLaserMesh.lookAt(aimTarget);
              this.bossLaserMesh.visible = true;

              const rayDir = aimTarget.clone().sub(bossEye).normalize();
              const toP = playerEyePos.clone().sub(bossEye);
              const proj = Math.max(0, toP.dot(rayDir));
              const closest = bossEye.clone().addScaledVector(rayDir, proj);
              if (
                closest.distanceTo(playerEyePos) < 4.5 &&
                !playerHints.dodgeIframesActive &&
                r.meleeCooldown <= 0
              ) {
                r.meleeCooldown = 0.45;
                const dmg = Math.round(r.attackDamage * (playerHints.isBlocking ? 0.25 : 0.75));
                if (playerHints.isBlocking) onBlockDeflect();
                onPlayerHit(dmg);
              }
            } else {
              r.laserCooldown -= simDt;
              if (r.laserCooldown <= 0 && dist < 380) {
                r.laserActiveTimer = 1.65;
                r.laserSweepAngle = -0.6;
                r.laserCooldown = 7.5;
                sound.playBossLaser();
              }
            }
          }

          r.powerCooldown -= simDt;
          if (r.powerCooldown <= 0 && r.bossPower) {
            r.powerCooldown = isFinalTitan ? 4.2 : 4.6;
            sound.playBossPower(r.bossPower);
            if (r.bossPower === 'punch' || isFinalTitan) {
              r.swordSwingTimer = 0.9;
              this.wipeNearbyBuildings(r.position, isFinalTitan ? 85 : 24, arena, sound);
              this.spawnExplosion(
                r.position.clone().setY(r.position.y + (isFinalTitan ? 24 : 2)),
                true,
                0xeab308,
                isFinalTitan ? 45 : 18,
              );
              const punchRange = isFinalTitan ? 115 : 20;
              if (!targetRobot && dist < punchRange && !playerHints.dodgeIframesActive) {
                const dmg = Math.round(r.attackDamage * (playerHints.isBlocking ? 0.25 : 1.0));
                if (playerHints.isBlocking) onBlockDeflect();
                onPlayerHit(dmg);
                const push = flatDir.clone().multiplyScalar(isFinalTitan ? 38 : 28);
                push.y = 15;
                onBossPowerEffect('punch', push);
              }
            } else {
              this.firePowerOrb(
                r.bossPower,
                bossEye,
                predictedPos,
                r.attackDamage,
                58,
              );
            }
          }
        }
      } else if (r.kind === 'void_assassin') {
        if (r.alerted) {
          const flatDir = this.tmpVecB.set(toTarget.x, 0, toTarget.z);
          const flatDist = Math.max(0.1, flatDir.length());
          flatDir.divideScalar(flatDist);
          r.blinkCooldown -= simDt;
          if (r.blinkCooldown <= 0 && flatDist > 8 && flatDist < 52) {
            r.blinkCooldown = 4.2;
            const behindX = targetPos.x - flatDir.x * 7.5 + r.strafeSign * -flatDir.z * 3.5;
            const behindZ = targetPos.z - flatDir.z * 7.5 + r.strafeSign * flatDir.x * 3.5;
            this.spawnImpactSpark(r.position.clone().setY(r.position.y + 1.4), 10);
            r.position.set(behindX, r.position.y, behindZ);
            this.spawnImpactSpark(r.position.clone().setY(r.position.y + 1.4), 10);
          } else {
            const strafeX = -flatDir.z * r.strafeSign;
            const strafeZ = flatDir.x * r.strafeSign;
            const spd = 23.0 * speedScale;
            const chase = flatDist > 5.5 ? 0.96 : -0.35;
            r.position.x += (flatDir.x * chase + strafeX * 0.72) * spd * simDt;
            r.position.z += (flatDir.z * chase + strafeZ * 0.72) * spd * simDt;
          }
        } else {
          const px = r.homePos.x + Math.sin(r.patrolPhase) * r.patrolRadius * 0.85;
          r.position.x = THREE.MathUtils.lerp(r.position.x, px, Math.min(1, simDt * 3));
        }
      } else if (r.kind === 'mecha_lancer') {
        if (r.alerted) {
          const orbitR = 14;
          const tx = targetPos.x + Math.cos(r.patrolPhase * 1.4) * orbitR * r.strafeSign;
          const tz = targetPos.z + Math.sin(r.patrolPhase * 1.4) * orbitR;
          const ty = Math.max(5.5, targetPos.y + 5.5 + Math.sin(r.patrolPhase * 2.2) * 3.5);
          r.position.x = THREE.MathUtils.lerp(r.position.x, tx, Math.min(1, simDt * 4.5));
          r.position.y = THREE.MathUtils.lerp(r.position.y, ty, Math.min(1, simDt * 4.0));
          r.position.z = THREE.MathUtils.lerp(r.position.z, tz, Math.min(1, simDt * 4.5));
        } else {
          r.position.x = r.homePos.x + Math.cos(r.patrolPhase) * r.patrolRadius;
          r.position.y = r.homePos.y + Math.sin(r.patrolPhase * 2) * 2.5;
        }
      } else {
        // Cryo Stalker, Pyro Bomber, Volt Sniper, Aegis Juggernaut, Scout, Trooper!
        if (r.alerted) {
          const flatDir = this.tmpVecB.set(toTarget.x, 0, toTarget.z);
          const flatDist = Math.max(0.1, flatDir.length());
          flatDir.divideScalar(flatDist);
          const strafeX = -flatDir.z * Math.sin(r.patrolPhase * 1.25) * r.strafeSign;
          const strafeZ = flatDir.x * Math.sin(r.patrolPhase * 1.25) * r.strafeSign;
          const spd =
            r.kind === 'cryo_stalker'
              ? 21.5 * speedScale
              : r.kind === 'volt_sniper'
                ? 18.0 * speedScale
                : r.kind === 'pyro_bomber'
                  ? 17.0 * speedScale
                  : r.kind === 'aegis_juggernaut'
                    ? 14.5 * speedScale
                    : (r.kind === 'scout' ? 19.5 : 17.5) * speedScale;
          const preferredDist = r.kind === 'volt_sniper' ? 28 : r.kind === 'pyro_bomber' ? 16 : 6.5;
          const chase = flatDist > preferredDist ? 0.92 : flatDist < preferredDist * 0.65 ? -0.55 : 0.1;
          r.position.x += (flatDir.x * chase + strafeX * 0.65) * spd * simDt;
          r.position.z += (flatDir.z * chase + strafeZ * 0.65) * spd * simDt;
        } else {
          const patrolX = r.homePos.x + Math.sin(r.patrolPhase) * r.patrolRadius * 0.72;
          r.position.x = THREE.MathUtils.lerp(r.position.x, patrolX, Math.min(1, simDt * 2.4));
        }
      }

      if (r.kind !== 'glitch_titan' && !isFfa && !this.outsideWorldMode) {
        r.position.x = THREE.MathUtils.clamp(
          r.position.x,
          r.homePos.x - r.patrolRadius * 1.45,
          r.homePos.x + r.patrolRadius * 1.45,
        );
        r.position.z = THREE.MathUtils.clamp(
          r.position.z,
          r.homePos.z - r.patrolRadius * 1.45,
          r.homePos.z + r.patrolRadius * 1.45,
        );
      }

      r.group.position.copy(r.position);

      if (r.alerted) {
        const yaw = Math.atan2(targetPos.x - r.position.x, targetPos.z - r.position.z);
        r.group.rotation.y = yaw;
      } else {
        r.group.rotation.y = Math.cos(r.patrolPhase) >= 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      }

      const effDamage = r.shrunkTimer > 0 ? Math.round(r.attackDamage * 0.5) : r.attackDamage;

      if (
        r.alerted &&
        r.meleeCooldown <= 0 &&
        dist < r.radius + 2.4 &&
        Math.abs(targetPos.y - (r.position.y + r.height * 0.5)) < r.height
      ) {
        r.meleeCooldown = r.kind === 'boss' || r.kind === 'final_boss' || r.kind === 'glitch_titan' ? 1.0 : 1.2;
        if (targetRobot) {
          this.damageRobot(targetRobot, effDamage, sound, sloMo);
        } else if (!playerHints.dodgeIframesActive) {
          const dmg = Math.round(effDamage * (playerHints.isBlocking ? 0.2 : 1.0));
          if (playerHints.isBlocking) onBlockDeflect();
          onPlayerHit(dmg);
        }
      }

      if (r.alerted && r.kind !== 'glitch_titan' && r.stunTimer <= 0) {
        r.fireCooldown -= simDt;
        const shouldMimicFire =
          (r.kind === 'mimic' || r.kind === 'giant_mimic') &&
          (playerHints.firedRecently || (playerHints.gunEquipped && r.fireCooldown <= 0));

        if ((r.fireCooldown <= 0 || shouldMimicFire) && dist < (r.kind === 'final_boss' ? 420 : 118)) {
          const eyeOrigin = this.tmpVecE.set(
            r.position.x,
            r.position.y + r.height * 0.74,
            r.position.z,
          );
          if (
            r.kind === 'boss' ||
            r.kind === 'final_boss' ||
            r.kind === 'giant_mimic' ||
            this.hasLineOfSight(
              eyeOrigin,
              targetPos,
              arena.colliders,
              arena.destructibleBuildings,
            )
          ) {
            this.executeRobotAbility(
              r,
              eyeOrigin,
              targetPos,
              playerVel,
              dist,
              effDamage,
              boltSpeedBase,
              sound,
              targetRobot,
              onElementalHit,
            );
          } else {
            r.fireCooldown = 0.4;
          }
        }
      }
    }

    // --- UPDATE 150-BOT SWARM (Outside World) ---
    if (this.outsideWorldMode && this.swarmBots.length > 0) {
      let swarmFiresThisFrame = 0;
      for (let i = 0; i < this.swarmBots.length; i++) {
        const b = this.swarmBots[i];
        if (!b.alive) continue;

        b.phase += simDt * (b.kind === 'drone' ? 2.1 : 1.45);
        const dx = playerEyePos.x - b.position.x;
        const dz = playerEyePos.z - b.position.z;
        const distSq = dx * dx + dz * dz;
        const dist = Math.sqrt(distSq);
        b.yaw = Math.atan2(dx, dz);

        if (dist < 280) {
          const inv = dist > 0.1 ? 1 / dist : 0;
          const dirX = dx * inv;
          const dirZ = dz * inv;
          const strafeX = -dirZ * Math.sin(b.phase);
          const strafeZ = dirX * Math.sin(b.phase);
          const chase = dist > 18 ? 0.85 : -0.25;
          const spd = b.kind === 'drone' ? 19 : b.kind === 'hunter' ? 18 : 16;
          b.position.x += (dirX * chase + strafeX * 0.45) * spd * simDt;
          b.position.z += (dirZ * chase + strafeZ * 0.45) * spd * simDt;
          if (b.kind === 'drone') {
            b.position.y = Math.max(8, playerEyePos.y + 4 + Math.sin(b.phase * 1.5) * 4);
          }

          b.fireCooldown -= simDt;
          if (b.fireCooldown <= 0 && dist < 130 && swarmFiresThisFrame < 4) {
            swarmFiresThisFrame++;
            b.fireCooldown = 2.2 + Math.random() * 1.6;
            this.tmpPos.set(b.position.x, b.position.y + b.height * 0.72, b.position.z);
            this.fireBolt(this.bolts, false, -1, this.tmpPos, playerEyePos, b.attackDamage, 52, 0);
          } else if (b.fireCooldown <= 0) {
            b.fireCooldown = 0.6 + Math.random();
          }
        }
      }
      this.syncSwarmMatrices();
    }

    // Update Recruited Allies
    for (let i = 0; i < this.allies.length; i++) {
      const a = this.allies[i];
      if (!a.alive || !a.recruited) continue;

      const sideOffset = (i % 2 === 0 ? -1 : 1) * 3.4;
      const followTargetX = playerEyePos.x + sideOffset;
      const followTargetY = Math.max(0, playerEyePos.y - 1.85);
      const followTargetZ = playerEyePos.z + 3.2 + i * 1.4;

      const dx = followTargetX - a.position.x;
      const dz = followTargetZ - a.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 2.8) {
        const step = Math.min(d, 16.5 * simDt);
        a.position.x += (dx / d) * step;
        a.position.z += (dz / d) * step;
      }
      a.position.y = THREE.MathUtils.lerp(a.position.y, followTargetY, Math.min(1, simDt * 6));
      a.group.position.copy(a.position);

      let nearestBot: RobotUnit | null = null;
      let nearestDist = 56;
      for (const r of this.robots) {
        if (!r.alive) continue;
        const rd = r.position.distanceTo(a.position);
        if (rd < nearestDist) {
          nearestDist = rd;
          nearestBot = r;
        }
      }

      if (nearestBot) {
        a.group.rotation.y = Math.atan2(
          nearestBot.position.x - a.position.x,
          nearestBot.position.z - a.position.z,
        );
        a.fireCooldown -= simDt;
        if (a.fireCooldown <= 0) {
          a.fireCooldown = 1.15;
          const origin = this.tmpVecD.set(a.position.x, a.position.y + 1.45, a.position.z);
          const target = this.tmpVecE.set(
            nearestBot.position.x,
            nearestBot.position.y + nearestBot.height * 0.55,
            nearestBot.position.z,
          );
          this.fireBolt(this.allyBolts, true, -1, origin, target, 24, 52, 0);
        }
      }
    }

    // Update Enemy Bolts (including FFA robot-vs-robot hits!)
    for (const b of this.bolts) {
      if (!b.active) continue;
      b.life -= simDt;
      if (b.life <= 0) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }
      if (b.homing && !b.fromAlly) {
        const toPlayer = this.tmpVecC.subVectors(playerEyePos, b.pos);
        const dLen = toPlayer.length();
        if (dLen > 0.1 && dLen < 65) {
          toPlayer.divideScalar(dLen);
          const spd = b.vel.length();
          b.vel.lerp(this.tmpVecD.copy(toPlayer).multiplyScalar(spd), Math.min(1, simDt * 2.4));
        }
      }
      b.pos.addScaledVector(b.vel, simDt);
      b.mesh.position.copy(b.pos);

      const blockRadiusSq = playerHints.isBlocking ? 2.25 * 2.25 : 1.38 * 1.38;
      if (b.pos.distanceToSquared(playerEyePos) < blockRadiusSq) {
        b.active = false;
        b.mesh.visible = false;
        if (b.explosive) {
          this.spawnExplosion(b.pos, false, 0xf97316, b.shockwaveRadius || 7);
        }
        if (playerHints.dodgeIframesActive) {
          continue;
        } else if (playerHints.isBlocking) {
          onBlockDeflect();
        } else {
          onPlayerHit(b.damage);
          if (b.cryoSlow) {
            onElementalHit?.('cryo', b.vel);
          } else if (b.gravityPull) {
            onElementalHit?.('gravity', this.tmpVecD.subVectors(playerEyePos, b.pos).negate());
          } else if (b.explosive) {
            onElementalHit?.('shockwave', b.vel);
          }
        }
        continue;
      }

      if (isFfa) {
        let hitOtherBot = false;
        for (const r of this.robots) {
          if (!r.alive || r.id === b.ownerRobotId) continue;
          const ry = r.position.y + r.height * 0.55;
          const rdx = b.pos.x - r.position.x;
          const rdy = b.pos.y - ry;
          const rdz = b.pos.z - r.position.z;
          if (rdx * rdx + rdy * rdy + rdz * rdz < (r.radius + 0.6) * (r.radius + 0.6)) {
            b.active = false;
            b.mesh.visible = false;
            this.damageRobot(r, b.damage * 1.6, sound, sloMo);
            hitOtherBot = true;
            break;
          }
        }
        if (hitOtherBot) continue;
      }

      for (const a of this.allies) {
        if (!a.alive || !a.recruited) continue;
        const allyCenterY = a.position.y + 1.25;
        const adx = b.pos.x - a.position.x;
        const ady = b.pos.y - allyCenterY;
        const adz = b.pos.z - a.position.z;
        if (adx * adx + ady * ady + adz * adz < 1.25 * 1.25) {
          b.active = false;
          b.mesh.visible = false;
          a.hp = Math.max(0, a.hp - b.damage);
          if (a.hp <= 0) {
            a.alive = false;
            a.group.visible = false;
            this.spawnExplosion(a.position.clone().setY(allyCenterY), false);
          }
          break;
        }
      }
    }

    for (const b of this.powerBolts) {
      if (!b.active) continue;
      b.life -= simDt;
      if (b.life <= 0) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }
      b.pos.addScaledVector(b.vel, simDt);
      b.mesh.position.copy(b.pos);

      const hitRadiusSq = playerHints.isBlocking ? 2.5 * 2.5 : 2.1 * 2.1;
      if (b.pos.distanceToSquared(playerEyePos) < hitRadiusSq) {
        b.active = false;
        b.mesh.visible = false;
        if (playerHints.dodgeIframesActive) continue;
        const col =
          b.powerKind === 'water' ? 0x0ea5e9 : b.powerKind === 'shrink' ? 0xd946ef : 0xf97316;
        this.spawnExplosion(b.pos, false, col);

        if (playerHints.isBlocking) {
          onBlockDeflect();
        } else {
          onPlayerHit(b.damage);
          if (b.powerKind) {
            const push = b.vel
              .clone()
              .setY(0)
              .normalize()
              .multiplyScalar(b.powerKind === 'water' ? 24 : 10);
            push.y = b.powerKind === 'water' ? 11 : 5;
            onBossPowerEffect(b.powerKind, push);
          }
        }
      }
    }

    for (const b of this.allyBolts) {
      if (!b.active) continue;
      b.life -= simDt;
      if (b.life <= 0) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }
      b.pos.addScaledVector(b.vel, simDt);
      b.mesh.position.copy(b.pos);

      for (const r of this.robots) {
        if (!r.alive) continue;
        const ry = r.position.y + r.height * 0.55;
        const rdx = b.pos.x - r.position.x;
        const rdy = b.pos.y - ry;
        const rdz = b.pos.z - r.position.z;
        if (rdx * rdx + rdy * rdy + rdz * rdz < (r.radius + 0.6) * (r.radius + 0.6)) {
          b.active = false;
          b.mesh.visible = false;
          const res = this.damageRobot(r, b.damage, sound, sloMo);
          if (res.killed) {
            onAllyKilledRobot(res.creditsReward, res.pointsReward);
          }
          break;
        }
      }
    }

    for (const e of this.explosions) {
      if (!e.active) continue;
      e.age += simDt;
      const t = e.age / e.duration;
      if (t >= 1) {
        e.active = false;
        e.sphere.visible = false;
        e.ring.visible = false;
        continue;
      }
      const easeOut = 1 - Math.pow(1 - t, 3);
      e.sphere.scale.setScalar(Math.max(0.1, easeOut * e.maxRadius * 0.78));
      (e.sphere.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.72;

      e.ring.scale.setScalar(Math.max(0.1, easeOut * e.maxRadius * 1.45));
      (e.ring.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.9;
    }

    this.updateShardPool(this.shards, this.shardMesh, simDt);

    const speedMps = playerVel.length();
    const showWind = windEffectsEnabled && speedMps > 14;
    if (!showWind) {
      this.windMesh.visible = false;
    } else {
      this.windMesh.visible = true;
      const moveDir = this.tmpVecA.copy(playerVel);
      if (moveDir.lengthSq() > 0.01) moveDir.normalize();
      else moveDir.set(0, 0, -1).applyQuaternion(cameraQuat);

      const orientQuat = this.tmpQuat.setFromUnitVectors(
        this.tmpVecB.set(0, 0, 1),
        moveDir,
      );
      const streakLenScale = THREE.MathUtils.clamp((speedMps - 12) / 14, 0.8, 3.8);

      for (let i = 0; i < this.windNeedles.length; i++) {
        const w = this.windNeedles[i];
        w.pos.addScaledVector(moveDir, -speedMps * 1.15 * realDt);

        const distSq = w.pos.distanceToSquared(playerEyePos);
        if (distSq > 34 * 34) {
          const fwd = this.tmpVecC
            .copy(moveDir)
            .multiplyScalar(18 + Math.random() * 14);
          w.pos.copy(playerEyePos).add(fwd);
          w.pos.x += (Math.random() - 0.5) * 24;
          w.pos.y += (Math.random() - 0.5) * 16;
          w.pos.z += (Math.random() - 0.5) * 24;
        }

        this.tmpScale.set(1, 1, w.len * streakLenScale);
        this.tmpMat4.compose(w.pos, orientQuat, this.tmpScale);
        this.windMesh.setMatrixAt(i, this.tmpMat4);
      }
      this.windMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private firePowerOrb(
    power: BossPowerId,
    origin: THREE.Vector3,
    target: THREE.Vector3,
    damage: number,
    speed: number,
  ): void {
    const slot = this.powerBolts.find((b) => !b.active) ?? this.powerBolts[0];
    slot.active = true;
    slot.powerKind = power;
    slot.pos.copy(origin);
    const dir = target.clone().sub(origin).normalize();
    slot.vel.copy(dir).multiplyScalar(speed);
    slot.damage = damage;
    slot.life = 3.2;
    const mat = slot.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(power === 'water' ? 0x0ea5e9 : power === 'shrink' ? 0xd946ef : 0xf97316);
    slot.mesh.position.copy(origin);
    slot.mesh.visible = true;
  }

  private updateShardPool(
    pool: DebrisShard[],
    mesh: THREE.InstancedMesh,
    simDt: number,
  ): void {
    let dirty = false;
    for (let i = 0; i < pool.length; i++) {
      const s = pool[i];
      if (!s.active) continue;
      dirty = true;
      s.life -= simDt;
      if (s.life <= 0) {
        s.active = false;
        this.tmpMat4.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, this.tmpMat4);
        continue;
      }
      s.vel.y -= 26 * simDt;
      s.pos.addScaledVector(s.vel, simDt);
      if (s.pos.y < 0.2) {
        s.pos.y = 0.2;
        s.vel.y = Math.abs(s.vel.y) * 0.35;
      }
      s.rot.x += s.rotVel.x * simDt;
      s.rot.y += s.rotVel.y * simDt;
      s.rot.z += s.rotVel.z * simDt;

      const fade = Math.min(1, s.life / (s.maxLife * 0.4));
      this.tmpQuat.setFromEuler(s.rot);
      this.tmpScale.setScalar(s.scale * fade);
      this.tmpMat4.compose(s.pos, this.tmpQuat, this.tmpScale);
      mesh.setMatrixAt(i, this.tmpMat4);
    }
    if (dirty) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private executeRobotAbility(
    r: RobotUnit,
    origin: THREE.Vector3,
    targetPos: THREE.Vector3,
    playerVel: THREE.Vector3,
    dist: number,
    effDamage: number,
    boltSpeedBase: number,
    sound: ProceduralSoundEngine,
    targetRobot: RobotUnit | null,
    onElementalHit?: (effect: 'cryo' | 'gravity' | 'shockwave', dir: THREE.Vector3) => void,
  ): void {
    const spec: EnemyAbilitySpec = getEnemyAbilitySpec(r.abilityPoolStart + r.abilityOffset);
    r.abilityOffset = (r.abilityOffset + 1) % 200;
    r.activeAbilityName = `${spec.name} (#${spec.id + 1}/200)`;

    const lead = Math.min(0.45, dist / 74);
    const targetLead = this.tmpVecD
      .copy(targetPos)
      .addScaledVector(playerVel, targetRobot ? 0 : lead * 0.62);

    const speed =
      (r.kind === 'boss' || r.kind === 'final_boss' ? 74 : boltSpeedBase + 8) * spec.speedMult;
    const dmg = Math.max(2, Math.round(effDamage * spec.dmgMult));

    if (r.kind === 'spider') sound.playSpiderChirp();

    if (spec.pattern === 'burst_3') {
      this.fireBolt(this.bolts, false, r.id, origin, targetLead, dmg, speed, 0, spec);
      this.fireBolt(this.bolts, false, r.id, origin, targetLead, Math.round(dmg * 0.78), speed * 0.96, 0.075, spec);
      this.fireBolt(this.bolts, false, r.id, origin, targetLead, Math.round(dmg * 0.78), speed * 0.96, -0.075, spec);
    } else if (spec.pattern === 'fan_5') {
      for (let f = -2; f <= 2; f++) {
        this.fireBolt(this.bolts, false, r.id, origin, targetLead, Math.round(dmg * 0.68), speed * 0.92, f * 0.11, spec);
      }
    } else if (spec.pattern === 'spiral_ring') {
      const count = r.kind === 'boss' || r.kind === 'final_boss' ? 8 : 6;
      for (let s = 0; s < count; s++) {
        const ang = (s / count) * Math.PI * 2 + r.patrolPhase;
        this.fireBolt(this.bolts, false, r.id, origin, targetLead, Math.round(dmg * 0.72), speed * 0.85, ang, spec);
      }
    } else if (spec.pattern === 'sniper_lance') {
      this.fireBolt(this.bolts, false, r.id, origin, targetLead, Math.round(dmg * 1.3), speed * 1.45, 0, spec);
    } else if (spec.pattern === 'mortar_arc') {
      const lobTarget = this.tmpVecD.copy(targetLead);
      lobTarget.y += Math.min(12, dist * 0.22);
      this.fireBolt(this.bolts, false, r.id, origin, lobTarget, Math.round(dmg * 1.1), speed * 0.76, 0, spec);
      this.fireBolt(this.bolts, false, r.id, origin, lobTarget, Math.round(dmg * 0.85), speed * 0.78, 0.14, spec);
    } else if (spec.pattern === 'shockwave_slam' || spec.pattern === 'overload_nova') {
      this.spawnExplosion(origin, r.kind === 'boss' || r.kind === 'final_boss', spec.colorHex, 12);
      this.fireBolt(this.bolts, false, r.id, origin, targetLead, dmg, speed, 0.12, spec);
      this.fireBolt(this.bolts, false, r.id, origin, targetLead, dmg, speed, -0.12, spec);
      if (dist < 14) {
        onElementalHit?.('shockwave', this.tmpVecC.subVectors(targetPos, origin).normalize());
      }
    } else {
      this.fireBolt(this.bolts, false, r.id, origin, targetLead, dmg, speed, 0, spec);
    }

    const baseCd =
      r.kind === 'final_boss'
        ? 0.92
        : r.kind === 'boss'
          ? 1.12
          : this.trainingMode
            ? 2.0
            : r.kind === 'volt_sniper'
              ? 1.55
              : r.kind === 'mimic' || r.kind === 'giant_mimic'
                ? 0.85
                : 1.25;
    r.fireCooldown = baseCd * Math.max(0.68, 1.05 - (spec.speedMult - 1) * 0.45);
  }

  private fireBolt(
    pool: PlasmaBolt[],
    fromAlly: boolean,
    ownerRobotId: number,
    origin: THREE.Vector3,
    target: THREE.Vector3,
    damage: number,
    speed: number,
    yawOffset: number,
    abilitySpec?: EnemyAbilitySpec,
  ): void {
    const bolt = pool.find((b) => !b.active) ?? pool[0];
    bolt.active = true;
    bolt.fromAlly = fromAlly;
    bolt.ownerRobotId = ownerRobotId;
    bolt.homing = Boolean(abilitySpec?.homing);
    bolt.cryoSlow = Boolean(abilitySpec?.cryoSlow);
    bolt.explosive = Boolean(abilitySpec?.explosive);
    bolt.gravityPull = Boolean(abilitySpec?.gravityPull);
    bolt.shockwaveRadius = abilitySpec?.explosive ? 8 : 0;
    bolt.pos.copy(origin);
    const dir = this.tmpVecC.subVectors(target, origin).normalize();
    if (yawOffset !== 0) {
      dir.applyAxisAngle(this.tmpAxisY, yawOffset);
    }
    bolt.vel.copy(dir).multiplyScalar(speed);
    bolt.damage = damage;
    bolt.life = 3.2;
    if (!fromAlly && abilitySpec) {
      (bolt.mesh.material as THREE.MeshBasicMaterial).color.setHex(abilitySpec.colorHex);
      bolt.mesh.scale.setScalar(abilitySpec.explosive ? 1.45 : 1.0);
    } else if (!fromAlly) {
      (bolt.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xff3b3b);
      bolt.mesh.scale.setScalar(1.0);
    }
    bolt.mesh.position.copy(origin);
    bolt.mesh.visible = true;
  }

  public getAliveCount(): number {
    let c = 0;
    for (const r of this.robots) {
      if (r.alive) c++;
    }
    for (const b of this.swarmBots) {
      if (b.alive) c++;
    }
    return c;
  }

  public getBossUnit(): RobotUnit | undefined {
    return (
      this.robots.find((r) => r.kind === 'glitch_titan' && r.alive) ??
      this.robots.find((r) => r.kind === 'final_boss' && r.alive) ??
      this.robots.find((r) => r.kind === 'boss' && r.alive) ??
      this.robots.find((r) => r.kind === 'boss' || r.kind === 'final_boss' || r.kind === 'glitch_titan')
    );
  }

  public dispose(): void {
    this.clearLevelUnits();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.root.removeFromParent();
  }
}
