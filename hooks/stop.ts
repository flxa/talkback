import { loadConfig } from '../lib/config.ts';
import { enqueue, projectName, readStdinJson } from '../lib/speak.ts';
import { extractSpeak, stripForSpeech } from '../lib/strip.ts';
import { lastAssistantText } from '../lib/transcript.ts';

interface ContentBlock { type: string; text?: string }
interface StopInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  stop_hook_active?: boolean;
  last_assistant_message?: string | ContentBlock | ContentBlock[] | { content?: string | ContentBlock[] };
}

const MISSING_BLOCK_REASON =
  'Talkback: your reply has no <speak> block, so the user heard nothing. Append exactly one now: <speak>one to three plain spoken sentences, under sixty words, with the outcome and anything the user must decide, no paths, code, links or hashes</speak>. Add nothing else.';

function textOf(m: StopInput['last_assistant_message']): string {
  if (!m) return '';
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return m.map(textOf).join('\n\n');
  if ('text' in m && typeof m.text === 'string') return m.text;
  if ('content' in m) return textOf(m.content as StopInput['last_assistant_message']);
  return '';
}

const input = readStdinJson<StopInput>();
if (input) {
  const cfg = loadConfig();
  const fromTranscript = input.transcript_path ? lastAssistantText(input.transcript_path) : '';
  const text = fromTranscript || textOf(input.last_assistant_message);
  const block = extractSpeak(text) ?? extractSpeak(textOf(input.last_assistant_message));
  if (!block && cfg.enabled && cfg.enforce && !input.stop_hook_active) {
    process.stdout.write(JSON.stringify({ decision: 'block', reason: MISSING_BLOCK_REASON }));
  } else {
    const fallback = cfg.fallback === 'strip' ? stripForSpeech(text, cfg.fallbackMaxChars) : '';
    const spoken = block ?? (fallback.length > 12 ? fallback : 'Done. The details are on screen.');
    enqueue({ session: input.session_id ?? 'unknown', project: projectName(input.cwd), text: spoken, kind: 'reply' });
  }
}
