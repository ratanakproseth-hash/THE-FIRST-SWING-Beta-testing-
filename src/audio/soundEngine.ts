import {
  BossPowerId,
  GunWeaponId,
  SwordWeaponId,
  WeaponId,
  getWeaponConfig,
} from '../types/game';

export class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private tensionGain: GainNode | null = null;
  private tensionOsc: OscillatorNode | null = null;
  private musicGain: GainNode | null = null;
  private musicActive = false;
  private musicStepAccum = 0;
  private musicStepIdx = 0;
  private noiseBuffer: AudioBuffer | null = null;
  private initialized = false;
  private volume = 0.78;
  private muted = false;

  public init(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.volume;
    this.masterGain.connect(this.ctx.destination);

    const sampleRate = this.ctx.sampleRate;
    const len = Math.floor(sampleRate * 2.5);
    this.noiseBuffer = this.ctx.createBuffer(1, len, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = this.noiseBuffer;
    windSrc.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 340;
    this.windFilter.Q.value = 0.85;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0;

    windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    windSrc.start();

    this.tensionOsc = this.ctx.createOscillator();
    this.tensionOsc.type = 'triangle';
    this.tensionOsc.frequency.value = 110;

    const tensionFilter = this.ctx.createBiquadFilter();
    tensionFilter.type = 'lowpass';
    tensionFilter.frequency.value = 620;

    this.tensionGain = this.ctx.createGain();
    this.tensionGain.gain.value = 0.0;

    this.tensionOsc.connect(tensionFilter);
    tensionFilter.connect(this.tensionGain);
    this.tensionGain.connect(this.masterGain);
    this.tensionOsc.start();

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.masterGain);

    this.initialized = true;
  }

  public setVolume(volume: number, muted: boolean): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.04,
      );
    }
  }

  public updateContinuous(
    speedMph: number,
    isSwinging: boolean,
    tensionRatio: number,
    isZipping: boolean,
    sloMo = false,
  ): void {
    if (!this.initialized || !this.ctx || !this.windGain || !this.windFilter) return;
    if (this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    const speedNorm = Math.min(1, Math.max(0, (speedMph - 10) / 120));
    const zipBoost = isZipping ? 0.14 : 0;
    const targetWindGain =
      speedNorm * speedNorm * 0.25 + (isSwinging ? 0.045 : 0) + zipBoost;
    const sloFactor = sloMo ? 0.45 : 1.0;
    const targetWindFreq = (210 + speedNorm * 1450 + (isZipping ? 450 : 0)) * sloFactor;

    this.windGain.gain.setTargetAtTime(targetWindGain, now, 0.08);
    this.windFilter.frequency.setTargetAtTime(targetWindFreq, now, 0.08);

    if (this.tensionGain && this.tensionOsc) {
      const tGain = isSwinging ? Math.min(0.11, tensionRatio * 0.095) : 0;
      const tFreq = (105 + tensionRatio * 230) * (sloMo ? 0.52 : 1.0);
      this.tensionGain.gain.setTargetAtTime(tGain, now, 0.06);
      this.tensionOsc.frequency.setTargetAtTime(tFreq, now, 0.06);
    }
  }

  public updateBossMusic(
    active: boolean,
    realDt: number,
    sloMo = false,
    isFinalOrGlitch = false,
  ): void {
    if (!this.initialized || !this.ctx || !this.musicGain) return;
    if (this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    if (!active) {
      if (this.musicActive) {
        this.musicActive = false;
        this.musicStepAccum = 0;
        this.musicGain.gain.setTargetAtTime(0.0, now, 0.14);
      }
      return;
    }

    if (!this.musicActive) {
      this.musicActive = true;
      this.musicStepAccum = 0.09; // Trigger first downbeat immediately
      this.musicStepIdx = 0;
    }

    const targetBus = (isFinalOrGlitch ? 0.56 : 0.48) * (sloMo ? 0.7 : 1.0);
    this.musicGain.gain.setTargetAtTime(targetBus, now, 0.12);

    const bpm = (isFinalOrGlitch ? 162 : 150) * (sloMo ? 0.62 : 1.0);
    const stepDur = 60 / bpm / 4; // 16th-note pulse
    this.musicStepAccum += Math.min(0.06, realDt);

    let stepsRun = 0;
    while (this.musicStepAccum >= stepDur && stepsRun < 2) {
      this.musicStepAccum -= stepDur;
      stepsRun++;
      this.triggerBossMusicStep(this.musicStepIdx, now, stepDur, sloMo, isFinalOrGlitch);
      this.musicStepIdx = (this.musicStepIdx + 1) % 64;
    }
  }

  private triggerBossMusicStep(
    step: number,
    now: number,
    stepDur: number,
    sloMo: boolean,
    isFinalOrGlitch: boolean,
  ): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;

    const bar = Math.floor(step / 16);
    const stepInBar = step % 16;
    const pitchScale = sloMo ? 0.72 : 1.0;

    // 4-bar Phrygian Dominant / Cyber-Metal progression: D2 -> F2 -> G2 -> Eb2
    const barRoots = [73.42, 87.31, 98.0, 77.78];
    const rootFreq = barRoots[bar % 4] * pitchScale;

    // 1. Double-bass metal Kick on driving gallop beats
    const isKick =
      stepInBar === 0 ||
      stepInBar === 3 ||
      stepInBar === 6 ||
      stepInBar === 8 ||
      stepInBar === 11 ||
      stepInBar === 14;
    if (isKick) {
      const kick = this.ctx.createOscillator();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(145 * pitchScale, now);
      kick.frequency.exponentialRampToValueAtTime(34 * pitchScale, now + 0.11);
      const kg = this.ctx.createGain();
      kg.gain.setValueAtTime(stepInBar === 0 || stepInBar === 8 ? 0.44 : 0.34, now);
      kg.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      kick.connect(kg);
      kg.connect(this.musicGain);
      kick.start(now);
      kick.stop(now + 0.14);
    }

    // 2. Heavy Industrial Snare on 2 and 4 (+ fill on bar 4 end)
    const isSnare =
      stepInBar === 4 ||
      stepInBar === 12 ||
      (bar === 3 && (stepInBar === 14 || stepInBar === 15));
    if (isSnare) {
      const snNoise = this.ctx.createBufferSource();
      snNoise.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1950 * pitchScale, now);
      bp.Q.value = 0.9;
      const sng = this.ctx.createGain();
      sng.gain.setValueAtTime(0.28, now);
      sng.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      snNoise.connect(bp);
      bp.connect(sng);
      sng.connect(this.musicGain);
      snNoise.start(now);
      snNoise.stop(now + 0.15);

      const snTone = this.ctx.createOscillator();
      snTone.type = 'triangle';
      snTone.frequency.setValueAtTime(215 * pitchScale, now);
      snTone.frequency.exponentialRampToValueAtTime(92 * pitchScale, now + 0.08);
      const stg = this.ctx.createGain();
      stg.gain.setValueAtTime(0.22, now);
      stg.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      snTone.connect(stg);
      stg.connect(this.musicGain);
      snTone.start(now);
      snTone.stop(now + 0.1);
    }

    // 3. Crisp 16th-note Cyber Hi-Hat
    const hat = this.ctx.createBufferSource();
    hat.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(6800, now);
    const hg = this.ctx.createGain();
    const hatAmp = stepInBar % 4 === 2 ? 0.11 : 0.045;
    hg.gain.setValueAtTime(hatAmp, now);
    hg.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    hat.connect(hp);
    hp.connect(hg);
    hg.connect(this.musicGain);
    hat.start(now);
    hat.stop(now + 0.05);

    // 4. Relentless 16th-note Sawtooth Synth Bass Chug
    const bassOctave = stepInBar % 4 === 2 ? 2.0 : 1.0;
    const bass = this.ctx.createOscillator();
    bass.type = 'sawtooth';
    bass.frequency.setValueAtTime(rootFreq * bassOctave, now);
    const bassLp = this.ctx.createBiquadFilter();
    bassLp.type = 'lowpass';
    bassLp.frequency.setValueAtTime((stepInBar % 2 === 0 ? 1350 : 880) * pitchScale, now);
    bassLp.Q.value = 3.6;
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(0.22, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + stepDur * 0.92);
    bass.connect(bassLp);
    bassLp.connect(bg);
    bg.connect(this.musicGain);
    bass.start(now);
    bass.stop(now + stepDur);

    // 5. Menacing Lead Arp / Brass Riff
    const leadPattern = [
      1.0, 0, 1.5, 0, 1.8877, 0, 1.5, 1.1892,
      1.0, 0, 1.5, 1.8877, 2.0, 0, 1.8877, 1.5,
    ];
    const ratio = leadPattern[stepInBar];
    if (ratio > 0) {
      const lead = this.ctx.createOscillator();
      lead.type = isFinalOrGlitch ? 'sawtooth' : 'square';
      lead.frequency.setValueAtTime(rootFreq * 4 * ratio, now);
      const leadFilter = this.ctx.createBiquadFilter();
      leadFilter.type = 'lowpass';
      leadFilter.frequency.setValueAtTime(2600 * pitchScale, now);
      const lg = this.ctx.createGain();
      lg.gain.setValueAtTime(0.001, now);
      lg.gain.linearRampToValueAtTime(0.11, now + 0.012);
      lg.gain.exponentialRampToValueAtTime(0.001, now + stepDur * 1.45);
      lead.connect(leadFilter);
      leadFilter.connect(lg);
      lg.connect(this.musicGain);
      lead.start(now);
      lead.stop(now + stepDur * 1.5);
    }

    // 6. Cinematic Brass Power Chord Stab on bar downbeats
    if (stepInBar === 0) {
      [2.0, 3.0].forEach((mult) => {
        if (!this.ctx || !this.musicGain) return;
        const brass = this.ctx.createOscillator();
        brass.type = 'sawtooth';
        brass.frequency.setValueAtTime(rootFreq * mult, now);
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(1650 * pitchScale, now);
        lp.frequency.exponentialRampToValueAtTime(520 * pitchScale, now + 0.36);
        const brg = this.ctx.createGain();
        brg.gain.setValueAtTime(0.11, now);
        brg.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        brass.connect(lp);
        lp.connect(brg);
        brg.connect(this.musicGain);
        brass.start(now);
        brass.stop(now + 0.4);
      });
    }
  }

  public playIronSuitBoot(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(55, now);
    sub.frequency.exponentialRampToValueAtTime(140, now + 0.35);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.35, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    sub.connect(sg);
    sg.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.56);

    [330, 493.88, 659.25, 987.77].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + 0.08 + i * 0.075;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  public playStringShoot(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, now);
    bp.frequency.exponentialRampToValueAtTime(760, now + 0.12);
    bp.Q.value = 1.9;

    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(0.32, now + 0.01);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    noiseSrc.connect(bp);
    bp.connect(ng);
    ng.connect(this.masterGain);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.14);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.09);

    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.16, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(og);
    og.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playStringSnap(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.16);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playZipBoost(strikeTarget = false): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(strikeTarget ? 280 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(strikeTarget ? 1150 : 880, now + 0.22);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, now);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(1300, now);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.18, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    noiseSrc.connect(hp);
    hp.connect(ng);
    ng.connect(this.masterGain);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.21);
  }

  public playZipDodgeRedirect(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(780, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playDodge(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(520, now);
    bp.frequency.exponentialRampToValueAtTime(2100, now + 0.12);
    bp.Q.value = 1.4;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.28, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    noiseSrc.connect(bp);
    bp.connect(ng);
    ng.connect(this.masterGain);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.17);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playGunShot(sloMo = false, gunId: GunWeaponId = 'sidearm'): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const rate = sloMo ? 0.56 : 1.0;

    if (gunId === 'laser_boom') {
      this.playLaserBoomFire(sloMo);
      return;
    }

    const isBoomer =
      gunId === 'rpg' || gunId === 'sniper' || gunId === 'shotgun' || gunId === 'railcannon';
    const isMegaBoom = gunId === 'rpg' || gunId === 'sniper' || gunId === 'railcannon';
    const dur = gunId === 'rpg' ? 0.58 : isMegaBoom ? 0.44 : gunId === 'shotgun' ? 0.32 : 0.14;

    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    const subF0 =
      gunId === 'rpg'
        ? 118
        : gunId === 'sniper'
          ? 155
          : gunId === 'railcannon'
            ? 145
            : gunId === 'shotgun'
              ? 135
              : gunId === 'smg'
                ? 195
                : 170;
    sub.frequency.setValueAtTime(subF0 * rate, now);
    sub.frequency.exponentialRampToValueAtTime(24 * rate, now + dur * 0.9);

    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(
      gunId === 'rpg' ? 0.68 : isMegaBoom ? 0.58 : isBoomer ? 0.48 : 0.34,
      now,
    );
    sg.gain.exponentialRampToValueAtTime(0.001, now + dur);
    sub.connect(sg);
    sg.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + dur + 0.03);

    const osc = this.ctx.createOscillator();
    osc.type = gunId === 'sniper' || gunId === 'railcannon' ? 'sawtooth' : 'triangle';
    const crackF0 =
      gunId === 'sniper'
        ? 1420
        : gunId === 'rpg'
          ? 340
          : gunId === 'railcannon'
            ? 1120
            : gunId === 'smg'
              ? 1220
              : 880;
    osc.frequency.setValueAtTime(crackF0 * rate, now);
    osc.frequency.exponentialRampToValueAtTime((isBoomer ? 38 : 90) * rate, now + dur * 0.65);

    const og = this.ctx.createGain();
    og.gain.setValueAtTime(isBoomer ? 0.44 : 0.28, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.7);
    osc.connect(og);
    og.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + dur * 0.72);

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = isBoomer ? 'lowpass' : 'bandpass';
    lp.frequency.setValueAtTime((gunId === 'sniper' ? 5200 : isBoomer ? 3200 : 2800) * rate, now);
    lp.frequency.exponentialRampToValueAtTime((isBoomer ? 140 : 420) * rate, now + dur);

    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(isBoomer ? 0.52 : 0.26, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noiseSrc.connect(lp);
    lp.connect(ng);
    ng.connect(this.masterGain);
    noiseSrc.start(now);
    noiseSrc.stop(now + dur + 0.03);

    // Per-gun signature harmonic & mechanical tail
    if (gunId === 'railcannon') {
      const whine = this.ctx.createOscillator();
      whine.type = 'sawtooth';
      whine.frequency.setValueAtTime(2400 * rate, now);
      whine.frequency.exponentialRampToValueAtTime(190 * rate, now + 0.36);
      const wg = this.ctx.createGain();
      wg.gain.setValueAtTime(0.28, now);
      wg.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      whine.connect(wg);
      wg.connect(this.masterGain);
      whine.start(now);
      whine.stop(now + 0.4);
    } else if (gunId === 'shotgun') {
      const rackT = now + 0.18;
      const rack = this.ctx.createOscillator();
      rack.type = 'triangle';
      rack.frequency.setValueAtTime(420 * rate, rackT);
      rack.frequency.linearRampToValueAtTime(680 * rate, rackT + 0.07);
      const rg = this.ctx.createGain();
      rg.gain.setValueAtTime(0.14, rackT);
      rg.gain.exponentialRampToValueAtTime(0.001, rackT + 0.09);
      rack.connect(rg);
      rg.connect(this.masterGain);
      rack.start(rackT);
      rack.stop(rackT + 0.1);
    } else if (gunId === 'smg' || gunId === 'carbine') {
      const bolt = this.ctx.createOscillator();
      bolt.type = 'square';
      bolt.frequency.setValueAtTime((gunId === 'smg' ? 1680 : 1280) * rate, now);
      bolt.frequency.exponentialRampToValueAtTime(420 * rate, now + 0.045);
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(0.11, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      bolt.connect(bg);
      bg.connect(this.masterGain);
      bolt.start(now);
      bolt.stop(now + 0.055);
    } else if (gunId === 'sniper') {
      const echo = this.ctx.createOscillator();
      echo.type = 'sine';
      echo.frequency.setValueAtTime(980 * rate, now + 0.03);
      echo.frequency.exponentialRampToValueAtTime(140 * rate, now + 0.48);
      const eg = this.ctx.createGain();
      eg.gain.setValueAtTime(0.22, now + 0.03);
      eg.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      echo.connect(eg);
      eg.connect(this.masterGain);
      echo.start(now + 0.03);
      echo.stop(now + 0.52);
    }
  }

  public playAdsZoom(zoomIn: boolean, isOptic = false): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = isOptic ? 'sine' : 'triangle';
    const f0 = zoomIn ? (isOptic ? 540 : 420) : isOptic ? 820 : 620;
    const f1 = zoomIn ? (isOptic ? 940 : 680) : isOptic ? 460 : 380;
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.exponentialRampToValueAtTime(f1, now + 0.065);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playSuitCriticalAlert(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [880, 620, 940].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.11;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1850, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.095);
    });
  }

  public playLaserChargeTick(progress: number): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    const f = 220 + progress * 980;
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.linearRampToValueAtTime(f + 85, now + 0.06);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06 + progress * 0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playLaserBoomFire(sloMo = false): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const pitch = sloMo ? 0.6 : 1.0;

    // Seismic sub-bass discharge
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(175 * pitch, now);
    sub.frequency.exponentialRampToValueAtTime(22, now + 0.95);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.75, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    sub.connect(sg);
    sg.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 1.02);

    // High-energy beam harmonic roar
    const beam = this.ctx.createOscillator();
    beam.type = 'sawtooth';
    beam.frequency.setValueAtTime(1480 * pitch, now);
    beam.frequency.exponentialRampToValueAtTime(92 * pitch, now + 0.78);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3400, now);
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(0.45, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.82);
    beam.connect(lp);
    lp.connect(bg);
    bg.connect(this.masterGain);
    beam.start(now);
    beam.stop(now + 0.85);

    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.setValueAtTime(4200, now);
    bp.frequency.exponentialRampToValueAtTime(180, now + 0.85);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.54, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.88);
    n.connect(bp);
    bp.connect(ng);
    ng.connect(this.masterGain);
    n.start(now);
    n.stop(now + 0.9);
  }

  public playSwordSwing(sloMo = false, swordId: SwordWeaponId = 'katana'): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const pitch = sloMo ? 0.62 : 1.0;

    if (swordId === 'lightsaber') {
      const hum = this.ctx.createOscillator();
      hum.type = 'sawtooth';
      hum.frequency.setValueAtTime(135 * pitch, now);
      hum.frequency.linearRampToValueAtTime(215 * pitch, now + 0.08);
      hum.frequency.exponentialRampToValueAtTime(118 * pitch, now + 0.24);

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1400 * pitch, now);
      lp.Q.value = 3.2;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.28, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      hum.connect(lp);
      lp.connect(g);
      g.connect(this.masterGain);
      hum.start(now);
      hum.stop(now + 0.28);
      return;
    }

    if (swordId === 'axe') {
      const sub = this.ctx.createOscillator();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(280 * pitch, now);
      sub.frequency.exponentialRampToValueAtTime(75 * pitch, now + 0.28);
      const sg = this.ctx.createGain();
      sg.gain.setValueAtTime(0.26, now);
      sg.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      sub.connect(sg);
      sg.connect(this.masterGain);
      sub.start(now);
      sub.stop(now + 0.32);
    }

    const baseF = swordId === 'scythe' ? 480 : swordId === 'axe' ? 320 : swordId === 'saber' ? 760 : 640;
    const peakF = swordId === 'scythe' ? 1680 : swordId === 'axe' ? 780 : swordId === 'saber' ? 1720 : 1420;
    const carrier = this.ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(baseF * pitch, now);
    carrier.frequency.exponentialRampToValueAtTime(peakF * pitch, now + 0.07);
    carrier.frequency.exponentialRampToValueAtTime(baseF * 0.65 * pitch, now + 0.24);

    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.001, now);
    cg.gain.linearRampToValueAtTime(0.16, now + 0.03);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    carrier.connect(cg);
    cg.connect(this.masterGain);
    carrier.start(now);
    carrier.stop(now + 0.26);

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime((swordId === 'axe' ? 520 : 950) * pitch, now);
    bp.frequency.exponentialRampToValueAtTime((swordId === 'scythe' ? 3900 : 2800) * pitch, now + 0.09);
    bp.frequency.exponentialRampToValueAtTime(600 * pitch, now + 0.24);
    bp.Q.value = 1.6;

    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(swordId === 'axe' ? 0.3 : 0.24, now + 0.045);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noiseSrc.connect(bp);
    bp.connect(ng);
    ng.connect(this.masterGain);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.26);
  }

  public playSwordBarrage(sloMo = false): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const pitch = sloMo ? 0.65 : 1.0;

    for (let i = 0; i < 5; i++) {
      const t = now + i * 0.05;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime((720 + i * 110) * pitch, t);
      osc.frequency.exponentialRampToValueAtTime((2400 + i * 160) * pitch, t + 0.08);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.15);
    }
  }

  public playSwordMetalHit(
    heavy = false,
    sloMo = false,
    weaponId: WeaponId = 'katana',
  ): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const cfg = getWeaponConfig(weaponId);
    const swordId: SwordWeaponId = cfg.category === 'sword' ? (cfg.id as SwordWeaponId) : 'katana';
    const now = this.ctx.currentTime;
    const pitch = sloMo ? 0.65 : 1.0;

    if (swordId === 'lightsaber') {
      const zap = this.ctx.createOscillator();
      zap.type = 'sawtooth';
      zap.frequency.setValueAtTime(420 * pitch, now);
      zap.frequency.exponentialRampToValueAtTime(140 * pitch, now + 0.22);
      const zg = this.ctx.createGain();
      zg.gain.setValueAtTime(0.32, now);
      zg.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      zap.connect(zg);
      zg.connect(this.masterGain);
      zap.start(now);
      zap.stop(now + 0.25);
    }

    const ratios = heavy ? [1, 1.48, 2.31, 3.42, 4.76] : [1, 1.54, 2.45, 3.85];
    const baseFreq = (swordId === 'axe' ? 360 : heavy ? 520 : 680) * pitch;

    ratios.forEach((ratio, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(baseFreq * ratio, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * ratio * 0.96, now + 0.38);

      const g = this.ctx.createGain();
      const amp = (heavy ? 0.24 : 0.16) / (1 + idx * 0.65);
      g.gain.setValueAtTime(amp, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.44 : 0.28));

      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.46);
    });

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2200 * pitch, now);

    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(heavy ? 0.36 : 0.22, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noiseSrc.connect(hp);
    hp.connect(ng);
    ng.connect(this.masterGain);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.16);
  }

  public playCritUlt(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.72);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.65, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.76);
    sub.connect(sg);
    sg.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.78);

    [440, 659.25, 880, 1318.5].forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.02);
      osc.frequency.exponentialRampToValueAtTime(f * 1.15, now + 0.42);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.14, now + idx * 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now + idx * 0.02);
      osc.stop(now + 0.5);
    });
  }

  public playBossUltWarning(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.18;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(540 + i * 160, t);
      osc.frequency.linearRampToValueAtTime(320, t + 0.14);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.16);
    }
  }

  public playBossLaser(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(95, now + 0.52);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1600, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.54);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.56);
  }

  public playGlitchWarp(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.08;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(i % 2 === 0 ? 110 : 880, t);
      osc.frequency.exponentialRampToValueAtTime(i % 2 === 0 ? 640 : 65, t + 0.07);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.24, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.08);
    }
  }

  public playSpiderChirp(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playBlockDeflect(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    [920, 1480, 2260].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.18, now + 0.12);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.18 / (i + 1), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.18);
    });
  }

  public playSensorAlert(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.setValueAtTime(1520, now + 0.05);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playRescueRecruit(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.06;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public playExplosion(isBoss = false, sloMo = false): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const dur = isBoss ? 1.35 : 0.72;
    const pitch = sloMo ? 0.6 : 1.0;

    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime((isBoss ? 128 : 155) * pitch, now);
    sub.frequency.exponentialRampToValueAtTime(22, now + dur * 0.9);

    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(isBoss ? 0.68 : 0.46, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + dur);

    sub.connect(sg);
    sg.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + dur + 0.02);

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime((isBoss ? 3800 : 3000) * pitch, now);
    lp.frequency.exponentialRampToValueAtTime(140, now + dur);

    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(isBoss ? 0.56 : 0.38, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noiseSrc.connect(lp);
    lp.connect(ng);
    ng.connect(this.masterGain);
    noiseSrc.start(now);
    noiseSrc.stop(now + dur + 0.02);
  }

  public playFootstep(sprint: boolean, crouched: boolean): void {
    if (crouched) return;
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(sprint ? 125 : 95, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.065);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(sprint ? 0.14 : 0.075, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playJump(boostPad = false, doubleJump = false): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = doubleJump ? 'triangle' : 'sine';
    const f0 = boostPad ? 260 : doubleJump ? 290 : 180;
    const f1 = boostPad ? 920 : doubleJump ? 660 : 420;
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.exponentialRampToValueAtTime(f1, now + (boostPad ? 0.24 : 0.13));

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(boostPad ? 0.22 : doubleJump ? 0.16 : 0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (boostPad ? 0.25 : 0.14));

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playSloMoToggle(enabled: boolean): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(enabled ? 760 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(enabled ? 140 : 720, now + 0.24);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  public playPlayerDamage(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playLevelClear(isBoss = false): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = isBoss ? [440, 554.37, 659.25, 880, 1108.73] : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.08;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.44);
    });
  }

  public playNoGrabError(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.085;
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(190 - i * 40, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.075);
    }
  }

  public playBuildingCollapse(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 0.65);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.42, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.72);

    if (this.noiseBuffer) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuffer;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(900, now);
      lp.frequency.exponentialRampToValueAtTime(140, now + 0.68);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.38, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      n.connect(lp);
      lp.connect(ng);
      ng.connect(this.masterGain);
      n.start(now);
      n.stop(now + 0.72);
    }
  }

  public playBossPower(power: BossPowerId): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    if (power === 'fire') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.36);
      g.gain.setValueAtTime(0.28, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    } else if (power === 'water') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.34);
      g.gain.setValueAtTime(0.25, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    } else if (power === 'punch') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.44);
      g.gain.setValueAtTime(0.45, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1240, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.35);
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.37);
    }

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.48);
  }

  public playWeakPointHit(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playBossStun(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const freqs = [480, 320, 180];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.08;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.28);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.26, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  public playLaserZap(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playShieldBreak(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(760, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.28);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.32);
  }
}
