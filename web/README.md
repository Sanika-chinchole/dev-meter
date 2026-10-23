# DevMeter web dashboard

Shows your AI spend (totals, by day, by model) from the DevMeter backend. Sign in with the same Google
account as the VS Code extension. The dashboard only reads `GET /usage` and `GET /auth/me`; it never
sees prompt or response text.

## Run

Needs the backend running on `http://localhost:8080`.

```
npm install
npm run dev        # http://localhost:5173 (fixed: the backend only allows this origin)
```

Optional: copy `.env.example` to `.env` to point at another backend (`VITE_BACKEND_URL`).

## Scripts

```
npm test           # unit tests (Vitest)
npm run lint       # oxlint
npm run build      # type-check + production build into dist/
```
