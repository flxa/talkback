import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../lib/config.ts';

if (loadConfig().enabled) {
  const contract = readFileSync(fileURLToPath(new URL('./speak-contract.md', import.meta.url)), 'utf8');
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: contract } }),
  );
}
