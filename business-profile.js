import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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

/** Build-time only: use sourced topics and AI-authored wording, never invented visits. */
export function buildReviewCatalog({ research = readJson('keyword-research.json'), wording = readJson('draft-wording.json') } = {}) {
  const topics = validateSources(research);
  validateWording(wording);
  const records = [];
  const seen = new Set();
  for (const category of BUSINESS_PROFILE.categories) {
    const categoryTopics = topics.get(category.id);
    // Only Onex was supplied as a wall-clock brand; watch names never imply stock.
    const brands = category.id === 'clock' ? ['Onex'] : BRAND_NAMES;
    for (const language of LANGUAGES) {
      const templates = wording.templates[language];
      for (let n = 0; n < category.languages[language]; n++) {
        const area = BUSINESS_PROFILE.servingAreas[n % BUSINESS_PROFILE.servingAreas.length];
        const brand = brands[n % brands.length];
        const topic = categoryTopics[n % categoryTopics.length];
        const template = templates[Math.floor(n / BUSINESS_PROFILE.servingAreas.length) % templates.length];
        const values = { business: BUSINESS_PROFILE.name, city: BUSINESS_PROFILE.city, area, brand, topic };
        const sentence = template.replace(/\{([^{}]+)\}/g, (_, token) => values[token]);
        const text = sentence.charAt(0).toUpperCase() + sentence.slice(1);
        if (seen.has(text)) throw new Error('Duplicate draft in review catalog');
        seen.add(text);
        const id = createHash('sha256').update(text).digest('hex').slice(0, 16);
        records.push(Object.freeze({ id, language, area, brand, category: category.id, keyword: BUSINESS_PROFILE.keywords[language], topic, text }));
      }
    }
  }
  if (records.length !== 500 || seen.size !== 500) throw new Error('Expected 500 unique complete drafts');
  return Object.freeze(records);
}
