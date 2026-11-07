import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { createSkimServer, JEV_MODEL, JEV_URL } from '../server.mjs';

const paragraph = {
  paragraphId: 'p0', goal: 'caveat', topic: 'release',
  candidates: [
    { id: 's0', text: 'The release is ready for a limited trial.' },
    { id: 's1', text: 'It is not safe to enable it for everyone until the audit is complete.' },
  ],
};

function providerResponse(choice = 's1') {
  return Response.json({
    model: JEV_MODEL,
    answers: { selection: { type: 'choice', choice, confidence: 0.8, probabilities: { s0: 0.1, s1: 0.9 } } },
    usage: { input_tokens: 180, output_tokens: 15 },
  });
}

async function fixture(t, options = {}) {
  const server = createSkimServer({ apiKey: 'mock-key-never-sent-to-a-real-provider', ...options });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(accept => server.close(accept));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    post: (body = paragraph, headers = {}) => fetch(`${origin}/api/rank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin, ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  };
}

test('status reveals only configuration, and an absent key makes no provider call', async t => {
  let calls = 0;
  const app = await fixture(t, { apiKey: '', fetchImpl: async () => { calls++; return providerResponse(); } });
  const status = await fetch(`${app.origin}/api/status`);
  assert.deepEqual(await status.json(), { provider: 'local', configured: false });
  const response = await app.post();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'not_configured', fallback: 'local' });
  assert.equal(calls, 0);
});

test('the official Choice request sends source once and returns only an allowed sentence ID', async t => {
  let sent;
  const app = await fixture(t, { fetchImpl: async (url, options) => {
    sent = { url, ...options, body: JSON.parse(options.body) };
    return providerResponse();
  } });
  assert.deepEqual(await (await fetch(`${app.origin}/api/status`)).json(), { provider: 'jev', configured: true });
  const response = await app.post();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sentenceId: 's1', provider: 'jev' });
  assert.equal(sent.url, JEV_URL);
  assert.equal(sent.method, 'POST');
  assert.equal(sent.headers.Authorization, 'Bearer mock-key-never-sent-to-a-real-provider');
  assert.equal(sent.redirect, 'error');
  assert.equal(sent.body.model, JEV_MODEL);
  assert.deepEqual(sent.body.state, { reading_goal: 'caveat', topic: 'release' });
  assert.equal(sent.body.questions.selection.type, 'choice');
  assert.deepEqual(sent.body.questions.selection.criteria, { s0: paragraph.candidates[0].text, s1: paragraph.candidates[1].text });
  assert.equal(JSON.stringify(sent.body).split(paragraph.candidates[1].text).length - 1, 1);
  assert.ok(sent.signal instanceof AbortSignal);
});

test('foreign or missing Origin, spoofed host, and non-JSON requests cannot spend tokens', async t => {
  let calls = 0;
  const app = await fixture(t, { fetchImpl: async () => { calls++; return providerResponse(); } });
  assert.equal((await app.post(paragraph, { Origin: 'https://unrelated.example' })).status, 403);
  assert.equal((await app.post(paragraph, { Origin: '' })).status, 403);
  const spoofedHostStatus = await new Promise((accept, reject) => {
    const request = httpRequest(`${app.origin}/api/rank`, {
      method: 'POST',
      headers: { Host: 'unrelated.example', Origin: app.origin, 'Content-Type': 'application/json' },
    }, response => { response.resume(); accept(response.statusCode); });
    request.on('error', reject);
    request.end(JSON.stringify(paragraph));
  });
  assert.equal(spoofedHostStatus, 403);
  assert.equal((await app.post(paragraph, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await app.post(paragraph, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal(calls, 0);
});

test('malformed, duplicate, overlong and oversized candidate payloads cannot spend tokens', async t => {
  let calls = 0;
  const app = await fixture(t, { fetchImpl: async () => { calls++; return providerResponse(); } });
  assert.equal((await app.post('{')).status, 400);
  assert.equal((await app.post({ ...paragraph, goal: 'invent' })).status, 400);
  assert.equal((await app.post({ ...paragraph, goal: ['answer'] })).status, 400);
  assert.equal((await app.post({ ...paragraph, topic: 'x'.repeat(181) })).status, 400);
  assert.equal((await app.post({ ...paragraph, candidates: [paragraph.candidates[0], paragraph.candidates[0]] })).status, 400);
  assert.equal((await app.post({ ...paragraph, candidates: [{ id: '__proto__', text: 'Bad.' }, paragraph.candidates[1]] })).status, 400);
  assert.equal((await app.post({ ...paragraph, candidates: [{ id: 's0', text: 'x'.repeat(4001) }, paragraph.candidates[1]] })).status, 400);
  assert.equal((await app.post({ ...paragraph, candidates: Array.from({ length: 3 }, (_, i) => ({ id: `s${i}`, text: 'x'.repeat(3000) })) })).status, 413);
  assert.equal((await app.post(' '.repeat(24 * 1024 + 1))).status, 413);
  assert.equal(calls, 0);
});

test('unknown choices, wrong answer types and invalid JSON never claim a Jev selection', async t => {
  const replies = [
    () => providerResponse('not-a-source-id'),
    () => Response.json({ answers: { selection: { type: 'noul', choice: 's1' } } }),
    () => new Response('not JSON', { status: 200 }),
  ];
  const app = await fixture(t, { cooldownMs: 0, fetchImpl: async () => replies.shift()() });
  for (let i = 0; i < 3; i++) {
    const response = await app.post();
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'invalid_provider_response', fallback: 'local' });
  }
});

test('cached identical contexts avoid another call, while changed goals respect a global cooldown', async t => {
  let time = 10000;
  let calls = 0;
  const app = await fixture(t, { now: () => time, fetchImpl: async () => { calls++; return providerResponse(); } });
  assert.equal((await app.post()).status, 200);
  assert.equal((await app.post({ ...paragraph, paragraphId: 'p7' })).status, 200);
  assert.equal(calls, 1);
  const early = await app.post({ ...paragraph, goal: 'answer' });
  assert.equal(early.status, 429);
  assert.equal(early.headers.get('retry-after'), '3');
  assert.equal((await early.json()).error, 'cooldown');
  time += 3000;
  assert.equal((await app.post({ ...paragraph, goal: 'answer' })).status, 200);
  assert.equal(calls, 2);
});

test('simultaneous duplicate requests share one provider call', async t => {
  let calls = 0;
  let release;
  const gate = new Promise(accept => { release = accept; });
  const app = await fixture(t, { fetchImpl: async () => { calls++; await gate; return providerResponse(); } });
  const first = app.post();
  const second = app.post();
  await new Promise(accept => setTimeout(accept, 25));
  release();
  const responses = await Promise.all([first, second]);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  assert.equal(calls, 1);
});

test('provider failures are safe, are not retried, and count toward the session budget', async t => {
  let calls = 0;
  const app = await fixture(t, { maxRequests: 2, cooldownMs: 0, fetchImpl: async () => {
    calls++;
    return new Response('Secret provider error details', { status: calls === 1 ? 429 : 529 });
  } });
  const limited = await app.post();
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: 'provider_rate_limited', fallback: 'local' });
  const overloaded = await app.post();
  assert.equal(overloaded.status, 503);
  assert.deepEqual(await overloaded.json(), { error: 'provider_unavailable', fallback: 'local' });
  const exhausted = await app.post();
  assert.equal(exhausted.status, 429);
  assert.deepEqual(await exhausted.json(), { error: 'session_limit', fallback: 'local' });
  assert.equal(calls, 2);
});

test('the default session budget permits at most 60 provider attempts', async t => {
  let calls = 0;
  const app = await fixture(t, { cooldownMs: 0, fetchImpl: async () => { calls++; return providerResponse(); } });
  for (let i = 0; i < 60; i++) {
    assert.equal((await app.post({ ...paragraph, topic: `topic ${i}` })).status, 200);
  }
  const exhausted = await app.post({ ...paragraph, topic: 'request 61' });
  assert.equal(exhausted.status, 429);
  assert.equal((await exhausted.json()).error, 'session_limit');
  // The session limit does not invalidate an already cached result.
  assert.equal((await app.post({ ...paragraph, topic: 'topic 0' })).status, 200);
  assert.equal(calls, 60);
});

test('a stalled provider is aborted at the deadline and falls back locally', async t => {
  let signal;
  let calls = 0;
  const app = await fixture(t, { timeoutMs: 30, fetchImpl: async (_url, options) => {
    signal = options.signal;
    calls++;
    return new Promise(() => {});
  } });
  const response = await app.post();
  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), { error: 'provider_timeout', fallback: 'local' });
  assert.equal(signal.aborted, true);
  assert.equal(calls, 1);
});

test('static assets are served, but files outside dist are not exposed', async t => {
  const app = await fixture(t, { apiKey: '' });
  const index = await fetch(app.origin);
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type'), /text\/html/);
  assert.match(await index.text(), /<html/i);
  assert.equal((await fetch(`${app.origin}/server.mjs`)).status, 404);
  assert.equal((await fetch(`${app.origin}/%2e%2e%2fserver.mjs`)).status, 404);
  assert.equal((await fetch(`${app.origin}/%00`)).status, 400);
});
