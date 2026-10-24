// Browser-side client for /api/claude. It names a task (src/prompts.js) and sends that task's inputs;
// the server writes the prompt. Conversations (the chat, Sam) also send their turns.
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
