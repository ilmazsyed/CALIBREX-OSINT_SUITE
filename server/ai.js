// Optional AI layer. Each operator connects their own AI account:
//   - OpenRouter (one-click sign-in via OAuth PKCE) gives access to Claude,
//     ChatGPT and Gemini models under one account.
//   - Direct keys for Anthropic (Claude), OpenAI (ChatGPT) or Google (Gemini).
// Keys are encrypted at rest and only ever used server-side for that operator.
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

export const PROVIDERS = {
  openrouter: { label: 'OpenRouter (Claude, ChatGPT, Gemini)' },
  anthropic: { label: 'Claude (Anthropic API key)' },
  openai: { label: 'ChatGPT (OpenAI API key)' },
  gemini: { label: 'Gemini (Google AI Studio key)' },
};

// ---------------------------------------------------------------- key encryption

function encKey() {
  const secret = process.env.AI_ENCRYPTION_KEY || process.env.SESSION_SECRET || '';
  if (!secret) throw new Error('Server is missing SESSION_SECRET; AI keys cannot be stored securely.');
  return crypto.createHash('sha256').update('calibrex-ai:' + secret).digest();
}
export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}
export function decrypt(blob) {
  const [iv, tag, data] = String(blob).split('.').map(s => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', encKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}

// ---------------------------------------------------------------- OpenRouter PKCE

const pending = new Map(); // state -> { userId, verifier, at }
export function startOpenRouter(userId, origin) {
  for (const [k, v] of pending) if (Date.now() - v.at > 15 * 60000) pending.delete(k);
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('base64url');
  pending.set(state, { userId, verifier, at: Date.now() });
  const callback = `${origin}/api/ai/openrouter/callback?state=${state}`;
  return `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callback)}&code_challenge=${challenge}&code_challenge_method=S256`;
}
export async function finishOpenRouter(state, code, userId) {
  const p = pending.get(state);
  pending.delete(state);
  if (!p || p.userId !== userId) throw new Error('This connection request expired or belongs to another account. Start again.');
  const res = await fetch('https://openrouter.ai/api/v1/auth/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: p.verifier, code_challenge_method: 'S256' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.key) throw new Error(data?.error?.message || `OpenRouter refused the connection (HTTP ${res.status}).`);
  return data.key;
}

// ---------------------------------------------------------------- model lists

const FAMILY = m => (/claude|anthropic/i.test(m) ? 'Claude' : /gemini|google/i.test(m) ? 'Gemini' : /gpt|openai|o\d/i.test(m) ? 'ChatGPT' : 'Other');

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || data?.message || `HTTP ${res.status}`;
    const e = new Error(typeof msg === 'string' ? msg : `HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

/** List models the key can use. Doubles as the connection test. */
export async function listModels(provider, key) {
  if (provider === 'openrouter') {
    await jsonFetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${key}` } });
    const data = await jsonFetch('https://openrouter.ai/api/v1/models');
    return (data.data || [])
      .filter(m => /^(anthropic|openai|google)\//.test(m.id) && !/image|audio|embed|tts|realtime|search-preview/i.test(m.id))
      .map(m => ({ id: m.id, name: m.name || m.id, family: FAMILY(m.id) }));
  }
  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey: key });
    const out = [];
    for await (const m of client.models.list({ limit: 100 })) out.push({ id: m.id, name: m.display_name || m.id, family: 'Claude' });
    return out;
  }
  if (provider === 'openai') {
    const data = await jsonFetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
    return (data.data || [])
      .filter(m => /^(gpt|o\d|chatgpt)/.test(m.id) && !/audio|realtime|image|tts|transcribe|search|embedding/i.test(m.id))
      .map(m => ({ id: m.id, name: m.id, family: 'ChatGPT' }))
      .sort((a, b) => b.id.localeCompare(a.id));
  }
  if (provider === 'gemini') {
    const data = await jsonFetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${encodeURIComponent(key)}`);
    return (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/.test(m.name) && !/image|tts|audio|embedding/i.test(m.name))
      .map(m => ({ id: m.name.replace(/^models\//, ''), name: m.displayName || m.name, family: 'Gemini' }));
  }
  throw new Error('Unknown AI provider.');
}

/** Pick a sensible default model from what the key can use. */
export function defaultModel(provider, models, family) {
  const ids = models.map(m => m.id);
  const pick = patterns => { for (const re of patterns) { const hit = ids.find(id => re.test(id)); if (hit) return hit; } return null; };
  if (provider === 'anthropic') return ids.includes('claude-opus-5') ? 'claude-opus-5' : pick([/opus/, /sonnet/]) || ids[0];
  if (provider === 'openrouter') {
    if (family === 'ChatGPT') return pick([/^openai\/gpt-5(?!.*mini)/, /^openai\/gpt/]) || ids[0];
    if (family === 'Gemini') return pick([/^google\/gemini-.*pro/, /^google\/gemini/]) || ids[0];
    return ids.includes('anthropic/claude-opus-5') ? 'anthropic/claude-opus-5' : pick([/^anthropic\/claude-opus/, /^anthropic\/claude-sonnet/, /^anthropic\//]) || ids[0];
  }
  if (provider === 'openai') return pick([/^gpt-5(?!.*(mini|nano))/, /^gpt-4o$/, /^gpt/]) || ids[0];
  if (provider === 'gemini') return pick([/gemini-.*pro(?!.*vision)/, /gemini/]) || ids[0];
  return ids[0];
}

// ---------------------------------------------------------------- generation

const SYSTEM = `You are the analysis assistant inside Calibrex OSINT Studio, an open-source intelligence tool used by analysts and journalists.
Work only from the numbered sources you are given. Cite them inline as [n]. If the sources do not cover something, say so; never invent incidents, figures, names or quotes.
Write plainly and concisely, in plain text without Markdown symbols.`;

async function complete(provider, key, model, prompt, maxTokens = 2000) {
  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey: key });
    const params = { model, max_tokens: Math.max(maxTokens, 4000), system: SYSTEM, messages: [{ role: 'user', content: prompt }] };
    // Current Claude models think adaptively; keep effort modest for summaries.
    if (/claude-(opus|sonnet|fable)-(5|4-[6-9])/.test(model)) params.output_config = { effort: 'medium' };
    const res = await client.messages.create(params);
    if (res.stop_reason === 'refusal') throw new Error('Claude declined this request.');
    return res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  }
  if (provider === 'openrouter' || provider === 'openai') {
    const url = provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    if (provider === 'openrouter') { headers['HTTP-Referer'] = process.env.PUBLIC_URL || 'https://calibrex.onrender.com'; headers['X-Title'] = 'Calibrex OSINT Studio'; }
    const body = { model, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }] };
    if (provider === 'openrouter') body.max_tokens = maxTokens; else body.max_completion_tokens = Math.max(maxTokens, 4000);
    const data = await jsonFetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    return String(data.choices?.[0]?.message?.content || '').trim();
  }
  if (provider === 'gemini') {
    const data = await jsonFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: Math.max(maxTokens, 4000) } }),
    });
    return (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  }
  throw new Error('Unknown AI provider.');
}

const numbered = sources => sources.slice(0, 25).map((s, i) =>
  `[${i + 1}] ${s.title} (${s.source || 'source'}${s.kind === 'social' ? ', social media post, unverified' : ''}${s.published ? `, ${new Date(s.published).toISOString().slice(0, 16).replace('T', ' ')} UTC` : ''})${s.url ? ` ${s.url}` : ''}` +
  (s.text ? `\n    Article text: ${s.text}` : s.summary ? `\n    Summary: ${s.summary}` : '')).join('\n');

/** Build the prompt for one AI task from page-supplied data. */
export function buildPrompt(task, input) {
  const sources = Array.isArray(input.sources) ? input.sources.map(s => ({
    title: String(s.title || '').slice(0, 300), source: String(s.source || '').slice(0, 80),
    url: String(s.url || '').slice(0, 500), published: Number(s.published) || null,
    kind: s.kind === 'social' ? 'social' : 'news',
    summary: String(s.summary || '').slice(0, 600),
    text: String(s.text || '').slice(0, 3000),
  })) : [];
  const today = new Date().toDateString();
  switch (task) {
    case 'report':
      return { max: 2500, prompt: `Today is ${today}. Draft an executive intelligence report titled "${String(input.title || 'Untitled').slice(0, 200)}" (category: ${String(input.category || 'General').slice(0, 60)}).
Write these sections, each heading on its own line in capitals: EXECUTIVE SUMMARY, DETAILED ANALYSIS, STRATEGIC IMPLICATIONS, INDICATORS TO WATCH.
${input.notes ? `Analyst notes to take into account:\n${String(input.notes).slice(0, 2000)}\n` : ''}
SOURCES:
${numbered(sources)}` };
    case 'research':
      return { max: 1200, prompt: `Today is ${today}. Answer the analyst's query in 2-3 short paragraphs using the search results below, then list 2-4 open questions worth checking next.
QUERY: ${String(input.query || '').slice(0, 300)}
SOURCES:
${numbered(sources)}` };
    case 'threat':
      return { max: 700, prompt: `Today is ${today}. Write a situation summary (one paragraph, max 120 words) for the threat vector "${String(input.title || '').slice(0, 200)}" at ${String(input.location || 'unknown location').slice(0, 100)}, then one line starting "Watch:" naming what to monitor next.
SOURCES:
${numbered(sources)}` };
    case 'verify':
      return { max: 700, prompt: `An analyst is checking this claim: "${String(input.claim || '').slice(0, 500)}"
Below are matching reports found just now. In 3-5 sentences, say which parts of the claim the reports support, where they differ (numbers, attribution, place, time), and what remains unconfirmed.
SOURCES:
${numbered(sources)}` };
    case 'brief':
      return { max: 1200, prompt: `Today is ${today}. Write a rapid intelligence brief (about 220 words) on "${String(input.title || '').slice(0, 200)}" with sections SITUATION, KEY INDICATORS, ASSESSMENT, each heading on its own line.
SOURCES:
${numbered(sources)}` };
    case 'article':
      return { max: 1200, prompt: `Summarise this article for an intelligence analyst. Give: a 2-3 sentence summary; KEY FACTS as short lines (who, what, where, when, numbers); CLAIMS TO VERIFY (statements attributed to one party or not independently confirmed). Say if the text looks incomplete.
TITLE: ${String(input.title || '').slice(0, 300)}
SOURCE: ${String(input.source || '').slice(0, 100)} ${String(input.url || '').slice(0, 500)}
TEXT:
${String(input.text || '').slice(0, 24000)}` };
    case 'test':
      return { max: 200, prompt: 'Reply with one short sentence confirming you are connected to Calibrex OSINT Studio and ready to analyse sources.' };
    default:
      throw new Error('Unknown AI task.');
  }
}

/** Decrypt a stored key; fails with a reconnect message if the server secret changed. */
export function openKey(conn) {
  try { return decrypt(conn.key); } catch {
    throw Object.assign(new Error('Your saved AI connection can no longer be read. Reconnect it in Settings → AI Connection.'), { status: 401 });
  }
}

export async function runTask(conn, task, input) {
  const { prompt, max } = buildPrompt(task, input);
  const key = openKey(conn);
  const text = await complete(conn.provider, key, conn.model, prompt, max);
  if (!text) throw new Error('The AI returned an empty answer. Try again.');
  return text;
}

export function friendlyAiError(e) {
  const s = e?.status;
  if (s === 401 || s === 403) return 'Your AI provider rejected the connection. Reconnect it in Settings → AI Connection.';
  if (s === 402) return 'Your AI account has no credit left. Add credit with your provider, then try again.';
  if (s === 429) return 'Your AI provider is rate-limiting requests. Wait a minute and try again.';
  if (s === 404) return 'The selected AI model is not available on your account. Pick another model in Settings → AI Connection.';
  if (s >= 500) return 'Your AI provider is having problems. Try again shortly.';
  return e?.message || 'The AI request failed.';
}
