import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSpeak, stripForSpeech } from '../lib/strip.ts';
import { lastAssistantText } from '../lib/transcript.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const node = ['--experimental-strip-types', '--no-warnings'];

const t1 = lastAssistantText(join(here, 'fixture.jsonl'));
assert.equal(extractSpeak(t1), 'The merge request is green. Say the word and I will merge it.');

const t2 = lastAssistantText(join(here, 'fixture-nospeak.jsonl'));
assert.equal(extractSpeak(t2), null);
const s2 = stripForSpeech(t2, 400);
for (const bad of ['```', 'const x', 'https://', '/Users/', 'a1b2c3d4e5f', '|', '##', 'src/foo.ts'])
  assert.ok(!s2.includes(bad), `fallback still contains ${bad}: ${s2}`);
assert.ok(s2.includes('Two tests still fail'), s2);

const out = mkdtempSync(join(tmpdir(), 'talkback-'));
mkdirSync(join(out, '.talkback'));
const dry = join(out, 'spoken.txt');
const run = (script: string, input: object) =>
  spawnSync(process.execPath, [...node, join(here, '..', 'hooks', script)], {
    input: JSON.stringify(input),
    env: { ...process.env, TALKBACK_DRY_RUN: dry, HOME: out },
    encoding: 'utf8',
  });

writeFileSync(join(out, '.talkback', 'config.json'), JSON.stringify({ projectNames: { 'my-app': 'my app' } }));
let r = run('stop.ts', { session_id: 's1', cwd: '/x/base', transcript_path: join(here, 'fixture.jsonl') });
assert.equal(r.status, 0, r.stderr);
r = run('stop.ts', { session_id: 's2', cwd: '/x/web', transcript_path: join(here, 'fixture-nospeak.jsonl') });
assert.equal(r.status, 0, r.stderr);
assert.equal(JSON.parse(r.stdout).decision, 'block');
r = run('stop.ts', { session_id: 's2', cwd: '/x/web', stop_hook_active: true, transcript_path: join(here, 'fixture-nospeak.jsonl') });
assert.equal(r.status, 0, r.stderr);
assert.equal(r.stdout, '');
r = run('ack.ts', { session_id: 's3', cwd: '/x/my-app', prompt: 'what are my open MRs' });
assert.equal(r.status, 0, r.stderr);
r = run('ack.ts', { session_id: 's3', cwd: '/x/api', prompt: '/talkback:hush' });
assert.equal(r.status, 0, r.stderr);
r = run('notification.ts', { session_id: 's1', cwd: '/x/shop-api', notification_type: 'permission_prompt' });
assert.equal(r.status, 0, r.stderr);
writeFileSync(join(out, '.talkback', 'config.json'), JSON.stringify({ provider: 'elevenlabs', elevenlabs: { apiKey: 'sk_test', voiceId: 'v1' } }));
r = run('notification.ts', { session_id: 's4', cwd: '/x/mail-api', notification_type: 'idle_prompt' });
assert.equal(r.status, 0, r.stderr);
r = run('session-start.ts', { session_id: 's1', source: 'startup' });
assert.equal(r.status, 0, r.stderr);
assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /<speak>/);

await new Promise((res) => setTimeout(res, 1500));
const spoken = readFileSync(dry, 'utf8').trim().split('\n');
const ack = spoken.splice(2, 1)[0];
assert.match(ack, /^my app\. (Hold your horses|Just a tick|Hang on a tic|Give us a sec|Keep your shirt on|Righto old mate|K, one sec)/);
assert.deepEqual(spoken, [
  'base. The merge request is green. Say the word and I will merge it.',
  'web. Result. Fixed in commit a commit. See a link for the MR. Two tests still fail in a file path.',
  'shop api. needs your permission.',
  'mail api. is waiting for you.',
]);
r = spawnSync(process.execPath, [...node, join(here, 'elevenlabs.ts')], { env: { ...process.env, HOME: out }, encoding: 'utf8' });
assert.equal(r.status, 0, r.stderr);
rmSync(out, { recursive: true, force: true });
console.log('talkback: all tests passed');
