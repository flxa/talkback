import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE_DIR, loadConfig, LAST_SESSION_FILE, LOCK_DIR, QUEUE_DIR, type Config } from './config.ts';
import { cachePath, resolveProvider, synthesize } from './elevenlabs.ts';
import { log, type QueueItem } from './speak.ts';

const STALE_LOCK_MS = 5 * 60 * 1000;
const PID_FILE = join(LOCK_DIR, 'pid');

function takeLock(): boolean {
  try {
    mkdirSync(LOCK_DIR);
    writeFileSync(PID_FILE, String(process.pid));
    return true;
  } catch {
    return lockIsStale() && (rmSync(LOCK_DIR, { recursive: true, force: true }), takeLock());
  }
}

function lockIsStale(): boolean {
  try {
    const pid = Number(readFileSync(PID_FILE, 'utf8'));
    const ageMs = Date.now() - statSync(PID_FILE).mtimeMs;
    if (ageMs > STALE_LOCK_MS) return true;
    process.kill(pid, 0);
    return false;
  } catch {
    return true;
  }
}

function releaseLock(): void {
  rmSync(LOCK_DIR, { recursive: true, force: true });
}

function nextItem(): { path: string; item: QueueItem } | null {
  if (!existsSync(QUEUE_DIR)) return null;
  for (const f of readdirSync(QUEUE_DIR).filter((n) => n.endsWith('.json')).sort()) {
    const path = join(QUEUE_DIR, f);
    try {
      return { path, item: JSON.parse(readFileSync(path, 'utf8')) as QueueItem };
    } catch {
      unlinkSync(path);
    }
  }
  return null;
}

function lastSession(): string {
  try {
    return readFileSync(LAST_SESSION_FILE, 'utf8');
  } catch {
    return '';
  }
}

function voiceInstalled(voice: string): boolean {
  const list = spawnSync('say', ['-v', '?'], { encoding: 'utf8' }).stdout ?? '';
  return list.split('\n').some((l) => l.startsWith(voice + ' ') || l.startsWith(voice + '\t'));
}

async function speak(item: QueueItem): Promise<void> {
  const cfg = loadConfig();
  const needsPrefix = cfg.prefixProject && (item.kind === 'notification' || lastSession() !== item.session);
  const text = needsPrefix ? `${item.project}. ${item.text}` : item.text;
  if (process.env.TALKBACK_DRY_RUN) appendFileSync(process.env.TALKBACK_DRY_RUN, `${text}\n`);
  else if (!(resolveProvider(cfg) === 'elevenlabs' && (await speakElevenLabs(text, item, cfg)))) speakSay(text, item, cfg);
  writeFileSync(LAST_SESSION_FILE, item.session);
}

function speakSay(text: string, item: QueueItem, cfg: Config): void {
  const args: string[] = [];
  if (cfg.voice && voiceInstalled(cfg.voice)) args.push('-v', cfg.voice);
  if (cfg.rate) args.push('-r', String(cfg.rate));
  args.push('--', text);
  log(`say [${item.project}] ${text.slice(0, 120)}`);
  spawnSync('say', args, { stdio: 'ignore' });
}

async function speakElevenLabs(text: string, item: QueueItem, cfg: Config): Promise<boolean> {
  const cacheable = item.kind !== 'reply';
  const file = cacheable ? cachePath(text, cfg) : join(CACHE_DIR, `reply-${process.pid}.mp3`);
  mkdirSync(CACHE_DIR, { recursive: true });
  if (!(cacheable && existsSync(file))) {
    const audio = await synthesize(text, cfg);
    if (!audio) return false;
    writeFileSync(file, audio);
  }
  log(`elevenlabs [${item.project}] ${text.slice(0, 120)}`);
  const played = spawnSync('afplay', [file], { stdio: 'ignore' }).status === 0;
  if (!cacheable) rmSync(file, { force: true });
  if (!played) log('afplay failed');
  return played;
}

async function drain(): Promise<void> {
  for (let next = nextItem(); next; next = nextItem()) {
    unlinkSync(next.path);
    await speak(next.item);
  }
}

for (let attempt = 0; attempt < 2; attempt++) {
  if (!takeLock()) break;
  try {
    await drain();
  } finally {
    releaseLock();
  }
  if (!nextItem()) break;
}
