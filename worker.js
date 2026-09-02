/**
 * Platypus AI — Cloudflare Worker
 * Deployed at: https://noisy-breeze-a4b2.detlaffcameron.workers.dev
 *
 * Secure proxy with random key rotation across pools.
 * Keys live in Cloudflare secrets — never in browser code.
 *
 * ── Secrets to add in Cloudflare Dashboard ───────────────────
 *  Worker → Settings → Variables & Secrets → Add secret:
 *
 *  OPENAI_KEY_1      (gpt-oss-20b key 1)
 *  OPENAI_KEY_2      (gpt-oss-20b key 2)
 *  OPENAI_KEY_3      (gpt-oss-20b key 3)
 *  DEEPSEEK_KEY_1    (DeepSeek V3 key 1)
 *  DEEPSEEK_KEY_2    (DeepSeek V3 key 2)
 *  ZHIPU_KEY_1       (GLM-4.5 Air key 1)
 *  ZHIPU_KEY_2       (GLM-4.5 Air key 2)
 *  GROK_KEY_1        (Grok 4 key)
 *  GEMINI_KEY_1      (Gemini 2.0 Flash key)
 *  QWEN_KEY_1        (Qwen Code 3 key)
 * ─────────────────────────────────────────────────────────────
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';

const MODEL_CONFIG = {
  'gpt-oss-20b': {
    apiModel:   'openai/gpt-oss-20b',
    keySecrets: ['OPENAI_KEY_1', 'OPENAI_KEY_2', 'OPENAI_KEY_3'],
  },
  'deepseek-v3': {
    apiModel:   'deepseek/deepseek-chat-v3-5',
    keySecrets: ['DEEPSEEK_KEY_1', 'DEEPSEEK_KEY_2'],
  },
  'glm-4-5-air': {
    apiModel:   'z-ai/glm-4-5-air',
    keySecrets: ['ZHIPU_KEY_1', 'ZHIPU_KEY_2'],
  },
  'grok-4': {
    apiModel:   'x-ai/grok-4',
    keySecrets: ['GROK_KEY_1'],
  },
  'gemini-flash': {
    apiModel:   'google/gemini-2.0-flash-001',
    keySecrets: ['GEMINI_KEY_1'],
  },
  'qwen-code-3': {
    apiModel:   'qwen/qwen3-coder',
    keySecrets: ['QWEN_KEY_1'],
  },
};

function pickKey(config, env) {
  const available = config.keySecrets.map(n => env[n]).filter(Boolean);
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ status: 'ok', worker: 'platypus-ai' });
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env);
    }

    return json({ error: 'Not found' }, 404);
  },
};

async function handleChat(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { modelId, messages } = body;

  if (!modelId || !Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'Required: modelId (string) and messages (array)' }, 400);
  }

  const config = MODEL_CONFIG[modelId];
  if (!config) {
    return json({ error: `Unknown modelId "${modelId}". Valid: ${Object.keys(MODEL_CONFIG).join(', ')}` }, 400);
  }

  const apiKey = pickKey(config, env);
  if (!apiKey) {
    console.error(`[platypus-ai] No secrets found for model: ${modelId}`);
    return json({ error: 'API key not configured for this model' }, 503);
  }

  const sanitised = messages
    .filter(m => m && typeof m.role === 'string' && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content }));

  if (sanitised.length === 0) {
    return json({ error: 'No valid messages provided' }, 400);
  }

  let upstreamRes;
  try {
    upstreamRes = await fetch(OPENROUTER_BASE, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer':  'https://noisy-breeze-a4b2.detlaffcameron.workers.dev',
        'X-Title':       'Platypus AI',
      },
      body: JSON.stringify({
        model:      config.apiModel,
        messages:   sanitised,
        max_tokens: 2048,
        stream:     false,
      }),
    });
  } catch (err) {
    console.error('[platypus-ai] Upstream fetch failed:', err);
    return json({ error: 'Failed to reach AI provider' }, 502);
  }

  if (!upstreamRes.ok) {
    const errText = await upstreamRes.text().catch(() => upstreamRes.statusText);
    console.error(`[platypus-ai] Upstream ${upstreamRes.status}:`, errText);
    return json(
      { error: `AI provider returned ${upstreamRes.status}`, detail: errText },
      upstreamRes.status >= 500 ? 502 : upstreamRes.status,
    );
  }

  let data;
  try {
    data = await upstreamRes.json();
  } catch {
    return json({ error: 'Malformed response from AI provider' }, 502);
  }

  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return json({ error: 'Empty response from AI provider' }, 502);
  }

  return json({ reply });
}
