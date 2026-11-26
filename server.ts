import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

let cachedAi: GoogleGenAI | null = null;
let cachedApiKey = '';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim() ?? '';
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!cachedAi || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    cachedAi = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedAi;
}

interface SherlcoContext {
  level: number;
  mode: string;
  suitEntered: boolean;
  arenaShapeName?: string;
  levelSubject?: string;
  hp: number;
  maxHp: number;
  shieldHp?: number;
  maxShieldHp?: number;
  armorReductionPct?: number;
  mana: number;
  maxMana: number;
  activeWeapon: string;
  activeWeaponId?: string;
  enemiesRemaining: number;
  portalChargePct?: number;
  bossName: string | null;
  bossHp?: number;
  bossIsInfinite?: boolean;
  bossStunnedSec?: number;
  aiWarningText?: string | null;
  laserBoomAmmo?: number;
  laserBoomCooldownSec?: number;
  tutorialStep?: string | null;
  tutorialStepText?: string | null;
  glitchChoicePending?: boolean;
}

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 1): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = /429|500|502|503|504|unavailable|timeout|rate/i.test(msg);
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '512kb' }));

  app.post('/api/sherlco', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Sherlco neural link requires GEMINI_API_KEY to be configured in Settings > Secrets.',
      });
      return;
    }

    const message =
      typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 600) : '';
    const rawCtx = req.body?.context ?? req.body?.telemetry ?? {};
    const ctx = rawCtx as Partial<SherlcoContext>;

    if (!message) {
      res.status(400).json({ error: 'Please provide a voice or text prompt for Sherlco.' });
      return;
    }

    const systemInstruction = `You are Sherlco, the sharp, supportive, tactical female AI built into the player's Iron Armor Suit in the 1st-person action game "The First Swing".
Give concise, clear tactical help, damage tips, and live threat warnings in 2 to 4 short sentences suitable for both HUD text and voice-to-speech playback.
Key Suit Systems you know accurately:
- Direct Combat Deployment: The Iron Armor Suit deploys directly into active sectors (no starting room); Energy Shields and Extra Armor plating can be equipped in the Armory.
- Grapple & Wall Slide: Hold [RMB] with a sword, [G], mid-air [Space], or SWING to grapple; press [E] for Zip Pull (0.3s cooldown). Jump into arena walls or cyan slide panels mid-air to Wall-Slide and press [Space] to Wall-Kick.
- Weak Points, Boss Stuns & Explosions: Every enemy and Boss carries a glowing red Weak Point—aim there for 2.6x–3.5x crits! Bosses periodically enter a Stunned state every ~14s. Hitting Weak Points with [F] Sword Barrage or [Z] 10x Crit triggers massive AoE explosions!
- Underground Warp Portals: Defeating robots emits Light Orb Streams that flow into the underground portal vault. Once 100% charged, drop into the underground beam to advance.
- [Y] AI Overcharge Assist: Your emergency Sherlco Overcharge repairs hull & shield HP and grants +25% damage boost for 8.5s.
- Weapons & Zoom: [1]-[6] or [Q] swaps Swords & Guns. Hold [RMB] with any gun (or ZOOM on Mobile) to aim down sights. [V]/[Alt] dodges, [B] blocks, [T] activates 20s Slo-Mo, [X]/[7]-[0] unleashes Boss Powers.
Never break character or mention APIs, code, or files.`;

    const telemetrySummary = [
      `Mode: ${ctx.mode ?? 'campaign'}`,
      `Level: ${ctx.level ?? 1}`,
      ctx.levelSubject ? `Subject: ${ctx.levelSubject}` : null,
      ctx.arenaShapeName ? `Sector Shape: ${ctx.arenaShapeName}` : null,
      `HP: ${ctx.hp ?? 125}/${ctx.maxHp ?? 125}`,
      ctx.maxShieldHp ? `Shield: ${ctx.shieldHp ?? 0}/${ctx.maxShieldHp}` : null,
      ctx.armorReductionPct ? `Armor Reduction: ${ctx.armorReductionPct}%` : null,
      `Mana: ${ctx.mana ?? 100}/${ctx.maxMana ?? 100}`,
      `Active Weapon: ${ctx.activeWeapon ?? ctx.activeWeaponId ?? 'Cyber Katana'}`,
      `Hostiles Remaining: ${ctx.enemiesRemaining ?? 0}`,
      ctx.portalChargePct !== undefined ? `Portal Charge: ${ctx.portalChargePct}%` : null,
      ctx.bossName
        ? `Boss Active: ${ctx.bossName}${ctx.bossIsInfinite ? ' (∞ HP)' : ctx.bossHp !== undefined ? ` (${ctx.bossHp} HP)` : ''}${ctx.bossStunnedSec && ctx.bossStunnedSec > 0 ? ' [STUNNED - HIT RED WEAK POINT]' : ''}`
        : null,
      ctx.aiWarningText ? `Active AI Warning: ${ctx.aiWarningText}` : null,
      ctx.tutorialStep || ctx.tutorialStepText
        ? `Tutorial Step: ${ctx.tutorialStep ?? ctx.tutorialStepText}`
        : null,
      ctx.glitchChoicePending ? 'LV 0 Glitch Titan Choice Active (Fight vs Run)' : null,
    ]
      .filter(Boolean)
      .join(' | ');

    try {
      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Suit Telemetry: ${telemetrySummary}\nPilot says: "${message}"`,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
      );
      const reply = response.text?.trim();
      if (!reply) {
        res.status(502).json({ error: 'Sherlco received an empty neural response.' });
        return;
      }
      res.json({ reply });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sherlco neural link failed.';
      console.error('[Sherlco API Error]', msg);
      res.status(502).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`The First Swing server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
