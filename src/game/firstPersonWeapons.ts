import * as THREE from 'three';
import {
  GrappleHookId,
  PlayerMovementState,
  WeaponId,
  getGrappleHookConfig,
  getWeaponConfig,
} from '../types/game';

interface TracerBolt {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  mesh: THREE.Mesh;
}

export interface SlashWaveProjectile {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  damage: number;
  hitRobotIds: Set<number>;
  hitSwarmIds: Set<number>;
  mesh: THREE.Mesh;
}

interface SwingSpark {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
}

export class FirstPersonWeapons {
  public readonly root = new THREE.Group();

  // LEFT HAND: DISCONNECTED WRIST GRAPPLE HOOK LAUNCHER
  private readonly grapplePivot = new THREE.Group();
  private readonly grappleModel = new THREE.Group();
  private readonly grappleAccentMat: THREE.MeshStandardMaterial;
  private readonly grappleSpoolMesh: THREE.Mesh;
  private readonly stringEmitterPoint = new THREE.Object3D();

  // RIGHT HAND: UNIFIED ACTIVE WEAPON (SWORD OR GUN)
  private readonly rightHandPivot = new THREE.Group();
  private readonly swordModel = new THREE.Group();
  private readonly swordBladeGroup = new THREE.Group();

  // Distinct melee sub-meshes
  private readonly katanaGroup = new THREE.Group();
  private readonly duelistSaberGroup = new THREE.Group();
  private readonly axeGroup = new THREE.Group();
  private readonly lightsaberGroup = new THREE.Group();
  private readonly scytheGroup = new THREE.Group();

  // Right-hand Gun model & distinct weapon groups
  private readonly gunModel = new THREE.Group();
  private readonly sidearmGroup = new THREE.Group();
  private readonly carbineGroup = new THREE.Group();
  private readonly shotgunGroup = new THREE.Group();
  private readonly sniperScopeGroup = new THREE.Group();
  private readonly rpgTubeGroup = new THREE.Group();
  private readonly rpgWarheadMesh: THREE.Mesh;
  private readonly smgDrumMesh: THREE.Mesh;
  private readonly railcannonGroup = new THREE.Group();
  private readonly laserBoomGroup = new THREE.Group();
  private readonly laserPrismRingA: THREE.Mesh;
  private readonly laserPrismRingB: THREE.Mesh;
  private readonly laserChargeSphere: THREE.Mesh;
  private readonly laserChargeMat: THREE.MeshBasicMaterial;

  // World-space piercing mega beam for Omega Laser Boom Gun
  private readonly laserBoomBeamMesh: THREE.Mesh;
  private readonly laserBoomBeamMat: THREE.MeshBasicMaterial;
  private laserBeamTimer = 0;

  // Far-traveling Sword Barrage crescent wave projectiles
  public readonly slashWaves: SlashWaveProjectile[] = [];
  private readonly slashWaveGroup = new THREE.Group();
  private readonly slashWaveMat: THREE.MeshBasicMaterial;

  private readonly slashArcMesh: THREE.Mesh;
  private readonly slashArcMat: THREE.MeshBasicMaterial;
  private readonly swordAuraMesh: THREE.Mesh;
  private readonly swordAuraMat: THREE.MeshBasicMaterial;
  private readonly blockShieldMesh: THREE.Mesh;
  private readonly blockShieldMat: THREE.MeshBasicMaterial;
  private readonly steelBladeMat: THREE.MeshStandardMaterial;
  private readonly edgeMat: THREE.MeshStandardMaterial;
  private readonly saberCoreMat: THREE.MeshBasicMaterial;
  private readonly gunAccentMat: THREE.MeshStandardMaterial;
  private readonly muzzleFlash: THREE.Mesh;
  private readonly muzzleRingMesh: THREE.Mesh;
  private readonly muzzleFlashMat: THREE.MeshBasicMaterial;
  private readonly barrelPoint = new THREE.Object3D();

  private readonly tracers: TracerBolt[] = [];
  private readonly tracerGroup = new THREE.Group();
  private readonly tracerMat: THREE.MeshBasicMaterial;
  private readonly sparkMesh: THREE.InstancedMesh;
  private readonly sparks: SwingSpark[] = [];

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  private activeWeaponId: WeaponId = 'katana';
  private activeGrappleId: GrappleHookId = 'standard_hook';
  private slashTimer = 0;
  private slashDuration = 0.25;
  private slashFlip = 1;
  private isHeavyZipStrike = false;
  private gunRecoil = 0;
  private sniperZoomProgress = 0;
  private blockProgress = 0;
  private muzzleTimer = 0;
  private bobPhase = 0;
  private sparkSpawnAccum = 0;

  private readonly tmpWorldPos = new THREE.Vector3();
  private readonly tmpMat4 = new THREE.Matrix4();
  private readonly tmpScale = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      this.geometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      this.materials.push(m);
      return m;
    };

    const darkGripMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.78,
        metalness: 0.25,
      }),
    );
    const whiteCeramicMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.36,
        metalness: 0.14,
      }),
    );
    this.steelBladeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.14,
        metalness: 0.94,
      }),
    );
    const titaniumMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.28,
        metalness: 0.84,
      }),
    );
    const oliveLauncherMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.42,
        metalness: 0.68,
      }),
    );
    this.edgeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        emissive: 0x06b6d4,
        emissiveIntensity: 2.2,
        roughness: 0.18,
        metalness: 0.2,
      }),
    );
    this.saberCoreMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.gunAccentMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 2.2,
        roughness: 0.2,
        metalness: 0.3,
      }),
    );
    this.grappleAccentMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 2.4,
        roughness: 0.2,
        metalness: 0.3,
      }),
    );
    const scopeGlassMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 1.6,
        roughness: 0.1,
        metalness: 0.85,
      }),
    );

    // =========================================================================
    // LEFT WRIST: DISCONNECTED MAGNETIC GRAPPLE HOOK LAUNCHER
    // =========================================================================
    this.grapplePivot.position.set(-0.34, -0.29, -0.48);
    this.root.add(this.grapplePivot);
    this.grapplePivot.add(this.grappleModel);

    const gauntletCuff = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.088, 0.072, 0.24)),
      darkGripMat,
    );
    gauntletCuff.position.set(0, 0, 0.02);
    this.grappleModel.add(gauntletCuff);

    const cuffPlate = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.094, 0.028, 0.19)),
      whiteCeramicMat,
    );
    cuffPlate.position.set(0, 0.04, 0);
    this.grappleModel.add(cuffPlate);

    this.grappleSpoolMesh = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.038, 0.038, 0.06, 16)),
      titaniumMat,
    );
    this.grappleSpoolMesh.rotation.z = Math.PI * 0.5;
    this.grappleSpoolMesh.position.set(0, 0.052, -0.02);
    this.grappleModel.add(this.grappleSpoolMesh);

    const spoolGlow = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.04, 0.008, 8, 18)),
      this.grappleAccentMat,
    );
    spoolGlow.rotation.y = Math.PI * 0.5;
    spoolGlow.position.set(0, 0.052, -0.02);
    this.grappleModel.add(spoolGlow);

    const prongL = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.014, 0.11, 6)),
      this.grappleAccentMat,
    );
    prongL.rotation.x = -Math.PI * 0.5;
    prongL.position.set(-0.028, 0.028, -0.15);
    const prongR = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.014, 0.11, 6)),
      this.grappleAccentMat,
    );
    prongR.rotation.x = -Math.PI * 0.5;
    prongR.position.set(0.028, 0.028, -0.15);
    this.grappleModel.add(prongL, prongR);

    this.stringEmitterPoint.position.set(0, 0.032, -0.2);
    this.grappleModel.add(this.stringEmitterPoint);

    // =========================================================================
    // RIGHT HAND: UNIFIED WEAPON SLOT (SWORDS & GUNS SHARE THIS HAND)
    // =========================================================================
    this.rightHandPivot.position.set(0.35, -0.29, -0.51);
    this.root.add(this.rightHandPivot);

    // --- SWORD CHASSIS ---
    this.swordModel.rotation.set(0.28, -0.22, 0.22);
    this.rightHandPivot.add(this.swordModel);

    const hilt = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.022, 0.026, 0.22, 12)),
      darkGripMat,
    );
    hilt.position.set(0, -0.06, 0);
    this.swordModel.add(hilt);

    const pommel = new THREE.Mesh(
      trackGeo(new THREE.OctahedronGeometry(0.03, 0)),
      titaniumMat,
    );
    pommel.position.set(0, -0.18, 0);
    this.swordModel.add(pommel);

    const guard = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.085, 0.032, 0.11)),
      whiteCeramicMat,
    );
    guard.position.set(0, 0.055, -0.01);
    this.swordModel.add(guard);

    this.swordModel.add(this.swordBladeGroup);

    // 1. Katana / Ripper / Plasma / Void
    const blade = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.016, 0.68, 0.056)),
      this.steelBladeMat,
    );
    blade.position.set(0, 0.41, -0.01);
    const tip = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.028, 0.14, 4)),
      this.steelBladeMat,
    );
    tip.scale.set(0.35, 1, 1);
    tip.position.set(0, 0.82, -0.01);
    const edge = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.008, 0.71, 0.012)),
      this.edgeMat,
    );
    edge.position.set(0, 0.41, -0.04);
    this.katanaGroup.add(blade, tip, edge);
    this.swordBladeGroup.add(this.katanaGroup);

    // 2. Vanguard Duelist Saber (Curved sweeping cavalry saber + hand basket guard)
    const basketGuard = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.078, 0.01, 8, 16, Math.PI * 1.1)),
      titaniumMat,
    );
    basketGuard.rotation.y = Math.PI * 0.5;
    basketGuard.position.set(0, -0.02, -0.055);
    const saberSeg1 = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.014, 0.38, 0.048)),
      this.steelBladeMat,
    );
    saberSeg1.position.set(0, 0.25, -0.01);
    const saberSeg2 = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.014, 0.36, 0.042)),
      this.steelBladeMat,
    );
    saberSeg2.position.set(0, 0.59, 0.032);
    saberSeg2.rotation.x = 0.22;
    const saberArcTip = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.022, 0.14, 4)),
      this.edgeMat,
    );
    saberArcTip.scale.set(0.35, 1, 1);
    saberArcTip.position.set(0, 0.81, 0.088);
    saberArcTip.rotation.x = 0.34;
    const saberGlow1 = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.007, 0.38, 0.012)),
      this.edgeMat,
    );
    saberGlow1.position.set(0, 0.25, -0.038);
    const saberGlow2 = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.007, 0.37, 0.012)),
      this.edgeMat,
    );
    saberGlow2.position.set(0, 0.59, 0.008);
    saberGlow2.rotation.x = 0.22;
    this.duelistSaberGroup.add(
      basketGuard,
      saberSeg1,
      saberSeg2,
      saberArcTip,
      saberGlow1,
      saberGlow2,
    );
    this.duelistSaberGroup.visible = false;
    this.swordBladeGroup.add(this.duelistSaberGroup);

    // 3. Titan Battle Axe
    const axeShaft = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.022, 0.026, 0.82, 10)),
      darkGripMat,
    );
    axeShaft.position.set(0, 0.44, -0.01);
    const axeHub = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.075, 0.16, 0.12)),
      titaniumMat,
    );
    axeHub.position.set(0, 0.68, -0.01);
    const axeHeadFront = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.028, 0.34, 0.2)),
      this.steelBladeMat,
    );
    axeHeadFront.position.set(0, 0.69, -0.14);
    axeHeadFront.rotation.x = -0.18;
    const axeBevelFront = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.014, 0.36, 0.032)),
      this.edgeMat,
    );
    axeBevelFront.position.set(0, 0.69, -0.245);
    axeBevelFront.rotation.x = -0.18;
    const axeBackSpike = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.035, 0.16, 6)),
      this.edgeMat,
    );
    axeBackSpike.rotation.x = Math.PI * 0.5;
    axeBackSpike.position.set(0, 0.69, 0.11);
    this.axeGroup.add(axeShaft, axeHub, axeHeadFront, axeBevelFront, axeBackSpike);
    this.axeGroup.visible = false;
    this.swordBladeGroup.add(this.axeGroup);

    // 4. Plasma Lightsaber
    const emitter = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.034, 0.028, 0.12, 16)),
      titaniumMat,
    );
    emitter.position.set(0, 0.11, -0.01);
    const emitterRing = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.036, 0.008, 8, 16)),
      this.edgeMat,
    );
    emitterRing.rotation.x = Math.PI * 0.5;
    emitterRing.position.set(0, 0.15, -0.01);
    const saberCore = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.014, 0.014, 0.84, 12)),
      this.saberCoreMat,
    );
    saberCore.position.set(0, 0.57, -0.01);
    const saberSheath = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.03, 0.032, 0.87, 12)),
      this.edgeMat,
    );
    saberSheath.position.set(0, 0.57, -0.01);
    this.lightsaberGroup.add(emitter, emitterRing, saberCore, saberSheath);
    this.lightsaberGroup.visible = false;
    this.swordBladeGroup.add(this.lightsaberGroup);

    // 5. Reaper Crescent Scythe
    const scythePole = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.019, 0.022, 0.96, 10)),
      darkGripMat,
    );
    scythePole.position.set(0, 0.48, -0.01);
    const scytheCollar = new THREE.Mesh(
      trackGeo(new THREE.OctahedronGeometry(0.048, 0)),
      this.edgeMat,
    );
    scytheCollar.position.set(0, 0.92, -0.01);
    const scytheBladeMain = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.016, 0.12, 0.44)),
      this.steelBladeMat,
    );
    scytheBladeMain.position.set(0, 0.92, -0.22);
    scytheBladeMain.rotation.x = 0.24;
    const scytheBladeTip = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.042, 0.28, 4)),
      this.steelBladeMat,
    );
    scytheBladeTip.scale.set(0.35, 1, 1);
    scytheBladeTip.rotation.x = -Math.PI * 0.68;
    scytheBladeTip.position.set(0, 0.84, -0.49);
    const scytheEdge = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.01, 0.024, 0.46)),
      this.edgeMat,
    );
    scytheEdge.position.set(0, 0.86, -0.23);
    scytheEdge.rotation.x = 0.24;
    this.scytheGroup.add(
      scythePole,
      scytheCollar,
      scytheBladeMain,
      scytheBladeTip,
      scytheEdge,
    );
    this.scytheGroup.visible = false;
    this.swordBladeGroup.add(this.scytheGroup);

    this.swordAuraMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.swordAuraMesh = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.042, 0.065, 0.86, 12, 1, true)),
      this.swordAuraMat,
    );
    this.swordAuraMesh.position.set(0, 0.46, -0.015);
    this.swordBladeGroup.add(this.swordAuraMesh);

    // --- RIGHT-HAND GUN MODEL ---
    this.rightHandPivot.add(this.gunModel);
    this.gunModel.visible = false;

    const gunGrip = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.045, 0.14, 0.055)),
      darkGripMat,
    );
    gunGrip.position.set(0, -0.06, 0.06);
    gunGrip.rotation.x = 0.25;
    this.gunModel.add(gunGrip);

    const receiver = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.058, 0.068, 0.28)),
      darkGripMat,
    );
    receiver.position.set(0, 0.01, -0.02);
    this.gunModel.add(receiver);

    const shroud = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.068, 0.056, 0.34)),
      whiteCeramicMat,
    );
    shroud.position.set(0, 0.052, -0.05);
    this.gunModel.add(shroud);

    const railL = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.012, 0.026, 0.22)),
      this.steelBladeMat,
    );
    railL.position.set(-0.022, 0.05, -0.26);
    this.gunModel.add(railL);

    const railR = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.012, 0.026, 0.22)),
      this.steelBladeMat,
    );
    railR.position.set(0.022, 0.05, -0.26);
    this.gunModel.add(railR);

    const capStrip = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.022, 0.016, 0.26)),
      this.gunAccentMat,
    );
    capStrip.position.set(0, 0.084, -0.08);
    this.gunModel.add(capStrip);

    const optic = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.038, 0.03, 0.055)),
      titaniumMat,
    );
    optic.position.set(0, 0.098, 0.01);
    this.gunModel.add(optic);

    // Sidearm Tactical Holo-Sight + Underbarrel Laser
    const sidearmHoloFrame = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.036, 0.028, 0.044)),
      titaniumMat,
    );
    sidearmHoloFrame.position.set(0, 0.112, -0.02);
    const sidearmHoloLens = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.022, 0.018, 0.008)),
      this.gunAccentMat,
    );
    sidearmHoloLens.position.set(0, 0.114, -0.02);
    const sidearmLaserPod = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.11, 10)),
      darkGripMat,
    );
    sidearmLaserPod.rotation.x = Math.PI * 0.5;
    sidearmLaserPod.position.set(0, 0.008, -0.2);
    this.sidearmGroup.add(sidearmHoloFrame, sidearmHoloLens, sidearmLaserPod);
    this.sidearmGroup.visible = false;
    this.gunModel.add(this.sidearmGroup);

    // Striker Pulse Carbine (Ventilated Shroud + Heat Fins + ACOG Prism + Shoulder Stock)
    const carbineShroud = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.056, 0.052, 0.34)),
      titaniumMat,
    );
    carbineShroud.position.set(0, 0.052, -0.3);
    const carbineStock = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.044, 0.088, 0.18)),
      darkGripMat,
    );
    carbineStock.position.set(0, 0.012, 0.18);
    const acogBody = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.022, 0.02, 0.11, 12)),
      darkGripMat,
    );
    acogBody.rotation.x = Math.PI * 0.5;
    acogBody.position.set(0, 0.12, -0.04);
    const acogLens = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12)),
      this.gunAccentMat,
    );
    acogLens.rotation.x = Math.PI * 0.5;
    acogLens.position.set(0, 0.12, -0.095);
    this.carbineGroup.add(carbineShroud, carbineStock, acogBody, acogLens);
    for (let f = 0; f < 4; f++) {
      const fin = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.072, 0.012, 0.022)),
        this.gunAccentMat,
      );
      fin.position.set(0, 0.074, -0.22 - f * 0.055);
      this.carbineGroup.add(fin);
    }
    this.carbineGroup.visible = false;
    this.gunModel.add(this.carbineGroup);

    // Breacher Scatter Shotgun (Twin-Bore Barrel + Pump Foregrip + Side Shell Rack + Choke)
    const shotBarrelTop = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.38, 12)),
      titaniumMat,
    );
    shotBarrelTop.rotation.x = Math.PI * 0.5;
    shotBarrelTop.position.set(-0.02, 0.064, -0.3);
    const shotBarrelR = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.38, 12)),
      titaniumMat,
    );
    shotBarrelR.rotation.x = Math.PI * 0.5;
    shotBarrelR.position.set(0.02, 0.064, -0.3);
    const shotPump = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.074, 0.048, 0.16)),
      darkGripMat,
    );
    shotPump.position.set(0, 0.02, -0.26);
    const shotChoke = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.088, 0.055, 0.045)),
      this.gunAccentMat,
    );
    shotChoke.position.set(0, 0.055, -0.47);
    this.shotgunGroup.add(shotBarrelTop, shotBarrelR, shotPump, shotChoke);
    for (let s = 0; s < 4; s++) {
      const shell = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.009, 0.009, 0.04, 8)),
        scopeGlassMat,
      );
      shell.position.set(-0.044, 0.045, -0.02 - s * 0.026);
      this.shotgunGroup.add(shell);
    }
    this.shotgunGroup.visible = false;
    this.gunModel.add(this.shotgunGroup);

    // Sniper Long Barrel + Telescopic Zoom Scope Lens
    const sniperBarrel = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.014, 0.018, 0.42, 10)),
      titaniumMat,
    );
    sniperBarrel.rotation.x = Math.PI * 0.5;
    sniperBarrel.position.set(0, 0.052, -0.42);
    const scopeTube = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.026, 0.024, 0.22, 14)),
      darkGripMat,
    );
    scopeTube.rotation.x = Math.PI * 0.5;
    scopeTube.position.set(0, 0.125, -0.03);
    const scopeLensFront = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 0.01, 14)),
      scopeGlassMat,
    );
    scopeLensFront.rotation.x = Math.PI * 0.5;
    scopeLensFront.position.set(0, 0.125, -0.14);
    const scopeLensRear = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 14)),
      scopeGlassMat,
    );
    scopeLensRear.rotation.x = Math.PI * 0.5;
    scopeLensRear.position.set(0, 0.125, 0.08);
    this.sniperScopeGroup.add(sniperBarrel, scopeTube, scopeLensFront, scopeLensRear);
    this.sniperScopeGroup.visible = false;
    this.gunModel.add(this.sniperScopeGroup);

    // Hydra RPG Launcher Tube
    const rpgTube = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.068, 0.068, 0.62, 14)),
      oliveLauncherMat,
    );
    rpgTube.rotation.x = Math.PI * 0.5;
    rpgTube.position.set(0, 0.065, -0.1);
    const rpgBell = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.082, 0.068, 0.09, 14)),
      titaniumMat,
    );
    rpgBell.rotation.x = Math.PI * 0.5;
    rpgBell.position.set(0, 0.065, -0.4);
    this.rpgWarheadMesh = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.052, 0.15, 10)),
      this.gunAccentMat,
    );
    this.rpgWarheadMesh.rotation.x = -Math.PI * 0.5;
    this.rpgWarheadMesh.position.set(0, 0.065, -0.49);
    this.rpgTubeGroup.add(rpgTube, rpgBell, this.rpgWarheadMesh);
    this.rpgTubeGroup.visible = false;
    this.gunModel.add(this.rpgTubeGroup);

    // SMG Compact Side Magazine Drum
    this.smgDrumMesh = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 0.045, 14)),
      titaniumMat,
    );
    this.smgDrumMesh.rotation.z = Math.PI * 0.5;
    this.smgDrumMesh.position.set(0.048, -0.025, -0.08);
    this.smgDrumMesh.visible = false;
    this.gunModel.add(this.smgDrumMesh);

    // Heavy Gauss Railcannon (Split Twin Accelerator Rails + 3 Glowing Coil Rings + Crimson Optic)
    const railTop = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.042, 0.026, 0.52)),
      whiteCeramicMat,
    );
    railTop.position.set(0, 0.086, -0.34);
    const railBottom = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.042, 0.026, 0.52)),
      whiteCeramicMat,
    );
    railBottom.position.set(0, 0.024, -0.34);
    const railCore = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.48, 10)),
      this.gunAccentMat,
    );
    railCore.rotation.x = Math.PI * 0.5;
    railCore.position.set(0, 0.055, -0.32);
    const railOptic = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.024, 0.022, 0.16, 12)),
      darkGripMat,
    );
    railOptic.rotation.x = Math.PI * 0.5;
    railOptic.position.set(0, 0.132, -0.06);
    const railOpticGlass = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 12)),
      scopeGlassMat,
    );
    railOpticGlass.rotation.x = Math.PI * 0.5;
    railOpticGlass.position.set(0, 0.132, -0.142);
    this.railcannonGroup.add(railTop, railBottom, railCore, railOptic, railOpticGlass);
    for (let c = 0; c < 3; c++) {
      const coil = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(0.044, 0.008, 8, 16)),
        this.gunAccentMat,
      );
      coil.position.set(0, 0.055, -0.22 - c * 0.13);
      this.railcannonGroup.add(coil);
    }
    this.railcannonGroup.visible = false;
    this.gunModel.add(this.railcannonGroup);

    // Omega Laser Boom Gun (Massive Twin-Prism Capacitor Barrel + Spinning Rings + Charge Core)
    const laserBody = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.11, 0.12, 0.52)),
      darkGripMat,
    );
    laserBody.position.set(0, 0.06, -0.14);
    this.laserPrismRingA = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.072, 0.012, 8, 20)),
      this.gunAccentMat,
    );
    this.laserPrismRingA.position.set(0, 0.06, -0.24);
    this.laserPrismRingB = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.064, 0.012, 8, 20)),
      this.gunAccentMat,
    );
    this.laserPrismRingB.position.set(0, 0.06, -0.38);
    this.laserChargeMat = trackMat(
      new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.9 }),
    );
    this.laserChargeSphere = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.045, 14, 12)),
      this.laserChargeMat,
    );
    this.laserChargeSphere.position.set(0, 0.06, -0.45);
    this.laserBoomGroup.add(
      laserBody,
      this.laserPrismRingA,
      this.laserPrismRingB,
      this.laserChargeSphere,
    );
    this.laserBoomGroup.visible = false;
    this.gunModel.add(this.laserBoomGroup);

    this.muzzleFlashMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.muzzleFlash = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.065, 0.22, 8)),
      this.muzzleFlashMat,
    );
    this.muzzleFlash.rotation.x = Math.PI * 0.5;
    this.muzzleFlash.position.set(0, 0.05, -0.42);
    this.gunModel.add(this.muzzleFlash);

    this.muzzleRingMesh = new THREE.Mesh(
      trackGeo(new THREE.RingGeometry(0.04, 0.14, 6)),
      this.muzzleFlashMat,
    );
    this.muzzleRingMesh.position.set(0, 0.05, -0.42);
    this.gunModel.add(this.muzzleRingMesh);

    this.barrelPoint.position.set(0, 0.05, -0.42);
    this.gunModel.add(this.barrelPoint);

    // Block Guard Energy Shield Plane
    this.blockShieldMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.blockShieldMesh = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.018, 6)),
      this.blockShieldMat,
    );
    this.blockShieldMesh.rotation.x = Math.PI * 0.5;
    this.blockShieldMesh.position.set(0, -0.02, -0.58);
    this.root.add(this.blockShieldMesh);

    // Dynamic Slash Arc Ribbon
    this.slashArcMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.slashArcMesh = new THREE.Mesh(
      trackGeo(new THREE.RingGeometry(0.32, 0.68, 24, 1, -Math.PI * 0.48, Math.PI * 0.96)),
      this.slashArcMat,
    );
    this.slashArcMesh.position.set(0.04, -0.04, -0.68);
    this.slashArcMesh.rotation.set(0.35, 0.1, -0.45);
    this.root.add(this.slashArcMesh);

    // --- WORLD-SPACE LASER BOOM MEGA BEAM ---
    const beamGeo = trackGeo(new THREE.CylinderGeometry(0.62, 0.95, 1, 14, 1, true));
    beamGeo.translate(0, 0.5, 0);
    beamGeo.rotateX(Math.PI * 0.5);
    this.laserBoomBeamMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xf472b6,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.laserBoomBeamMesh = new THREE.Mesh(beamGeo, this.laserBoomBeamMat);
    this.laserBoomBeamMesh.visible = false;
    this.laserBoomBeamMesh.frustumCulled = false;
    scene.add(this.laserBoomBeamMesh);

    // --- WORLD-SPACE FAR-TRAVELING SWORD BARRAGE SLASH WAVES ---
    scene.add(this.slashWaveGroup);
    const waveGeo = trackGeo(
      new THREE.RingGeometry(1.1, 2.35, 18, 1, -Math.PI * 0.42, Math.PI * 0.84),
    );
    waveGeo.rotateX(Math.PI * 0.5);
    this.slashWaveMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(waveGeo, this.slashWaveMat);
      mesh.visible = false;
      this.slashWaveGroup.add(mesh);
      this.slashWaves.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.5,
        damage: 100,
        hitRobotIds: new Set<number>(),
        hitSwarmIds: new Set<number>(),
        mesh,
      });
    }

    // --- WORLD-SPACE TRACER BOLT POOL ---
    scene.add(this.tracerGroup);
    const tracerGeo = trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 2.8, 6));
    tracerGeo.rotateX(Math.PI * 0.5);
    this.tracerMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));

    for (let i = 0; i < 32; i++) {
      const mesh = new THREE.Mesh(tracerGeo, this.tracerMat);
      mesh.visible = false;
      this.tracerGroup.add(mesh);
      this.tracers.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.22,
        mesh,
      });
    }

    // --- GRAPPLE & BLOCK SPARK POOL ---
    const sparkGeo = trackGeo(new THREE.OctahedronGeometry(0.075, 0));
    const sparkMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, 64);
    this.sparkMesh.frustumCulled = false;
    scene.add(this.sparkMesh);
    for (let i = 0; i < 64; i++) {
      this.sparks.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
      });
      this.tmpMat4.makeScale(0, 0, 0);
      this.sparkMesh.setMatrixAt(i, this.tmpMat4);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
  }

  public applyLoadout(weaponId: WeaponId, grappleId: GrappleHookId): void {
    this.activeWeaponId = weaponId;
    this.activeGrappleId = grappleId;

    const wCfg = getWeaponConfig(weaponId);
    const gCfg = getGrappleHookConfig(grappleId);

    this.grappleAccentMat.color.set(gCfg.accentColor);
    this.grappleAccentMat.emissive.set(gCfg.accentColor);
    this.grappleModel.scale.setScalar(
      grappleId === 'quantum_hook' ? 1.18 : grappleId === 'titanium_winch' ? 1.09 : 1.0,
    );

    const isSword = wCfg.category === 'sword';
    this.swordModel.visible = isSword;
    this.gunModel.visible = !isSword;

    if (isSword) {
      this.steelBladeMat.color.set(wCfg.bladeColor ?? '#e2e8f0');
      this.edgeMat.color.set(wCfg.accentColor);
      this.edgeMat.emissive.set(wCfg.accentColor);
      this.swordAuraMat.color.set(wCfg.accentColor);
      this.slashArcMat.color.set(wCfg.accentColor);
      this.slashWaveMat.color.set(wCfg.accentColor);

      this.katanaGroup.visible =
        weaponId === 'katana' || weaponId === 'ripper' || weaponId === 'plasma' || weaponId === 'void';
      this.duelistSaberGroup.visible = weaponId === 'saber';
      this.axeGroup.visible = weaponId === 'axe';
      this.lightsaberGroup.visible = weaponId === 'lightsaber';
      this.scytheGroup.visible = weaponId === 'scythe';

      const bladeScaleY =
        weaponId === 'axe' || weaponId === 'scythe' || weaponId === 'lightsaber' || weaponId === 'saber'
          ? 1.05
          : 1 + (wCfg.reachBonus ?? 0.4) * 0.14;
      this.swordBladeGroup.scale.set(
        weaponId === 'void' ? 1.25 : weaponId === 'plasma' ? 1.15 : 1,
        bladeScaleY,
        1,
      );
    } else {
      this.gunAccentMat.color.set(wCfg.accentColor);
      this.gunAccentMat.emissive.set(wCfg.accentColor);
      this.muzzleFlashMat.color.set(wCfg.accentColor);
      this.tracerMat.color.set(wCfg.accentColor);

      this.sidearmGroup.visible = weaponId === 'sidearm';
      this.carbineGroup.visible = weaponId === 'carbine';
      this.shotgunGroup.visible = weaponId === 'shotgun';
      this.sniperScopeGroup.visible = weaponId === 'sniper';
      this.rpgTubeGroup.visible = weaponId === 'rpg';
      this.smgDrumMesh.visible = weaponId === 'smg';
      this.railcannonGroup.visible = weaponId === 'railcannon';
      this.laserBoomGroup.visible = weaponId === 'laser_boom';

      if (weaponId === 'shotgun') {
        this.gunModel.scale.set(1.12, 1.08, 1.02);
      } else if (weaponId === 'railcannon') {
        this.gunModel.scale.set(1.12, 1.1, 1.18);
      } else if (weaponId === 'sniper') {
        this.gunModel.scale.set(1.0, 1.02, 1.18);
      } else if (weaponId === 'rpg') {
        this.gunModel.scale.set(1.12, 1.12, 1.12);
      } else if (weaponId === 'laser_boom') {
        this.gunModel.scale.set(1.18, 1.18, 1.24);
      } else if (weaponId === 'smg') {
        this.gunModel.scale.set(0.95, 0.96, 0.9);
      } else if (weaponId === 'carbine') {
        this.gunModel.scale.set(1.04, 1.02, 1.08);
      } else {
        this.gunModel.scale.set(0.94, 0.94, 0.92);
      }
    }
  }

  public clearProjectiles(): void {
    for (const sw of this.slashWaves) {
      sw.active = false;
      sw.mesh.visible = false;
    }
    for (const tr of this.tracers) {
      tr.active = false;
      tr.mesh.visible = false;
    }
    this.laserBeamTimer = 0;
    this.laserBoomBeamMesh.visible = false;
  }

  public spawnDeflectSparks(): void {
    this.blockShieldMesh.getWorldPosition(this.tmpWorldPos);
    for (let k = 0; k < 12; k++) {
      const slot = this.sparks.find((s) => !s.active) ?? this.sparks[k % this.sparks.length];
      slot.active = true;
      slot.pos.copy(this.tmpWorldPos);
      slot.vel.set(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.3) * 12,
        (Math.random() - 0.5) * 14,
      );
      slot.life = 0.32;
    }
  }

  public triggerSwordSlash(heavyZipStrike = false): void {
    this.isHeavyZipStrike = heavyZipStrike;
    this.slashFlip = -this.slashFlip;
    if (this.activeWeaponId === 'axe') {
      this.slashDuration = heavyZipStrike ? 0.38 : 0.34;
      this.slashArcMesh.rotation.set(0.15, 0.0, Math.PI * 0.5);
      this.slashArcMesh.scale.setScalar(heavyZipStrike ? 1.7 : 1.35);
    } else if (this.activeWeaponId === 'scythe') {
      this.slashDuration = heavyZipStrike ? 0.36 : 0.31;
      this.slashArcMesh.rotation.set(1.18, 0, 0.05);
      this.slashArcMesh.scale.setScalar(heavyZipStrike ? 1.85 : 1.5);
    } else if (this.activeWeaponId === 'lightsaber' || this.activeWeaponId === 'saber') {
      this.slashDuration = heavyZipStrike ? 0.28 : 0.19;
      this.slashArcMesh.rotation.set(0.35, 0.1, this.slashFlip > 0 ? -0.58 : 0.58);
      this.slashArcMesh.scale.setScalar(heavyZipStrike ? 1.65 : 1.25);
    } else {
      this.slashDuration = heavyZipStrike ? 0.34 : 0.24;
      this.slashArcMesh.rotation.set(0.35, 0.1, heavyZipStrike ? -0.25 : -0.75 + Math.random() * 0.6);
      this.slashArcMesh.scale.setScalar(heavyZipStrike ? 1.55 : 1.05);
    }
    this.slashTimer = this.slashDuration;
  }

  public triggerSwordBarrage(
    origin: THREE.Vector3,
    camDir: THREE.Vector3,
    waveDamage: number,
  ): void {
    this.triggerSwordSlash(true);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(camDir, up).normalize();
    const offsets = [-0.26, -0.13, 0, 0.13, 0.26];

    for (let i = 0; i < offsets.length; i++) {
      const slot = this.slashWaves.find((w) => !w.active) ?? this.slashWaves[i % this.slashWaves.length];
      slot.active = true;
      slot.pos.copy(origin).addScaledVector(camDir, 2.2);
      const dir = camDir.clone().addScaledVector(right, offsets[i]).normalize();
      slot.vel.copy(dir).multiplyScalar(86);
      slot.maxLife = 1.65; // Travels ~142m across the arena!
      slot.life = slot.maxLife;
      slot.damage = waveDamage;
      slot.hitRobotIds.clear();
      slot.hitSwarmIds.clear();

      slot.mesh.position.copy(slot.pos);
      slot.mesh.lookAt(slot.pos.clone().add(dir));
      slot.mesh.rotateZ((i - 2) * 0.32);
      slot.mesh.scale.setScalar(1.25);
      slot.mesh.visible = true;
    }
  }

  public triggerGunShot(targetWorldPos: THREE.Vector3, heavy = false, isRocket = false): void {
    this.gunRecoil = isRocket ? 2.1 : heavy ? 1.55 : 0.95;
    this.muzzleTimer = isRocket ? 0.15 : heavy ? 0.1 : 0.065;

    this.barrelPoint.getWorldPosition(this.tmpWorldPos);
    const bolt = this.tracers.find((t) => !t.active) ?? this.tracers[0];
    bolt.active = true;
    bolt.pos.copy(this.tmpWorldPos);

    const dir = targetWorldPos.clone().sub(this.tmpWorldPos);
    const dist = Math.max(2, dir.length());
    dir.normalize();
    const speed = isRocket ? 140 : 280;
    bolt.vel.copy(dir).multiplyScalar(speed);
    bolt.maxLife = Math.min(isRocket ? 0.65 : 0.28, dist / speed);
    bolt.life = bolt.maxLife;
    bolt.mesh.position.copy(bolt.pos);
    bolt.mesh.scale.set(
      isRocket ? 3.2 : heavy ? 1.85 : 1,
      isRocket ? 3.2 : heavy ? 1.85 : 1,
      isRocket ? 2.6 : heavy ? 1.6 : 1,
    );
    bolt.mesh.lookAt(targetWorldPos);
    bolt.mesh.visible = true;
  }

  public triggerLaserBoomBeam(endWorldPos: THREE.Vector3): void {
    this.gunRecoil = 2.6;
    this.muzzleTimer = 0.22;
    this.barrelPoint.getWorldPosition(this.tmpWorldPos);
    const dist = Math.max(12, this.tmpWorldPos.distanceTo(endWorldPos));
    this.laserBoomBeamMesh.position.copy(this.tmpWorldPos);
    this.laserBoomBeamMesh.lookAt(endWorldPos);
    this.laserBoomBeamMesh.scale.set(1.5, 1.5, dist);
    this.laserBoomBeamMesh.visible = true;
    this.laserBeamTimer = 0.42;
  }

  public getStringEmitterWorldPos(out: THREE.Vector3): THREE.Vector3 {
    this.stringEmitterPoint.getWorldPosition(out);
    return out;
  }

  public update(
    dt: number,
    realDt: number,
    movementState: PlayerMovementState,
    speedMps: number,
    isCrouching: boolean,
    isSwinging: boolean,
    isZipping: boolean,
    isBlocking: boolean,
    activeWeaponId: WeaponId,
    sniperZoomed = false,
    laserChargeRatio = 0,
  ): void {
    if (this.activeWeaponId !== activeWeaponId) {
      this.applyLoadout(activeWeaponId, this.activeGrappleId);
    }

    const wCfg = getWeaponConfig(activeWeaponId);
    const isSword = wCfg.category === 'sword';

    const isMovingGround =
      movementState === 'walk' ||
      movementState === 'sprint' ||
      movementState === 'crouch';
    const bobRate =
      movementState === 'sprint' ? 14.5 : movementState === 'crouch' ? 6.2 : 9.2;
    this.bobPhase += dt * (isMovingGround ? bobRate : 2.1);

    const bobAmp = sniperZoomed
      ? 0.002
      : isMovingGround
        ? movementState === 'sprint'
          ? 0.026
          : movementState === 'crouch'
            ? 0.008
            : 0.015
        : 0.004;

    const bobX = Math.cos(this.bobPhase * 0.5) * bobAmp;
    const bobY = Math.abs(Math.sin(this.bobPhase)) * -bobAmp;
    const crouchY = isCrouching ? -0.05 : 0;
    const sprintTilt = movementState === 'sprint' ? 0.14 : 0;
    const airPull = Math.min(0.05, speedMps * 0.0012);

    // Block Shield update
    this.blockProgress = THREE.MathUtils.lerp(
      this.blockProgress,
      isBlocking ? 1 : 0,
      Math.min(1, realDt * 16),
    );
    this.blockShieldMesh.visible = this.blockProgress > 0.04;
    this.blockShieldMat.opacity = this.blockProgress * 0.24;
    this.blockShieldMesh.rotation.y += realDt * 3.5;

    // LEFT WRIST GRAPPLE HOOK ANIMATION
    const tethered = isSwinging || isZipping;
    this.grappleSpoolMesh.rotation.x += realDt * (isZipping ? 28 : isSwinging ? 14 : 1.5);
    this.grappleAccentMat.emissiveIntensity = isZipping ? 4.5 : isSwinging ? 3.4 : 2.0;

    const grappleLiftY = isZipping ? 0.08 : isSwinging ? 0.05 : 0;
    const grappleReachZ = isZipping ? -0.14 : isSwinging ? -0.08 : 0;
    const grapplePitch = isZipping ? 0.18 : isSwinging ? 0.14 : 0;
    this.grapplePivot.position.set(
      -0.34 - bobX * 0.85,
      -0.29 + bobY * 0.85 + crouchY + grappleLiftY,
      -0.48 + airPull + grappleReachZ,
    );
    this.grapplePivot.rotation.set(
      grapplePitch - sprintTilt * 0.7,
      isCrouching ? -0.1 : 0,
      sprintTilt * 0.45,
    );

    if (tethered) {
      this.sparkSpawnAccum += realDt * (isZipping ? 55 : 28);
      if (this.sparkSpawnAccum >= 1) {
        this.sparkSpawnAccum -= 1;
        this.stringEmitterPoint.getWorldPosition(this.tmpWorldPos);
        const slot = this.sparks.find((s) => !s.active) ?? this.sparks[0];
        slot.active = true;
        slot.pos.copy(this.tmpWorldPos);
        slot.vel.set(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6,
        );
        slot.life = isZipping ? 0.36 : 0.24;
      }
    }

    let sparksDirty = false;
    for (let i = 0; i < this.sparks.length; i++) {
      const s = this.sparks[i];
      if (!s.active) continue;
      sparksDirty = true;
      s.life -= realDt;
      if (s.life <= 0) {
        s.active = false;
        this.tmpMat4.makeScale(0, 0, 0);
        this.sparkMesh.setMatrixAt(i, this.tmpMat4);
        continue;
      }
      s.pos.addScaledVector(s.vel, realDt);
      this.tmpScale.setScalar(s.life * 3.0);
      this.tmpMat4.makeTranslation(s.pos.x, s.pos.y, s.pos.z);
      this.tmpMat4.scale(this.tmpScale);
      this.sparkMesh.setMatrixAt(i, this.tmpMat4);
    }
    if (sparksDirty) {
      this.sparkMesh.instanceMatrix.needsUpdate = true;
    }

    // RIGHT HAND: ACTIVE SWORD OR GUN
    let slashRotX = 0;
    let slashRotY = 0;
    let slashRotZ = 0;
    let slashOffsetX = 0;
    let slashOffsetY = 0;
    let slashOffsetZ = 0;

    if (this.slashTimer > 0) {
      this.slashTimer = Math.max(0, this.slashTimer - dt);
      const p = 1 - this.slashTimer / this.slashDuration;
      const swingCurve = Math.sin(p * Math.PI);

      if (this.activeWeaponId === 'axe') {
        const windup = p < 0.28 ? -p / 0.28 : 1 - (p - 0.28) / 0.72;
        slashRotX = p < 0.28 ? 0.55 * (p / 0.28) : -1.65 * Math.sin(((p - 0.28) / 0.72) * Math.PI);
        slashRotY = 0.12 * swingCurve;
        slashRotZ = -0.15 * windup;
        slashOffsetY = p < 0.28 ? 0.18 * (p / 0.28) : -0.14 * swingCurve;
        slashOffsetZ = -0.26 * swingCurve;
      } else if (this.activeWeaponId === 'saber') {
        // Quick forward lunge + curved sweeping arc
        slashRotX = -1.15 * swingCurve;
        slashRotY = 0.55 * this.slashFlip * swingCurve;
        slashRotZ = 0.65 * this.slashFlip * swingCurve;
        slashOffsetX = -0.18 * swingCurve;
        slashOffsetZ = -0.32 * swingCurve;
      } else if (this.activeWeaponId === 'lightsaber') {
        const dir = this.slashFlip;
        slashRotX = -0.85 * swingCurve;
        slashRotY = 1.15 * dir * Math.sin(p * Math.PI * 1.4);
        slashRotZ = 1.35 * dir * swingCurve;
        slashOffsetX = -0.28 * swingCurve;
        slashOffsetZ = -0.18 * swingCurve;
      } else if (this.activeWeaponId === 'scythe') {
        slashRotX = -0.35 * swingCurve;
        slashRotY = 1.75 * Math.sin(p * Math.PI);
        slashRotZ = 1.32 * swingCurve;
        slashOffsetX = -0.34 * swingCurve;
        slashOffsetZ = -0.24 * swingCurve;
      } else if (this.isHeavyZipStrike) {
        slashRotX = -1.25 * swingCurve;
        slashRotY = 0.55 * swingCurve;
        slashRotZ = 1.05 * swingCurve;
        slashOffsetX = -0.22 * swingCurve;
        slashOffsetZ = -0.22 * swingCurve;
      } else {
        slashRotX = -0.95 * swingCurve;
        slashRotY = 0.72 * swingCurve;
        slashRotZ = 0.88 * swingCurve;
        slashOffsetX = -0.24 * swingCurve;
        slashOffsetZ = -0.14 * swingCurve;
      }
      this.slashArcMat.opacity = swingCurve * (this.isHeavyZipStrike ? 0.94 : 0.76);
      this.slashArcMesh.rotation.y = (p - 0.5) * (this.activeWeaponId === 'scythe' ? 2.4 : 1.4);
    } else {
      this.slashArcMat.opacity = 0;
    }

    const targetAuraOpacity = isBlocking
      ? 0.45
      : this.activeWeaponId === 'lightsaber'
        ? 0.25
        : this.slashTimer > 0
          ? 0.35
          : 0;
    this.swordAuraMat.opacity = THREE.MathUtils.lerp(
      this.swordAuraMat.opacity,
      targetAuraOpacity,
      Math.min(1, realDt * 12),
    );
    this.swordAuraMesh.rotation.y += realDt * 9;
    this.edgeMat.emissiveIntensity = isBlocking
      ? 3.8
      : this.activeWeaponId === 'lightsaber'
        ? 3.4
        : 2.1;

    this.sniperZoomProgress = THREE.MathUtils.lerp(
      this.sniperZoomProgress,
      !isSword && sniperZoomed ? 1 : 0,
      Math.min(1, realDt * 15),
    );

    this.gunRecoil = Math.max(0, this.gunRecoil - realDt * 8.2);
    if (this.muzzleTimer > 0) {
      this.muzzleTimer = Math.max(0, this.muzzleTimer - realDt);
      this.muzzleFlashMat.opacity = Math.min(1, this.muzzleTimer / 0.04);
      this.muzzleFlash.rotation.z += realDt * 42;
      this.muzzleFlash.scale.setScalar(0.9 + Math.random() * 0.5);
      this.muzzleRingMesh.visible = true;
      this.muzzleRingMesh.rotation.z -= realDt * 28;
      this.muzzleRingMesh.scale.setScalar(1.0 + Math.random() * 0.6);
    } else {
      this.muzzleFlashMat.opacity = 0;
      this.muzzleRingMesh.visible = false;
    }

    if (activeWeaponId === 'laser_boom') {
      const cScale = 0.45 + laserChargeRatio * 2.1;
      this.laserChargeSphere.scale.setScalar(cScale);
      this.laserChargeMat.opacity = 0.45 + laserChargeRatio * 0.55;
      const spinSpd = 1.8 + laserChargeRatio * 18;
      this.laserPrismRingA.rotation.z += realDt * spinSpd;
      this.laserPrismRingB.rotation.z -= realDt * spinSpd * 1.25;
    }

    if (this.laserBeamTimer > 0) {
      this.laserBeamTimer = Math.max(0, this.laserBeamTimer - realDt);
      this.laserBoomBeamMat.opacity = Math.min(1, (this.laserBeamTimer / 0.42) * 0.92);
      if (this.laserBeamTimer <= 0) {
        this.laserBoomBeamMesh.visible = false;
      }
    }

    const guardOffsetX = -0.44 * this.blockProgress;
    const guardOffsetY = 0.22 * this.blockProgress;
    const guardOffsetZ = -0.06 * this.blockProgress;
    const guardRotX = -0.34 * this.blockProgress;
    const guardRotY = 0.72 * this.blockProgress;
    const guardRotZ = 1.06 * this.blockProgress;

    this.rightHandPivot.visible = !(wCfg.isOpticScope && this.sniperZoomProgress > 0.72);
    this.rightHandPivot.position.set(
      THREE.MathUtils.lerp(0.35 + bobX + slashOffsetX + guardOffsetX, 0, this.sniperZoomProgress),
      THREE.MathUtils.lerp(
        -0.29 + bobY + crouchY + slashOffsetY + this.gunRecoil * 0.025 + guardOffsetY,
        -0.115 + this.gunRecoil * 0.015,
        this.sniperZoomProgress,
      ),
      THREE.MathUtils.lerp(
        -0.51 + airPull + slashOffsetZ + this.gunRecoil * 0.13 + guardOffsetZ,
        -0.34 + this.gunRecoil * 0.09,
        this.sniperZoomProgress,
      ),
    );
    this.rightHandPivot.rotation.set(
      (isSword ? slashRotX : this.gunRecoil * 0.3) - sprintTilt * 0.7 * (1 - this.sniperZoomProgress) + guardRotX,
      (isSword ? slashRotY : 0) + (isCrouching ? 0.1 * (1 - this.sniperZoomProgress) : 0) + guardRotY,
      (isSword ? slashRotZ : 0) - sprintTilt * 0.45 * (1 - this.sniperZoomProgress) + guardRotZ,
    );

    // Advance World-Space Slash Waves & Tracers
    for (const sw of this.slashWaves) {
      if (!sw.active) continue;
      sw.life -= dt;
      if (sw.life <= 0) {
        sw.active = false;
        sw.mesh.visible = false;
        continue;
      }
      sw.pos.addScaledVector(sw.vel, dt);
      sw.mesh.position.copy(sw.pos);
      const pulse = 1.25 + (1 - sw.life / sw.maxLife) * 1.1;
      sw.mesh.scale.setScalar(pulse);
    }

    for (const bolt of this.tracers) {
      if (!bolt.active) continue;
      bolt.life -= dt;
      if (bolt.life <= 0) {
        bolt.active = false;
        bolt.mesh.visible = false;
        continue;
      }
      bolt.pos.addScaledVector(bolt.vel, dt);
      bolt.mesh.position.copy(bolt.pos);
    }
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.tracerGroup.removeFromParent();
    this.slashWaveGroup.removeFromParent();
    this.laserBoomBeamMesh.removeFromParent();
    this.sparkMesh.removeFromParent();
  }
}
