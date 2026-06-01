# AI Accountant Frontend

React + Vite client for AI-assisted bookkeeping.

## Commands

```powershell
npm install
npm run dev
npm run lint
npm test
npm run build
```

The Vite dev server proxies `/api` to `http://127.0.0.1:3002` by default. Override it with `VITE_API_PROXY_TARGET`.

`frontend/.env.example` is a reference file for local development:

```bash
cp .env.example .env
```

Vite reads variables prefixed with `VITE_` from `.env` during development and build.
