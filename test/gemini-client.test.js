import test from 'node:test';
import assert from 'node:assert/strict';
import { requestGeminiDrafts, GeminiRequestError } from '../gemini-client.js';
import { CATEGORY_PHRASES } from '../review-core.js';

const secret = 'test-private-api-credential';
const contexts = [{ contextId: 'context-1', business: 'Ambika Watch & Gift', city: 'Surat', language: 'en', area: 'Varachha', category: 'women', topic: 'ladies watches', variant: 0, categoryPhrase: 'ladies watches', styleIndex: 0 }];
const draft = { contextId: 'context-1', text: 'I came from [area: Varachha] to Ambika Watch & Gift, Surat to buy [category: ladies watches] for [recipient], and [experience].', categoryPhrase: 'ladies watches' };
const wireDraft = { ...draft, contextId: 'd1' };
const payload = (drafts = [wireDraft], extra = {}) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ drafts }) }] } }], usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 40 }, ...extra });
const ok = data => ({ ok: true, status: 200, json: async () => data });

function isSafeError(code, status) {
  return error => {
    assert.ok(error instanceof GeminiRequestError);
    assert.equal(error.code, code);
    if (status !== undefined) assert.equal(error.status, status);
    assert.ok(!String(error).includes(secret));
    assert.ok(!JSON.stringify(error).includes(secret));
    return true;
  };
}

test('Gemini transport pins the endpoint, sends the key only in its header and validates complete IDs', async () => {
  let request;
  const result = await requestGeminiDrafts({ contexts: [{ ...contexts[0], privateExtraField: 'not part of the model context', brand: 'discard-this-field' }], apiKey: secret, revisionGuidance: 'Use ASCII Roman Gujarati only for context-1.', fetchImpl: async (url, options) => {
    request = { url, options };
    return ok(payload([{ ...wireDraft, brand: 'discard-response-field' }]));
  } });
  assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['x-goog-api-key'], secret);
  assert.ok(!request.url.includes(secret));
  assert.ok(!request.options.body.includes(secret));
  assert.ok(!request.options.body.includes('not part of the model context'));
  assert.ok(!request.options.body.includes('discard-this-field'));
  assert.ok(!request.options.body.includes('\"brand\"'));
  assert.ok(!request.options.body.includes('context-1'));
  assert.ok(request.options.body.includes('d1'));
  const body = JSON.parse(request.options.body);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingBudget: 0 });
  assert.equal('minItems' in body.generationConfig.responseSchema.properties.drafts, false);
  assert.equal('maxItems' in body.generationConfig.responseSchema.properties.drafts, false);
  const schema = body.generationConfig.responseSchema.properties.drafts.items.properties;
  assert.equal(schema.text.pattern, '^[ -~]+\\.$');
  assert.equal(new RegExp(schema.text.pattern).test(draft.text), true);
  assert.equal(new RegExp(schema.text.pattern).test('Gujarati ગુજરાતી.'), false);
  assert.equal(new RegExp(schema.text.pattern).test('Missing terminal punctuation'), false);
  assert.ok(schema.categoryPhrase.enum.includes('ladies watches'));
  assert.deepEqual(schema.categoryPhrase.enum, [...CATEGORY_PHRASES]);
  assert.ok(schema.categoryPhrase.enum.every(phrase => /watch|clock/.test(phrase)));
  assert.equal('brand' in schema, false);
  assert.ok(body.contents[0].parts[0].text.includes('Use ASCII Roman Gujarati only for d1.'));
  assert.deepEqual(schema.contextId.enum, ['d1']);
  const prompt = body.contents[0].parts[0].text;
  assert.ok(prompt.includes('CUSTOMER POV FILL-IN TEMPLATES'));
  assert.ok(prompt.includes('hypothetical templates, not completed customer reviews'));
  for (const slot of ['[area: AREA]', '[category: PHRASE]', '[recipient]', '[experience]']) assert.ok(prompt.includes(slot));
  assert.ok(prompt.includes('NEVER fill recipient with papa, friend or any other person'));
  assert.ok(prompt.includes('NEVER fill experience with praise, criticism, staff, prices, satisfaction'));
  assert.ok(prompt.includes('Roman Hindi for hi, and Roman Gujarati for gu'));
  assert.ok(prompt.includes('place the area slot BEFORE THE BUSINESS NAME'));
  assert.ok(prompt.includes('exactly these FOUR bracket slots'));
  assert.ok(!prompt.includes('[brand:'));
  assert.ok(prompt.includes('Return categoryPhrase EXACTLY as supplied'));
  assert.ok(prompt.includes('styleIndex'));
  assert.ok(prompt.includes('Do not include any watch or clock brand names'));
  assert.ok(request.options.signal instanceof AbortSignal);
  assert.deepEqual(result, { entries: [draft], usage: { inputTokens: 120, outputTokens: 40 } });
});

test('legacy descriptive mode cannot bypass the brand-free template transport', async () => {
  let requests = 0;
  await assert.rejects(requestGeminiDrafts({ contexts, apiKey: secret, kind: 'business-context-draft', fetchImpl: async () => { requests++; return ok(payload()); } }), isSafeError('CONFIGURATION'));
  assert.equal(requests, 0);
});

test('request-local aliases map reordered replies and retry feedback back to canonical IDs', async () => {
  const input = [
    { ...contexts[0], contextId: 'canonical-long-id-1' },
    { ...contexts[0], contextId: 'canonical-long-id-10', variant: 1 },
  ];
  const result = await requestGeminiDrafts({ contexts: input, apiKey: secret,
    revisionGuidance: 'Repair canonical-long-id-10 and canonical-long-id-1.',
    fetchImpl: async (_, options) => {
      const body = JSON.parse(options.body);
      const prompt = body.contents[0].parts[0].text;
      assert.ok(!options.body.includes('canonical-long-id-1'));
      assert.ok(prompt.includes('Repair d2 and d1.'));
      assert.deepEqual(body.generationConfig.responseSchema.properties.drafts.items.properties.contextId.enum, ['d1', 'd2']);
      return ok(payload([{ ...wireDraft, contextId: 'd2' }, wireDraft]));
    },
  });
  assert.deepEqual(result.entries.map(row => row.contextId), ['canonical-long-id-10', 'canonical-long-id-1']);
});

test('missing credentials, invalid models and duplicate contexts fail before any request', async () => {
  let requests = 0;
  const fetchImpl = async () => { requests++; throw new Error('Must not fetch'); };
  for (const overrides of [
    { apiKey: undefined }, { apiKey: '' }, { apiKey: ' secret ' }, { apiKey: 'secret\nheader' },
    { model: '../other-service' }, { model: 'gemini?key=secret' }, { timeoutMs: 0 }, { kind: 'unverified-customer-review' },
    { revisionGuidance: null }, { revisionGuidance: 'x'.repeat(4001) }, { revisionGuidance: `Provider printed ${secret}` },
    { contexts: [] }, { contexts: [contexts[0], contexts[0]] }, { contexts: [{ ...contexts[0], language: 'unknown' }] },
    { contexts: [{ ...contexts[0], categoryPhrase: 'wall clock' }] }, { contexts: [{ ...contexts[0], styleIndex: -1 }] },
    { contexts: [{ ...contexts[0], styleIndex: 101 }] }, { contexts: [{ ...contexts[0], variant: 1001 }] },
    { contexts: [{ ...contexts[0], categoryPhrase: undefined }] }, { contexts: [{ ...contexts[0], styleIndex: 1.5 }] },
  ]) {
    await assert.rejects(requestGeminiDrafts({ contexts, apiKey: secret, fetchImpl, ...overrides }), isSafeError('CONFIGURATION'));
  }
  assert.equal(requests, 0);
});

test('HTTP and network failures do not expose provider bodies or thrown secret text', async () => {
  for (const status of [401, 429, 500]) {
    let bodyReads = 0;
    await assert.rejects(requestGeminiDrafts({ contexts, apiKey: secret, fetchImpl: async () => ({ ok: false, status, json: async () => { bodyReads++; return { error: secret }; } }) }), isSafeError('HTTP', status));
    assert.equal(bodyReads, 0);
  }
  await assert.rejects(requestGeminiDrafts({ contexts, apiKey: secret, fetchImpl: async () => { throw new Error(secret); } }), isSafeError('NETWORK'));
  await assert.rejects(requestGeminiDrafts({ contexts, apiKey: secret, fetchImpl: async () => ({ ok: true, json: async () => { throw new Error(secret); } }) }), isSafeError('INVALID_RESPONSE'));
});

test('malformed, missing, duplicate or incomplete draft output is rejected', async () => {
  const twoContexts = [contexts[0], { ...contexts[0], contextId: 'context-2', variant: 1 }];
  const bad = [
    [contexts, null],
    [contexts, { candidates: [] }],
    [contexts, { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: secret }] } }] }],
    [contexts, payload([])],
    [contexts, payload([{ ...wireDraft, contextId: 'unexpected-context' }])],
    [contexts, payload([{ ...wireDraft, text: '' }])],
    [twoContexts, payload([wireDraft, wireDraft])],
  ];
  for (const [inputContexts, data] of bad) {
    await assert.rejects(requestGeminiDrafts({ contexts: inputContexts, apiKey: secret, fetchImpl: async () => ok(data) }), isSafeError('INVALID_RESPONSE'));
  }
});

test('well-typed semantic violations are returned for the separate business validator', async () => {
  const semanticViolation = { ...draft, text: draft.text + ' ગુજરાતી।', categoryPhrase: 'not in the text' };
  const result = await requestGeminiDrafts({ contexts, apiKey: secret, fetchImpl: async () => ok(payload([{ ...semanticViolation, contextId: 'd1' }])) });
  assert.deepEqual(result.entries, [semanticViolation]);
});

test('blocked or truncated content cannot be accepted as complete drafts', async () => {
  const blocked = [
    payload([draft], { promptFeedback: { blockReason: 'SAFETY' } }),
    { candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: JSON.stringify({ drafts: [draft] }) }] } }] },
  ];
  for (const data of blocked) await assert.rejects(requestGeminiDrafts({ contexts, apiKey: secret, fetchImpl: async () => ok(data) }), isSafeError('BLOCKED'));
  await assert.rejects(requestGeminiDrafts({ contexts, apiKey: secret, fetchImpl: async () => ok({ candidates: [{ finishReason: 'MAX_TOKENS' }] }) }), isSafeError('TRUNCATED'));
});

test('timeouts abort fetch even when the transport ignores the abort signal', async () => {
  let signal;
  await assert.rejects(requestGeminiDrafts({ contexts, apiKey: secret, timeoutMs: 10, fetchImpl: async (_, options) => {
    signal = options.signal;
    return new Promise(() => {});
  } }), isSafeError('TIMEOUT'));
  assert.equal(signal.aborted, true);
});

test('timeout covers stalled response parsing and cleans up successful timers', async () => {
  await assert.rejects(requestGeminiDrafts({ contexts, apiKey: secret, timeoutMs: 10, fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }) }), isSafeError('TIMEOUT'));
  let signal;
  await requestGeminiDrafts({ contexts, apiKey: secret, timeoutMs: 15, fetchImpl: async (_, options) => { signal = options.signal; return ok(payload()); } });
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(signal.aborted, false);
});
