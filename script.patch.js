/**
 * PATCHED sendMessageToAI — replace the original in script.js
 *
 * All API keys are removed from the frontend.
 * Calls the Cloudflare Worker proxy at /api/chat instead.
 *
 * Set WORKER_BASE_URL to your deployed worker URL, e.g.:
 *   https://platypus-ai.<your-subdomain>.workers.dev
 * or your custom domain if you've configured one.
 */

// ── 1. Remove keyPool from every model definition ─────────────
// In the MODELS array, delete every `keyPool: [...]` entry.
// The worker handles keys — the frontend should have none.

// ── 2. Remove the getNextKey function entirely ─────────────────

// ── 3. Replace sendMessageToAI with this ──────────────────────

const WORKER_BASE_URL = 'https://platypus-ai.<YOUR-SUBDOMAIN>.workers.dev';

async function sendMessageToAI(messages, model) {
  const res = await fetch(`${WORKER_BASE_URL}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId:  model.id,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Worker returned ${res.status}`);
  }

  const data = await res.json();
  return data.reply || '(No response)';
}
