import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAgent, agentTools, summarize } from '../agent.js';

// Drive the loop with a scripted fake model (no provider, no network).
test('agent loop runs tools then compiles a brief', async () => {
  const events = [];
  const emit = e => events.push(e);

  // mock tools so no network is touched
  const tools = agentTools().map(t => t.name === 'search_intelligence'
    ? { ...t, run: async () => ({ results: [{ title: 'X happened', source: 'Reuters', url: 'https://r.com/x' }] }) }
    : t);

  // scripted turns: 1) call search_intelligence  2) call compile_intelligence_brief
  let n = 0;
  const _turn = async () => {
    n++;
    if (n === 1) return { text: 'Let me search.', toolCalls: [{ id: 't1', name: 'search_intelligence', args: { query: 'X' } }] };
    return { text: '', toolCalls: [{ id: 't2', name: 'compile_intelligence_brief', args: { bottomLine: 'X happened.', assessment: 'Observed.', confidence: 'MODERATE' } }] };
  };
  const _pushResults = () => {};

  const out = await runAgent({ provider: 'anthropic', model: 'm', key: 'x' }, { question: 'What happened with X?', tools, emit, _turn, _pushResults });

  assert.ok(out.brief, 'should return a brief');
  assert.equal(out.brief.confidence, 'MODERATE');
  assert.ok(events.some(e => e.type === 'step' && e.tool === 'search_intelligence'), 'emits a tool step');
  assert.ok(events.some(e => e.type === 'result' && e.tool === 'search_intelligence'), 'emits a tool result');
  assert.ok(events.some(e => e.type === 'brief'), 'emits the final brief');
});

test('agent loop stops at the step limit without a brief', async () => {
  const _turn = async () => ({ text: 'thinking', toolCalls: [{ id: 'a', name: 'search_intelligence', args: { query: 'loop' } }] });
  const tools = agentTools().map(t => t.name === 'search_intelligence' ? { ...t, run: async () => ({ results: [] }) } : t);
  const events = [];
  const out = await runAgent({ provider: 'openai', model: 'm' }, { question: 'q', maxSteps: 3, tools, emit: e => events.push(e), _turn, _pushResults: () => {} });
  assert.equal(out.brief, null);
  assert.ok(events.some(e => e.type === 'error'), 'emits a step-limit error');
});

test('summarize produces compact tool summaries', () => {
  assert.match(summarize('corroborate_claim', { status: 'CORROBORATED', independentDomains: 4, score: 70 }), /CORROBORATED/);
  assert.match(summarize('search_intelligence', { results: [1, 2, 3] }), /3 leads/);
  assert.match(summarize('web_search', { error: 'nope' }), /error/);
});
