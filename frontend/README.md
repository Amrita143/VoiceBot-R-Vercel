# Retell Voicebot UI (Vite + React + Tailwind)

Minimal split-view UI for real-time Retell voice calls with smooth transcript, variables editor, and Mermaid canvas.

## Quick Start

```bash
# 1) Install
npm i

# 2) Run in dev (expects your backend on http://localhost:3001)
npm run dev

# If your backend is at a different origin, set it at runtime:
#   Edit index.html and change window.__RETELL_API__.
#   Or prepend before `npm run dev`:  (Linux/macOS)
#   RETELL_API=https://your-backend.example.com npm run dev
```

## Build & Preview
```bash
npm run build
npm run preview
```

## Files to Note
- **src/App.tsx** – main UI (left: Voicebot, right: Flow/Mermaid)
- **index.html** – sets `window.__RETELL_API__`
- **tailwind.config.ts** + **src/index.css** – styling
- **vite.config.ts** – Vite + React

## Backend expectations

The UI calls two endpoints on your backend:

- `POST /api/create-web-call` → returns JSON: `{ access_token, call_id }`
  - Dynamic variables from the `{}` editor are sent in the POST body (e.g., `full_name`, `ssn_last_four_digit`).

- `GET /api/get-call-analysis?call_id=...` → returns `{ call_analysis: {...} }`

The backend should use your Retell API key securely (server-side) to retrieve the call analysis via:
```js
// pseudo example
import Retell from 'retell-sdk';
const client = new Retell({ apiKey: process.env.RETELL_API_KEY });
const r = await client.call.retrieve(call_id);
res.json({ call_analysis: r.call_analysis || null });
```
