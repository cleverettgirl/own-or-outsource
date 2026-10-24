// Vercel serverless entry point. Same handler as local dev (see vite.config.js).
import { handleClaude } from '../server/claude.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const { status, json } = await handleClaude({ ip, body: req.body });
  res.status(status).json(json);
}
