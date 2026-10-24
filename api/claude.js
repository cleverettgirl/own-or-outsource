// Vercel serverless entry point. Same handler as local dev (see vite.config.js).
import { serve } from '../server/claude.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  await serve({ ip, body: req.body, res });
}
