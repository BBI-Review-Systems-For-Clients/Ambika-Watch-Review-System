import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { BUSINESS_PROFILE, CUSTOMER_POV_KIND, CUSTOMER_POV_SLOTS, buildReviewCatalog, buildReviewContexts, validateGeminiDrafts } from '../business-profile.js';
import { REVIEW_CATALOG } from '../review-catalog.js';
import { BRAND_NAMES } from '../review-core.js';
import { createAutomaticReviewGenerator } from '../auto-review-generator.js';

const research = JSON.parse(await readFile(new URL('../keyword-research.json', import.meta.url), 'utf8'));
const wording = JSON.parse(await readFile(new URL('../draft-wording.json', import.meta.url), 'utf8'));
const countBy = (records, key) => records.reduce((counts, item) => ({ ...counts, [item[key]]: (counts[item[key]] || 0) + 1 }), {});
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const entities = values => new RegExp(`\\b(?:${values.map(escapeRegExp).sort((a, b) => b.length - a.length).join('|')})\\b`, 'gi');
const clone = value => JSON.parse(JSON.stringify(value));

function makeManifest(contexts) {
  return {
    schemaVersion: 1, provider: 'google-gemini', model: 'gemini-2.5-flash', generatedAt: '2026-10-25T00:00:00Z',
    contextHash: createHash('sha256').update(JSON.stringify(contexts)).digest('hex'),
    entries: contexts.map(context => {
      const templateIndex = Math.floor(context.variant / BUSINESS_PROFILE.servingAreas.length) % wording.templates[context.language].length;
      const areaFirstEnglish = {
        3: 'For {area} shoppers with {brand} {topic} in mind, {business} is a watch shop in {city}.',
        4: 'Shoppers from {area} considering {brand} {topic} can include {business}, a watch shop in {city}, among their options.',
      };
      const template = context.language === 'en' && areaFirstEnglish[templateIndex]
        ? areaFirstEnglish[templateIndex] : wording.templates[context.language][templateIndex];
      const text = template.replace(/\{([^{}]+)\}/g, (_, token) => context[token]);
      return { contextId: context.contextId, text, categoryPhrase: context.topic };
    }),
  };
}

function makePovManifest(contexts) {
  const manifest = makeManifest(contexts);
  manifest.kind = CUSTOMER_POV_KIND;
  manifest.entries = contexts.map(context => {
    const area = `[area: ${context.area}]`;
    const product = `[brand: ${context.brand}] [category: ${context.topic}]`;
    const business = `${context.business}, ${context.city}`;
    const variant = Math.floor(context.variant / BUSINESS_PROFILE.servingAreas.length) % 8;
    const templates = {
      en: [
        `I came from ${area} to ${business} to buy ${product} for [recipient], and [experience].`,
        `I went from ${area} to ${business} to choose ${product} for [recipient], and [experience].`,
        `From ${area}, I visited ${business} to buy ${product} for [recipient], and [experience].`,
        `I travelled from ${area} to ${business} to pick ${product} for [recipient], and [experience].`,
        `We came from ${area} to ${business} to look at ${product} for [recipient], and [experience].`,
        `We went from ${area} to ${business} to buy ${product} for [recipient], and [experience].`,
        `After coming from ${area}, I stopped at ${business} to buy ${product} for [recipient], and [experience].`,
        `I visited ${business} from ${area} to choose ${product} for [recipient], and [experience].`,
      ],
      hi: [
        `Main ${area} se [recipient] ke liye ${product} lene ${business} aaya tha aur [experience].`,
        `${area} se main ${business} mein [recipient] ke liye ${product} lene gaya tha aur [experience].`,
        `Hum ${area} se [recipient] ke liye ${product} lene ${business} gaye the aur [experience].`,
        `Main [recipient] ke liye ${product} lene ${area} se ${business} gaya tha aur [experience].`,
        `${area} se hum ${business} par [recipient] ke liye ${product} lene aaye the aur [experience].`,
        `Main ${area} se ${business} par ${product} dekhne [recipient] ke liye gaya tha aur [experience].`,
        `Hum [recipient] ke liye ${product} dekhne ${area} se ${business} aaye the aur [experience].`,
        `Main ${area} se ${business} mein [recipient] ke liye ${product} kharidne aaya tha aur [experience].`,
      ],
      gu: [
        `Hu ${area} thi [recipient] mate ${product} leva ${business} aavyo hato ane [experience].`,
        `${area} thi hu ${business} ma [recipient] mate ${product} leva gayo hato ane [experience].`,
        `Ame ${area} thi [recipient] mate ${product} leva ${business} aavya hata ane [experience].`,
        `Hu [recipient] mate ${product} leva ${area} thi ${business} gayo hato ane [experience].`,
        `${area} thi ame ${business} par [recipient] mate ${product} leva aavya hata ane [experience].`,
        `Hu ${area} thi ${business} par ${product} jova [recipient] mate gayo hato ane [experience].`,
        `Ame [recipient] mate ${product} jova ${area} thi ${business} aavya hata ane [experience].`,
        `Hu ${area} thi ${business} ma [recipient] mate ${product} kharidva aavyo hato ane [experience].`,
      ],
    };
    return { contextId: context.contextId, categoryPhrase: context.topic, text: templates[context.language][variant] };
  });
  return manifest;
}

test('explicit customer POV mode produces first-person templates with five unresolved factual slots', () => {
  const contexts = buildReviewContexts({ research });
  const manifest = makePovManifest(contexts);
  const entries = validateGeminiDrafts(contexts, manifest);
  const catalog = buildReviewCatalog({ research, generated: manifest });
  assert.equal(entries.length, 500);
  assert.equal(catalog.length, 500);
  for (let index = 0; index < entries.length; index++) {
    assert.equal(entries[index].kind, CUSTOMER_POV_KIND);
    assert.deepEqual(entries[index].templateSlots, CUSTOMER_POV_SLOTS);
    assert.ok(Object.isFrozen(entries[index].templateSlots));
    assert.equal(catalog[index].kind, CUSTOMER_POV_KIND);
    assert.deepEqual(catalog[index].templateSlots, CUSTOMER_POV_SLOTS);
    assert.equal(entries[index].text.match(/\[[^\[\]]+\]/g)?.length, 5);
    assert.ok(entries[index].text.includes(`[area: ${contexts[index].area}]`));
    assert.ok(entries[index].text.includes(`[brand: ${contexts[index].brand}]`));
    assert.ok(entries[index].text.includes(`[category: ${entries[index].categoryPhrase}]`));
    assert.ok(entries[index].text.includes('[recipient]'));
    assert.ok(entries[index].text.includes('[experience]'));
  }
});

test('template mode rejects filled or malformed slots and invented personal judgements', () => {
  const contexts = [buildReviewContexts({ research })[0]];
  const manifest = makePovManifest(contexts);
  const original = manifest.entries[0].text;
  for (const replacement of [
    original.replace('[recipient]', 'my papa'),
    original.replace('[experience]', 'the staff was helpful'),
    original.replace('[experience]', '[experience: good prices]'),
    original.replace('[experience]', '[experience] and the prices were reasonable'),
    original.replace('[experience]', '[experience] and it was good'),
    original.replace('[experience]', '[experience] and it cost 2000'),
    original.replace('[experience]', '[experience] after a friendly welcome'),
    original.replace('[experience]', 'I loved it, [experience]'),
    original.replace('[experience]', 'after a wonderful welcome, [experience]'),
    original.replace('[experience]', 'I was delighted, [experience]'),
    original.replace('[experience]', '[experience] for a birthday'),
    original.replace('[area: Varachha]', 'Varachha'),
    original.replace('[brand: Casio]', 'Casio'),
    original.replace('[category: ladies watches]', 'ladies watches'),
    original.replace('[recipient]', '[recipient] [recipient]'),
    original.replace('[recipient]', '[recipient'),
    original.replace('[recipient]', '[[recipient]]'),
    original.replace('[recipient]', '[unknown]'),
    original.replace('I came', 'People came'),
    original.replace('[experience]', '[experience] અને'),
    original.replace('I came', 'I’ve come'),
  ]) {
    const bad = clone(manifest); bad.entries[0].text = replacement;
    assert.throws(() => validateGeminiDrafts(contexts, bad), replacement);
  }
  const descriptive = clone(manifest); delete descriptive.kind;
  assert.throws(() => validateGeminiDrafts(contexts, descriptive), /Invalid one-sentence/);
  const unknown = clone(manifest); unknown.kind = 'unverified-customer-review';
  assert.throws(() => validateGeminiDrafts(contexts, unknown), /unsupported kind/);
});

test('customer POV scaffold vocabulary accepts neutral Roman grammar and rejects feedback in every language', () => {
  const allContexts = buildReviewContexts({ research });
  for (const language of ['en', 'hi', 'gu']) {
    const context = allContexts.find(item => item.language === language);
    const manifest = makePovManifest([context]);
    const original = manifest.entries[0].text;
    assert.equal(validateGeminiDrafts([context], manifest).length, 1);
    const feedback = { en: ['loved', 'wonderful', 'delighted', 'enjoyed'], hi: ['maza', 'khush', 'zabardast'], gu: ['gamyu', 'khushi', 'jordar'] }[language];
    for (const word of feedback) {
      const bad = clone(manifest);
      bad.entries[0].text = `${word} ${original}`;
      assert.throws(() => validateGeminiDrafts([context], bad), error => error.message.includes('outside-slot words') && error.message.includes(word));
    }
  }
});

test('recipient describes the purchase and the experience remains a separate final clause', () => {
  const allContexts = buildReviewContexts({ research });
  for (const language of ['en', 'hi', 'gu']) {
    const context = allContexts.find(item => item.language === language);
    const manifest = makePovManifest([context]);
    const original = manifest.entries[0].text;
    const link = { en: 'for [recipient]', hi: '[recipient] ke liye', gu: '[recipient] mate' }[language];
    const bad = clone(manifest);
    bad.entries[0].text = original.replace(link, '').replace('[experience]', `${link} [experience]`);
    assert.throws(() => validateGeminiDrafts([context], bad), /attach recipient/);
    bad.entries[0].text = original.replace('[experience].', '[experience] there.');
    assert.throws(() => validateGeminiDrafts([context], bad), /final experience clause/);
  }
});

test('area remains customer origin and Gujarati visit clauses do not repeat', () => {
  const contexts = buildReviewContexts({ research });
  for (const language of ['en', 'hi', 'gu']) {
    const context = contexts.find(item => item.language === language);
    const manifest = makePovManifest([context]);
    const original = manifest.entries[0].text;
    manifest.entries[0].text = language === 'en' ? original.replace('from [area:', 'in [area:')
      : original.replace(`] ${language === 'hi' ? 'se' : 'thi'}`, `] ${language === 'hi' ? 'mein' : 'ma'}`);
    assert.throws(() => validateGeminiDrafts([context], manifest), /coming from/);
    if (language === 'gu') {
      manifest.entries[0].text = original.replace('ane [experience]', 'ane jova aavyo hato ane [experience]');
      assert.throws(() => validateGeminiDrafts([context], manifest), /one clear visit/);
    }
  }
});

test('a customer experience template describes a past visit instead of a future plan', () => {
  const context = buildReviewContexts({ research }).find(item => item.language === 'en');
  const manifest = makePovManifest([context]);
  manifest.entries[0].text = manifest.entries[0].text.replace('I came', 'I plan to come');
  assert.throws(() => validateGeminiDrafts([context], manifest), /past visit/);
});

// A refresh can change grammar and wording, but not the required business context.
test('the published pool contains 500 unique validated one-sentence drafts', () => {
  assert.equal(REVIEW_CATALOG.length, 500);
  assert.equal(new Set(REVIEW_CATALOG.map(x => x.text)).size, 500);
  assert.equal(new Set(REVIEW_CATALOG.map(x => x.id)).size, 500);
  assert.deepEqual(REVIEW_CATALOG, buildReviewCatalog());
  assert.ok(Object.isFrozen(REVIEW_CATALOG));
  for (const item of REVIEW_CATALOG) assert.ok(Object.isFrozen(item));
});

test('build-time Gemini contexts are stable and uniquely identify repeated clock contexts', () => {
  const contexts = buildReviewContexts({ research });
  assert.equal(contexts.length, 500);
  assert.equal(new Set(contexts.map(item => item.contextId)).size, 500);
  assert.deepEqual(contexts, buildReviewContexts({ research }));
  assert.ok(Object.isFrozen(contexts));
  for (const context of contexts) {
    assert.ok(Object.isFrozen(context));
    assert.equal(context.business, BUSINESS_PROFILE.name);
    assert.equal(context.city, BUSINESS_PROFILE.city);
    assert.ok(Number.isInteger(context.variant));
    const identity = [context.business, context.city, context.language, context.area, context.brand, context.category, context.topic, context.variant];
    assert.equal(context.contextId, createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0, 20));
  }
});

test('category and language coverage follows the supplied business mix', () => {
  for (const records of [REVIEW_CATALOG, buildReviewContexts({ research })]) {
    assert.deepEqual(countBy(records, 'category'), { women: 270, men: 180, clock: 50 });
    assert.deepEqual(countBy(records, 'language'), { en: 200, hi: 150, gu: 150 });
    for (const category of BUSINESS_PROFILE.categories) {
      for (const [language, count] of Object.entries(category.languages)) {
        assert.equal(records.filter(x => x.category === category.id && x.language === language).length, count);
      }
    }
  }
});

test('each concise Roman draft names one area, one approved brand and one category topic', () => {
  for (const record of REVIEW_CATALOG) {
    const text = record.text.toLowerCase();
    assert.ok(text.includes('ambika watch & gift'));
    assert.ok(text.includes('surat'));
    assert.ok(text.includes(record.keyword.toLowerCase()));
    const selected = research.selectedKeywords.filter(x => x.category === record.category).map(x => x.phrase || x.term);
    assert.ok(selected.includes(record.topic), `Unknown source topic ${record.topic}`);
    if (record.generator === 'google-gemini') {
      assert.ok(text.includes(record.categoryPhrase.toLowerCase()));
      assert.match(record.contextId, /^[a-f0-9]{20}$/);
      if (record.language === 'en') assert.ok(record.text.indexOf(record.area) < record.text.indexOf(record.brand), 'English catchment must appear before the product');
    } else {
      assert.ok(text.includes(record.topic.toLowerCase()));
      assert.equal(record.keyword, BUSINESS_PROFILE.keywords[record.language]);
    }
    assert.match(record.text, /[.!?]$/);
    assert.equal(record.text.match(/[.!?]/g)?.length, 1, record.text);
    assert.deepEqual(record.text.match(entities(BUSINESS_PROFILE.servingAreas)), [record.area]);
    assert.deepEqual(record.text.match(entities(BRAND_NAMES)), [record.brand]);
    assert.ok(BRAND_NAMES.includes(record.brand));
    if (record.category === 'clock') assert.equal(record.brand, 'Onex');
    assert.ok(record.text.split(/\s+/u).length <= 50, record.text);
    assert.ok(record.text.length <= 400);
    assert.doesNotMatch(record.text, /[\u0900-\u097f\u0a80-\u0aff]/u);
  }
  assert.deepEqual(new Set(REVIEW_CATALOG.filter(x => x.category !== 'clock').map(x => x.brand)), new Set(BRAND_NAMES));
});

test('Gemini full sentences can render a natural singular category without literal keyword stitching', () => {
  const contexts = buildReviewContexts({ research });
  const manifest = makeManifest(contexts);
  const context = contexts[0];
  manifest.entries[0] = {
    contextId: context.contextId,
    categoryPhrase: 'ladies watch',
    text: `${context.area} se ${context.brand} ladies watch dekh rahe log ${context.business}, ${context.city} ko apni watch shopping mein shamil kar sakte hain.`,
  };
  for (const language of ['hi', 'gu']) {
    const index = contexts.findIndex(item => item.language === language && item.category === 'women');
    const nativeContext = contexts[index];
    manifest.entries[index] = {
      contextId: nativeContext.contextId,
      categoryPhrase: 'ladies watch',
      text: language === 'hi'
        ? `${nativeContext.area} se ${nativeContext.brand} ladies watch dhoondh rahe hon to ${nativeContext.business}, ${nativeContext.city} ka naam dekh sakte hain.`
        : `${nativeContext.area} thi ${nativeContext.brand} ladies watch shodhta ho to ${nativeContext.business}, ${nativeContext.city} ne dhyan ma lai shakay.`,
    };
  }
  for (const language of ['en', 'hi', 'gu']) {
    const index = contexts.findIndex(item => item.language === language && item.category === 'women' && item.variant === 1);
    const buyerContext = contexts[index];
    const texts = {
      en: `Shoppers in ${buyerContext.area} interested in a ${buyerContext.brand} ladies watch can consider ${buyerContext.business} in ${buyerContext.city}.`,
      hi: `Agar aap ${buyerContext.area} mein ${buyerContext.brand} ladies watch dekh rahe hon to ${buyerContext.business}, ${buyerContext.city} ka naam dekh sakte hain.`,
      gu: `Jo tame ${buyerContext.area} ma ${buyerContext.brand} ladies watch shodhta ho to ${buyerContext.business}, ${buyerContext.city} ne dhyan ma lai shako.`,
    };
    manifest.entries[index] = { contextId: buyerContext.contextId, categoryPhrase: 'ladies watch', text: texts[language] };
  }
  const beforeBrandIndex = contexts.findIndex(item => item.language === 'en' && item.category === 'women' && item.variant === 2);
  const beforeBrandContext = contexts[beforeBrandIndex];
  manifest.entries[beforeBrandIndex] = {
    contextId: beforeBrandContext.contextId,
    categoryPhrase: 'ladies watch',
    text: `If you are from ${beforeBrandContext.area} and looking for a ${beforeBrandContext.brand} ladies watch, ${beforeBrandContext.business} in ${beforeBrandContext.city} is an option.`,
  };
  const entries = validateGeminiDrafts(contexts, manifest);
  const catalog = buildReviewCatalog({ research, generated: manifest });
  assert.equal(entries.length, 500);
  assert.equal(catalog.length, 500);
  assert.equal(catalog[0].text, manifest.entries[0].text);
  assert.equal(catalog[0].categoryPhrase, 'ladies watch');
  assert.equal(catalog[0].keyword, 'ladies watch');
  assert.equal(catalog[0].topic, context.topic);
  assert.equal(catalog[0].generator, 'google-gemini');
  assert.ok(!catalog[0].text.includes(context.topic));
  assert.ok(!catalog[0].text.includes('watch shop in Surat'));
});

test('Gemini output must cover all contexts with valid provenance and unique text', () => {
  const contexts = buildReviewContexts({ research });
  const manifest = makeManifest(contexts);
  for (const change of [
    data => { data.entries.pop(); },
    data => { data.entries[1].contextId = data.entries[0].contextId; },
    data => { data.entries[0].contextId = 'unknown'; },
    data => { data.contextHash = '0'.repeat(64); },
    data => { data.provider = 'not-gemini'; },
    data => { data.model = ''; },
    data => { data.generatedAt = 'not-a-date'; },
  ]) {
    const bad = clone(manifest); change(bad);
    assert.throws(() => validateGeminiDrafts(contexts, bad));
    assert.throws(() => buildReviewCatalog({ research, wording, generated: bad }), 'invalid generated data must never fall back to old wording');
  }
  const first = contexts.findIndex(item => item.category === 'clock' && item.language === 'en');
  const repeated = contexts.findIndex((item, index) => index > first && item.category === contexts[first].category && item.language === contexts[first].language && item.area === contexts[first].area && item.topic === contexts[first].topic);
  assert.ok(repeated > first);
  const duplicate = clone(manifest);
  duplicate.entries[repeated].text = duplicate.entries[first].text;
  assert.throws(() => validateGeminiDrafts(contexts, duplicate), /unique full sentences/);
});

test('mixed Gemini provenance reports exactly the models used by each accepted sentence', () => {
  const contexts = buildReviewContexts({ research });
  const manifest = makeManifest(contexts);
  manifest.entries[1].model = 'gemini-3.1-flash-lite';
  manifest.modelsUsed = ['gemini-3.1-flash-lite', 'gemini-2.5-flash'];
  const normalized = validateGeminiDrafts(contexts, manifest);
  assert.equal(normalized[0].model, 'gemini-2.5-flash');
  assert.equal(normalized[1].model, 'gemini-3.1-flash-lite');
  const catalog = buildReviewCatalog({ research, generated: manifest });
  assert.equal(catalog[0].generatorModel, 'gemini-2.5-flash');
  assert.equal(catalog[1].generatorModel, 'gemini-3.1-flash-lite');
  const noPrimaryUse = clone(manifest);
  noPrimaryUse.entries.forEach(entry => { entry.model = 'models/gemini-3.1-flash-lite'; });
  noPrimaryUse.modelsUsed = ['gemini-3.1-flash-lite'];
  assert.ok(validateGeminiDrafts(contexts, noPrimaryUse).every(entry => entry.model === 'gemini-3.1-flash-lite'));
  for (const change of [
    data => { data.entries[0].model = 'other-provider'; },
    data => { data.entries[0].model = ''; },
    data => { data.entries[0].model = null; },
    data => { data.modelsUsed = ['gemini-2.5-flash']; },
    data => { data.modelsUsed = ['gemini-3.1-flash-lite']; },
    data => { data.modelsUsed = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-unknown-unused']; },
    data => { data.modelsUsed = ['gemini-2.5-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite']; },
    data => { data.modelsUsed = ['models/gemini-2.5-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite']; },
    data => { data.modelsUsed = []; },
  ]) {
    const bad = clone(manifest); change(bad);
    assert.throws(() => validateGeminiDrafts(contexts, bad));
  }
});

test('Gemini output rejects wrong entities, multiple sentences, invented claims and wrong categories', () => {
  const contexts = buildReviewContexts({ research });
  const manifest = makeManifest(contexts);
  const first = manifest.entries[0];
  for (const replacement of [
    { text: first.text.replace('Casio', 'Rolex') },
    { text: first.text.replace('Varachha', 'Pune') },
    { text: first.text.replace('Surat', 'Mumbai') },
    { text: first.text.replace('Ambika Watch & Gift', 'Another Store') },
    { text: `${first.text} More watches too.` },
    { text: first.text.replace('.', ', and Timex is another option.') },
    { text: `I bought a Casio ladies watch at Ambika Watch & Gift, Surat after coming from Varachha.`, categoryPhrase: 'ladies watch' },
    { text: first.text.replace('.', ', the staff was helpful.') },
    { text: first.text.replace('.', ', all models are in stock.') },
    { text: 'Ambika Watch & Gift in Surat offers Casio ladies watches for Varachha shoppers.', categoryPhrase: 'ladies watches' },
    { text: 'Ambika Watch & Gift in Surat carries Casio ladies watches for Varachha shoppers.', categoryPhrase: 'ladies watches' },
    { text: 'Ambika Watch & Gift in Surat has Casio ladies watches for women if you are from Varachha.', categoryPhrase: 'ladies watches for women' },
    { text: 'Ambika Watch & Gift in Surat has a Casio ladies watch for shoppers from Varachha.', categoryPhrase: 'ladies watch' },
    { text: 'Ambika Watch & Gift in Surat is a watch shop for Casio ladies watches from Varachha.', categoryPhrase: 'ladies watches' },
    { text: 'Ambika Watch & Gift in Surat is a watch shop for Casio ladies watches from Varachha.', categoryPhrase: 'ladies watch' },
    { text: 'If you are considering Casio ladies watches from Varachha, Ambika Watch & Gift in Surat is an option.', categoryPhrase: 'ladies watches' },
    { text: 'Varachha se Casio ladies watches ke liye Ambika Watch & Gift, Surat par models uplabdh hain.', categoryPhrase: 'ladies watches' },
    { text: 'Varachha se Casio ladies watches ke liye Ambika Watch & Gift, Surat par models milti hain.', categoryPhrase: 'ladies watches' },
    { text: 'Varachha thi Casio ladies watches mate Ambika Watch & Gift, Surat par models male chhe.', categoryPhrase: 'ladies watches' },
    { text: 'Ambika Watch & Gift in Varachha, Surat is an option for shoppers considering Casio ladies watches.', categoryPhrase: 'ladies watches' },
    { text: 'Ambika Watch & Gift near Varachha, Surat is an option for shoppers considering Casio ladies watches.', categoryPhrase: 'ladies watches' },
    { text: 'Varachha mein Ambika Watch & Gift, Surat Casio ladies watches ke liye ek option hai.', categoryPhrase: 'ladies watches' },
    { text: 'Varachha ma Ambika Watch & Gift, Surat Casio ladies watches mate ek option chhe.', categoryPhrase: 'ladies watches' },
    { text: 'Ambika Watch & Gift in Surat, Varachha is an option for Casio ladies watches.', categoryPhrase: 'ladies watches' },
    { text: 'Surat ke Varachha mein Ambika Watch & Gift par Casio ladies watches ki baat ho sakti hai.', categoryPhrase: 'ladies watches' },
    { text: 'For Casio ladies watches, Ambika Watch & Gift is the shop located in Varachha, Surat.', categoryPhrase: 'ladies watches' },
    { text: first.text.replace('.', ', a good place.') },
    { text: first.text.replace('.', ', a great place.') },
    { text: first.text.replace('.', ', a well-known destination.') },
    { text: first.text.replace('.', ', a popular destination.') },
    { text: first.text.replace('.', ', undetectable human-written review.') },
    { text: first.text.replace('ladies watches', "men's watches"), categoryPhrase: "men's watches" },
    { text: first.text.replace('.', ', with wall clocks too.') },
    { categoryPhrase: 'missing ladies watch' },
    { text: first.text.replace('.', ', ખરીદ્યું.') },
  ]) {
    const bad = clone(manifest); Object.assign(bad.entries[0], replacement);
    assert.throws(() => validateGeminiDrafts(contexts, bad), JSON.stringify(replacement));
  }
  const clockIndex = contexts.findIndex(item => item.language === 'en' && item.category === 'clock' && item.area === 'Katargam');
  const clockContext = contexts[clockIndex];
  const ambiguousRoom = clone(manifest);
  ambiguousRoom.entries[clockIndex] = {
    contextId: clockContext.contextId,
    categoryPhrase: 'wall clock',
    text: `If you seek an ${clockContext.brand} wall clock for a living room from ${clockContext.area}, ${clockContext.business} in ${clockContext.city} is an option.`,
  };
  assert.throws(() => validateGeminiDrafts(contexts, ambiguousRoom), /catchment area before the brand/);
});

test('invalid source topics fail before generated copy can be published', () => {
  for (const change of [
    data => { data.selectedKeywords = data.selectedKeywords.filter(x => x.category !== 'clock'); },
    data => { data.selectedKeywords[0].term = 'Casio ladies watches'; },
    data => { data.selectedKeywords[0].phrase = 'ladies watches. Five stars'; },
    data => { data.selectedKeywords[0].phrase = 'best ladies watches'; },
    data => { data.selectedKeywords[0].phrase = 'mens watches'; },
    data => { data.selectedKeywords[0].sourceType = 'invented-trend'; },
    data => { data.selectedKeywords[0].sourceType = 'google-trends'; data.selectedKeywords[0].sourceUrl = 'https://example.com/'; },
  ]) {
    const bad = clone(research); change(bad);
    assert.throws(() => buildReviewContexts({ research: bad }));
  }
});

test('evergreen fallback topics work without inventing a retrieved Google source', () => {
  const fallbackResearch = {
    ...research,
    selectedKeywords: [
      { category: 'women', term: 'ladies watches', sourceType: 'evergreen', sourceUrl: null, retrievedAt: null },
      { category: 'men', term: 'gents watches', sourceType: 'evergreen', sourceUrl: null, retrievedAt: null },
      { category: 'clock', term: 'wall clocks', sourceType: 'evergreen', sourceUrl: null, retrievedAt: null },
    ],
  };
  const contexts = buildReviewContexts({ research: fallbackResearch });
  const catalog = buildReviewCatalog({ research: fallbackResearch, generated: makeManifest(contexts) });
  assert.equal(catalog.length, 500);
  assert.equal(new Set(catalog.map(item => item.text)).size, 500);
  assert.deepEqual(new Set(catalog.map(item => item.topic)), new Set(['ladies watches', 'gents watches', 'wall clocks']));
  for (const provenance of [
    { sourceUrl: 'https://suggestqueries.google.com/', retrievedAt: null },
    { sourceUrl: null, retrievedAt: research.researchedAt },
    { sourceUrl: undefined, retrievedAt: null },
  ]) {
    const bad = clone(fallbackResearch);
    Object.assign(bad.selectedKeywords[0], provenance);
    assert.throws(() => buildReviewContexts({ research: bad }), /Evergreen keyword/);
  }
});

test('a Google Trends label requires the literal keyword in observed data and entry evidence', () => {
  const verified = clone(research);
  const entry = verified.selectedKeywords[0];
  entry.sourceType = 'google-trends';
  entry.sourceUrl = 'https://trends.google.com/trending/rss?geo=IN';
  entry.evidence = { term: entry.term.toUpperCase() };
  verified.trends.observed = [{ term: entry.term.toUpperCase() }];
  assert.equal(buildReviewContexts({ research: verified }).length, 500);
  for (const change of [
    data => { delete data.selectedKeywords[0].evidence; },
    data => { data.selectedKeywords[0].evidence.term = 'unrelated news'; },
    data => { data.trends.observed = []; },
    data => { data.trends.observed = [{ term: 'unrelated news' }]; },
    data => { delete data.selectedKeywords[0].evidence; data.trends.observed = []; },
  ]) {
    const bad = clone(verified); change(bad);
    assert.throws(() => buildReviewContexts({ research: bad }), /matching literal observed and entry evidence/);
  }
});

test('selection reaches both catalog ends and excludes both the last page and last generated draft', () => {
  assert.equal(createAutomaticReviewGenerator({ random: () => 0 }).generate(), REVIEW_CATALOG[0]);
  assert.equal(createAutomaticReviewGenerator({ random: () => 0.999999 }).generate(), REVIEW_CATALOG.at(-1));
  const generator = createAutomaticReviewGenerator({ random: () => 0 });
  const previousId = REVIEW_CATALOG[0].id;
  const first = generator.generate({ previousId });
  const second = generator.generate({ previousId });
  assert.notEqual(first.id, previousId);
  assert.notEqual(second.id, previousId);
  assert.notEqual(first.id, second.id);
});
