import { useRef, useState } from 'react';
import { GameSettings, HudState, getWeaponConfig } from '../types/game';

export interface TouchInputActions {
  setAnalogMove: (x: number, y: number, sprint: boolean) => void;
  setJumpHeld: (held: boolean) => void;
  setSwingHeld: (held: boolean) => void;
  setFireHeld: (held: boolean) => void;
  setBlockHeld: (held: boolean) => void;
  toggleCrouch: () => void;
  toggleScope: () => void;
  triggerZipOrSuit: () => void;
  triggerBarrage: () => void;
  triggerDodge: () => void;
  triggerSloMo: () => void;
  triggerCritSurge: () => void;
  triggerAiOvercharge: () => void;
  applyTouchLook: (dx: number, dy: number) => void;
}

interface MobileTouchControlsProps {
  hud: HudState;
  settings: GameSettings;
  actions: TouchInputActions;
}

export function MobileTouchControls({ hud, settings, actions }: MobileTouchControlsProps) {
  const [joyOffset, setJoyOffset] = useState({ x: 0, y: 0 });
  const [joyActive, setJoyActive] = useState(false);
  const [sprintAuto, setSprintAuto] = useState(false);

  const joyTouchId = useRef<number | null>(null);
  const joyCenterRef = useRef({ x: 0, y: 0 });
  const lookTouchId = useRef<number | null>(null);
  const lookPrevRef = useRef({ x: 0, y: 0 });
  const lastTouchMsRef = useRef(0);

  if (hud.mode === 'glitch_lv0' && hud.glitchChoice === 'pending') {
    return null;
  }

  const maxRadius = 46;
  const activeWeaponCfg = getWeaponConfig(hud.activeWeaponId);
  const isGun = activeWeaponCfg.category === 'gun';

  const handleTapTouch = (fn: () => void) => (e: React.TouchEvent) => {
    e.stopPropagation();
    lastTouchMsRef.current = performance.now();
    fn();
  };

  const handleTapClick = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (performance.now() - lastTouchMsRef.current < 550) return;
    fn();
  };

  const handleJoystickStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const touch = e.changedTouches[0];
    if (!touch) return;
    const rect = e.currentTarget.getBoundingClientRect();
    joyTouchId.current = touch.identifier;
    joyCenterRef.current = {
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.5,
    };
    setJoyActive(true);
    updateJoystick(touch.clientX, touch.clientY);
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    const dx = clientX - joyCenterRef.current.x;
    const dy = clientY - joyCenterRef.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxRadius, dist);
    const angle = Math.atan2(dy, dx);
    const ox = Math.cos(angle) * clamped;
    const oy = Math.sin(angle) * clamped;
    const normX = ox / maxRadius;
    const normY = oy / maxRadius;
    const isAutoSprint = dist > maxRadius * 0.72 && normY < -0.25;

    setJoyOffset({ x: ox, y: oy });
    setSprintAuto(isAutoSprint);
    actions.setAnalogMove(normX, normY, isAutoSprint);
  };

  const handleJoystickMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (joyTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchId.current) {
        updateJoystick(t.clientX, t.clientY);
        break;
      }
    }
  };

  const handleJoystickEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId.current) {
        joyTouchId.current = null;
        setJoyActive(false);
        setSprintAuto(false);
        setJoyOffset({ x: 0, y: 0 });
        actions.setAnalogMove(0, 0, false);
        break;
      }
    }
  };

  const handleLookStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchId.current !== null) return;
    const t = e.changedTouches[0];
    if (!t) return;
    lookTouchId.current = t.identifier;
    lookPrevRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleLookMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchId.current) {
        const dx = t.clientX - lookPrevRef.current.x;
        const dy = t.clientY - lookPrevRef.current.y;
        lookPrevRef.current = { x: t.clientX, y: t.clientY };
        actions.applyTouchLook(dx * 1.45, dy * 1.35);
        break;
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
        break;
      }
    }
  };

  const zipContextLabel =
    hud.nearNpcPrompt && hud.nearNpcPrompt.includes('Rescue') ? 'RESCUE' : 'ZIP';

  const touchScale = Math.max(0.75, Math.min(1.3, settings.touchScale ?? 1));
  const touchOpacity = Math.max(0.45, Math.min(1.0, settings.touchOpacity ?? 0.9));

  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 select-none touch-none"
      style={{ opacity: touchOpacity }}
    >
      {/* Right-side Look Touch Zone (above weapon slots) */}
      <div
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
        className="pointer-events-auto fixed top-14 right-0 bottom-20 left-[38%] touch-none"
        aria-label="Aim Look Area"
      />

      {/* Left Thumb Zone: Fortnite-style Analog Joystick + Crouch & Slo-Mo */}
      <div
        className="pointer-events-auto fixed bottom-20 left-4 flex flex-col items-start gap-2.5 touch-none"
        style={{
          transform: `scale(${touchScale})`,
          transformOrigin: 'bottom left',
        }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onTouchStart={handleTapTouch(() => actions.toggleCrouch())}
            onClick={handleTapClick(() => actions.toggleCrouch())}
            className={`min-w-[48px] min-h-[44px] px-2 rounded-full border font-mono-num text-[10px] font-bold flex items-center justify-center transition ${
              hud.isCrouching
                ? 'border-cyan-300 bg-cyan-500/85 text-slate-950'
                : 'border-sky-400/50 bg-slate-950/85 text-sky-200'
            }`}
          >
            CROUCH
          </button>

          <button
            type="button"
            onTouchStart={handleTapTouch(() => actions.triggerSloMo())}
            onClick={handleTapClick(() => actions.triggerSloMo())}
            className={`min-w-[48px] min-h-[44px] px-2 rounded-full border font-mono-num text-[10px] font-bold flex items-center justify-center transition ${
              hud.sloMo
                ? 'border-sky-300 bg-sky-400 text-slate-950'
                : 'border-sky-400/50 bg-slate-950/85 text-sky-200'
            }`}
          >
            {hud.sloMo ? `${Math.ceil(hud.sloMoRemainingSec)}s` : 'SLO-MO'}
          </button>

          <button
            type="button"
            onTouchStart={handleTapTouch(() => actions.triggerAiOvercharge())}
            onClick={handleTapClick(() => actions.triggerAiOvercharge())}
            className={`min-w-[48px] min-h-[44px] px-2 rounded-full border font-mono-num text-[10px] font-bold flex items-center justify-center transition ${
              hud.aiOverchargeSec > 0
                ? 'border-emerald-300 bg-emerald-400 text-slate-950'
                : hud.aiOverchargeCooldownSec > 0
                  ? 'border-slate-700 bg-slate-950/85 text-slate-500'
                  : hud.health / Math.max(1, hud.maxHealth) <= 0.35
                    ? 'border-amber-300 bg-amber-500 text-slate-950'
                    : 'border-cyan-400/60 bg-slate-950/85 text-cyan-200'
            }`}
          >
            {hud.aiOverchargeSec > 0
              ? `AI ${hud.aiOverchargeSec.toFixed(0)}s`
              : hud.aiOverchargeCooldownSec > 0
                ? `AI ${Math.ceil(hud.aiOverchargeCooldownSec)}s`
                : 'AI BUFF'}
          </button>
        </div>

        {/* Analog Movement Stick */}
        <div
          onTouchStart={handleJoystickStart}
          onTouchMove={handleJoystickMove}
          onTouchEnd={handleJoystickEnd}
          onTouchCancel={handleJoystickEnd}
          className={`relative w-32 h-32 rounded-full border-2 flex items-center justify-center touch-none ${
            sprintAuto
              ? 'border-cyan-300 bg-cyan-950/45'
              : joyActive
                ? 'border-sky-400/80 bg-slate-950/55'
                : 'border-sky-400/40 bg-slate-950/45'
          }`}
        >
          <div className="absolute inset-4 rounded-full border border-sky-400/20 pointer-events-none" />
          <div
            className={`w-12 h-12 rounded-full border-2 pointer-events-none ${
              sprintAuto
                ? 'border-white bg-cyan-400/90'
                : 'border-sky-200 bg-sky-500/75'
            }`}
            style={{
              transform: `translate3d(${joyOffset.x}px, ${joyOffset.y}px, 0)`,
            }}
          />
          {sprintAuto && (
            <span className="absolute -top-5 font-mono-num text-[9px] font-bold text-cyan-300">
              SPRINT
            </span>
          )}
        </div>
      </div>

      {/* Right Thumb Zone: Fortnite Action Cluster */}
      <div
        className="pointer-events-auto fixed bottom-20 right-4 touch-none"
        style={{
          transform: `scale(${touchScale})`,
          transformOrigin: 'bottom right',
        }}
      >
        <div className="relative w-56 h-56">
          {/* Primary Fire / Attack (Main Thumb Button) */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              lastTouchMsRef.current = performance.now();
              actions.setFireHeld(true);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              actions.setFireHeld(false);
            }}
            onTouchCancel={(e) => {
              e.stopPropagation();
              actions.setFireHeld(false);
            }}
            onMouseDown={(e) => {
              if (performance.now() - lastTouchMsRef.current < 550) return;
              e.stopPropagation();
              actions.setFireHeld(true);
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              actions.setFireHeld(false);
            }}
            onMouseLeave={() => actions.setFireHeld(false)}
            className="absolute right-1 bottom-2 w-[74px] h-[74px] rounded-full border-2 border-rose-300 bg-rose-600/85 active:scale-95 flex flex-col items-center justify-center font-display text-xs font-black text-white shadow-xl"
          >
            <span>{isGun ? 'FIRE' : 'SLASH'}</span>
            <span className="text-[9px] font-mono-num opacity-85">
              {isGun ? activeWeaponCfg.name.split(' ').slice(-1)[0].toUpperCase() : 'BLADE'}
            </span>
          </button>

          {/* Jump / Double Jump */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              lastTouchMsRef.current = performance.now();
              actions.setJumpHeld(true);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              actions.setJumpHeld(false);
            }}
            onTouchCancel={(e) => {
              e.stopPropagation();
              actions.setJumpHeld(false);
            }}
            onMouseDown={(e) => {
              if (performance.now() - lastTouchMsRef.current < 550) return;
              e.stopPropagation();
              actions.setJumpHeld(true);
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              actions.setJumpHeld(false);
            }}
            onMouseLeave={() => actions.setJumpHeld(false)}
            className="absolute right-2 top-5 w-14 h-14 rounded-full border-2 border-emerald-300/80 bg-emerald-700/80 active:scale-95 flex items-center justify-center font-display text-[11px] font-bold text-white shadow-lg"
          >
            JUMP
          </button>

          {/* Grapple Swing (Hold) */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              lastTouchMsRef.current = performance.now();
              actions.setSwingHeld(true);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              actions.setSwingHeld(false);
            }}
            onTouchCancel={(e) => {
              e.stopPropagation();
              actions.setSwingHeld(false);
            }}
            onMouseDown={(e) => {
              if (performance.now() - lastTouchMsRef.current < 550) return;
              e.stopPropagation();
              actions.setSwingHeld(true);
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              actions.setSwingHeld(false);
            }}
            onMouseLeave={() => actions.setSwingHeld(false)}
            className={`absolute right-20 top-0 w-14 h-14 rounded-full border-2 active:scale-95 flex items-center justify-center font-display text-[11px] font-bold shadow-lg ${
              hud.isSwinging
                ? 'border-white bg-cyan-400 text-slate-950'
                : 'border-cyan-300/80 bg-cyan-700/80 text-white'
            }`}
          >
            SWING
          </button>

          {/* Zip / Rescue Context Button */}
          <button
            type="button"
            onTouchStart={handleTapTouch(() => actions.triggerZipOrSuit())}
            onClick={handleTapClick(() => actions.triggerZipOrSuit())}
            className={`absolute right-[92px] bottom-14 w-14 h-14 rounded-full border-2 active:scale-95 flex items-center justify-center font-display text-[11px] font-bold shadow-lg ${
              hud.zipCooldownSec > 0
                ? 'border-slate-600 bg-slate-900/85 text-slate-400'
                : 'border-sky-300/80 bg-sky-700/85 text-white'
            }`}
          >
            {hud.zipCooldownSec > 0 ? `${hud.zipCooldownSec.toFixed(1)}s` : zipContextLabel}
          </button>

          {/* Sword Barrage */}
          <button
            type="button"
            onTouchStart={handleTapTouch(() => actions.triggerBarrage())}
            onClick={handleTapClick(() => actions.triggerBarrage())}
            className={`absolute left-1 bottom-2 w-12 h-12 rounded-full border active:scale-95 flex items-center justify-center font-mono-num text-[10px] font-bold ${
              hud.barrageCooldownSec > 0
                ? 'border-slate-700 bg-slate-900/80 text-slate-500'
                : 'border-cyan-300/75 bg-slate-950/90 text-cyan-200'
            }`}
          >
            {hud.barrageCooldownSec > 0 ? `${hud.barrageCooldownSec.toFixed(0)}s` : 'WAVE'}
          </button>

          {/* Dodge */}
          <button
            type="button"
            onTouchStart={handleTapTouch(() => actions.triggerDodge())}
            onClick={handleTapClick(() => actions.triggerDodge())}
            className={`absolute left-1 top-14 w-12 h-12 rounded-full border active:scale-95 flex items-center justify-center font-mono-num text-[10px] font-bold ${
              hud.dodgeCooldownSec > 0
                ? 'border-slate-700 bg-slate-900/80 text-slate-500'
                : 'border-amber-300/75 bg-slate-950/90 text-amber-200'
            }`}
          >
            DODGE
          </button>

          {/* Block Shield (Hold) */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              lastTouchMsRef.current = performance.now();
              actions.setBlockHeld(true);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              actions.setBlockHeld(false);
            }}
            onTouchCancel={(e) => {
              e.stopPropagation();
              actions.setBlockHeld(false);
            }}
            onMouseDown={(e) => {
              if (performance.now() - lastTouchMsRef.current < 550) return;
              e.stopPropagation();
              actions.setBlockHeld(true);
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              actions.setBlockHeld(false);
            }}
            onMouseLeave={() => actions.setBlockHeld(false)}
            className={`absolute right-[92px] bottom-0 w-12 h-12 rounded-full border active:scale-95 flex items-center justify-center font-mono-num text-[10px] font-bold ${
              hud.isBlocking
                ? 'border-white bg-violet-400 text-slate-950'
                : 'border-violet-400/70 bg-slate-950/90 text-violet-200'
            }`}
          >
            BLOCK
          </button>

          {/* Per-Gun ADS / Optic Zoom Toggle (Available on ALL guns) */}
          {isGun && (
            <button
              type="button"
              onTouchStart={handleTapTouch(() => actions.toggleScope())}
              onClick={handleTapClick(() => actions.toggleScope())}
              className={`absolute left-3 -top-5 min-w-[48px] min-h-[48px] rounded-full border font-mono-num text-[10px] font-bold flex items-center justify-center shadow-lg ${
                hud.sniperZoomed
                  ? 'border-rose-300 bg-rose-500 text-white'
                  : 'border-rose-400/70 bg-slate-950/90 text-rose-200'
              }`}
            >
              ZOOM
            </button>
          )}

          {/* 10x Crit Surge Quick Button when charged */}
          {hud.critSurgeCharge >= 100 && !hud.critSurgeActive && (
            <button
              type="button"
              onTouchStart={handleTapTouch(() => actions.triggerCritSurge())}
              onClick={handleTapClick(() => actions.triggerCritSurge())}
              className="absolute right-0 -top-11 px-3 min-h-[44px] rounded-full border-2 border-amber-300 bg-amber-400 font-display text-xs font-black text-slate-950 shadow-lg"
            >
              10x CRIT READY
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
