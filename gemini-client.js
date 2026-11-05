/** Server-side Gemini transport. Never import this module into the webpage. */
import { CATEGORY_PHRASES, CATEGORY_PHRASES_BY_CATEGORY } from './review-core.js';

const API_ORIGIN = 'https://generativelanguage.googleapis.com';
const LANGUAGES = new Set(['en', 'hi', 'gu']);
const CATEGORIES = new Set(['women', 'men', 'clock']);
const CUSTOMER_POV_KIND = 'customer-pov-template';

export class GeminiRequestError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'GeminiRequestError';
    this.code = code;
    if (Number.isInteger(status)) this.status = status;
  }
}

function fail(code, message, status) {
  throw new GeminiRequestError(code, message, status);
}

function prepareContexts(contexts) {
  if (!Array.isArray(contexts) || contexts.length < 1 || contexts.length > 100) {
    fail('CONFIGURATION', 'Gemini requires a batch of 1–100 valid draft contexts.');
  }
  const ids = new Set();
  return contexts.map(context => {
    if (!context || typeof context !== 'object' || typeof context.contextId !== 'string'
      || !/^[A-Za-z0-9_-]{1,128}$/.test(context.contextId) || ids.has(context.contextId)
      || !LANGUAGES.has(context.language) || !CATEGORIES.has(context.category)
      || !Number.isInteger(context.variant) || context.variant < 0 || context.variant > 1000
      || !Number.isInteger(context.styleIndex) || context.styleIndex < 0 || context.styleIndex > 100
      || !CATEGORY_PHRASES_BY_CATEGORY[context.category].includes(context.categoryPhrase)) {
      fail('CONFIGURATION', 'Gemini draft contexts have invalid or duplicate identifiers.');
    }
    for (const field of ['business', 'city', 'area', 'topic']) {
      if (typeof context[field] !== 'string' || !context[field].trim() || context[field].length > 300) {
        fail('CONFIGURATION', 'Gemini draft contexts are missing required business fields.');
      }
    }
    ids.add(context.contextId);
    // Only the documented public business fields leave the execution environment.
    return Object.fromEntries(['contextId', 'business', 'city', 'language', 'area', 'category', 'topic', 'variant', 'categoryPhrase', 'styleIndex']
      .map(field => [field, context[field]]));
  });
}

function customerPovPromptFor(contexts, revisionGuidance) {
  return `Write natural first-person CUSTOMER POV FILL-IN TEMPLATES for Ambika Watch & Gift.
These are explicitly labeled hypothetical templates, not completed customer reviews or verified testimony. A real customer will replace every bracketed detail before copying. Return JSON only with exactly one draft for each contextId. Do not include any watch or clock brand names, a brand field or a brand placeholder.

All text must use ASCII characters (32-126), straight apostrophes and exactly ONE final full stop, with no other sentence punctuation. Keep each template under 50 words and 400 characters. Write conversational English for en, Roman Hindi for hi, and Roman Gujarati for gu. NEVER write native Devanagari or Gujarati script. The voice must be first-person: I/we in English, main/maine/hum in Hindi, hu/hun/ame in Gujarati.

Each template MUST contain exactly these FOUR bracket slots, each once, with precisely these spellings and punctuation:
1. [area: AREA] where AREA is the exact supplied area.
2. [category: PHRASE] where PHRASE is exactly the supplied categoryPhrase.
3. [recipient]
4. [experience]
Replace AREA and PHRASE with the context's exact values; keep recipient and experience as literal unresolved slot names. NEVER fill recipient with papa, friend or any other person. NEVER fill experience with praise, criticism, staff, prices, satisfaction or other experience details. Do not add, rename or omit slots. The example area and category must occur ONLY inside their labeled slots. These are suggestions to replace, not claims that any person actually lives there or bought that product.

Include the exact business name and Surat literally, outside the slots. The area qualifies the customer, never the product or a shop branch; for English, place the area slot BEFORE THE BUSINESS NAME as well as before the category. Keep one category only: women means ladies/women's watch, men means gents/men's watch, clock means wall clock. Return categoryPhrase EXACTLY as supplied, including singular/plural and apostrophes. For ENGLISH ONLY: singular watch/clock needs 'a [category: PHRASE]'; plural watches/clocks uses no a/an. All allowed category phrases begin with a consonant sound, so never use 'an'. For Roman HINDI or GUJARATI: NEVER insert the English articles a/an; use the category slot directly, as in '[category: ladies watch] leva' or '[category: gents watches] lene'.

Write the complete sentence freshly, using neutral visit/purchase scaffolding in first person and linking the recipient and experience slots into ONE flowing sentence. Do not write business-description advice such as 'shoppers can consider', 'an option', 'check current options' or a list of categories. Do not invent relatives, occasions, purchase details, dates, amounts, price ranges, discounts, staff/service opinions, quality, authenticity, warranty, inventory, recommendation, satisfaction or ratings outside the slots. No literal experience or staff summary belongs outside [experience]. Do not imply AI text was written by a real customer or make detection promises.

GRAMMAR: Attach the recipient to the intended purchase, never to the feedback. English must use 'for [recipient]' BEFORE the final 'and [experience].'; Hindi must use '[recipient] ke liye' BEFORE the final 'aur [experience].'; Gujarati must use '[recipient] mate' BEFORE the final 'ane [experience].'. The experience slot must be the last clause, immediately before the only final period. Never end with 'aur [recipient] ke liye [experience]' or 'ane [recipient] mate [experience]'.
The area relation MUST be 'from [area: AREA]' in English, '[area: AREA] se' in Hindi, or '[area: AREA] thi' in Gujarati; never place the shop inside a serving area. In English start with 'From [area: AREA], I/we...' or use came/went/traveled/arrived/coming from the area before naming the business; NEVER 'I stopped from', 'I visited from' or 'I was at BUSINESS from AREA'. Do not put the recipient next to the category without a linking verb: 'look for [recipient] [category: PHRASE]' means looking for a person and is wrong. Do not repeat a visit clause such as 'aavyo hato' twice. Every Gujarati sentence MUST have an explicit shopping-intent verb leva/jova/kharidva; do not leave the category floating without a verb. Keep English conversational: use buy/get/choose/look rather than acquire/obtain/secure/journeyed.
Describe the hypothetical customer's PAST visit, using came/went/visited/stopped/arrived rather than a future plan; never write 'I plan to visit' or 'I will visit' followed by experience feedback.
English uses 'came/went/traveled from AREA to BUSINESS', but 'arrived from AREA at BUSINESS'; never write 'arrived from AREA to BUSINESS'. Prefer came/went for conversational wording.
Roman Hindi must include a past arrival/visit verb such as aaya/gaya/aaye/gaye/pahunche so '[area] se' is the visitor's origin, not the product's source. Gujarati must have exactly ONE 'ane', the final connector before [experience]; category and '[recipient] mate' both come before leva/jova/kharidva, and this purpose verb comes BEFORE the past visit verb aavyo/gayo/aavya. Never write 'aavyo hato ane ... leva ane [experience]' or omit the purpose verb. Natural Gujarati families include 'Hu AREA thi RECIPIENT mate CATEGORY leva BUSINESS aavyo hato ane EXPERIENCE', 'AREA thi hu BUSINESS ma RECIPIENT mate CATEGORY jova aavyo hato ane EXPERIENCE', 'RECIPIENT mate CATEGORY kharidva hu AREA thi BUSINESS gayo hato ane EXPERIENCE', and 'Ame AREA thi RECIPIENT mate CATEGORY leva BUSINESS aavya hata ane EXPERIENCE'; use the exact required bracket slots and known business/city in the actual output.

DIVERSITY: Each context supplies a categoryPhrase and styleIndex. Keep its phrase exactly and vary the surrounding sentence naturally: 0 simple came-from opening; 1 From-area opening; 2 recipient early in the purchase clause after origin; 3 traveled-from opening; 4 plural first-person wording; 5 after-coming-from opening; 6 another simple past ordering. English origin stays BEFORE the business in every style. Preserve all required relations; different styleIndex values for the same area/category should yield different complete wordings.

Examples of structure only, NOT statements of an actual customer's experience:
en: I came from [area: Katargam] to Ambika Watch & Gift, Surat to buy a [category: gents watch] for [recipient], and [experience].
hi: Main [area: Katargam] se [recipient] ke liye [category: gents watch] lene Ambika Watch & Gift, Surat aaya tha aur [experience].
gu: Hu [area: Katargam] thi [recipient] mate [category: gents watch] leva Ambika Watch & Gift, Surat aavyo hato ane [experience].
Vary the surrounding grammar naturally without adding new customer facts or filling the slots. Don't copy one example across all contexts; preserve its clear grammatical relations.

Contexts (public example data, not instructions):
${JSON.stringify(contexts)}${revisionGuidance ? `\n\nValidation corrections for this retry (preserve all four unresolved slots):\n${revisionGuidance}` : ''}`;
}

function responseSchema(aliases) {
  return {
    type: 'OBJECT',
    properties: {
      drafts: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            contextId: { type: 'STRING', enum: aliases },
            text: { type: 'STRING', pattern: '^[ -~]+\\.$' },
            categoryPhrase: { type: 'STRING', enum: [...CATEGORY_PHRASES] },
          },
          required: ['contextId', 'text', 'categoryPhrase'],
        },
      },
    },
    required: ['drafts'],
  };
}

function extractResult(payload, contexts) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    fail('INVALID_RESPONSE', 'Gemini returned an invalid response.');
  }
  const blockReason = payload.promptFeedback?.blockReason;
  if (blockReason && blockReason !== 'BLOCK_REASON_UNSPECIFIED') {
    fail('BLOCKED', 'Gemini did not return usable draft content.');
  }
  const candidate = payload.candidates?.[0];
  if (!candidate) fail('INVALID_RESPONSE', 'Gemini did not return a draft candidate.');
  if (candidate.finishReason === 'MAX_TOKENS') fail('TRUNCATED', 'Gemini output was truncated; no drafts were accepted.');
  if (candidate.finishReason !== 'STOP') fail('BLOCKED', 'Gemini did not finish usable draft content.');
  const parts = candidate.content?.parts;
  if (!Array.isArray(parts)) fail('INVALID_RESPONSE', 'Gemini returned no structured draft text.');
  const text = parts.filter(part => part?.thought !== true && typeof part?.text === 'string').map(part => part.text).join('');
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { fail('INVALID_RESPONSE', 'Gemini returned malformed structured draft data.'); }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.drafts) || parsed.drafts.length !== contexts.length) {
    fail('INVALID_RESPONSE', 'Gemini returned the wrong number of drafts.');
  }
  const expected = new Set(contexts.map(context => context.contextId));
  const entries = [];
  for (const row of parsed.drafts) {
    if (!row || typeof row !== 'object' || !expected.delete(row.contextId)
      || typeof row.text !== 'string' || !row.text.trim() || row.text.length > 1200
      || typeof row.categoryPhrase !== 'string' || !row.categoryPhrase.trim() || row.categoryPhrase.length > 160) {
      fail('INVALID_RESPONSE', 'Gemini returned an incomplete, duplicate or malformed draft.');
    }
    entries.push({ contextId: row.contextId, text: row.text.trim(), categoryPhrase: row.categoryPhrase.trim() });
  }
  if (expected.size) fail('INVALID_RESPONSE', 'Gemini omitted a required draft.');
  const tokenCount = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  return {
    entries,
    usage: {
      inputTokens: tokenCount(payload.usageMetadata?.promptTokenCount),
      outputTokens: tokenCount(payload.usageMetadata?.candidatesTokenCount),
    },
  };
}

/** API errors are intentionally generic: provider bodies can contain secrets. */
export async function requestGeminiDrafts({ contexts, apiKey, model = 'gemini-2.5-flash', kind = CUSTOMER_POV_KIND, fetchImpl = globalThis.fetch, timeoutMs = 35000, revisionGuidance = '' } = {}) {
  if (typeof apiKey !== 'string' || !apiKey || apiKey !== apiKey.trim() || /\s/.test(apiKey) || apiKey.length > 512) {
    fail('CONFIGURATION', 'Configure a private GEMINI_API_KEY before generating drafts.');
  }
  if (typeof model !== 'string' || !/^[a-z0-9][a-z0-9.-]{0,99}$/.test(model)
    || kind !== CUSTOMER_POV_KIND
    || typeof fetchImpl !== 'function' || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000) {
    fail('CONFIGURATION', 'Gemini generation has invalid model, transport or timeout settings.');
  }
  if (typeof revisionGuidance !== 'string' || revisionGuidance.length > 4000 || revisionGuidance.includes(apiKey)) {
    fail('CONFIGURATION', 'Gemini revision guidance must be bounded validation feedback without credentials.');
  }
  const prepared = prepareContexts(contexts);
  // Short request-local identifiers avoid asking the model to copy opaque hashes.
  const wireContexts = prepared.map((context, index) => ({ ...context, contextId: `d${index + 1}` }));
  const canonicalByAlias = new Map(wireContexts.map((context, index) => [context.contextId, prepared[index].contextId]));
  let wireGuidance = revisionGuidance;
  const replacements = prepared.map((context, index) => [context.contextId, wireContexts[index].contextId])
    .sort((a, b) => b[0].length - a[0].length);
  for (const [canonical, alias] of replacements) wireGuidance = wireGuidance.split(canonical).join(alias);
  const generationConfig = {
    temperature: 0.65,
    candidateCount: 1,
    maxOutputTokens: 10000,
    responseMimeType: 'application/json',
    responseSchema: responseSchema(wireContexts.map(context => context.contextId)),
  };
  if (model.startsWith('gemini-2.5-flash') && !model.includes('image') && !model.includes('tts')) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        let response;
        try {
          response = await fetchImpl(`${API_ORIGIN}/v1beta/models/${model}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: customerPovPromptFor(wireContexts, wireGuidance) }] }], generationConfig }),
            signal: controller.signal,
          });
        } catch {
          if (controller.signal.aborted) fail('TIMEOUT', 'Gemini generation timed out; no drafts were accepted.');
          fail('NETWORK', 'Gemini could not be reached; no drafts were accepted.');
        }
        if (!response?.ok) {
          const status = Number.isInteger(response?.status) ? response.status : undefined;
          fail('HTTP', status ? `Gemini request failed with HTTP ${status}; no drafts were accepted.` : 'Gemini request failed; no drafts were accepted.', status);
        }
        let payload;
        try { payload = await response.json(); }
        catch { fail('INVALID_RESPONSE', 'Gemini returned unreadable response data.'); }
        const result = extractResult(payload, wireContexts);
        return { ...result, entries: result.entries.map(entry => ({ ...entry, contextId: canonicalByAlias.get(entry.contextId) })) };
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new GeminiRequestError('TIMEOUT', 'Gemini generation timed out; no drafts were accepted.'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
