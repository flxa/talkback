import { loadConfig } from '../lib/config.ts';
import { enqueue, projectName, readStdinJson } from '../lib/speak.ts';

interface NotificationInput {
  session_id?: string;
  cwd?: string;
  message?: string;
  notification_message?: string;
  notification_type?: string;
}

const phrases: Record<string, string> = {
  permission_prompt: 'needs your permission.',
  idle_prompt: 'is waiting for you.',
  elicitation_dialog: 'has a question for you.',
  agent_needs_input: 'has an agent waiting on you.',
};
const silent = new Set(['auth_success', 'elicitation_complete', 'elicitation_response', 'agent_completed']);

const input = readStdinJson<NotificationInput>();
if (input && loadConfig().notifications) {
  const kind = input.notification_type ?? '';
  const msg = input.notification_message ?? input.message ?? '';
  const text = silent.has(kind) ? '' : (phrases[kind] ?? msg.slice(0, 160));
  if (text) {
    enqueue({ session: input.session_id ?? 'unknown', project: projectName(input.cwd), text, kind: 'notification' });
  }
}
