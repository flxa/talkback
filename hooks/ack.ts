import { loadConfig } from '../lib/config.ts';
import { enqueue, projectName, readStdinJson } from '../lib/speak.ts';

interface PromptInput {
  session_id?: string;
  cwd?: string;
  prompt?: string;
}

const input = readStdinJson<PromptInput>();
const cfg = loadConfig();
if (input && cfg.ack && cfg.ackPhrases.length > 0 && !(input.prompt ?? '').trimStart().startsWith('/')) {
  const text = cfg.ackPhrases[Math.floor(Math.random() * cfg.ackPhrases.length)];
  enqueue({ session: input.session_id ?? 'unknown', project: projectName(input.cwd), text, kind: 'ack' });
}
