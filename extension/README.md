# DevMeter for VS Code

See what your AI calls cost. DevMeter records **usage metadata only** (model, provider, token counts,
latency, project tag) and sends it to your DevMeter backend. Prompt and response text never leave your machine.

## Commands

- **DevMeter: Sign In**: sign in with Google through your browser
- **DevMeter: Sign Out**
- **DevMeter: Ask AI**: run one AI request and record its usage
- **DevMeter: Show Status**: who is signed in, backend, mode, provider/model, whether an API key is set (never the key)
- **DevMeter: Set API Key** / **Remove API Key**: your provider API key, needed only when mock mode is off.
  Stored per provider in VS Code's secret storage, never in settings or logs.

## Settings

| Setting | Default | Notes |
|---|---|---|
| `devmeter.backendUrl` | `http://localhost:8080` | User settings only. Use `localhost`, not `127.0.0.1`. |
| `devmeter.provider` | `anthropic` | `anthropic` or `gemini`. Gemini has a free API tier (key from aistudio.google.com). |
| `devmeter.model` | *(empty)* | Empty uses the provider default: `claude-sonnet-5-5` or `gemini-3.8-flash`. |
| `devmeter.mockMode` | `true` | Simulated AI calls; no API key needed. Turn off for real calls to the selected provider. |
| `devmeter.projectTag` | *(empty)* | Empty uses the workspace folder name. Never taken from prompt text. |
| `devmeter.logSentEvents` | `false` | Prints each usage event sent to the backend in the DevMeter panel, to see exactly what leaves your machine. |

## Development

Requires Node 22.18+ (tests run TypeScript directly).

```
npm install
npm run compile      # type-check + build out/extension.cjs
npm test             # unit tests
npm run package      # build devmeter-<version>.vsix
```

To debug, open this `extension/` folder as its own VS Code window and press **F5**.
