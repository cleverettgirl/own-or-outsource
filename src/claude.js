// Browser-side client for /api/claude. It names a task (src/prompts.js) and sends that task's inputs;
// the server writes the prompt. Conversations (the chat, Sam) also send their turns.
export async function complete({ task, input = {}, messages }) {
  const r = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, input, messages }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data.text;
}
