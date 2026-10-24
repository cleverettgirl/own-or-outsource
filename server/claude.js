// Server-side Claude proxy. The browser never sees the API key, never picks the
// model, and can only ask for one of a few named "kinds" of call.
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the server env

const MODEL = 'claude-opus-5-5';

// Each kind of call the UI makes, with its own effort and output cap.
// tutor: annotations, hints, step Q&A, Sam. grade: the reveal's score, so it gets more thinking.
const KINDS = {
  tutor: { effort: 'low', max_tokens: 2000 },
  json: { effort: 'medium', max_tokens: 4000 },
  grade: { effort: 'high', max_tokens: 8000 },
};

const MAX_INPUT_CHARS = 12000;

// Cost logging: one line per call in the server terminal, plus a running total, so real usage
// replaces estimates. Opus 5.5 list prices per million tokens; thinking counts as output.
const PRICE = { input: 4, output: 20, cacheRead: 0.2 };
const totals = { calls: 0, cost: 0, byKind: {} };
export const usageTotals = () => totals;
function logUsage(kind, response) {
  const u = response.usage || {};
  const cost = ((u.input_tokens || 0) * PRICE.input + (u.output_tokens || 0) * PRICE.output + (u.cache_read_input_tokens || 0) * PRICE.cacheRead) / 1e6;
  totals.calls += 1; totals.cost += cost;
  const k = (totals.byKind[kind] ||= { calls: 0, cost: 0 }); k.calls += 1; k.cost += cost;
  // A fallback model may answer; its price differs, so the cost is marked as an Opus-price estimate.
  const note = response.model && response.model !== MODEL ? ` (answered by ${response.model}; cost at Opus prices)` : '';
  console.log(`[claude] ${kind.padEnd(5)} in ${u.input_tokens} · out ${u.output_tokens} → $${cost.toFixed(4)}${note} | total $${totals.cost.toFixed(3)} over ${totals.calls} calls`);
}

// How much one visitor can spend: a sliding window per IP.
// A full Own-it run is roughly 10–15 calls, so 60 per 15 minutes covers a grader trying several starters.
// Note: on Vercel each warm function instance has its own memory, so this is a soft limit.
const LIMIT = 60;
const WINDOW_MS = 15 * 60 * 1000;
const hits = new Map(); // ip -> array of request timestamps (ms)
export function isAllowed(ip, now = Date.now()) {
  // Keep only this IP's requests inside the window.
  const recent = (hits.get(ip) || []).filter(t => t > now - WINDOW_MS);
  if (recent.length >= LIMIT) { hits.set(ip, recent); return false; }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

export async function handleClaude({ ip, body }) {
  if (!isAllowed(ip)) return { status: 429, json: { error: 'Too many requests. Try again in a few minutes.' } };

  const { kind = 'tutor', system = '', messages } = body || {};
  const cfg = KINDS[kind];
  if (!cfg) return { status: 400, json: { error: 'Unknown kind' } };
  if (!Array.isArray(messages) || !messages.length) return { status: 400, json: { error: 'messages required' } };

  const clean = messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content ?? '') }));
  const size = String(system).length + clean.reduce((n, m) => n + m.content.length, 0);
  if (size > MAX_INPUT_CHARS) return { status: 413, json: { error: 'Input too long for this prototype.' } };

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: cfg.max_tokens,
      output_config: { effort: cfg.effort },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: String(system),
      messages: clean,
    });
    logUsage(kind, response);
    if (response.stop_reason === 'refusal') return { status: 422, json: { error: 'The model declined this request.' } };
    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return { status: 200, json: { text } };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { status: 429, json: { error: 'Model is busy. Try again shortly.' } };
    if (error instanceof Anthropic.APIError) {
      console.error('Claude API error', error.status, error.message);
      return { status: 502, json: { error: 'Model call failed.' } };
    }
    console.error(error);
    const detail = process.env.NODE_ENV === 'production' ? '' : ` (${error.message})`;
    return { status: 500, json: { error: 'Server error.' + detail } };
  }
}
