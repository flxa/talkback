import { spawn } from 'node:child_process';
import { appendFileSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDirs, loadConfig, LOG_FILE, QUEUE_DIR } from './config.ts';
import { sanitiseForSay } from './strip.ts';

export interface QueueItem {
  session: string;
  project: string;
  text: string;
  kind: 'reply' | 'notification' | 'ack';
}

export function log(msg: string): void {
  try {
    appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`);
  } catch {}
}

export function projectName(cwd: string | undefined): string {
  const name = basename(cwd || process.cwd());
  const map = loadConfig().projectNames;
  const key = Object.keys(map).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? map[key] : name.replace(/[-_]+/g, ' ');
}

export function enqueue(item: QueueItem): void {
  const cfg = loadConfig();
  if (!cfg.enabled) return;
  const text = sanitiseForSay(item.text);
  if (!text) return;
  ensureDirs();
  if (item.kind !== 'notification') dropQueuedFromSession(item.session);
  const name = `${Date.now()}-${process.pid}-${item.kind}.json`;
  writeFileSync(join(QUEUE_DIR, name), JSON.stringify({ ...item, text }));
  log(`enqueue ${name} [${item.project}] ${text.slice(0, 80)}`);
  const worker = fileURLToPath(new URL('./worker.ts', import.meta.url));
  const child = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', worker], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

function dropQueuedFromSession(session: string): void {
  for (const f of readdirSync(QUEUE_DIR)) {
    if (f.endsWith('-notification.json')) continue;
    const p = join(QUEUE_DIR, f);
    try {
      const item = JSON.parse(readFileSync(p, 'utf8')) as QueueItem;
      if (item.session === session) unlinkSync(p);
    } catch {}
  }
}

export function readStdinJson<T>(): T | null {
  try {
    const raw = readFileSync(0, 'utf8');
    return raw.trim() ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
