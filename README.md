# Own it or outsource it

A prototype for Anthropic Ed Labs: a Claude chat that tests whether you could do it yourself. Pick part of an answer to own, predict how you'll do, try a new case without help, see the gap, explain it to Sam, and get it back days later for recall.

**Live:** https://own-it-or-outsource-it.vercel.app

## Run it locally

Needs Node 20 or newer (`.nvmrc` pins 24) and an Anthropic API key.

```sh
nvm use
npm install
echo "ANTHROPIC_API_KEY=your-key" > .env.local
npm run dev
```

Open http://localhost:5173.

## How it's built

- **Frontend:** Vite, React and Tailwind 4 (`src/`). Progress is saved in the browser's localStorage; chats aren't kept.
- **Server:** one Vercel function (`api/claude.js` → `server/claude.js`). It holds the key and builds every request from a task name, so the browser never sends a prompt, model or limit. Dev serves the same handler through `vite.config.js`.
- **Checks:** SQL tries run in the browser with sql.js. Other answers are checked against answer keys or judged by Claude, which must quote the learner's words.
- **Prompts:** `src/prompts.js`. Hand-written examples (Juno, SQL, React) live in `src/*Targets.js`; any other question is generated.

## Tests

```sh
npm test              # target checks + full flow checks
npm run format:check  # Prettier
```
