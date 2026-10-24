import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, serve /api/claude from the same handler Vercel uses in production,
// so `npm run dev` is the whole app and no Vercel login is needed locally.
function devApi() {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/claude', async (req, res) => {
        const { handleClaude } = await server.ssrLoadModule('/server/claude.js');
        let raw = '';
        for await (const chunk of req) raw += chunk;
        let body = {};
        try { body = JSON.parse(raw || '{}'); } catch { /* handled as bad request below */ }
        const { status, json } = req.method === 'POST'
          ? await handleClaude({ ip: req.socket.remoteAddress || 'local', body })
          : { status: 405, json: { error: 'POST only' } };
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(json));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make ANTHROPIC_API_KEY from .env.local visible to the server code (never to the browser).
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [react(), devApi()] };
});
