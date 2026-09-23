export const SPEAK_RE = /<speak>([\s\S]*?)<\/speak>/gi;

export function extractSpeak(text: string): string | null {
  const matches = [...text.matchAll(SPEAK_RE)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1][1].trim();
  return last.length > 0 ? last : null;
}

export function stripForSpeech(text: string, maxChars: number): string {
  let t = text.replace(SPEAK_RE, '');
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/^[ \t]*\|.*\|[ \t]*$/gm, ' ');
  t = t.replace(/^[ \t]{4,}\S.*$/gm, ' ');
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  t = t.replace(/https?:\/\/\S+/g, 'a link');
  t = t.replace(/`[^`\n]*`/g, ' ');
  t = t.replace(/(?<![\w/])[\w@.~-]*\/[\w@.~/-]*(?::\d+)?/g, replacePath);
  t = t.replace(/\b[0-9a-f]{7,40}\b/g, 'a commit');
  t = t.replace(/^#{1,6}\s*/gm, '');
  t = t.replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '');
  t = t.replace(/^\s*>\s?/gm, '');
  t = t.replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, '$1');
  t = t.replace(/<[^>\n]+>/g, ' ');
  t = t.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '. ').replace(/\.\s*\./g, '.').trim();
  if (t.length <= maxChars) return t;
  const cut = t.slice(0, maxChars);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return (end > maxChars * 0.4 ? cut.slice(0, end + 1) : cut).trim();
}

function replacePath(token: string): string {
  const trail = token.match(/[.,;:]+$/)?.[0] ?? '';
  const core = token.slice(0, token.length - trail.length);
  const slashes = (core.match(/\//g) ?? []).length;
  const rooted = /^(?:~|\.{1,2})?\//.test(core);
  const hasExt = /\/[\w@-]+\.\w+(?::\d+)?$/.test(core);
  return rooted || slashes >= 2 || hasExt ? `a file path${trail}` : token;
}

export function sanitiseForSay(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/^-+/, '').trim();
}
