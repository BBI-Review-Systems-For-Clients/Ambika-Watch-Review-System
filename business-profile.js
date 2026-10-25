import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { BRAND_NAMES } from './review-core.js';

export const BUSINESS_PROFILE = Object.freeze({
  name: 'Ambika Watch & Gift',
  city: 'Surat',
  servingAreas: Object.freeze(['Varachha', 'Mota Varachha', 'Katargam', 'Amroli']),
  // Watches: 60% women / 40% men. Wall clocks: 10% of overall sales.
  categories: Object.freeze([
    Object.freeze({ id: 'women', count: 270, languages: { en: 108, hi: 81, gu: 81 } }),
    Object.freeze({ id: 'men', count: 180, languages: { en: 72, hi: 54, gu: 54 } }),
    Object.freeze({ id: 'clock', count: 50, languages: { en: 20, hi: 15, gu: 15 } }),
  ]),
  keywords: Object.freeze({ en: 'watch shop in Surat', hi: 'watch shop', gu: 'watch shop' }),
});

const LANGUAGES = ['en', 'hi', 'gu'];
const TOKENS = ['business', 'city', 'area', 'brand', 'topic'];
const SOURCE_TYPES = new Set(['google-autocomplete', 'evergreen', 'google-trends']);
const CLAIMS = /\b(I |my |bought|purchased|visited|maine|mera|maro|lidhu|lidhi|kharid|khareed)|five.star|5.star|helpful staff|best watch|in stock|available now|branch|guaranteed|genuine|authentic|discount|satisfied|excellent|amazing/i;
const UNSUPPORTED_TOPIC = /\b(buy|cheap|best|discount|under|sale|genuine|authentic|smart|waterproof|luxury|online|near me|delivery|repair|warranty|replica|fake|diamond|gold|silver)\b/i;
const FEMALE_TOPIC = /\b(women(?:'s)?|ladies|female)\b/i;
const MALE_TOPIC = /\b(men(?:'?s)?|gents|male)\b/i;
const WATCH_TOPIC = /\bwatch(?:es)?\b/i;
const CLOCK_TOPIC = /\b(?:wall|hanging) clocks?\b/i;
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BRAND_PATTERN = new RegExp(`\\b(?:${BRAND_NAMES.map(escapeRegExp).sort((a, b) => b.length - a.length).join('|')})\\b`, 'i');

function readJson(name) {
  try { return JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')); }
  catch (error) { throw new Error(`Cannot read valid ${name}: ${error.message}`); }
}

function validateSources(research) {
  if (research?.schemaVersion !== 1 || !Array.isArray(research.selectedKeywords) || !Number.isFinite(Date.parse(research.researchedAt))) {
    throw new Error('Keyword research requires schemaVersion 1, researchedAt and selectedKeywords');
  }
  const topics = new Map(BUSINESS_PROFILE.categories.map(category => [category.id, []]));
  const seen = new Set();
  for (const entry of research.selectedKeywords) {
    const { term, phrase = term, category, sourceType, sourceUrl, retrievedAt } = entry || {};
    if (!topics.has(category) || [term, phrase].some(value => typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9' -]{1,69}$/.test(value) || value !== value.trim())) {
      throw new Error('Each selected keyword needs a known category and a short single-sentence topic');
    }
    if (!SOURCE_TYPES.has(sourceType)) throw new Error(`Keyword ${term} needs a supported source type`);
    if (sourceType === 'evergreen') {
      // A business-approved fallback is not retrieved Google evidence.
      if (sourceUrl !== null || retrievedAt !== null) {
        throw new Error(`Evergreen keyword ${term} must have null source URL and retrieval date`);
      }
    } else {
      let source;
      try { source = new URL(sourceUrl); } catch { throw new Error(`Keyword ${term} needs a source URL`); }
      if (source.protocol !== 'https:' || !Number.isFinite(Date.parse(retrievedAt))) {
        throw new Error(`Keyword ${term} needs an HTTPS Google URL and retrieval date`);
      }
      if (sourceType === 'google-trends') {
        const observed = research.trends?.observed;
        const sameTerm = value => typeof value === 'string' && value.toLowerCase() === term.toLowerCase();
        if (source.hostname !== 'trends.google.com' || !sameTerm(entry.evidence?.term) || !Array.isArray(observed) || !observed.some(item => sameTerm(item?.term))) {
          throw new Error(`Google Trends keyword ${term} needs matching literal observed and entry evidence`);
        }
      }
      if (sourceType === 'google-autocomplete' && !['suggestqueries.google.com', 'www.google.com', 'google.com'].includes(source.hostname)) {
        throw new Error('A Google Autocomplete label needs a Google source');
      }
    }
    for (const topic of [term, phrase]) {
      const categoryMatches = category === 'women'
        ? WATCH_TOPIC.test(topic) && FEMALE_TOPIC.test(topic) && !MALE_TOPIC.test(topic) && !CLOCK_TOPIC.test(topic)
        : category === 'men'
          ? WATCH_TOPIC.test(topic) && MALE_TOPIC.test(topic) && !FEMALE_TOPIC.test(topic) && !CLOCK_TOPIC.test(topic)
          : CLOCK_TOPIC.test(topic) && !FEMALE_TOPIC.test(topic) && !MALE_TOPIC.test(topic) && !WATCH_TOPIC.test(topic);
      if (!categoryMatches || CLAIMS.test(topic) || UNSUPPORTED_TOPIC.test(topic) || BRAND_PATTERN.test(topic)) {
        throw new Error(`Keyword ${topic} adds an unsupported claim, brand or category`);
      }
    }
    const key = `${category}:${term.toLowerCase()}`;
    if (seen.has(key)) throw new Error(`Duplicate selected keyword: ${term}`);
    seen.add(key);
    if (!topics.get(category).includes(phrase)) topics.get(category).push(phrase);
  }
  for (const [category, terms] of topics) {
    if (!terms.length) throw new Error(`Keyword research has no approved ${category} topic`);
  }
  return topics;
}

function validateWording(wording) {
  if (wording?.schemaVersion !== 1) throw new Error('Draft wording requires schemaVersion 1');
  for (const language of LANGUAGES) {
    const templates = wording.templates?.[language];
    if (!Array.isArray(templates) || templates.length < 8 || new Set(templates).size !== templates.length) {
      throw new Error(`Need at least eight unique ${language} sentence templates`);
    }
    for (const template of templates) {
      if (typeof template !== 'string' || !template.endsWith('.') || /[.!?]/.test(template.slice(0, -1)) || CLAIMS.test(template) || /[\u0900-\u097f\u0a80-\u0aff]/u.test(template)) {
        throw new Error(`Invalid single-sentence Roman ${language} template`);
      }
      const tokens = [...template.matchAll(/\{([^{}]+)\}/g)].map(match => match[1]);
      if (tokens.length !== TOKENS.length || TOKENS.some(token => tokens.filter(value => value === token).length !== 1)) {
        throw new Error('A template needs each business, city, area, brand and topic token exactly once');
      }
      if (!template.includes(language === 'en' ? 'watch shop in {city}' : 'watch shop')) {
        throw new Error(`Template missing local watch-shop keyword for ${language}`);
      }
    }
  }
}

/** Stable, build-time inputs: Gemini can change grammar without inventing facts. */
export function buildReviewContexts({ research = readJson('keyword-research.json') } = {}) {
  const topics = validateSources(research);
  const contexts = [];
  for (const category of BUSINESS_PROFILE.categories) {
    const categoryTopics = topics.get(category.id);
    const brands = category.id === 'clock' ? ['Onex'] : BRAND_NAMES;
    for (const language of LANGUAGES) {
      for (let variant = 0; variant < category.languages[language]; variant++) {
        const business = BUSINESS_PROFILE.name;
        const city = BUSINESS_PROFILE.city;
        const area = BUSINESS_PROFILE.servingAreas[variant % BUSINESS_PROFILE.servingAreas.length];
        const brand = brands[variant % brands.length];
        const topic = categoryTopics[variant % categoryTopics.length];
        // A stable variant distinguishes multiple wordings of an identical context.
        // Clock contexts otherwise have fewer distinct entity combinations than drafts.
        const identity = [business, city, language, area, brand, category.id, topic, variant];
        const contextId = createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0, 20);
        contexts.push(Object.freeze({ contextId, business, city, language, area, brand, category: category.id, topic, variant }));
      }
    }
  }
  if (contexts.length !== 500 || new Set(contexts.map(item => item.contextId)).size !== 500) {
    throw new Error('Expected 500 uniquely identified review contexts');
  }
  return Object.freeze(contexts);
}

const allEntities = values => new RegExp(`\\b(?:${values.map(escapeRegExp).sort((a, b) => b.length - a.length).join('|')})\\b`, 'gi');
const NATIVE_SCRIPT = /[\u0900-\u097f\u0a80-\u0aff]/u;
const EXTRA_GENERATED_CLAIMS = /\b(?:main|mera|meri|mere|maro|mari|mane|mujhe|hu|gaya|gayi|gai|gayo|staff|service|quality|purchased|bought|visited|recommend|recommended|satisfaction|satisfied|perfect|excellent|amazing|guaranteed|authentic|genuine|discount|undetectable|algorithm|ranking)\b|five.star|5.star|human[- ](?:written|typed)|AI[- ]free|in stock|currently available|available now|milti hain|male chhe/i;
const GENERATED_STOCK_VERBS = /\b(?:offers?|carries|sells?|stocks?|available|availability|uplabdh|milti|milta|male|malti|malta|malshe)\b/i;
const GENERATED_REPUTATION = /\b(?:good|great)\s+place\b|\bwell[- ]known\b|\bpopular\b/i;
const GEMINI_MODEL_NAME = /^(?:models\/)?gemini-[A-Za-z0-9._-]{1,100}$/;
const validGeminiModel = value => typeof value === 'string' && GEMINI_MODEL_NAME.test(value);
const normalizeGeminiModel = value => value.replace(/^models\//, '');


function claimsServingAreaLocation(text, context) {
  const area = escapeRegExp(context.area);
  const business = escapeRegExp(context.business);
  const city = escapeRegExp(context.city);
  // Catch explicit shop/address predicates, not a shopper's conditional location.
  const patterns = [
    `\\b${business}\\s*,?\\s*(?:is\\s+)?(?:located\\s+)?(?:in|at|near)\\s+(?:the\\s+)?${area}\\b`,
    `\\b${business}(?:,\\s*|\\s+)(?:(?:a|the)\\s+)?(?:watch\\s+)?(?:shop|store|branch)\\s+(?:is\\s+)?(?:located\\s+)?(?:in|at|near)\\s+${area}\\b`,
    `\\b(?:this|the|our)\\s+(?:watch\\s+)?(?:shop|store|branch)\\s+(?:is\\s+)?(?:located\\s+)?(?:in|at|near)\\s+${area}\\b`,
    `\\b(?:shop|store|branch)\\s+(?:is\\s+)?located\\s+(?:in|at|near)\\s+${area}\\b`,
    `\\b${area}\\s+(?:mein|me|ma)\\s+${business}\\b`,
    `\\b${business}\\s*,?\\s*(?:is\\s+)?(?:located\\s+)?(?:in|at|near)\\s+${city}\\s*,\\s*${area}\\b`,
    `\\b${business}\\s*,\\s*${city}\\s*,\\s*${area}\\b`,
  ];
  return patterns.some(pattern => new RegExp(pattern, 'i').test(text));
}


function categoryPhraseMatches(phrase, category) {
  const female = /\b(women(?:'s)?|lad(?:y|ies)|female|mahila(?:on|o)?)\b/i.test(phrase);
  const male = /\b(men(?:'?s)?|gents|male|purush(?:on|o)?)\b/i.test(phrase);
  const watch = /\b(watch(?:es)?|wristwatch(?:es)?|ghadi(?:yan)?|ghadiyal(?:o)?)\b/i.test(phrase);
  const clock = /\b(?:wall|hanging) clocks?\b|\b(?:deewar(?: ki)?|deeval(?: ni)?) ghadi(?:yan|yalo|yal)?\b/i.test(phrase);
  return category === 'women' ? female && watch && !male && !clock
    : category === 'men' ? male && watch && !female && !clock
      : category === 'clock' && clock && !female && !male;
}

/** Validate a complete model result before any public artifact is replaced. */
export function validateGeminiDrafts(contexts, manifest) {
  const expectedHash = createHash('sha256').update(JSON.stringify(contexts)).digest('hex');
  if (manifest?.schemaVersion !== 1 || manifest.provider !== 'google-gemini'
    || !validGeminiModel(manifest.model)
    || typeof manifest.generatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(manifest.generatedAt) || !Number.isFinite(Date.parse(manifest.generatedAt))) {
    throw new Error('Gemini drafts require schemaVersion 1, Google provider, model and generation date');
  }
  if (manifest.contextHash !== expectedHash) throw new Error('Gemini drafts are stale or have an invalid context hash');
  if (!Array.isArray(manifest.entries) || manifest.entries.length !== contexts.length) {
    throw new Error('Gemini drafts must cover every context exactly once');
  }
  const expected = new Map(contexts.map(context => [context.contextId, context]));
  if (expected.size !== contexts.length || !contexts.length) throw new Error('Review contexts need unique identities');
  const byId = new Map();
  const seenText = new Set();
  for (const entry of manifest.entries) {
    const context = expected.get(entry?.contextId);
    if (!context || byId.has(entry.contextId)) throw new Error('Unknown or duplicate Gemini context ID');
    const { text, categoryPhrase } = entry;
    const rawModel = entry.model === undefined ? manifest.model : entry.model;
    if (!validGeminiModel(rawModel)) throw new Error(`Gemini draft has an invalid model for ${entry.contextId}`);
    const model = normalizeGeminiModel(rawModel);
    if (typeof text !== 'string' || text !== text.trim() || !text.length || text.length > 400
      || text.split(/\s+/u).length > 50 || !/[.!?]$/.test(text) || text.match(/[.!?]/g)?.length !== 1
      || /[\n\r<>]/.test(text) || NATIVE_SCRIPT.test(text) || CLAIMS.test(text) || EXTRA_GENERATED_CLAIMS.test(text) || GENERATED_STOCK_VERBS.test(text) || GENERATED_REPUTATION.test(text)) {
      throw new Error(`Invalid one-sentence Gemini draft for ${entry.contextId}`);
    }
    if (typeof categoryPhrase !== 'string' || categoryPhrase !== categoryPhrase.trim()
      || !/^[A-Za-z][A-Za-z0-9' -]{1,79}$/.test(categoryPhrase)
      || !text.toLowerCase().includes(categoryPhrase.toLowerCase())
      || !categoryPhraseMatches(categoryPhrase, context.category)
      || BRAND_PATTERN.test(categoryPhrase) || UNSUPPORTED_TOPIC.test(categoryPhrase)) {
      throw new Error(`Gemini draft has an invalid ${context.category} category phrase`);
    }
    const areas = text.match(allEntities(BUSINESS_PROFILE.servingAreas));
    const brands = text.match(allEntities(BRAND_NAMES));
    if (areas?.length !== 1 || areas[0] !== context.area || brands?.length !== 1 || brands[0] !== context.brand
      || !text.includes(context.business) || !text.includes(context.city)) {
      throw new Error(`Gemini draft changed or duplicated required entities for ${entry.contextId}`);
    }
    // In English, establish the shopper catchment before the product so a late
    // "from AREA" cannot attach ambiguously to the watch or room description.
    if (context.language === 'en' && text.indexOf(context.area) > text.indexOf(context.brand)) {
      throw new Error(`English Gemini draft must mention its catchment area before the brand for ${entry.contextId}`);
    }
    const productOrigin = new RegExp(`\\b${escapeRegExp(categoryPhrase)}(?:,?\\s+)from\\s+${escapeRegExp(context.area)}\\b`, 'i');
    const genericProductOrigin = new RegExp(`\\b(?:(?:wrist)?watch(?:es)?|clocks?)(?:,?\\s+)from\\s+${escapeRegExp(context.area)}\\b`, 'i');
    const hasBrand = new RegExp(`\\bhas\\s+(?:an?\\s+)?${escapeRegExp(context.brand)}\\b`, 'i');
    if (productOrigin.test(text) || genericProductOrigin.test(text) || hasBrand.test(text)) {
      throw new Error(`Gemini draft invents product origin or inventory for ${entry.contextId}`);
    }
    if (claimsServingAreaLocation(text, context)) {
      throw new Error(`Gemini draft treats a serving area as a branch location for ${entry.contextId}`);
    }
    if ((context.category === 'women' && MALE_TOPIC.test(text))
      || (context.category === 'men' && FEMALE_TOPIC.test(text))
      || (context.category !== 'clock' && CLOCK_TOPIC.test(text))
      || (context.category === 'clock' && (FEMALE_TOPIC.test(text) || MALE_TOPIC.test(text)))) {
      throw new Error(`Gemini draft added an unrelated category for ${entry.contextId}`);
    }
    const normalizedText = text.toLowerCase();
    if (seenText.has(normalizedText)) throw new Error('Gemini drafts must have unique full sentences');
    seenText.add(normalizedText);
    const phraseStart = text.toLowerCase().indexOf(categoryPhrase.toLowerCase());
    const renderedPhrase = text.slice(phraseStart, phraseStart + categoryPhrase.length);
    byId.set(entry.contextId, Object.freeze({ contextId: entry.contextId, text, categoryPhrase: renderedPhrase, model }));
  }
  if (manifest.modelsUsed !== undefined) {
    if (!Array.isArray(manifest.modelsUsed) || !manifest.modelsUsed.length || manifest.modelsUsed.some(model => !validGeminiModel(model))) {
      throw new Error('Gemini modelsUsed must list valid models actually used by the entries');
    }
    const declared = manifest.modelsUsed.map(normalizeGeminiModel);
    const actual = new Set([...byId.values()].map(entry => entry.model));
    if (new Set(declared).size !== declared.length || declared.length !== actual.size || declared.some(model => !actual.has(model))) {
      throw new Error('Gemini modelsUsed must exactly match the entry models without duplicates');
    }
  }
  return Object.freeze(contexts.map(context => byId.get(context.contextId)));
}

/** Build-time only. A present invalid Gemini manifest never silently falls back. */
export function buildReviewCatalog({ research = readJson('keyword-research.json'), wording, generated } = {}) {
  const contexts = buildReviewContexts({ research });
  const hasGeneratedFile = existsSync(new URL('./gemini-drafts.json', import.meta.url));
  if (generated !== undefined || hasGeneratedFile) {
    const entries = validateGeminiDrafts(contexts, generated === undefined ? readJson('gemini-drafts.json') : generated);
    return Object.freeze(entries.map((entry, index) => {
      const context = contexts[index];
      const id = createHash('sha256').update(entry.text).digest('hex').slice(0, 16);
      return Object.freeze({ id, language: context.language, area: context.area, brand: context.brand,
        category: context.category, keyword: entry.categoryPhrase, topic: context.topic,
        contextId: context.contextId, categoryPhrase: entry.categoryPhrase, generator: 'google-gemini', generatorModel: entry.model, text: entry.text });
    }));
  }

  // Legacy bootstrap is available only while no Gemini manifest exists. It is
  // explicit offline wording, never reported as a successful Gemini generation.
  const legacyWording = wording === undefined ? readJson('draft-wording.json') : wording;
  validateWording(legacyWording);
  const seen = new Set();
  return Object.freeze(contexts.map(context => {
    const templates = legacyWording.templates[context.language];
    const template = templates[Math.floor(context.variant / BUSINESS_PROFILE.servingAreas.length) % templates.length];
    const values = { business: context.business, city: context.city, area: context.area, brand: context.brand, topic: context.topic };
    const sentence = template.replace(/\{([^{}]+)\}/g, (_, token) => values[token]);
    const text = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    if (seen.has(text)) throw new Error('Duplicate draft in review catalog');
    seen.add(text);
    const id = createHash('sha256').update(text).digest('hex').slice(0, 16);
    return Object.freeze({ id, language: context.language, area: context.area, brand: context.brand,
      category: context.category, keyword: BUSINESS_PROFILE.keywords[context.language], topic: context.topic, text });
  }));
}
