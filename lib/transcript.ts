import { readFileSync } from 'node:fs';

interface Block { type: string; text?: string }
interface Line { type?: string; message?: { role?: string; content?: string | Block[] } }

function isRealUserTurn(line: Line): boolean {
  if (line.type !== 'user') return false;
  const c = line.message?.content;
  if (typeof c === 'string') return true;
  return Array.isArray(c) && c.some((b) => b.type === 'text');
}

export function lastAssistantText(transcriptPath: string): string {
  let raw: string;
  try {
    raw = readFileSync(transcriptPath, 'utf8');
  } catch {
    return '';
  }
  const lines = raw.split('\n').filter(Boolean);
  const texts: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    let line: Line;
    try {
      line = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (isRealUserTurn(line)) break;
    if (line.type !== 'assistant') continue;
    const c = line.message?.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) if (b.type === 'text' && b.text) texts.unshift(b.text);
  }
  return texts.join('\n\n');
}
