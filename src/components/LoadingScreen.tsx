import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface LoadingScreenProps {
  headline: string;
  sublabel: string;
  onComplete: () => void;
  durationMs?: number;
}

export function LoadingScreen({
  headline,
  sublabel,
  onComplete,
  durationMs = 950,
}: LoadingScreenProps) {
  const [pct, setPct] = useState(8);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const ratio = Math.min(1, elapsed / durationMs);
      setPct(Math.round(8 + ratio * 92));
      if (ratio < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        onComplete();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md rounded-xl border border-cyan-500/50 bg-slate-900/95 p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-cyan-400">
            <ShieldCheck className="w-5 h-5" />
            <span className="font-mono-num text-xs font-bold uppercase tracking-widest">
              IRON SUIT OS · CALIBRATING
            </span>
          </div>
          <span className="font-mono-num text-sm font-bold text-white">{pct}%</span>
        </div>

        <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-white">
          {headline}
        </h2>
        <p className="mt-1 text-xs text-slate-400">{sublabel}</p>

        <div className="mt-5 h-2.5 w-full rounded-sm bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 transition-all duration-75"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 font-mono-num text-[10px] text-slate-400">
          <div className="rounded border border-slate-800 bg-slate-950 px-2 py-1.5">
            GRAPPLE: <span className="text-cyan-300">ONLINE</span>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 px-2 py-1.5">
            SHERLCO AI: <span className="text-emerald-300">STANDBY</span>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 px-2 py-1.5">
            ARENA: <span className="text-amber-300">SYNCED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
