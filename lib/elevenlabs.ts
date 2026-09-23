import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE_DIR, COOLDOWN_FILE, type Config } from './config.ts';
import { log } from './speak.ts';

const API = 'https://api.elevenlabs.io/v1';
const COOLDOWN_STATUSES = new Set([401, 402, 429]);

export interface SynthDeps {
  fetch: typeof fetch;
  now: () => number;
  cooldownFile: string;
  env: NodeJS.ProcessEnv;
}

export function apiKey(cfg: Config, env: NodeJS.ProcessEnv = process.env): string | null {
  return env.ELEVENLABS_API_KEY || cfg.elevenlabs.apiKey || null;
}

export function resolveProvider(cfg: Config, env: NodeJS.ProcessEnv = process.env): 'say' | 'elevenlabs' {
  if (cfg.provider !== 'auto') return cfg.provider;
  return apiKey(cfg, env) && cfg.elevenlabs.voiceId ? 'elevenlabs' : 'say';
}

export function cachePath(text: string, cfg: Config): string {
  const key = createHash('sha1').update(`${cfg.elevenlabs.voiceId}|${cfg.elevenlabs.modelId}|${cfg.elevenlabs.speed}|${text}`).digest('hex');
  return join(CACHE_DIR, `${key}.mp3`);
}

function cooldownActive(file: string, now: number): boolean {
  try {
    return Number(readFileSync(file, 'utf8')) > now;
  } catch {
    return false;
  }
}

export async function synthesize(text: string, cfg: Config, deps: Partial<SynthDeps> = {}): Promise<Buffer | null> {
  const d: SynthDeps = { fetch: globalThis.fetch, now: Date.now, cooldownFile: COOLDOWN_FILE, env: process.env, ...deps };
  const key = apiKey(cfg, d.env);
  const { voiceId, modelId, speed, timeoutMs, cooldownMinutes } = cfg.elevenlabs;
  if (!key || !voiceId) return skip(`no ${key ? 'voiceId' : 'api key'}`);
  if (cooldownActive(d.cooldownFile, d.now())) return skip('cooling down after an auth or quota error');
  try {
    const res = await d.fetch(`${API}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: modelId, ...(speed !== 1 ? { voice_settings: { speed } } : {}) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 160);
      if (COOLDOWN_STATUSES.has(res.status)) {
        try {
          writeFileSync(d.cooldownFile, String(d.now() + cooldownMinutes * 60_000));
        } catch {}
      }
      return skip(`HTTP ${res.status} ${detail}`);
    }
    const audio = Buffer.from(await res.arrayBuffer());
    return audio.length > 100 ? audio : skip('empty audio');
  } catch (err) {
    return skip(err instanceof Error ? err.message : String(err));
  }
}

function skip(reason: string): null {
  log(`elevenlabs fallback to say: ${reason}`);
  return null;
}
