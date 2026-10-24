// Browser-side client for /api/claude. Replaces the design tool's window.claude.complete.
export async function complete({ kind = 'tutor', system = '', messages }) {
  const r = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, system, messages }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data.text;
}
