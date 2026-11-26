import * as THREE from 'three';
import {
  BossPowerId,
  GameMode,
  GlitchOutcomeChoice,
  MAX_LEVEL,
  OUTSIDE_WORLD_BOT_COUNT,
  getBossPowerForLevel,
  isBossLevelNumber,
  isRescueLevelNumber,
} from '../types/game';

export interface ArenaPlatformBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  isBoostPad?: boolean;
  boostVelocity?: number;
  buildingId?: number;
}

export interface GrappleNode {
  id: number;
  position: THREE.Vector3;
  radius: number;
  ringMesh: THREE.Mesh;
}

export interface DestructibleBuilding {
  id: number;
  center: THREE.Vector3;
  width: number;
  height: number;
  depth: number;
  colliderIndex: number;
  group: THREE.Group;
  destroyed: boolean;
}

export interface ArenaLaserObstacle {
  id: number;
  origin: THREE.Vector3;
  length: number;
  baseY: number;
  kind: 'sweep' | 'static_low' | 'static_high' | 'spinner';
  speed: number;
  phase: number;
  beamMesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  p1: THREE.Vector3;
  p2: THREE.Vector3;
}

export interface RobotSpawnSpec {
  kind:
    | 'scout'
    | 'trooper'
    | 'drone'
    | 'spider'
    | 'hunter'
    | 'mimic'
    | 'cryo_stalker'
    | 'pyro_bomber'
    | 'volt_sniper'
    | 'void_assassin'
    | 'aegis_juggernaut'
    | 'mecha_lancer'
    | 'giant_mimic'
    | 'boss'
    | 'final_boss'
    | 'glitch_titan';
  position: THREE.Vector3;
  patrolRadius: number;
  hpMultiplier: number;
  bossTier?: number;
  variantName?: string;
  levelVariantIdx?: number;
}

export type ArenaShapeName =
  | 'Helix Spire'
  | 'Hex Citadel'
  | 'Twin-Arch Canyon'
  | 'Diamond Labyrinth'
  | 'Suspended Bridges'
  | 'Stepped Pyramid'
  | 'Training Matrix'
  | 'Outside World'
  | 'Glitch Reality LV 0'
  | 'Glitch Endless Run'
  | 'FFA Colosseum'
  | 'Wave Fortress';

export interface ArenaLevelData {
  level: number;
  mode: GameMode;
  shapeName: ArenaShapeName;
  trainingMode: boolean;
  outsideWorldActive: boolean;
  isBossLevel: boolean;
  isRescueLevel: boolean;
  bossName: string | null;
  bossPower: BossPowerId | null;
  group: THREE.Group;
  colliders: ArenaPlatformBox[];
  grappleNodes: GrappleNode[];
  destructibleBuildings: DestructibleBuilding[];
  laserObstacles: ArenaLaserObstacle[];
  raycastMeshes: THREE.Object3D[];
  spawnPos: THREE.Vector3;
  npcQuestPos: THREE.Vector3;
  captiveSpawns: THREE.Vector3[];
  goalPos: THREE.Vector3;
  goalLight: THREE.PointLight;
  goalBeaconMat: THREE.MeshStandardMaterial;
  goalBeamMat: THREE.MeshBasicMaterial;
  goalPortalDiscMat: THREE.MeshBasicMaterial;
  goalRingMesh: THREE.Mesh;
  robotSpawns: RobotSpawnSpec[];
  getCorridorXRangeAtZ: (z: number) => { minX: number; maxX: number };
  bounds: {
    minX: number;
    maxX: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  dispose: () => void;
}

function createSeededRng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createObsidianTexture(
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
  isFloor = false,
  accentHex = '#06b6d4',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = isFloor ? '#060a12' : '#090f1a';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = isFloor ? '#0b1220' : '#0f1727';
  ctx.beginPath();
  ctx.moveTo(12, 12);
  ctx.lineTo(116, 20);
  ctx.lineTo(105, 116);
  ctx.lineTo(9, 106);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(138, 130);
  ctx.lineTo(243, 140);
  ctx.lineTo(235, 244);
  ctx.lineTo(130, 232);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 254, 254);

  ctx.strokeStyle = '#132035';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.stroke();

  ctx.fillStyle = accentHex;
  const corners = [
    [6, 6],
    [246, 6],
    [6, 246],
    [246, 246],
    [126, 126],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx, cy, 3, 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(4, maxAnisotropy);
  return tex;
}

function getBossName(level: number, mode: GameMode): string {
  if (mode === 'outside_world') return 'OMEGA-TITAN · WORLD ENDER (100x)';
  if (mode === 'glitch_lv0') return 'GLITCH TITAN NULL-0 · ∞ HP (1,000,000x)';
  const prefixes = [
    'PYRO',
    'LEVIATHAN',
    'BREAKER',
    'SINGULARITY',
    'HYPERION',
    'KRONOS',
    'VALKYRIE',
    'SOLARIS',
    'APEX',
    'ZENITH',
  ];
  const suffixes = [
    'TITAN',
    'WARDEN',
    'COLOSSUS',
    'OVERLORD',
    'EXECUTOR',
    'PRIME',
    'VANGUARD',
  ];
  const idx = Math.max(0, Math.floor(level / 5) - 1);
  const p = prefixes[idx % prefixes.length];
  const s = suffixes[Math.floor(idx / prefixes.length) % suffixes.length];
  return `${p} ${s} MK-${Math.floor(level / 5)}`;
}

const CAMPAIGN_SHAPES: ArenaShapeName[] = [
  'Helix Spire',
  'Hex Citadel',
  'Twin-Arch Canyon',
  'Diamond Labyrinth',
  'Suspended Bridges',
  'Stepped Pyramid',
];

const LEVEL_FEATURED_ROBOTS: Array<{
  kind: RobotSpawnSpec['kind'];
  name: string;
}> = [
  { kind: 'scout', name: 'Striker Scout Mk-I' },
  { kind: 'trooper', name: 'Laser Trooper Unit' },
  { kind: 'cryo_stalker', name: 'Cryo Stalker Alpha' },
  { kind: 'pyro_bomber', name: 'Pyro Bomber Vanguard' },
  { kind: 'spider', name: 'Arachnid Siege Bot' },
  { kind: 'volt_sniper', name: 'Volt Rail Sniper' },
  { kind: 'void_assassin', name: 'Void Blink Assassin' },
  { kind: 'aegis_juggernaut', name: 'Aegis Heavy Juggernaut' },
  { kind: 'mecha_lancer', name: 'Mecha Sky Lancer' },
  { kind: 'hunter', name: 'Apex Lock-Hunter' },
  { kind: 'cryo_stalker', name: 'Glacier Fang Stalker' },
  { kind: 'pyro_bomber', name: 'Magma Mortar Mech' },
  { kind: 'volt_sniper', name: 'Arc-Coil Marksman' },
  { kind: 'void_assassin', name: 'Phase Wraith Unit' },
  { kind: 'mimic', name: 'Mirror Doppel-Bot' },
  { kind: 'aegis_juggernaut', name: 'Bastion Siege Mech' },
  { kind: 'mecha_lancer', name: 'Hyper-Jet Lancer' },
  { kind: 'cryo_stalker', name: 'Sub-Zero Prowler' },
  { kind: 'pyro_bomber', name: 'Inferno Bombardier' },
  { kind: 'hunter', name: 'Overclocked Hunter' },
  { kind: 'volt_sniper', name: 'Tesla Beam Stalker' },
  { kind: 'void_assassin', name: 'Eclipse Shadow Blade' },
  { kind: 'aegis_juggernaut', name: 'Fortress Titanite' },
  { kind: 'mecha_lancer', name: 'Valkyrie Thruster Bot' },
  { kind: 'spider', name: 'Omega Widow Spider' },
  { kind: 'cryo_stalker', name: 'Frostbite Sprinter' },
  { kind: 'pyro_bomber', name: 'Solar Flak Bomber' },
  { kind: 'volt_sniper', name: 'Storm-Rail Overwatch' },
  { kind: 'void_assassin', name: 'Nightmare Blink Mech' },
  { kind: 'mimic', name: 'Abyssal Mirror Twin' },
  { kind: 'aegis_juggernaut', name: 'Ironclad Dreadnought' },
  { kind: 'mecha_lancer', name: 'Sonic Wing Lancer' },
  { kind: 'cryo_stalker', name: 'Cryo Nova Hound' },
  { kind: 'pyro_bomber', name: 'Vulcan Cluster Bot' },
  { kind: 'hunter', name: 'Siegebreaker Stalker' },
  { kind: 'volt_sniper', name: 'Ionized Longshot' },
  { kind: 'void_assassin', name: 'Singularity Phantom' },
  { kind: 'aegis_juggernaut', name: 'Obsidian Colossus' },
  { kind: 'mecha_lancer', name: 'Aero-Blitz Dragoon' },
  { kind: 'mimic', name: 'Quantum Replica Elite' },
  { kind: 'cryo_stalker', name: 'Absolute-Zero Hunter' },
  { kind: 'pyro_bomber', name: 'Helios Detonator' },
  { kind: 'volt_sniper', name: 'Hyper-Volt Deadeye' },
  { kind: 'void_assassin', name: 'Warp-Rift Executioner' },
  { kind: 'aegis_juggernaut', name: 'Supreme Bastion Guard' },
  { kind: 'mecha_lancer', name: 'Starlight Interceptor' },
  { kind: 'spider', name: 'Quantum Tarantula' },
  { kind: 'void_assassin', name: 'Omega Shadow Assassin' },
  { kind: 'aegis_juggernaut', name: 'Apex Threshold Guard' },
  { kind: 'mecha_lancer', name: 'World-Ender Vanguard' },
];

export function getLevelFeaturedRobot(level: number): { kind: RobotSpawnSpec['kind']; name: string } {
  const idx = Math.max(0, Math.min(LEVEL_FEATURED_ROBOTS.length - 1, level - 1));
  return LEVEL_FEATURED_ROBOTS[idx];
}

export function buildArenaLevel(
  level: number,
  maxAnisotropy: number,
  mode: GameMode = 'campaign',
  glitchChoice: GlitchOutcomeChoice = 'pending',
): ArenaLevelData {
  const trainingMode = mode === 'tutorial';
  const outsideWorldActive = mode === 'outside_world';
  const rng = createSeededRng(
    outsideWorldActive
      ? 888888
      : mode === 'glitch_lv0'
        ? 404040
        : mode === 'ffa'
          ? 777111
          : mode === 'wave'
            ? 555333
            : trainingMode
              ? 99991
              : level + 2026,
  );

  const isBossLevel =
    outsideWorldActive ||
    mode === 'glitch_lv0' ||
    (mode === 'campaign' && isBossLevelNumber(level));
  const isRescueLevel = mode === 'campaign' && isRescueLevelNumber(level);
  const bossName = isBossLevel ? getBossName(level, mode) : null;
  const bossPower = isBossLevel
    ? outsideWorldActive || mode === 'glitch_lv0'
      ? 'punch'
      : getBossPowerForLevel(level)
    : null;

  const shapeName: ArenaShapeName =
    mode === 'tutorial'
      ? 'Training Matrix'
      : mode === 'outside_world'
        ? 'Outside World'
        : mode === 'glitch_lv0'
          ? glitchChoice === 'run'
            ? 'Glitch Endless Run'
            : 'Glitch Reality LV 0'
          : mode === 'ffa'
            ? 'FFA Colosseum'
            : mode === 'wave'
              ? 'Wave Fortress'
              : CAMPAIGN_SHAPES[(Math.max(1, level) - 1) % CAMPAIGN_SHAPES.length];

  const group = new THREE.Group();
  const colliders: ArenaPlatformBox[] = [];
  const grappleNodes: GrappleNode[] = [];
  const destructibleBuildings: DestructibleBuilding[] = [];
  const laserObstacles: ArenaLaserObstacle[] = [];
  const raycastMeshes: THREE.Object3D[] = [];
  const robotSpawns: RobotSpawnSpec[] = [];
  const captiveSpawns: THREE.Vector3[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const accentHex =
    mode === 'glitch_lv0'
      ? '#f43f5e'
      : mode === 'ffa'
        ? '#f59e0b'
        : mode === 'wave'
          ? '#a855f7'
          : '#06b6d4';

  const floorTex = createObsidianTexture(
    outsideWorldActive ? 64 : 24,
    outsideWorldActive ? 64 : 24,
    maxAnisotropy,
    true,
    accentHex,
  );
  const wallTex = createObsidianTexture(18, 10, maxAnisotropy, false, accentHex);
  const platTex = createObsidianTexture(3, 3, maxAnisotropy, false, accentHex);
  textures.push(floorTex, wallTex, platTex);

  const blackFloorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: floorTex,
      color: 0xffffff,
      roughness: 0.38,
      metalness: 0.34,
    }),
  );
  const blackWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: wallTex,
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.28,
    }),
  );
  const blackPlatformMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: platTex,
      color: 0xf8fafc,
      roughness: 0.3,
      metalness: 0.45,
    }),
  );
  const darkChromeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.24,
      metalness: 0.88,
    }),
  );
  const cyanGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: mode === 'glitch_lv0' ? 0xf43f5e : 0x22d3ee,
      emissive: mode === 'glitch_lv0' ? 0xe11d48 : 0x06b6d4,
      emissiveIntensity: 2.1,
      roughness: 0.2,
      metalness: 0.2,
    }),
  );
  const boostGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 2.6,
      roughness: 0.15,
      metalness: 0.1,
    }),
  );
  const violetGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: mode === 'glitch_lv0' ? 0xfb7185 : 0xa855f7,
      emissive: mode === 'glitch_lv0' ? 0xe11d48 : 0x9333ea,
      emissiveIntensity: 2.0,
      roughness: 0.2,
      metalness: 0.25,
    }),
  );
  const buildingShellMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: platTex,
      color: 0x1e293b,
      roughness: 0.38,
      metalness: 0.65,
    }),
  );
  const buildingCoreMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 1.8,
      roughness: 0.22,
      metalness: 0.35,
    }),
  );
  const nodeCoreMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.88,
    }),
  );
  const goalBeaconMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 2.3,
      roughness: 0.2,
      metalness: 0.5,
    }),
  );
  const goalBeamMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const goalPortalDiscMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );

  const addPlatform = (
    cx: number,
    topY: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    isBoostPad = false,
    boostVelocity = 34,
    hexStyle = false,
  ): THREE.Mesh => {
    const geo = hexStyle
      ? trackGeo(new THREE.CylinderGeometry(Math.min(w, d) * 0.55, Math.min(w, d) * 0.48, h, 6))
      : trackGeo(new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geo, blackPlatformMat);
    mesh.position.set(cx, topY - h * 0.5, cz);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    group.add(mesh);
    raycastMeshes.push(mesh);

    const rimGeo = hexStyle
      ? trackGeo(new THREE.CylinderGeometry(Math.min(w, d) * 0.57, Math.min(w, d) * 0.57, 0.34, 6))
      : trackGeo(new THREE.BoxGeometry(w + 0.24, 0.36, d + 0.24));
    const rim = new THREE.Mesh(
      rimGeo,
      isBoostPad ? boostGlowMat : hexStyle ? violetGlowMat : cyanGlowMat,
    );
    rim.position.set(cx, topY - 0.28, cz);
    group.add(rim);

    if (isBoostPad) {
      const padGeo = trackGeo(
        new THREE.CylinderGeometry(Math.min(w, d) * 0.34, Math.min(w, d) * 0.38, 0.28, 24),
      );
      const pad = new THREE.Mesh(padGeo, boostGlowMat);
      pad.position.set(cx, topY + 0.14, cz);
      group.add(pad);
    }

    const colW = hexStyle ? Math.min(w, d) * 0.92 : w;
    const colD = hexStyle ? Math.min(w, d) * 0.92 : d;
    colliders.push({
      minX: cx - colW * 0.5,
      maxX: cx + colW * 0.5,
      minY: topY - h,
      maxY: topY,
      minZ: cz - colD * 0.5,
      maxZ: cz + colD * 0.5,
      isBoostPad,
      boostVelocity,
    });

    return mesh;
  };

  const addDestructibleBuilding = (
    cx: number,
    baseY: number,
    cz: number,
    w: number,
    h: number,
    d: number,
  ) => {
    const id = destructibleBuildings.length;
    const bGroup = new THREE.Group();
    bGroup.position.set(cx, baseY, cz);

    const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), buildingShellMat);
    body.position.y = h * 0.5;
    body.castShadow = false;
    body.receiveShadow = true;
    bGroup.add(body);

    const crown = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(w + 0.7, 0.9, d + 0.7)),
      darkChromeMat,
    );
    crown.position.y = h - 0.45;
    bGroup.add(crown);

    const spineFront = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.55, h * 0.86, 0.4)),
      buildingCoreMat,
    );
    spineFront.position.set(0, h * 0.5, d * 0.5 + 0.1);
    const spineBack = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.55, h * 0.86, 0.4)),
      buildingCoreMat,
    );
    spineBack.position.set(0, h * 0.5, -d * 0.5 - 0.1);
    bGroup.add(spineFront, spineBack);

    const spire = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.18, 0.35, 3.2, 8)),
      buildingCoreMat,
    );
    spire.position.y = h + 1.6;
    bGroup.add(spire);

    group.add(bGroup);
    raycastMeshes.push(body);

    const colliderIndex = colliders.length;
    colliders.push({
      minX: cx - w * 0.5,
      maxX: cx + w * 0.5,
      minY: baseY,
      maxY: baseY + h,
      minZ: cz - d * 0.5,
      maxZ: cz + d * 0.5,
      buildingId: id,
    });

    destructibleBuildings.push({
      id,
      center: new THREE.Vector3(cx, baseY + h * 0.5, cz),
      width: w,
      height: h,
      depth: d,
      colliderIndex,
      group: bGroup,
      destroyed: false,
    });
  };

  const addGrappleNode = (x: number, y: number, z: number, floating = false) => {
    const id = grappleNodes.length;
    const nodeGroup = new THREE.Group();
    nodeGroup.position.set(x, y, z);

    const hub = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(1.15, 1)), nodeCoreMat);
    nodeGroup.add(hub);

    const collar = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(1.4, 1.4, 0.45, 16)),
      darkChromeMat,
    );
    nodeGroup.add(collar);

    const ringMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: floating ? 0xfbbf24 : mode === 'glitch_lv0' ? 0xf43f5e : 0x67e8f9,
        emissive: floating ? 0xd97706 : mode === 'glitch_lv0' ? 0xe11d48 : 0x06b6d4,
        emissiveIntensity: 2.3,
        roughness: 0.18,
        metalness: 0.3,
      }),
    );
    const ringMesh = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(2.25, 0.22, 12, 28)),
      ringMat,
    );
    ringMesh.rotation.x = Math.PI * 0.5;
    nodeGroup.add(ringMesh);

    if (!floating) {
      const rod = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 18, 8)),
        darkChromeMat,
      );
      rod.position.y = 9;
      nodeGroup.add(rod);
    }

    group.add(nodeGroup);
    raycastMeshes.push(hub, ringMesh);

    grappleNodes.push({
      id,
      position: new THREE.Vector3(x, y, z),
      radius: 4.8,
      ringMesh,
    });
  };

  const addLaserObstacle = (
    x: number,
    baseY: number,
    z: number,
    length: number,
    kind: ArenaLaserObstacle['kind'],
    speed = 1.6,
    phase = 0,
  ) => {
    const pylonMat = darkChromeMat;
    const emitterMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 2.4,
        roughness: 0.2,
      }),
    );

    if (kind === 'spinner') {
      const hub = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.85, 1.05, 3.4, 12)),
        pylonMat,
      );
      hub.position.set(x, baseY + 1.7, z);
      const cap = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.7, 10, 8)), emitterMat);
      cap.position.set(x, baseY + 3.45, z);
      group.add(hub, cap);
      raycastMeshes.push(hub);
    } else {
      const half = length * 0.5;
      const postL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.85, 4.4, 0.85)), pylonMat);
      postL.position.set(x - half, baseY + 2.2, z);
      const postR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.85, 4.4, 0.85)), pylonMat);
      postR.position.set(x + half, baseY + 2.2, z);
      const orbL = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.42, 8, 8)), emitterMat);
      orbL.position.set(x - half, baseY + (kind === 'static_high' ? 2.55 : 1.05), z);
      const orbR = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.42, 8, 8)), emitterMat);
      orbR.position.set(x + half, baseY + (kind === 'static_high' ? 2.55 : 1.05), z);
      group.add(postL, postR, orbL, orbR);
      raycastMeshes.push(postL, postR);
    }

    const laserMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xff2a55,
        transparent: true,
        opacity: 0.9,
      }),
    );
    const beamMesh = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 1, 10)),
      laserMat,
    );
    group.add(beamMesh);

    const beamY = baseY + (kind === 'static_high' ? 2.55 : kind === 'spinner' ? 1.85 : 1.05);
    laserObstacles.push({
      id: laserObstacles.length,
      origin: new THREE.Vector3(x, baseY, z),
      length,
      baseY: beamY,
      kind,
      speed,
      phase,
      beamMesh,
      mat: laserMat,
      p1: new THREE.Vector3(x - length * 0.5, beamY, z),
      p2: new THREE.Vector3(x + length * 0.5, beamY, z),
    });
  };

  const addFloorWithPortalPit = (
    floorMinX: number,
    floorMaxX: number,
    floorMinZ: number,
    floorMaxZ: number,
    pitCenterX: number,
    pitCenterZ: number,
    pitHalfSize = 14,
  ) => {
    const pitMinX = pitCenterX - pitHalfSize;
    const pitMaxX = pitCenterX + pitHalfSize;
    const pitMinZ = pitCenterZ - pitHalfSize;
    const pitMaxZ = pitCenterZ + pitHalfSize;

    const addFloorSlab = (x0: number, x1: number, z0: number, z1: number) => {
      const w = x1 - x0;
      const d = z1 - z0;
      if (w <= 0.1 || d <= 0.1) return;
      const cx = (x0 + x1) * 0.5;
      const cz = (z0 + z1) * 0.5;
      const slab = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(w, 2, d)),
        blackFloorMat,
      );
      slab.position.set(cx, -1, cz);
      slab.receiveShadow = true;
      group.add(slab);
      raycastMeshes.push(slab);
      colliders.push({
        minX: x0,
        maxX: x1,
        minY: -2,
        maxY: 0,
        minZ: z0,
        maxZ: z1,
      });
    };

    // North (behind portal), South (approach), West flank, East flank
    addFloorSlab(floorMinX, floorMaxX, floorMinZ, pitMinZ);
    addFloorSlab(floorMinX, floorMaxX, pitMaxZ, floorMaxZ);
    addFloorSlab(floorMinX, pitMinX, pitMinZ, pitMaxZ);
    addFloorSlab(pitMaxX, floorMaxX, pitMinZ, pitMaxZ);
  };

  const addWallSlidePanel = (cx: number, baseY: number, cz: number, thickness: number, height: number, length: number) => {
    addPlatform(cx, baseY + height, cz, thickness, height, length, false, 34, false);
    const rail = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(thickness + 0.25, 0.45, length - 0.6)),
      cyanGlowMat,
    );
    rail.position.set(cx, baseY + height * 0.55, cz);
    group.add(rail);
  };

  const buildGoalPad = (goalPos: THREE.Vector3, padSize = 26, beamHeight = 64) => {
    const isUnderground = goalPos.y < -1;
    // Underground Subterranean Vault Floor + Walls + Entry Stairway if below y=0
    if (isUnderground) {
      const pitHalf = 14;
      const depth = Math.abs(goalPos.y);
      addPlatform(goalPos.x, goalPos.y, goalPos.z, padSize + 4, 3.5, padSize + 4, false, 34, false);

      // Subterranean chamber walls around the pit (-14..0)
      const wallH = depth + 2;
      const wallY = goalPos.y + wallH * 0.5 - 1;
      const wBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(pitHalf * 2 + 4, wallH, 2)), blackWallMat);
      wBack.position.set(goalPos.x, wallY, goalPos.z - pitHalf - 1);
      const wLeft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2, wallH, pitHalf * 2 + 4)), blackWallMat);
      wLeft.position.set(goalPos.x - pitHalf - 1, wallY, goalPos.z);
      const wRight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2, wallH, pitHalf * 2 + 4)), blackWallMat);
      wRight.position.set(goalPos.x + pitHalf + 1, wallY, goalPos.z);
      group.add(wBack, wLeft, wRight);
      raycastMeshes.push(wBack, wLeft, wRight);

      // Glowing subterranean pit rim framing the drop opening at y=0
      const rimFront = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(pitHalf * 2, 0.45, 0.65)), cyanGlowMat);
      rimFront.position.set(goalPos.x, 0.22, goalPos.z + pitHalf);
      const rimBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(pitHalf * 2, 0.45, 0.65)), cyanGlowMat);
      rimBack.position.set(goalPos.x, 0.22, goalPos.z - pitHalf);
      const rimLeft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.65, 0.45, pitHalf * 2)), cyanGlowMat);
      rimLeft.position.set(goalPos.x - pitHalf, 0.22, goalPos.z);
      const rimRight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.65, 0.45, pitHalf * 2)), cyanGlowMat);
      rimRight.position.set(goalPos.x + pitHalf, 0.22, goalPos.z);
      group.add(rimFront, rimBack, rimLeft, rimRight);

      // Stepped descent ledges inside the pit from y=0 down to goalPos.y + overhead grapple node
      for (let s = 0; s < 5; s++) {
        const sy = -2.4 * (s + 1);
        const sz = goalPos.z + pitHalf - 2.2 - s * 2.1;
        addPlatform(goalPos.x - 8, sy, sz, 7, 1.8, 2.2, false, 34, false);
        addPlatform(goalPos.x + 8, sy, sz, 7, 1.8, 2.2, false, 34, false);
      }
      addGrappleNode(goalPos.x, 18, goalPos.z, true);
    } else {
      addPlatform(goalPos.x, goalPos.y, goalPos.z, padSize, 4.5, padSize, false, 34, true);
    }

    const beaconPad = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(5.2, 5.8, 0.36, 24)),
      goalBeaconMat,
    );
    beaconPad.position.set(goalPos.x, goalPos.y + 0.18, goalPos.z);
    group.add(beaconPad);

    // Twin Obsidian Portal Pylons + Crown Arch
    const pylonL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.5, 11.5, 2.1)), darkChromeMat);
    pylonL.position.set(goalPos.x - 5.2, goalPos.y + 5.75, goalPos.z);
    const pylonR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.5, 11.5, 2.1)), darkChromeMat);
    pylonR.position.set(goalPos.x + 5.2, goalPos.y + 5.75, goalPos.z);
    const crownArch = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(12.2, 1.4, 2.4)), darkChromeMat);
    crownArch.position.set(goalPos.x, goalPos.y + 11.5, goalPos.z);
    group.add(pylonL, pylonR, crownArch);

    // Outer Vertical Warp Portal Ring
    const outerPortalFrame = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(4.65, 0.42, 14, 36)),
      goalBeaconMat,
    );
    outerPortalFrame.position.set(goalPos.x, goalPos.y + 5.6, goalPos.z);
    group.add(outerPortalFrame);

    // Translucent Shimmering Portal Vortex Disc
    const portalDisc = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(4.35, 32)),
      goalPortalDiscMat,
    );
    portalDisc.position.set(goalPos.x, goalPos.y + 5.6, goalPos.z);
    group.add(portalDisc);

    // Spinning Inner Torus Ring
    const goalRingMesh = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(3.55, 0.24, 12, 32)),
      goalBeaconMat,
    );
    goalRingMesh.position.set(goalPos.x, goalPos.y + 5.6, goalPos.z);
    group.add(goalRingMesh);

    const totalBeamH = isUnderground ? Math.max(76, beamHeight + 22) : beamHeight;
    const goalBeam = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(2.8, 3.8, totalBeamH, 20, 1, true)),
      goalBeamMat,
    );
    goalBeam.position.set(goalPos.x, goalPos.y + totalBeamH * 0.5, goalPos.z);
    group.add(goalBeam);

    const goalLight = new THREE.PointLight(0xf59e0b, 34, 96, 1.3);
    goalLight.position.set(goalPos.x, goalPos.y + 7.2, goalPos.z + 2);
    group.add(goalLight);

    return { goalRingMesh, goalLight };
  };

  // =========================================================================
  // 1. OUTSIDE WORLD (ALL BOSSES RETURN + 50m FAST MIMIC + SPIDERS + 100x OMEGA-TITAN + 150 BOTS)
  // =========================================================================
  if (outsideWorldActive) {
    const worldHalf = 560;
    const goalPos = new THREE.Vector3(0, -14, -265);
    addFloorWithPortalPit(-worldHalf, worldHalf, -170 - worldHalf, -170 + worldHalf, goalPos.x, goalPos.z, 14);

    const mountainGeo = trackGeo(new THREE.ConeGeometry(46, 175, 5));
    const mountainCount = 34;
    const mountainMesh = new THREE.InstancedMesh(mountainGeo, blackWallMat, mountainCount);
    const tmpM = new THREE.Matrix4();
    const tmpQ = new THREE.Quaternion();
    const tmpS = new THREE.Vector3();
    const tmpP = new THREE.Vector3();
    for (let m = 0; m < mountainCount; m++) {
      const ang = (m / mountainCount) * Math.PI * 2;
      const dist = 440 + rng() * 95;
      tmpP.set(Math.cos(ang) * dist, 75, -170 + Math.sin(ang) * dist);
      tmpQ.setFromEuler(new THREE.Euler(0, rng() * Math.PI, (rng() - 0.5) * 0.14));
      tmpS.set(0.85 + rng() * 0.9, 0.75 + rng() * 1.15, 0.85 + rng() * 0.9);
      tmpM.compose(tmpP, tmpQ, tmpS);
      mountainMesh.setMatrixAt(m, tmpM);
    }
    mountainMesh.instanceMatrix.needsUpdate = true;
    mountainMesh.computeBoundingSphere();
    group.add(mountainMesh);

    addPlatform(0, 6, 185, 36, 6, 30, true, 46, false);
    const spawnPos = new THREE.Vector3(0, 7.85, 188);
    const npcQuestPos = new THREE.Vector3(-11, 6, 178);

    const bossPos = new THREE.Vector3(0, 0, -155);
    for (let ring = 0; ring < 14; ring++) {
      const ang = (ring / 14) * Math.PI * 2;
      const dist = ring % 2 === 0 ? 155 : 230;
      const px = bossPos.x + Math.cos(ang) * dist;
      const pz = bossPos.z + Math.sin(ang) * dist;
      const py = 14 + (ring % 3) * 10;
      addPlatform(px, py, pz, 18, py, 18, ring % 2 === 0, 52, true);
      if (ring % 2 === 1) {
        addDestructibleBuilding(px, py, pz, 8, 22, 8);
      }
      addGrappleNode(px, py + 38, pz, true);
      addGrappleNode(
        bossPos.x + Math.cos(ang + 0.18) * 115,
        105 + (ring % 3) * 34,
        bossPos.z + Math.sin(ang + 0.18) * 115,
        true,
      );
    }

    addGrappleNode(-28, 42, 130, true);
    addGrappleNode(28, 42, 130, true);
    addGrappleNode(0, 68, 65, true);
    addGrappleNode(-45, 92, 10, true);
    addGrappleNode(45, 92, 10, true);

    addDestructibleBuilding(-46, 0, -24, 10, 28, 10);
    addDestructibleBuilding(46, 0, -24, 10, 28, 10);
    addDestructibleBuilding(-75, 0, -90, 10, 32, 10);
    addDestructibleBuilding(75, 0, -90, 10, 32, 10);

    // 1. Colossal 100x Omega-Titan Final Big Boss
    robotSpawns.push({
      kind: 'final_boss',
      position: bossPos.clone(),
      patrolRadius: 65,
      hpMultiplier: 1,
    });

    // 2. 50m Towering Ultra-Fast Mimic Robot!
    robotSpawns.push({
      kind: 'giant_mimic',
      position: new THREE.Vector3(-85, 0, -35),
      patrolRadius: 120,
      hpMultiplier: 1,
    });

    // 3. Bring Back All Previous Bosses (Pyro, Leviathan, Breaker, Singularity Titans)
    const returningBossLevels = [5, 10, 15, 20, 30, 40, 50];
    returningBossLevels.forEach((bLvl, idx) => {
      const ang = (idx / returningBossLevels.length) * Math.PI * 1.4 - Math.PI * 0.7;
      robotSpawns.push({
        kind: 'boss',
        position: new THREE.Vector3(Math.sin(ang) * 135, 0, -45 - Math.cos(ang) * 65),
        patrolRadius: 65,
        hpMultiplier: 0.45,
        bossTier: bLvl,
      });
    });

    // 4. 150 Swarm Bots + Spider Robots
    for (let b = 0; b < OUTSIDE_WORLD_BOT_COUNT; b++) {
      const row = Math.floor(b / 15);
      const col = b % 15;
      const spreadX = (col - 7) * 24 + (rng() - 0.5) * 10;
      const spreadZ = 95 - row * 24 + (rng() - 0.5) * 10;
      const kind: RobotSpawnSpec['kind'] =
        b % 10 === 0
          ? 'hunter'
          : b % 4 === 0
            ? 'drone'
            : b % 2 === 0
              ? 'trooper'
              : 'scout';
      robotSpawns.push({
        kind,
        position: new THREE.Vector3(
          spreadX,
          kind === 'drone' ? 16 + rng() * 28 : 0.2,
          spreadZ,
        ),
        patrolRadius: 32,
        hpMultiplier: 1,
      });
    }

    // 6 Elite Arachnid Spider Robots
    for (let s = 0; s < 6; s++) {
      robotSpawns.push({
        kind: 'spider',
        position: new THREE.Vector3((s - 2.5) * 48, 0.2, 35 - (s % 2) * 55),
        patrolRadius: 48,
        hpMultiplier: 1.4,
      });
    }

    // Laser perimeter gates & sweepers in the Outside World battleground
    addLaserObstacle(-52, 0, 12, 22, 'spinner', 1.4, 0.3);
    addLaserObstacle(52, 0, 12, 22, 'spinner', -1.4, 1.8);
    addLaserObstacle(0, 0, -56, 26, 'sweep', 1.6, 0.7);

    const { goalRingMesh, goalLight } = buildGoalPad(goalPos, 26, 85);

    return {
      level: MAX_LEVEL,
      mode,
      shapeName,
      trainingMode: false,
      outsideWorldActive: true,
      isBossLevel: true,
      isRescueLevel: false,
      bossName,
      bossPower,
      group,
      colliders,
      grappleNodes,
      destructibleBuildings,
      laserObstacles,
      raycastMeshes,
      spawnPos,
      npcQuestPos,
      captiveSpawns,
      goalPos,
      goalLight,
      goalBeaconMat,
      goalBeamMat,
      goalPortalDiscMat,
      goalRingMesh,
      robotSpawns,
      getCorridorXRangeAtZ: () => ({ minX: -worldHalf + 10, maxX: worldHalf - 10 }),
      bounds: {
        minX: -worldHalf + 10,
        maxX: worldHalf - 10,
        maxY: 440,
        minZ: -170 - worldHalf + 10,
        maxZ: -170 + worldHalf - 10,
      },
      dispose: () => {
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        textures.forEach((t) => t.dispose());
      },
    };
  }

  // =========================================================================
  // 3. GLITCH LV 0 FINALE (FIGHT INF-HP 1,000,000x TITAN OR RUN CORRIDOR)
  // =========================================================================
  if (mode === 'glitch_lv0') {
    if (glitchChoice === 'run') {
      // Endless-style 2,400m receding Glitch Corridor for the RUN outcome!
      const corridorLen = 2400;
      const halfW = 34;
      const floorMesh = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(halfW * 2, 2, corridorLen)),
        blackFloorMat,
      );
      floorMesh.position.set(0, -1, -corridorLen * 0.5 + 40);
      floorMesh.receiveShadow = true;
      group.add(floorMesh);
      raycastMeshes.push(floorMesh);
      colliders.push({
        minX: -halfW,
        maxX: halfW,
        minY: -2,
        maxY: 0,
        minZ: -corridorLen + 40,
        maxZ: 40,
      });

      const segMat = violetGlowMat;
      for (let z = 10; z > -corridorLen + 60; z -= 42) {
        const archL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.8, 34, 2.2)), blackWallMat);
        archL.position.set(-halfW + 1.5, 17, z);
        const archR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.8, 34, 2.2)), blackWallMat);
        archR.position.set(halfW - 1.5, 17, z);
        const neonL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.6, 34, 0.8)), segMat);
        neonL.position.set(-halfW + 2.6, 17, z);
        const neonR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.6, 34, 0.8)), segMat);
        neonR.position.set(halfW - 2.6, 17, z);
        group.add(archL, archR, neonL, neonR);
        raycastMeshes.push(archL, archR);
        addGrappleNode((rng() - 0.5) * 14, 26, z - 16, true);
        if (Math.abs(z) % 84 < 42) {
          addPlatform((rng() - 0.5) * 18, 4, z - 10, 12, 4, 12, true, 42, true);
        }
      }

      robotSpawns.push({
        kind: 'glitch_titan',
        position: new THREE.Vector3(0, 0, 95), // Chases relentlessly from behind!
        patrolRadius: 2600,
        hpMultiplier: 1,
      });

      const goalPos = new THREE.Vector3(0, 1, -corridorLen + 80);
      const { goalRingMesh, goalLight } = buildGoalPad(goalPos, 18, 50);

      return {
        level: 0,
        mode,
        shapeName,
        trainingMode: false,
        outsideWorldActive: false,
        isBossLevel: true,
        isRescueLevel: false,
        bossName,
        bossPower: null,
        group,
        colliders,
        grappleNodes,
        destructibleBuildings,
        laserObstacles,
        raycastMeshes,
        spawnPos: new THREE.Vector3(0, 1.85, 18),
        npcQuestPos: new THREE.Vector3(-12, 0, 18),
        captiveSpawns,
        goalPos,
        goalLight,
        goalBeaconMat,
        goalBeamMat,
        goalPortalDiscMat,
        goalRingMesh,
        robotSpawns,
        getCorridorXRangeAtZ: () => ({ minX: -halfW + 2, maxX: halfW - 2 }),
        bounds: {
          minX: -halfW + 2,
          maxX: halfW - 2,
          maxY: 220,
          minZ: -corridorLen + 45,
          maxZ: 38,
        },
        dispose: () => {
          geometries.forEach((g) => g.dispose());
          materials.forEach((m) => m.dispose());
          textures.forEach((t) => t.dispose());
        },
      };
    }

    // Glitch Arena ('pending' or 'fight')
    const worldHalf = 320;
    const floorMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(worldHalf * 2, 3, worldHalf * 2)),
      blackFloorMat,
    );
    floorMesh.position.set(0, -1.5, -100);
    group.add(floorMesh);
    raycastMeshes.push(floorMesh);
    colliders.push({
      minX: -worldHalf,
      maxX: worldHalf,
      minY: -3,
      maxY: 0,
      minZ: -100 - worldHalf,
      maxZ: -100 + worldHalf,
    });

    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const dist = 75 + (i % 3) * 45;
      const px = Math.cos(ang) * dist;
      const pz = -90 + Math.sin(ang) * dist;
      const py = 12 + (i % 4) * 9;
      addPlatform(px, py, pz, 16, py, 16, i % 2 === 0, 44, true);
      addGrappleNode(px, py + 32, pz, true);
    }

    robotSpawns.push({
      kind: 'glitch_titan',
      position: new THREE.Vector3(0, 0, -145),
      patrolRadius: 240,
      hpMultiplier: 1,
    });

    const goalPos = new THREE.Vector3(0, 2, -230);
    const { goalRingMesh, goalLight } = buildGoalPad(goalPos, 20, 60);

    return {
      level: 0,
      mode,
      shapeName,
      trainingMode: false,
      outsideWorldActive: false,
      isBossLevel: true,
      isRescueLevel: false,
      bossName,
      bossPower: null,
      group,
      colliders,
      grappleNodes,
      destructibleBuildings,
      laserObstacles,
      raycastMeshes,
      spawnPos: new THREE.Vector3(0, 1.85, 60),
      npcQuestPos: new THREE.Vector3(-12, 0, 56),
      captiveSpawns,
      goalPos,
      goalLight,
      goalBeaconMat,
      goalBeamMat,
      goalPortalDiscMat,
      goalRingMesh,
      robotSpawns,
      getCorridorXRangeAtZ: () => ({ minX: -worldHalf + 8, maxX: worldHalf - 8 }),
      bounds: {
        minX: -worldHalf + 8,
        maxX: worldHalf - 8,
        maxY: 440,
        minZ: -100 - worldHalf + 8,
        maxZ: -100 + worldHalf - 8,
      },
      dispose: () => {
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        textures.forEach((t) => t.dispose());
      },
    };
  }

  // =========================================================================
  // 4. UNLOCKABLE FREE-FOR-ALL COLOSSEUM & WAVE FORTRESS MODES
  // =========================================================================
  if (mode === 'ffa' || mode === 'wave') {
    const arenaHalf = 140;
    const goalPos = new THREE.Vector3(0, -14, -108);
    addFloorWithPortalPit(-arenaHalf, arenaHalf, -arenaHalf, arenaHalf, goalPos.x, goalPos.z, 14);

    // Octagonal perimeter wall segments
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const wx = Math.cos(ang) * 126;
      const wz = Math.sin(ang) * 126;
      const wall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(106, 72, 4)), blackWallMat);
      wall.position.set(wx, 36, wz);
      wall.rotation.y = -ang + Math.PI * 0.5;
      group.add(wall);
      raycastMeshes.push(wall);
    }

    addPlatform(0, 6, 0, 32, 6, 32, true, 44, true);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const px = Math.cos(ang) * 64;
      const pz = Math.sin(ang) * 64;
      addPlatform(px, 14 + (i % 2) * 8, pz, 20, 14 + (i % 2) * 8, 20, i % 2 === 0, 40, i % 2 === 1);
      addDestructibleBuilding(px * 0.72, 0, pz * 0.72, 7, 16, 7);
      addGrappleNode(px * 0.8, 38 + (i % 2) * 10, pz * 0.8, true);
    }
    addGrappleNode(0, 52, 0, true);

    if (mode === 'ffa') {
      const kinds: RobotSpawnSpec['kind'][] = [
        'spider',
        'void_assassin',
        'cryo_stalker',
        'pyro_bomber',
        'volt_sniper',
        'aegis_juggernaut',
        'mecha_lancer',
        'mimic',
        'hunter',
        'trooper',
        'scout',
        'drone',
      ];
      kinds.forEach((k, idx) => {
        const ang = (idx / kinds.length) * Math.PI * 2;
        const dist = 42 + (idx % 3) * 24;
        robotSpawns.push({
          kind: k,
          position: new THREE.Vector3(Math.cos(ang) * dist, k === 'drone' || k === 'mecha_lancer' ? 22 : 0.4, Math.sin(ang) * dist),
          patrolRadius: 90,
          hpMultiplier: 1.5,
        });
      });
    } else {
      // Wave 1 starter squad (RobotAndVfxManager spawns subsequent waves dynamically!)
      const wave1Kinds: RobotSpawnSpec['kind'][] = [
        'cryo_stalker',
        'pyro_bomber',
        'spider',
        'volt_sniper',
        'mecha_lancer',
      ];
      wave1Kinds.forEach((k, idx) => {
        const ang = (idx / wave1Kinds.length) * Math.PI * 2;
        robotSpawns.push({
          kind: k,
          position: new THREE.Vector3(Math.cos(ang) * 58, k === 'drone' || k === 'mecha_lancer' ? 20 : 0.4, Math.sin(ang) * 58),
          patrolRadius: 95,
          hpMultiplier: 1.0,
        });
      });
    }

    addLaserObstacle(-36, 0, 22, 18, 'spinner', 1.5, 0.2);
    addLaserObstacle(36, 0, -22, 18, 'spinner', -1.5, 1.4);
    addLaserObstacle(0, 6, 0, 22, 'sweep', 1.2, 0.6);

    const { goalRingMesh, goalLight } = buildGoalPad(goalPos, 16, 48);

    return {
      level: 1,
      mode,
      shapeName,
      trainingMode: false,
      outsideWorldActive: false,
      isBossLevel: false,
      isRescueLevel: false,
      bossName: null,
      bossPower: null,
      group,
      colliders,
      grappleNodes,
      destructibleBuildings,
      laserObstacles,
      raycastMeshes,
      spawnPos: new THREE.Vector3(0, 7.85, 86),
      npcQuestPos: new THREE.Vector3(-12, 0, 82),
      captiveSpawns,
      goalPos,
      goalLight,
      goalBeaconMat,
      goalBeamMat,
      goalPortalDiscMat,
      goalRingMesh,
      robotSpawns,
      getCorridorXRangeAtZ: () => ({ minX: -115, maxX: 115 }),
      bounds: {
        minX: -115,
        maxX: 115,
        maxY: 260,
        minZ: -115,
        maxZ: 115,
      },
      dispose: () => {
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        textures.forEach((t) => t.dispose());
      },
    };
  }

  // =========================================================================
  // 5. CONNECTED CAMPAIGN SECTORS (LV 1..50, DIFFERENT SHAPE PER LEVEL) & TUTORIAL
  // =========================================================================
  const chamberHeight = 148;
  const startZ = 34;
  const totalCourseLen = trainingMode
    ? 230
    : isBossLevel
      ? 245
      : level === 1
        ? 210
        : Math.min(440, 240 + Math.floor(level / 6) * 14);
  const minZ = startZ - totalCourseLen;
  const maxZ = startZ + 22;
  const chamberLen = maxZ - minZ;
  const centerZ = (minZ + maxZ) * 0.5;

  const shapeIdx = (Math.max(1, level) - 1) % 6;

  const getCorridorXRangeAtZ = (z: number): { minX: number; maxX: number } => {
    const t = THREE.MathUtils.clamp((maxZ - z) / Math.max(1, chamberLen), 0, 1);
    const bell = Math.sin(t * Math.PI);
    if (trainingMode) {
      return { minX: -62, maxX: 62 };
    }
    if (isBossLevel) {
      const half = 82 + bell * 34;
      return { minX: -half, maxX: half };
    }
    if (shapeIdx === 0) {
      // Helix Spire: twisting sinusoidal ribbon
      const shift = Math.sin(t * Math.PI * 3) * 28;
      return { minX: shift - 56, maxX: shift + 56 };
    }
    if (shapeIdx === 1) {
      // Hex Citadel: wide octagonal chamber
      const half = 54 + bell * 44;
      return { minX: -half, maxX: half };
    }
    if (shapeIdx === 2) {
      // Twin-Arch Canyon: hourglass pinch
      const half = 78 - bell * 24;
      return { minX: -half, maxX: half };
    }
    if (shapeIdx === 3) {
      // Diamond Labyrinth: sharp diamond flare
      const diamond = t < 0.5 ? t * 2 : (1 - t) * 2;
      const half = 44 + diamond * 58;
      return { minX: -half, maxX: half };
    }
    if (shapeIdx === 4) {
      // Suspended Bridges: sleek narrow canyon
      const shift = Math.cos(t * Math.PI * 2.5) * 18;
      return { minX: shift - 52, maxX: shift + 52 };
    }
    // Stepped Pyramid: wide base tapering toward exit
    const half = 88 - t * 34;
    return { minX: -half, maxX: half };
  };

  const wideSpanX = 240;
  const portalGoalZ = minZ + 22;
  addFloorWithPortalPit(-wideSpanX * 0.5, wideSpanX * 0.5, minZ, maxZ, 0, portalGoalZ, 14);

  // Entry archway from previous connected sector
  const entryArchL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4, 24, 4)), darkChromeMat);
  entryArchL.position.set(-14, 12, maxZ - 1);
  const entryArchR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4, 24, 4)), darkChromeMat);
  entryArchR.position.set(14, 12, maxZ - 1);
  const entryLintel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(32, 3, 4)), cyanGlowMat);
  entryLintel.position.set(0, 24, maxZ - 1);
  group.add(entryArchL, entryArchR, entryLintel);

  // Connected Exit Archway & visual bridge stub leading seamlessly into the next sector!
  const exitArchL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4, 26, 4)), darkChromeMat);
  exitArchL.position.set(-16, 13, minZ + 1);
  const exitArchR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4, 26, 4)), darkChromeMat);
  exitArchR.position.set(16, 13, minZ + 1);
  const exitLintel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(36, 3.2, 4)), violetGlowMat);
  exitLintel.position.set(0, 26, minZ + 1);
  const nextSectorBridge = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(28, 2, 46)),
    blackPlatformMat,
  );
  nextSectorBridge.position.set(0, -1, minZ - 23);
  group.add(exitArchL, exitArchR, exitLintel, nextSectorBridge);

  const wallSegCount = Math.max(10, Math.floor(chamberLen / 22));
  const segStepZ = chamberLen / wallSegCount;

  for (let i = 0; i < wallSegCount; i++) {
    const z0 = maxZ - i * segStepZ;
    const z1 = z0 - segStepZ;
    const midZ = (z0 + z1) * 0.5;
    const r0 = getCorridorXRangeAtZ(z0);
    const r1 = getCorridorXRangeAtZ(z1);

    const lx0 = r0.minX - 1.5;
    const lx1 = r1.minX - 1.5;
    const lMidX = (lx0 + lx1) * 0.5;
    const lAngle = Math.atan2(lx1 - lx0, -segStepZ);
    const lLen = Math.hypot(lx1 - lx0, segStepZ) + 2.4;
    const leftSeg = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(3.2, chamberHeight, lLen)),
      blackWallMat,
    );
    leftSeg.position.set(lMidX, chamberHeight * 0.5, midZ);
    leftSeg.rotation.y = lAngle;
    leftSeg.receiveShadow = true;
    group.add(leftSeg);
    raycastMeshes.push(leftSeg);

    const rx0 = r0.maxX + 1.5;
    const rx1 = r1.maxX + 1.5;
    const rMidX = (rx0 + rx1) * 0.5;
    const rAngle = Math.atan2(rx1 - rx0, -segStepZ);
    const rLen = Math.hypot(rx1 - rx0, segStepZ) + 2.4;
    const rightSeg = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(3.2, chamberHeight, rLen)),
      blackWallMat,
    );
    rightSeg.position.set(rMidX, chamberHeight * 0.5, midZ);
    rightSeg.rotation.y = rAngle;
    rightSeg.receiveShadow = true;
    group.add(rightSeg);
    raycastMeshes.push(rightSeg);

    const ribL = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.65, chamberHeight, 0.9)),
      i % 2 === 0 ? cyanGlowMat : violetGlowMat,
    );
    ribL.position.set(lx0 + 1.4, chamberHeight * 0.5, z0);
    group.add(ribL);

    const ribR = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.65, chamberHeight, 0.9)),
      i % 2 === 0 ? cyanGlowMat : violetGlowMat,
    );
    ribR.position.set(rx0 - 1.4, chamberHeight * 0.5, z0);
    group.add(ribR);
  }

  const startTopY = isBossLevel ? 4 : 10;
  addPlatform(0, startTopY, startZ - 4, 24, startTopY, 22, false);
  const spawnPos = new THREE.Vector3(0, startTopY + 1.85, startZ);
  const npcQuestPos = new THREE.Vector3(-7.5, startTopY, startZ - 7);

  let goalPos = new THREE.Vector3(0, 8, minZ + 16);
  const hpScale = 1 + (level - 1) * 0.055;

  if (trainingMode) {
    // Tutorial Mode: clean guided course
    addPlatform(-16, 11, startZ - 38, 16, 3, 16, false, 34, true);
    addPlatform(0, 14, startZ - 70, 16, 3, 16, true, 36, false);
    addPlatform(16, 17, startZ - 102, 16, 3, 16, false, 34, true);
    addPlatform(0, 10, startZ - 150, 54, 4, 48, false, 34, false);

    addDestructibleBuilding(-16, 10, startZ - 152, 6, 14, 6);
    addDestructibleBuilding(16, 10, startZ - 152, 6, 14, 6);

    // Training Academy Laser Obstacle Demo (Jump over low beam, crouch under high beam)
    addLaserObstacle(0, 14, startZ - 70, 13, 'static_low', 0, 0);
    addLaserObstacle(0, 10, startZ - 134, 16, 'sweep', 1.1, 0.4);
    addWallSlidePanel(-26, 6, startZ - 64, 16, 26, 0);
    addWallSlidePanel(26, 6, startZ - 96, 16, 26, 0);

    addGrappleNode(0, 36, startZ - 26);
    addGrappleNode(-10, 42, startZ - 54);
    addGrappleNode(10, 44, startZ - 84);
    addGrappleNode(0, 42, startZ - 122);

    robotSpawns.push(
      { kind: 'cryo_stalker', position: new THREE.Vector3(-12, 10, startZ - 142), patrolRadius: 8, hpMultiplier: 1, variantName: 'Training Cryo Stalker' },
      { kind: 'trooper', position: new THREE.Vector3(12, 10, startZ - 142), patrolRadius: 8, hpMultiplier: 1 },
      { kind: 'spider', position: new THREE.Vector3(-4, 10, startZ - 158), patrolRadius: 10, hpMultiplier: 1 },
      { kind: 'mecha_lancer', position: new THREE.Vector3(0, 22, startZ - 150), patrolRadius: 11, hpMultiplier: 1, variantName: 'Training Sky Lancer' },
    );

    goalPos = new THREE.Vector3(0, -14, portalGoalZ);
  } else if (isBossLevel) {
    const bossCenterZ = centerZ - 4;
    addPlatform(0, 5.5, bossCenterZ, 68, 5.5, 68, false, 34, true);

    addDestructibleBuilding(-18, 5.5, bossCenterZ - 14, 6.2, 16, 6.2);
    addDestructibleBuilding(18, 5.5, bossCenterZ - 14, 6.2, 16, 6.2);
    addDestructibleBuilding(-18, 5.5, bossCenterZ + 14, 6.2, 15, 6.2);
    addDestructibleBuilding(18, 5.5, bossCenterZ + 14, 6.2, 15, 6.2);

    // Boss Arena Laser Perimeter Sweepers
    addLaserObstacle(-24, 5.5, bossCenterZ, 18, 'spinner', 1.4 + level * 0.015, 0.2);
    addLaserObstacle(24, 5.5, bossCenterZ, 18, 'spinner', -(1.4 + level * 0.015), 1.7);

    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + 0.25;
      const dist = 46;
      addPlatform(
        Math.cos(ang) * dist,
        12 + (i % 2) * 6,
        bossCenterZ + Math.sin(ang) * dist,
        12,
        12,
        12,
        i % 2 === 0,
        42,
        true,
      );
    }

    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      addGrappleNode(
        Math.cos(ang) * 44,
        48 + (i % 2) * 12,
        bossCenterZ + Math.sin(ang) * 44,
      );
    }
    addGrappleNode(0, 62, bossCenterZ);
    addGrappleNode(0, 38, startZ - 32);

    robotSpawns.push({
      kind: 'boss',
      position: new THREE.Vector3(0, 5.5, bossCenterZ),
      patrolRadius: 32,
      hpMultiplier: hpScale,
      bossTier: level,
      levelVariantIdx: level,
    });

    const featured = getLevelFeaturedRobot(level);
    const escortCount = level >= 20 ? 4 : 3;
    const escortPool: RobotSpawnSpec['kind'][] = [
      featured.kind,
      'cryo_stalker',
      'pyro_bomber',
      'void_assassin',
      'volt_sniper',
    ];
    for (let d = 0; d < escortCount; d++) {
      const ang = (d / escortCount) * Math.PI * 2 + 0.6;
      const eKind = escortPool[d % escortPool.length];
      robotSpawns.push({
        kind: eKind,
        position: new THREE.Vector3(
          Math.cos(ang) * 28,
          eKind === 'drone' || eKind === 'mecha_lancer' ? 24 : 5.5,
          bossCenterZ + Math.sin(ang) * 28,
        ),
        patrolRadius: 24,
        hpMultiplier: hpScale,
        variantName: d === 0 ? featured.name : undefined,
        levelVariantIdx: level + d,
      });
    }

    addWallSlidePanel(-56, 4, bossCenterZ, 20, 32, 0);
    addWallSlidePanel(56, 4, bossCenterZ, 20, 32, 0);
    goalPos = new THREE.Vector3(0, -14, portalGoalZ);
  } else {
    // 6 Distinct Connected Shape Builders + Lasers + Better Tactical Obstacles + Per-Level Robot Roster!
    const platformCount = Math.min(12, 5 + Math.floor(level / 8));
    const usableSpan = totalCourseLen - 54;
    const stepZ = usableSpan / platformCount;
    const featuredRobot = getLevelFeaturedRobot(level);

    let prevX = 0;
    let prevY = startTopY;
    let prevZ = startZ - 14;
    addGrappleNode(0, startTopY + 24, startZ - 26);

    const diffNorm = Math.min(1, (level - 1) / MAX_LEVEL);

    for (let i = 0; i < platformCount; i++) {
      const t = (i + 1) / platformCount;
      const curZ = startZ - 22 - (i + 1) * stepZ;
      const zRange = getCorridorXRangeAtZ(curZ);
      const midCorridor = (zRange.minX + zRange.maxX) * 0.5;

      let curX = midCorridor;
      let curY = 12;
      let pw = 17;
      let pd = 17;
      let hexStyle = false;
      let hasBoost = i % 4 === 1;

      if (shapeIdx === 0) {
        // Helix Spire: circular winding orbit around center
        curX = midCorridor + Math.sin(t * Math.PI * 3.0) * 26;
        curY = 10 + t * 28;
        pw = 16;
        pd = 16;
        hexStyle = true;
      } else if (shapeIdx === 1) {
        // Hex Citadel: alternating twin hex islands
        curX = midCorridor + (i % 2 === 0 ? -20 : 20);
        curY = 12 + (i % 3) * 7;
        pw = 19;
        pd = 19;
        hexStyle = true;
      } else if (shapeIdx === 2) {
        // Twin-Arch Canyon: left/right canyon perches + center bridge
        curX = i % 3 === 0 ? midCorridor : midCorridor + (i % 2 === 0 ? 22 : -22);
        curY = 14 + Math.sin(t * Math.PI) * 16;
        pw = 17;
        pd = 19;
      } else if (shapeIdx === 3) {
        // Diamond Labyrinth: wider flared staggered plazas
        curX = midCorridor + (i % 2 === 0 ? 1 : -1) * (14 + t * 20);
        curY = 11 + (i % 2) * 8 + t * 10;
        pw = 18 - diffNorm * 3;
        pd = 18 - diffNorm * 3;
      } else if (shapeIdx === 4) {
        // Suspended Bridges: slim skywalk spans
        curX = midCorridor + (rng() - 0.5) * 16;
        curY = 18 + Math.sin(t * Math.PI * 2) * 10;
        pw = 14;
        pd = 23;
        hasBoost = i % 3 === 0;
      } else {
        // Stepped Pyramid: rising terraced ascent
        curX = midCorridor + (i % 2 === 0 ? -12 : 12);
        curY = 8 + t * 32;
        pw = 22 - t * 7;
        pd = 19 - t * 4;
      }

      curX = THREE.MathUtils.clamp(curX, zRange.minX + 12, zRange.maxX - 12);
      addPlatform(curX, curY, curZ, pw, 3.4, pd, hasBoost, 38, hexStyle);

      // Better tactical obstacles: destructible cover monoliths + solid waist cover walls + active Laser Gates!
      if (i % 2 === 0 && destructibleBuildings.length < 6) {
        addDestructibleBuilding(curX + (i % 4 === 0 ? 3.5 : -3.5), curY, curZ, 4.6, 12 + rng() * 5, 4.6);
      } else if (i % 2 === 1) {
        const barX = curX + (i % 3 === 0 ? -pw * 0.25 : pw * 0.25);
        addPlatform(barX, curY + 2.4, curZ + 2.2, 4.5, 2.4, 1.4, false, 34, false);
      }

      // Wall-Slide tactical rails along elevated platforms
      if (i % 2 === 0) {
        const slideSide = i % 4 === 0 ? -1 : 1;
        const slideX = THREE.MathUtils.clamp(curX + slideSide * (pw * 0.5 + 3.2), zRange.minX + 3, zRange.maxX - 3);
        addWallSlidePanel(slideX, curY - 2, curZ, 18, 28, 0);
      }

      // Active Laser Obstacles starting LV 2
      if (level >= 2 && (i % 2 === 1 || (level >= 8 && i === 0))) {
        const laserKinds: ArenaLaserObstacle['kind'][] = ['sweep', 'static_low', 'static_high', 'spinner'];
        const lKind = laserKinds[(level + i) % laserKinds.length];
        const laserLen = Math.max(10, Math.min(pw - 2.5, 16));
        addLaserObstacle(
          curX,
          curY,
          curZ - pd * 0.16,
          laserLen,
          lKind,
          1.35 + diffNorm * 1.45,
          i * 1.1 + level * 0.4,
        );
      }

      const midX = (prevX + curX) * 0.5;
      const midZ = (prevZ + curZ) * 0.5;
      const midY = Math.max(prevY, curY) + 23 + rng() * 8;
      addGrappleNode(midX, midY, midZ);

      if (
        isRescueLevel &&
        (i === 1 || (i === Math.floor(platformCount * 0.6) && captiveSpawns.length < 2))
      ) {
        captiveSpawns.push(new THREE.Vector3(curX + (rng() - 0.5) * 3, curY, curZ + 1.5));
      }

      const isFeaturedSlot = i === platformCount - 1 || i === Math.floor(platformCount * 0.5);
      const roll = rng();
      const dynamicPool: RobotSpawnSpec['kind'][] = [
        'scout',
        'trooper',
        'drone',
        ...(level >= 2 ? (['spider', 'cryo_stalker'] as const) : []),
        ...(level >= 3 ? (['hunter', 'pyro_bomber'] as const) : []),
        ...(level >= 4 ? (['mimic', 'volt_sniper'] as const) : []),
        ...(level >= 6 ? (['void_assassin'] as const) : []),
        ...(level >= 8 ? (['aegis_juggernaut', 'mecha_lancer'] as const) : []),
      ];
      const kind: RobotSpawnSpec['kind'] = isFeaturedSlot
        ? featuredRobot.kind
        : dynamicPool[Math.floor(roll * dynamicPool.length) % dynamicPool.length];

      robotSpawns.push({
        kind,
        position: new THREE.Vector3(
          curX,
          kind === 'drone' || kind === 'mecha_lancer' ? curY + 9 : curY,
          curZ,
        ),
        patrolRadius: Math.max(7.5, Math.min(pw, pd) * 0.52),
        hpMultiplier: hpScale,
        variantName: isFeaturedSlot ? featuredRobot.name : undefined,
        levelVariantIdx: level + i,
      });

      prevX = curX;
      prevY = curY;
      prevZ = curZ;
    }

    goalPos = new THREE.Vector3(0, -14, portalGoalZ);
  }

  if (isRescueLevel && captiveSpawns.length === 0) {
    captiveSpawns.push(new THREE.Vector3(-18, 4, portalGoalZ + 24));
  }

  const { goalRingMesh, goalLight } = buildGoalPad(goalPos, 24, 54);

  return {
    level,
    mode,
    shapeName,
    trainingMode,
    outsideWorldActive: false,
    isBossLevel,
    isRescueLevel,
    bossName,
    bossPower,
    group,
    colliders,
    grappleNodes,
    destructibleBuildings,
    laserObstacles,
    raycastMeshes,
    spawnPos,
    npcQuestPos,
    captiveSpawns,
    goalPos,
    goalLight,
    goalBeaconMat,
    goalBeamMat,
    goalPortalDiscMat,
    goalRingMesh,
    robotSpawns,
    getCorridorXRangeAtZ,
    bounds: {
      minX: -118,
      maxX: 118,
      maxY: 420,
      minZ: minZ + 1.5,
      maxZ: maxZ - 1.5,
    },
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
