import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Mic, MicOff, Send, Volume2, VolumeX, X } from 'lucide-react';
import { HudState, getWeaponConfig } from '../types/game';

interface ChatMessage {
  role: 'sherlco' | 'user';
  text: string;
}

interface SherlcoAssistantProps {
  hud: HudState;
  open: boolean;
  micTriggerCounter: number;
  onToggleOpen: () => void;
  onTriggerAiOvercharge?: () => void;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function SherlcoAssistant({
  hud,
  open,
  micTriggerCounter,
  onToggleOpen,
  onTriggerAiOvercharge,
}: SherlcoAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'sherlco',
      text: 'Iron Armor Suit online, Commander. I am Sherlco—ask me by voice [M] or text for combat warnings, weak point callouts, or activate my [Y] AI Overcharge repair & damage boost.',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const lastTutorialStepRef = useRef<number>(-1);
  const prevMicCounterRef = useRef<number>(micTriggerCounter);
  const lastAutoAlertMsRef = useRef<number>(0);
  const lastAutoAlertTagRef = useRef<string>('');
  const hudRef = useRef(hud);
  hudRef.current = hud;

  const speakText = useCallback(
    (text: string) => {
      if (!voiceOutputEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const femaleVoice =
          voices.find((v) => /female|samantha|victoria|karen|zira|google.*us.*english/i.test(v.name)) ??
          voices.find((v) => v.lang.startsWith('en'));
        if (femaleVoice) utter.voice = femaleVoice;
        utter.rate = 1.06;
        utter.pitch = 1.12;
        window.speechSynthesis.speak(utter);
      } catch {
        // Ignore TTS failure in restricted browsers
      }
    },
    [voiceOutputEnabled],
  );

  // Automatic spoken tutorial guidance when Sherlco is active in Tutorial Mode
  useEffect(() => {
    if (!hud.suitEntered || hud.mode !== 'tutorial') return;
    if (hud.tutorialStepIndex !== lastTutorialStepRef.current) {
      lastTutorialStepRef.current = hud.tutorialStepIndex;
      const tips = [
        'Suit systems calibrated. Move with W A S D or the left stick, Sprint with Shift, and jump into walls to Wall-Slide.',
        'Hold Right-Click, G, or mid-air Space to swing from your wrist grapple, or press E to Zip Pull with a 0.3 second cooldown.',
        'Aim for glowing red Weak Points and press F for Sword Barrage or Z for 10x Crit explosions.',
        'Underground portal charged! Drop into the illuminated underground vault to advance.',
      ];
      const msg = tips[hud.tutorialStepIndex];
      if (msg) {
        setMessages((prev) => [...prev.slice(-8), { role: 'sherlco', text: msg }]);
        speakText(msg);
      }
    }
  }, [hud.suitEntered, hud.mode, hud.tutorialStepIndex, speakText]);

  // Proactive Sherlco tactical warnings for Boss Stun, Ult, Critical HP, and Portal Unlock
  useEffect(() => {
    if (!hud.suitEntered || hud.mode === 'tutorial') return;
    const now = performance.now();
    let tag = '';
    let spoken = '';
    if (hud.bossStunnedSec > 0.5) {
      tag = 'stun';
      spoken = 'Boss stunned! Strike the glowing red weak point with Barrage or Ult!';
    } else if (hud.bossUltChargingSec > 0.4) {
      tag = 'ult';
      spoken = 'Warning! Boss explosion ult charging. Dodge or swing clear!';
    } else if (hud.health / Math.max(1, hud.maxHealth) <= 0.22) {
      tag = 'lowhp';
      spoken = 'Hull critical! Activate Y for AI Overcharge repair and shield boost!';
    }
    if (tag && (tag !== lastAutoAlertTagRef.current || now - lastAutoAlertMsRef.current > 9500)) {
      lastAutoAlertTagRef.current = tag;
      lastAutoAlertMsRef.current = now;
      speakText(spoken);
    }
  }, [hud.suitEntered, hud.mode, hud.bossStunnedSec, hud.bossUltChargingSec, hud.health, hud.maxHealth, speakText]);

  const sendToSherlco = useCallback(
    async (prompt: string) => {
      const clean = prompt.trim();
      if (!clean) return;
      setErrorMsg(null);
      setMessages((prev) => [...prev.slice(-10), { role: 'user', text: clean }]);
      setLoading(true);
      try {
        const cur = hudRef.current;
        const weaponCfg = getWeaponConfig(cur.activeWeaponId);
        const res = await fetch('/api/sherlco', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: clean,
            context: {
              level: cur.level,
              mode: cur.mode,
              suitEntered: cur.suitEntered,
              arenaShapeName: cur.arenaShapeName,
              levelSubject: cur.levelSubject,
              hp: cur.health,
              maxHp: cur.maxHealth,
              shieldHp: cur.shieldHp,
              maxShieldHp: cur.maxShieldHp,
              armorReductionPct: cur.armorReductionPct,
              mana: cur.mana,
              maxMana: cur.maxMana,
              activeWeapon: weaponCfg.name,
              activeWeaponId: cur.activeWeaponId,
              enemiesRemaining: cur.enemiesRemaining,
              portalChargePct: cur.portalChargePct,
              bossName: cur.bossName,
              bossHp: cur.bossHp,
              bossIsInfinite: cur.bossIsInfinite,
              bossStunnedSec: cur.bossStunnedSec,
              aiWarningText: cur.aiWarningText,
              laserBoomAmmo: cur.laserBoomAmmo,
              laserBoomCooldownSec: Math.round(cur.laserBoomCooldownSec),
              tutorialStep: cur.tutorialStepText,
              glitchChoicePending: cur.mode === 'glitch_lv0' && cur.glitchChoice === 'pending',
            },
          }),
        });
        const data = (await res.json()) as { reply?: string; error?: string };
        if (!res.ok || !data.reply) {
          throw new Error(data.error || `Request failed (${res.status})`);
        }
        setMessages((prev) => [...prev.slice(-10), { role: 'sherlco', text: data.reply! }]);
        speakText(data.reply);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to reach Sherlco AI.');
      } finally {
        setLoading(false);
      }
    },
    [speakText],
  );

  const toggleVoiceMic = useCallback(() => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const RecClass = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!RecClass) {
      setErrorMsg('Voice input is unavailable in this browser. Type your message below.');
      if (!open) onToggleOpen();
      return;
    }

    try {
      setErrorMsg(null);
      const rec = new RecClass();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      rec.onresult = (ev) => {
        const transcript = ev.results?.[0]?.[0]?.transcript ?? '';
        setListening(false);
        if (transcript.trim()) {
          if (!open) onToggleOpen();
          void sendToSherlco(transcript);
        }
      };
      rec.onerror = (ev) => {
        setListening(false);
        setErrorMsg(`Voice input error: ${ev.error}`);
      };
      rec.onend = () => {
        setListening(false);
      };
      recognitionRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      setErrorMsg('Unable to start microphone capture.');
    }
  }, [listening, open, onToggleOpen, sendToSherlco]);

  // Only toggle mic when micTriggerCounter actually increments (fixes instant self-cancellation bug!)
  useEffect(() => {
    if (micTriggerCounter === prevMicCounterRef.current) return;
    prevMicCounterRef.current = micTriggerCounter;
    if (hud.suitEntered) {
      toggleVoiceMic();
    }
  }, [micTriggerCounter, hud.suitEntered, toggleVoiceMic]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore stop errors on teardown
      }
    };
  }, []);

  if (!hud.suitEntered) return null;

  if (!open) {
    return (
      <div className="pointer-events-auto fixed top-[116px] left-2.5 sm:top-auto sm:left-auto sm:bottom-24 sm:right-4 z-30 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (document.pointerLockElement) document.exitPointerLock();
            toggleVoiceMic();
          }}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 min-h-[44px] font-mono-num text-[11px] sm:text-xs font-bold shadow-lg transition ${
            listening
              ? 'border-rose-400 bg-rose-950/95 text-rose-200'
              : 'border-cyan-500/60 bg-slate-950/92 text-cyan-300 hover:border-cyan-400'
          }`}
        >
          {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{listening ? 'Listening...' : 'Voice [M]'}</span>
          <span className="sm:hidden">{listening ? '...' : 'Voice'}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (document.pointerLockElement) document.exitPointerLock();
            onToggleOpen();
          }}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/60 bg-slate-950/92 px-2.5 py-2 min-h-[44px] font-mono-num text-[11px] sm:text-xs font-bold text-emerald-300 shadow-lg hover:border-emerald-400 transition"
        >
          <Bot className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sherlco AI [H]</span>
          <span className="sm:hidden">Sherlco</span>
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto fixed inset-x-3 top-14 sm:inset-x-auto sm:top-auto sm:bottom-24 sm:right-4 z-40 sm:w-96 rounded-xl border border-cyan-500/60 bg-slate-950/96 shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-cyan-400" />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-cyan-300">
            SHERLCO · IRON SUIT AI
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setVoiceOutputEnabled((v) => !v)}
            title={voiceOutputEnabled ? 'Mute AI Voice' : 'Enable AI Voice'}
            className="rounded border border-slate-700 bg-slate-900 p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-300 hover:border-cyan-400"
          >
            {voiceOutputEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>
          <button
            type="button"
            onClick={onToggleOpen}
            className="rounded border border-slate-700 bg-slate-900 p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-300 hover:border-rose-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {hud.aiWarningText && (
        <div className="border-b border-amber-500/40 bg-amber-950/60 px-3 py-1.5 font-mono-num text-[10px] font-bold text-amber-200">
          {hud.aiWarningText}
        </div>
      )}

      <div className="max-h-48 overflow-y-auto p-3 space-y-2 text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`rounded-lg px-3 py-2 ${
              m.role === 'sherlco'
                ? 'border border-cyan-500/35 bg-slate-900 text-slate-100'
                : 'border border-slate-700 bg-slate-800/80 text-cyan-200 ml-6'
            }`}
          >
            <span className="font-mono-num text-[10px] font-bold uppercase tracking-wider text-cyan-400 block mb-0.5">
              {m.role === 'sherlco' ? 'Sherlco' : 'Commander'}
            </span>
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="font-mono-num text-[11px] text-cyan-400 px-1">
            Sherlco is analyzing tactical telemetry...
          </div>
        )}
        {errorMsg && (
          <div className="rounded border border-rose-500/50 bg-rose-950/70 px-2.5 py-1.5 text-[11px] text-rose-200">
            {errorMsg}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 px-3 pb-2">
        {onTriggerAiOvercharge && (
          <button
            type="button"
            disabled={hud.aiOverchargeCooldownSec > 0}
            onClick={onTriggerAiOvercharge}
            className={`rounded border px-2 py-1 font-mono-num text-[10px] font-bold ${
              hud.aiOverchargeCooldownSec > 0
                ? 'border-slate-700 bg-slate-900 text-slate-500 cursor-not-allowed'
                : 'border-emerald-400 bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
          >
            {hud.aiOverchargeSec > 0
              ? `OVERCHARGE (${hud.aiOverchargeSec.toFixed(1)}s)`
              : hud.aiOverchargeCooldownSec > 0
                ? `AI ASSIST CD ${Math.ceil(hud.aiOverchargeCooldownSec)}s`
                : 'AI OVERCHARGE +25% DMG [Y]'}
          </button>
        )}
        {['How do I stun & hit weak points?', 'Best weapon combo?', 'How do underground portals work?'].map(
          (q) => (
            <button
              key={q}
              type="button"
              onClick={() => void sendToSherlco(q)}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-400 hover:text-cyan-200"
            >
              {q}
            </button>
          ),
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const val = inputText;
          setInputText('');
          void sendToSherlco(val);
        }}
        className="flex items-center gap-1.5 border-t border-slate-800 p-2.5"
      >
        <button
          type="button"
          onClick={toggleVoiceMic}
          className={`shrink-0 rounded-md border p-2 min-w-[40px] min-h-[40px] flex items-center justify-center transition ${
            listening
              ? 'border-rose-400 bg-rose-500 text-white'
              : 'border-slate-700 bg-slate-900 text-cyan-300 hover:border-cyan-400'
          }`}
          title="Voice to Chat [M]"
        >
          {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask Sherlco..."
          className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !inputText.trim()}
          className="shrink-0 rounded-md bg-cyan-500 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-950 hover:bg-cyan-400 disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
