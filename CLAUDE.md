# Meanwhile - Pregnancy Milestone Tracker

## Project Structure

- `/src` - Preact frontend app
- `/worker` - Cloudflare Worker backend (config editor API)

## Development Modes

### 1. Local Frontend + Remote Backend (Recommended for quick iteration)

```bash
# In project root
npm run dev
```

The frontend will use the production backend at `https://meanwhile-config-editor.dalberto-adler.workers.dev`

### 2. Local Frontend + Local Backend (Full local development)

Terminal 1 - Start the worker:
```bash
cd worker
npm run setup-secrets  # First time only - stores secrets in macOS keychain
npm run dev
```

Terminal 2 - Start the frontend:
```bash
npm run dev
```

Update the frontend to use `http://localhost:8787` instead of the production URL.

### 3. Deploy

Frontend deploys automatically to GitHub Pages on push to main.

Worker deployment:
```bash
cd worker
npm run deploy
```

Or push to main - the GitHub Action will deploy if worker/ files changed.

## Worker Secrets

The worker needs these secrets (set in Cloudflare dashboard or via wrangler):

- `PIN` - 4-digit authentication PIN
- `MISTRAL_API_KEY` - From https://console.mistral.ai/api-keys
- `GITHUB_TOKEN` - PAT with repo write access

For local development, run `npm run setup-secrets` in the worker directory. This stores secrets in macOS keychain and creates `.dev.vars`.

## API Endpoints

- `GET /` - Health check
- `GET /openapi.json` - OpenAPI spec
- `POST /api/chat` - Edit config via natural language
  - Body: `{ "pin": "1234", "message": "Add birthday on March 15" }`
