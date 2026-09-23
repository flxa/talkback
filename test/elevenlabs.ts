import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, type Config } from '../lib/config.ts';
import { cachePath, resolveProvider, synthesize } from '../lib/elevenlabs.ts';

const tmp = mkdtempSync(join(tmpdir(), 'talkback-el-'));
const cooldownFile = join(tmp, 'cooldown');
const base: Config = { ...loadConfig(), elevenlabs: { ...loadConfig().elevenlabs, apiKey: 'sk_test', voiceId: 'v1' } };
const noEnv = {} as NodeJS.ProcessEnv;

// provider resolution
assert.equal(resolveProvider({ ...base, provider: 'auto' }, noEnv), 'elevenlabs');
assert.equal(resolveProvider({ ...base, provider: 'auto', elevenlabs: { ...base.elevenlabs, apiKey: null } }, noEnv), 'say');
assert.equal(resolveProvider({ ...base, provider: 'auto', elevenlabs: { ...base.elevenlabs, voiceId: null } }, noEnv), 'say');
assert.equal(resolveProvider({ ...base, provider: 'say' }, noEnv), 'say');
assert.equal(resolveProvider({ ...base, provider: 'elevenlabs', elevenlabs: { ...base.elevenlabs, apiKey: null } }, noEnv), 'elevenlabs');
assert.equal(
  resolveProvider({ ...base, provider: 'auto', elevenlabs: { ...base.elevenlabs, apiKey: null } }, { ELEVENLABS_API_KEY: 'sk_env' }),
  'elevenlabs',
);

// cache key is stable and voice/model specific
assert.equal(cachePath('Just a tick.', base), cachePath('Just a tick.', base));
assert.notEqual(cachePath('Just a tick.', base), cachePath('Just a tick', base));
assert.notEqual(cachePath('Just a tick.', base), cachePath('Just a tick.', { ...base, elevenlabs: { ...base.elevenlabs, voiceId: 'v2' } }));
assert.match(cachePath('x', base), /\.talkback\/cache\/[0-9a-f]{40}\.mp3$/);

const calls: { url: string; init: RequestInit }[] = [];
const fetchOk = async (url: string | URL | Request, init?: RequestInit) => {
  calls.push({ url: String(url), init: init ?? {} });
  return new Response(new Uint8Array(2000).fill(1), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
};

// success: posts to the voice with the model and returns audio
let audio = await synthesize('Hello there.', base, { fetch: fetchOk as typeof fetch, cooldownFile, env: noEnv });
assert.ok(audio && audio.length === 2000, 'expected audio buffer');
assert.equal(calls.length, 1);
assert.match(calls[0].url, /^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/v1\?output_format=mp3_44100_128$/);
assert.equal((calls[0].init.headers as Record<string, string>)['xi-api-key'], 'sk_test');
const body = JSON.parse(String(calls[0].init.body));
assert.equal(body.text, 'Hello there.');
assert.equal(body.model_id, 'eleven_flash_v2_5');
assert.equal(body.voice_settings, undefined);

// env key overrides config key; speed is sent only when not 1
calls.length = 0;
await synthesize('x', { ...base, elevenlabs: { ...base.elevenlabs, speed: 1.1 } }, { fetch: fetchOk as typeof fetch, cooldownFile, env: { ELEVENLABS_API_KEY: 'sk_env' } });
assert.equal((calls[0].init.headers as Record<string, string>)['xi-api-key'], 'sk_env');
assert.deepEqual(JSON.parse(String(calls[0].init.body)).voice_settings, { speed: 1.1 });

// no key or no voice: null without a network call
calls.length = 0;
assert.equal(await synthesize('x', { ...base, elevenlabs: { ...base.elevenlabs, apiKey: null } }, { fetch: fetchOk as typeof fetch, cooldownFile, env: noEnv }), null);
assert.equal(await synthesize('x', { ...base, elevenlabs: { ...base.elevenlabs, voiceId: null } }, { fetch: fetchOk as typeof fetch, cooldownFile, env: noEnv }), null);
assert.equal(calls.length, 0);

// quota / auth failure: null, and a cooldown stops the next attempt hitting the network
const fetch402 = async () => new Response(JSON.stringify({ detail: { message: 'Free users cannot use library voices' } }), { status: 402 });
let now = 1_000_000;
assert.equal(await synthesize('x', base, { fetch: fetch402 as typeof fetch, cooldownFile, env: noEnv, now: () => now }), null);
assert.ok(Number(readFileSync(cooldownFile, 'utf8')) > now, 'cooldown written');
calls.length = 0;
assert.equal(await synthesize('x', base, { fetch: fetchOk as typeof fetch, cooldownFile, env: noEnv, now: () => now + 60_000 }), null);
assert.equal(calls.length, 0, 'no network call during cooldown');
audio = await synthesize('x', base, { fetch: fetchOk as typeof fetch, cooldownFile, env: noEnv, now: () => now + 16 * 60_000 });
assert.ok(audio, 'cooldown expired');

// server error: null, no cooldown
rmSync(cooldownFile, { force: true });
const fetch500 = async () => new Response('boom', { status: 500 });
assert.equal(await synthesize('x', base, { fetch: fetch500 as typeof fetch, cooldownFile, env: noEnv }), null);
assert.throws(() => readFileSync(cooldownFile), 'no cooldown on 5xx');

// network error and timeout: null
const fetchThrows = async () => { throw new TypeError('fetch failed'); };
assert.equal(await synthesize('x', base, { fetch: fetchThrows as typeof fetch, cooldownFile, env: noEnv }), null);
const fetchHangs = (_u: unknown, init?: RequestInit) =>
  new Promise<Response>((_res, rej) => init?.signal?.addEventListener('abort', () => rej(init.signal!.reason)));
const keepAlive = setTimeout(() => {}, 5000);
assert.equal(await synthesize('x', { ...base, elevenlabs: { ...base.elevenlabs, timeoutMs: 20 } }, { fetch: fetchHangs as typeof fetch, cooldownFile, env: noEnv }), null);
clearTimeout(keepAlive);

// empty body: null
const fetchEmpty = async () => new Response(new Uint8Array(0), { status: 200 });
assert.equal(await synthesize('x', base, { fetch: fetchEmpty as typeof fetch, cooldownFile, env: noEnv }), null);

// config: elevenlabs block deep-merges over defaults
writeFileSync(join(tmp, 'config.json'), JSON.stringify({ elevenlabs: { apiKey: 'sk_file' } }));
const merged = loadConfig(join(tmp, 'config.json'));
assert.equal(merged.elevenlabs.apiKey, 'sk_file');
assert.equal(merged.elevenlabs.modelId, 'eleven_flash_v2_5');
assert.equal(merged.provider, 'auto');

rmSync(tmp, { recursive: true, force: true });
console.log('talkback: elevenlabs tests passed');
