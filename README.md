# Platypus AI — Cloudflare Worker

Secure API proxy for Platypus AI. Keeps all OpenRouter keys server-side
so they are never exposed in browser source code.

## Files

| File | Purpose |
|------|---------|
| `worker.js` | The Cloudflare Worker (deploy this) |
| `wrangler.toml` | Worker config |
| `script.patch.js` | Drop-in replacement for `sendMessageToAI` in your frontend |

---

## Deploy in 4 steps

### 1. Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. Set your API key secrets

You can use one key per provider (recommended) or a single shared key.

**One key per provider:**
```bash
wrangler secret put OPENROUTER_KEY_OPENAI
wrangler secret put OPENROUTER_KEY_DEEPSEEK
wrangler secret put OPENROUTER_KEY_ZHIPU
wrangler secret put OPENROUTER_KEY_XAI
wrangler secret put OPENROUTER_KEY_GOOGLE
wrangler secret put OPENROUTER_KEY_ALIBABA
```

**Or a single fallback key for all providers:**
```bash
wrangler secret put OPENROUTER_KEY_DEFAULT
```

Wrangler will prompt you to paste each key securely.

### 3. Deploy

```bash
cd platypus-worker
wrangler deploy
```

Wrangler prints your worker URL:
```
https://platypus-ai.<your-subdomain>.workers.dev
```

### 4. Update the frontend

In `script.js`:

1. **Delete all `keyPool: [...]` entries** from the `MODELS` array.
2. **Delete the `getNextKey` function.**
3. **Replace `sendMessageToAI`** with the version in `script.patch.js`.
4. **Set `WORKER_BASE_URL`** to your deployed worker URL.

---

## API reference

### `POST /api/chat`

**Request:**
```json
{
  "modelId": "deepseek-v3",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
```

**Success response `200`:**
```json
{ "reply": "Hi there! How can I help?" }
```

**Error response:**
```json
{ "error": "Description of what went wrong" }
```

### `GET /health`

Returns `{ "status": "ok", "worker": "platypus-ai" }` — useful for uptime monitoring.

---

## Supported model IDs

| `modelId` | Model | Provider |
|-----------|-------|----------|
| `gpt-oss-20b` | GPT-4o mini | OpenAI |
| `deepseek-v3` | DeepSeek V3 | DeepSeek |
| `glm-4-5-air` | GLM-4.5 Air | Zhipu AI |
| `grok-4` | Grok 4 | xAI |
| `gemini-flash` | Gemini 2.0 Flash | Google |
| `qwen-code-3` | Qwen Code 3 | Alibaba |

---

## Security notes

- API keys are stored as **Worker secrets** — encrypted at rest, never in code.
- The worker strips all fields from messages except `role` and `content`.
- Add an `Origin` allowlist in `corsHeaders()` once your domain is finalised.
