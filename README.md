# Platypus AI — Cloudflare Worker
**URL:** https://noisy-breeze-a4b2.detlaffcameron.workers.dev

---

## Step 1 — Paste the worker code

1. Go to https://dash.cloudflare.com → **Workers & Pages**
2. Open the **noisy-breeze-a4b2** worker
3. Click **Edit code**
4. Delete everything and paste in the contents of `worker.js`
5. Click **Deploy**

---

## Step 2 — Add the 10 secrets

Worker → **Settings** → **Variables & Secrets** → **Add secret**

| Secret name    | Value (paste full key including sk-or-v1-) |
|----------------|-------------------------------------------|
| OPENAI_KEY_1   | gpt-oss-20b key 1                         |
| OPENAI_KEY_2   | gpt-oss-20b key 2                         |
| OPENAI_KEY_3   | gpt-oss-20b key 3                         |
| DEEPSEEK_KEY_1 | DeepSeek V3 key 1                         |
| DEEPSEEK_KEY_2 | DeepSeek V3 key 2                         |
| ZHIPU_KEY_1    | GLM-4.5 Air key 1                         |
| ZHIPU_KEY_2    | GLM-4.5 Air key 2                         |
| GROK_KEY_1     | Grok 4 key                                |
| GEMINI_KEY_1   | Gemini 2.0 Flash key                      |
| QWEN_KEY_1     | Qwen Code 3 key                           |

---

## Step 3 — Patch script.js

Open your `script.js` and make 3 changes:

**A) Delete keyPool from every model** — remove lines like:
```js
keyPool: [
  'sk-or-v1-...',
  'sk-or-v1-...',
],
```

**B) Delete the getNextKey function** — remove:
```js
function getNextKey(model) { ... }
```

**C) Replace sendMessageToAI** with the version in `script.patch.js`

---

## Test it

Visit this URL in your browser — should return `{"status":"ok","worker":"platypus-ai"}`:
https://noisy-breeze-a4b2.detlaffcameron.workers.dev/health
