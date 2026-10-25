// Browser-side client for /api/claude. It names a task (src/prompts.js) and sends that task's inputs;
// the server writes the prompt. Conversations (the chat, Sam) also send their turns.
import { TASKS } from './prompts.js';

// One-shot task: the reply as text, or parsed when the task returns JSON.
export async function ask(task, input) {
  const text = await complete({ task, input });
  if (!TASKS[task].json) return String(text).trim();
  return JSON.parse(firstJson(String(text)));
}

// The first complete JSON object or array in a reply. Models sometimes add a sentence, or a second object, after
// the JSON; a greedy match would swallow that and fail to parse (2 of 40 generated tries did, in the eval).
function firstJson(t) {
  const start = t.search(/[{[]/); if (start < 0) throw new Error('no JSON');
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{' || c === '[') depth++; else if ((c === '}' || c === ']') && --depth === 0) return t.slice(start, i + 1);
  }
  throw new Error('unfinished JSON');
}

// onText, for the chat, gets the answer so far as it streams in; the full text is still what's returned.
export async function complete({ task, input = {}, messages, onText }) {
  const r = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, input, messages, stream: !!onText }),
  });
  if (onText && r.ok && /ndjson/.test(r.headers.get('Content-Type') || '')) return readStream(r, onText);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data.text;
}

// NDJSON lines: {"t": piece} …, then {"done": true} or {"error": message}.
async function readStream(r, onText) {
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = '', text = '';
  for (;;) {
    const { value, done } = await reader.read();
    buf += dec.decode(value || new Uint8Array(), { stream: !done });
    const lines = buf.split('\n'); buf = lines.pop();
    for (const l of lines.filter(Boolean)) {
      const m = JSON.parse(l);
      if (m.error) throw new Error(m.error);
      if (m.done) return text;
      text += m.t; onText(text);
    }
    if (done) throw new Error('The answer was cut off.');
  }
}
