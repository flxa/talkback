import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type Provider = 'auto' | 'say' | 'elevenlabs';

export interface ElevenLabsConfig {
  apiKey: string | null;
  voiceId: string | null;
  modelId: string;
  speed: number;
  timeoutMs: number;
  cooldownMinutes: number;
}

export interface Config {
  enabled: boolean;
  provider: Provider;
  elevenlabs: ElevenLabsConfig;
  voice: string | null;
  rate: number | null;
  prefixProject: boolean;
  fallback: 'strip' | 'none';
  fallbackMaxChars: number;
  notifications: boolean;
  enforce: boolean;
  ack: boolean;
  ackPhrases: string[];
  projectNames: Record<string, string>;
}

export const HOME_DIR = join(homedir(), '.talkback');
export const QUEUE_DIR = join(HOME_DIR, 'queue');
export const LOCK_DIR = join(HOME_DIR, 'lock');
export const LAST_SESSION_FILE = join(HOME_DIR, 'last-session');
export const CACHE_DIR = join(HOME_DIR, 'cache');
export const COOLDOWN_FILE = join(HOME_DIR, 'elevenlabs-cooldown');
export const CONFIG_FILE = join(HOME_DIR, 'config.json');
export const LOG_FILE = join(HOME_DIR, 'talkback.log');

const defaults: Config = {
  enabled: true,
  provider: 'auto',
  elevenlabs: {
    apiKey: null,
    voiceId: null,
    modelId: 'eleven_flash_v2_5',
    speed: 1,
    timeoutMs: 8000,
    cooldownMinutes: 15,
  },
  voice: null,
  rate: null,
  prefixProject: true,
  fallback: 'strip',
  fallbackMaxChars: 400,
  notifications: true,
  enforce: true,
  ack: true,
  ackPhrases: [
    'Hold your horses.',
    'Hold your horses, mate.',
    'Just a tick.',
    'Hang on a tic.',
    'Give us a sec.',
    'Keep your shirt on.',
    'Righto old mate.',
    'K, one sec.',
  ],
  projectNames: {},
};

export function ensureDirs(): void {
  mkdirSync(QUEUE_DIR, { recursive: true });
}

export function loadConfig(file = CONFIG_FILE): Config {
  if (!existsSync(file)) return { ...defaults, elevenlabs: { ...defaults.elevenlabs } };
  try {
    const user = JSON.parse(readFileSync(file, 'utf8')) as Partial<Config>;
    return { ...defaults, ...user, elevenlabs: { ...defaults.elevenlabs, ...(user.elevenlabs ?? {}) } };
  } catch {
    return { ...defaults, elevenlabs: { ...defaults.elevenlabs } };
  }
}
