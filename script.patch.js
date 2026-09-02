/**
 * Platypus AI — Frontend patch
 *
 * 1. In script.js, DELETE the entire keyPool from every model in MODELS array
 * 2. DELETE the getNextKey() function
 * 3. REPLACE the sendMessageToAI() function with the one below
 */

const WORKER_URL = 'https://noisy-breeze-a4b2.detlaffcameron.workers.dev';

async function sendMessageToAI(messages, model) {
  const res = await fetch(`${WORKER_URL}/api/chat`, {
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
