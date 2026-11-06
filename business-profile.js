import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CATEGORY_PHRASES_BY_CATEGORY } from './review-core.js';

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
const SOURCE_TYPES = new Set(['google-autocomplete', 'evergreen', 'google-trends']);
const CLAIMS = /\b(I |my |bought|purchased|visited|maine|mera|maro|lidhu|lidhi|kharid|khareed)|five.star|5.star|helpful staff|best watch|in stock|available now|branch|guaranteed|genuine|authentic|discount|satisfied|excellent|amazing/i;
const UNSUPPORTED_TOPIC = /\b(buy|cheap|best|discount|under|sale|genuine|authentic|smart|waterproof|luxury|online|near me|delivery|repair|warranty|replica|fake|diamond|gold|silver)\b/i;
const FEMALE_TOPIC = /\b(women(?:'?s)?|ladies|female)\b/i;
const MALE_TOPIC = /\b(men(?:'?s)?|gents|male)\b/i;
const WATCH_TOPIC = /\bwatch(?:es)?\b/i;
const CLOCK_TOPIC = /\b(?:wall|hanging) clocks?\b/i;
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SOURCE_TOPIC_WORDS = new Set("ladies lady women women's womens female men men's mens gents male watch watches wrist wristwatch wristwatches the wall hanging clock clocks for home living room bedroom gift gifting gifts".split(/\s+/));

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
        const publishedAt = Date.parse(entry.evidence?.publishedAt);
        const ageMs = Date.parse(research.researchedAt) - publishedAt;
        if (source.hostname !== 'trends.google.com' || !sameTerm(entry.evidence?.term) || !Number.isFinite(publishedAt)
          || ageMs < -60 * 60 * 1000 || ageMs > 48 * 60 * 60 * 1000
          || !Array.isArray(observed) || !observed.some(item => sameTerm(item?.term) && Date.parse(item.publishedAt) === publishedAt)) {
          throw new Error(`Google Trends keyword ${term} needs matching literal observed and entry evidence published within 48 hours of research`);
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
      if (!categoryMatches || CLAIMS.test(topic) || UNSUPPORTED_TOPIC.test(topic) || (topic.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []).some(word => !SOURCE_TOPIC_WORDS.has(word))) {
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

/** Stable public contexts contain generic category examples, never product brands. */
export function buildReviewContexts({ research = readJson('keyword-research.json') } = {}) {
  const topics = validateSources(research);
  const contexts = [];
  for (const category of BUSINESS_PROFILE.categories) {
    const categoryTopics = topics.get(category.id);
    const phrases = CATEGORY_PHRASES_BY_CATEGORY[category.id];
    for (const language of LANGUAGES) {
      for (let variant = 0; variant < category.languages[language]; variant++) {
        const business = BUSINESS_PROFILE.name;
        const city = BUSINESS_PROFILE.city;
        const area = BUSINESS_PROFILE.servingAreas[variant % BUSINESS_PROFILE.servingAreas.length];
        const topic = categoryTopics[variant % categoryTopics.length];
        // Each area gets singular/plural examples and multiple neutral sentence styles.
        const categoryPhrase = phrases[Math.floor(variant / BUSINESS_PROFILE.servingAreas.length) % phrases.length];
        const styleIndex = Math.floor(variant / (BUSINESS_PROFILE.servingAreas.length * phrases.length));
        const identity = [business, city, language, area, category.id, topic, variant, categoryPhrase, styleIndex];
        const contextId = createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0, 20);
        contexts.push(Object.freeze({ contextId, business, city, language, area,
          category: category.id, topic, variant, categoryPhrase, styleIndex }));
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
const GENERATED_STOCK_VERBS = /\b(?:offers?|carries|sells?|stocks?|available|availability|uplabdh|milti|milta|male|malti|malta|malshe)\b/i;
const GENERATED_REPUTATION = /\b(?:good|great)\s+place\b|\bwell[- ]known\b|\bpopular\b/i;
const GEMINI_MODEL_NAME = /^(?:models\/)?gemini-[A-Za-z0-9._-]{1,100}$/;
const validGeminiModel = value => typeof value === 'string' && GEMINI_MODEL_NAME.test(value);
const normalizeGeminiModel = value => value.replace(/^models\//, '');
export const CUSTOMER_POV_KIND = 'customer-pov-template';
export const CUSTOMER_POV_SLOTS = Object.freeze(['area', 'category', 'recipient', 'experience']);
// First-person visit/purchase grammar is allowed only in the explicitly marked
// template mode. Personal details and judgements must remain unresolved slots.
const POV_UNGROUNDED_DETAILS = /\b(?:staff|service|quality|helpful|friendly|polite|rude|good|great|best|bad|poor|nice|happy|satisfaction|satisfied|excellent|amazing|perfect|recommend|recommended|reliable|reasonable|affordable|expensive|cheap|price|prices|pricing|range|ranges|experience|overall|discount|offer|offers|warranty|guaranteed|genuine|authentic|original|popular|famous|known|papa|father|dad|daddy|mother|mummy|mom|mama|friend|friends|wife|husband|sister|brother|daughter|son|family|birthday|anniversary|wedding|yesterday|today|tomorrow|yday|rupees|rs|inr|acha|achha|accha|achhi|achhe|achcha|achchi|achche|badiya|badhiya|sasta|sasti|mehenga|mahenga|saru|saro|saras|sari|mast|anubhav|vyavhar|bhav|kimat|undetectable|algorithm|ranking)\b|five.star|5.star|human[- ](?:written|typed)|AI[- ]free|\d|in stock|currently available|available now/i;
const FIRST_PERSON = Object.freeze({ en: /\b(?:I|we)\b/i, hi: /\b(?:main|maine|hum|humne)\b/i, gu: /\b(?:hu|hun|ame|me)\b/i });
// Only neutral first-person visit/purchase grammar belongs outside the fields.
// A finite vocabulary fails closed on new adjectives, relatives and concrete
// experience details instead of trusting an ever-growing sentiment denylist.
export const CUSTOMER_POV_SCAFFOLD_WORDS = Object.freeze({
  en: Object.freeze(`i we my our me us a an the this that it from to at in for and or with as of by after before when while on into there here back then was were is are am be being been have had did do to go went gone going come came coming visit visited visiting stop stopped stopping travel travelled traveled travelling traveling arrive arrived arriving head headed heading drop dropped dropping buy bought buying purchase purchased purchasing choose chose chosen choosing pick picked picking look looked looking browse browsed browsing check checked checking see saw seen seeing select selected selecting find found finding get got getting take took taken taking want wanted wanting plan planned planning intend intended intending hope hoped hoping seek sought seeking make made making way up out over around through along towards about having i've we've i'm we're i'd we'd i'll we'll`.split(/\s+/)),
  hi: Object.freeze(`main maine hum humne ham hamne mai mein me mera meri mere mujhe apna apni apne hamara hamari hamare humara humari humare se ke ki ka ko liye lie par pe yahan yaha yahaan idhar wahan waha wahaan aur ya to toh jab tab phir lekin magar kharidne kharid kharida kharidi kharide kharidna khareedne khareed khareeda khareedi khareede khareedna lene lena liya liye li aaya aayi aai aaye aya ayi gaya gayi gai gaye gya gyi gye aata aati aate jaane jana jaata jaati jaate dekhne dekh dekha dekhi dekhe dekhna chunne chun chuna chuni chune chunna chala chali chale pahuncha pahunchi pahunche tha thi the thaa hoon hun hu hai hain ho hoke hokar kar karne kiya karke is iss us uss ek tak saath sath baad pehle dauran douran soch socha sochkar`.split(/\s+/)),
  gu: Object.freeze(`hu hun hoo me mane ame amey maro mari mara amaro amari amara thi ma maan maa par pase mate ne ni no na nu ane pan ke to tyare pachhi pachi pahela pehla leva levu lidhu lidhi lidho lidha lida lidhela lidheli kharidva kharidyu kharidi kharidyo kharidya kharidvu jova jovu joyu joi joya joyi jovaa java javu javanu gayo gai gayi gaya gya gyu gyi aavyo aavi aavya aaviyo avyo avi avya aavva aavvu aavine aavto aavti aavta hato hati hata htu hti pahochyo pahonchyo pahochi pahonchi pahonchya pahochya karva karvu karine karyu karyun karyo kari karya karta karata chhu chu chhe che chho chhiye chhie hoy aa te e tya tyaan ahi ahin ahiya ahiyan sathe saathe sudhhi sudhi taraf ek j thay thayu thai thaine pasandgi`.split(/\s+/)),
});
const SCAFFOLD_WORD_SETS = Object.freeze(Object.fromEntries(Object.entries(CUSTOMER_POV_SCAFFOLD_WORDS)
  .map(([language, words]) => [language, new Set(words)])));

function validateCustomerPovTemplate(text, categoryPhrase, context) {
  const slots = [...text.matchAll(/\[[^\[\]]+\]/g)].map(match => match[0]);
  const required = [`[area: ${context.area}]`, `[category: ${categoryPhrase}]`, '[recipient]', '[experience]'];
  const scaffold = text.replace(/\[[^\[\]]+\]/g, '');
  if (slots.length !== required.length || required.some(slot => slots.filter(value => value === slot).length !== 1)
    || /[\[\]]/.test(scaffold)) {
    throw new Error(`Customer POV template needs exactly four unresolved slots for ${context.contextId}`);
  }
  const links = {
    en: { recipient: /\bfor\s+\[recipient\]/i, experience: /\band\s+\[experience\]\.$/i },
    hi: { recipient: /\[recipient\]\s+ke\s+liye\b/i, experience: /\baur\s+\[experience\]\.$/i },
    gu: { recipient: /\[recipient\]\s+mate\b/i, experience: /\bane\s+\[experience\]\.$/i },
  }[context.language];
  const experienceLink = text.match(links.experience);
  const recipientLink = text.match(links.recipient);
  if (!experienceLink || !recipientLink || recipientLink.index >= experienceLink.index) {
    throw new Error(`Customer POV template must attach recipient to the purchase before the final experience clause for ${context.contextId}`);
  }
  const areaSlot = escapeRegExp(`[area: ${context.area}]`);
  const areaRelation = new RegExp(context.language === 'en' ? `\\bfrom\\s+${areaSlot}`
    : `${areaSlot}\\s+${context.language === 'hi' ? 'se' : 'thi'}\\b`, 'i');
  if (!areaRelation.test(text)) throw new Error(`Customer POV area must describe coming from the example area for ${context.contextId}`);
  if (context.language === 'en') {
    const areaIndex = text.indexOf(`[area: ${context.area}]`);
    const originPrefix = text.slice(0, areaIndex).trim();
    if (areaIndex > text.indexOf(context.business)
      || !/(?:^from|\b(?:came|went|traveled|travelled|arrived|coming|come|being)\s+from)$/i.test(originPrefix)) {
      throw new Error(`English template needs a clear customer-origin clause before the business for ${context.contextId}`);
    }
    if (/\bfor\s+\[recipient\]\s+\[category:/i.test(text) || /\blook(?:ed|ing)?\s+for\s+\[recipient\]/i.test(text)) {
      throw new Error(`English template must attach the recipient to shopping, not make them the product for ${context.contextId}`);
    }
    if (new RegExp(`\\barrived\\s+from\\s+${areaSlot}\\s+to\\s+${escapeRegExp(context.business)}`, 'i').test(text)) {
      throw new Error(`English arrival uses at the business, not to the business for ${context.contextId}`);
    }
  }
  // The example area and category must never escape their labeled slots.
  const plainScaffold = scaffold.replace(context.business, '').replace(context.city, '');
  const categorySlot = escapeRegExp(`[category: ${categoryPhrase}]`);
  if (new RegExp(`\\ban\\s+${categorySlot}`, 'i').test(text)
    || (/s$/.test(categoryPhrase) && new RegExp(`\\ba\\s+${categorySlot}`, 'i').test(text))
    || (context.language === 'en' && !/s$/.test(categoryPhrase) && !new RegExp(`\\ba\\s+${categorySlot}`, 'i').test(text))) {
    throw new Error(`Customer POV template has an article/category-number mismatch for ${context.contextId}`);
  }
  if (context.language === 'en' && !/s$/.test(categoryPhrase)
    && new RegExp(`\\bbrows(?:e|ed|ing)\\s+a\\s+${categorySlot}`, 'i').test(text)) {
    throw new Error(`English singular-item wording needs look at, check or choose instead of browse for ${context.contextId}`);
  }
  if (context.language === 'en' && (!/\b(?:came|went|visited|stopped|traveled|travelled|arrived|dropped)\b|\b(?:was|were)\s+at\b/i.test(plainScaffold)
    || /\b(?:plan|planning|intend|intending|will)\b/i.test(plainScaffold))) {
    throw new Error(`Customer POV template needs a past visit rather than a future plan for ${context.contextId}`);
  }
  if (context.language === 'hi' && !/\b(?:aaya|aayi|aai|aaye|aya|ayi|gaya|gayi|gai|gaye|gya|gyi|gye|pahuncha|pahunchi|pahunche)\b/i.test(plainScaffold)) {
    throw new Error(`Hindi template needs a past arrival or visit verb for ${context.contextId}`);
  }
  if (context.language === 'hi' && /\bmain\b/i.test(plainScaffold) && !/\bhum\b/i.test(plainScaffold) && /\bpahunche\b/i.test(plainScaffold)) {
    throw new Error(`Hindi singular main needs pahuncha or pahunchi, not plural pahunche for ${context.contextId}`);
  }
  const unknownWords = [...new Set((plainScaffold.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [])
    .map(word => word.toLowerCase()).filter(word => !SCAFFOLD_WORD_SETS[context.language]?.has(word)))];
  if (unknownWords.length) {
    throw new Error(`Customer POV template has unsupported outside-slot words for ${context.contextId}: ${unknownWords.slice(0, 12).join(', ').slice(0, 180)}`);
  }
  if (context.language === 'gu' && ((plainScaffold.match(/\b(?:aavyo|aavi|aavya|aaviyo|avyo|avi|avya|gayo|gayi|gaya|gya)\s+(?:hato|hati|hata)\b/gi)?.length || 0) > 1
    || !/\b(?:leva|jova|kharidva)\b/i.test(plainScaffold))) {
    throw new Error(`Gujarati template needs one clear visit clause and an explicit shopping-intent verb for ${context.contextId}`);
  }
  if (context.language === 'gu') {
    const intent = text.match(/\b(?:leva|jova|kharidva)\b/i);
    const visit = text.match(/\b(?:aavyo|aavi|aavya|aaviyo|avyo|avi|avya|gayo|gayi|gaya|gya)\b/i);
    if ((plainScaffold.match(/\bane\b/gi)?.length || 0) !== 1 || !visit
      || intent.index >= visit.index || text.indexOf('[category:') >= intent.index || recipientLink.index >= intent.index) {
      throw new Error(`Gujarati template needs one complete shopping-purpose clause before the past visit, then final feedback for ${context.contextId}`);
    }
    if (/\baavine\b/i.test(plainScaffold) && /\b(?:aavyo|aavi|aavya|aaviyo|avyo|avi|avya)\b/i.test(plainScaffold)) {
      throw new Error(`Gujarati template must not repeat arrival as aavine followed by aavyo for ${context.contextId}`);
    }
  }
  if (allEntities(BUSINESS_PROFILE.servingAreas).test(scaffold)
    || plainScaffold.toLowerCase().includes(categoryPhrase.toLowerCase())
    || !FIRST_PERSON[context.language]?.test(plainScaffold)
    || POV_UNGROUNDED_DETAILS.test(plainScaffold) || GENERATED_STOCK_VERBS.test(plainScaffold)
    || GENERATED_REPUTATION.test(plainScaffold)) {
    throw new Error(`Customer POV template invents a personal detail or judgement for ${context.contextId}`);
  }
  return Object.freeze({ kind: CUSTOMER_POV_KIND, templateSlots: CUSTOMER_POV_SLOTS });
}


/** Validate the current four-field model result before replacing public artifacts. */
export function validateGeminiDrafts(contexts, manifest) {
  const expectedHash = createHash('sha256').update(JSON.stringify(contexts)).digest('hex');
  if (manifest?.schemaVersion !== 2 || manifest.kind !== CUSTOMER_POV_KIND || manifest.provider !== 'google-gemini'
    || !validGeminiModel(manifest.model)
    || typeof manifest.generatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(manifest.generatedAt)
    || !Number.isFinite(Date.parse(manifest.generatedAt))) {
    throw new Error('Gemini drafts require schemaVersion 2, customer-pov-template kind, Google provider, model and generation date');
  }
  if (manifest.contextHash !== expectedHash) throw new Error('Gemini drafts are stale or have an invalid context hash');
  if (!Array.isArray(manifest.entries) || manifest.entries.length !== contexts.length) {
    throw new Error('Gemini drafts must cover every context exactly once');
  }
  const contextFields = new Set(['contextId', 'business', 'city', 'language', 'area', 'category', 'topic', 'variant', 'categoryPhrase', 'styleIndex']);
  if (contexts.some(context => Object.keys(context).some(key => !contextFields.has(key))
    || !CATEGORY_PHRASES_BY_CATEGORY[context.category]?.includes(context.categoryPhrase))) {
    throw new Error('Review contexts require the current generic-category schema');
  }
  const expected = new Map(contexts.map(context => [context.contextId, context]));
  if (expected.size !== contexts.length || !contexts.length) throw new Error('Review contexts need unique identities');
  const byId = new Map();
  const seenText = new Set();
  for (const entry of manifest.entries) {
    const context = expected.get(entry?.contextId);
    if (!context || byId.has(entry.contextId)) throw new Error('Unknown or duplicate Gemini context ID');
    if (Object.keys(entry).some(key => /brand/i.test(key))) throw new Error('Product-brand metadata is not permitted');
    const { text, categoryPhrase } = entry;
    const rawModel = entry.model === undefined ? manifest.model : entry.model;
    if (!validGeminiModel(rawModel)) throw new Error(`Gemini draft has an invalid model for ${entry.contextId}`);
    const model = normalizeGeminiModel(rawModel);
    if (typeof text !== 'string' || text !== text.trim() || !text.length || text.length > 400
      || text.split(/\s+/u).length > 50 || !text.endsWith('.') || text.match(/[.!?]/g)?.length !== 1
      || /[\n\r<>]/.test(text) || NATIVE_SCRIPT.test(text) || !/^[\x20-\x7e]+$/.test(text)) {
      throw new Error(`Invalid one-sentence Gemini draft for ${entry.contextId}`);
    }
    if (categoryPhrase !== context.categoryPhrase || !CATEGORY_PHRASES_BY_CATEGORY[context.category].includes(categoryPhrase)) {
      throw new Error(`Gemini draft must use its assigned generic ${context.category} category phrase`);
    }
    const templateMetadata = validateCustomerPovTemplate(text, categoryPhrase, context);
    const areas = text.match(allEntities(BUSINESS_PROFILE.servingAreas));
    if (areas?.length !== 1 || areas[0] !== context.area
      || text.split(context.business).length !== 2 || text.split(context.city).length !== 2) {
      throw new Error(`Gemini draft changed or duplicated required entities for ${entry.contextId}`);
    }
    if (context.language === 'en' && text.indexOf(context.area) > text.indexOf(`[category: ${categoryPhrase}]`)) {
      throw new Error(`English Gemini draft must mention its catchment area before the product for ${entry.contextId}`);
    }
    const normalizedText = text.toLowerCase();
    if (seenText.has(normalizedText)) throw new Error('Gemini drafts must have unique full sentences');
    seenText.add(normalizedText);
    byId.set(entry.contextId, Object.freeze({ contextId: entry.contextId, text, categoryPhrase, model, ...templateMetadata }));
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

/** Production compilation requires validated model output; retired wording never substitutes. */
export function buildReviewCatalog({ research = readJson('keyword-research.json'), generated } = {}) {
  const contexts = buildReviewContexts({ research });
  const entries = validateGeminiDrafts(contexts, generated === undefined ? readJson('gemini-drafts.json') : generated);
  return Object.freeze(entries.map((entry, index) => {
    const context = contexts[index];
    const id = createHash('sha256').update(entry.text).digest('hex').slice(0, 16);
    return Object.freeze({ id, language: context.language, area: context.area,
      category: context.category, keyword: entry.categoryPhrase, topic: context.topic,
      contextId: context.contextId, categoryPhrase: entry.categoryPhrase, generator: 'google-gemini', generatorModel: entry.model,
      kind: entry.kind, templateSlots: entry.templateSlots, text: entry.text });
  }));
}
