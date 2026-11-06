import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { BUSINESS_PROFILE, CUSTOMER_POV_KIND, CUSTOMER_POV_SLOTS, buildReviewCatalog, buildReviewContexts, validateGeminiDrafts } from '../business-profile.js';
import { REVIEW_CATALOG } from '../review-catalog.js';
import { CATEGORY_PHRASES_BY_CATEGORY } from '../review-core.js';
import { createAutomaticReviewGenerator } from '../auto-review-generator.js';

const research = JSON.parse(await readFile(new URL('../keyword-research.json', import.meta.url), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const countBy = (records, key) => records.reduce((counts, item) => ({ ...counts, [item[key]]: (counts[item[key]] || 0) + 1 }), {});

function makeManifest(contexts) {
  return {
    schemaVersion: 2, kind: CUSTOMER_POV_KIND, provider: 'google-gemini', model: 'gemini-2.5-flash', generatedAt: '2026-11-04T00:00:00Z',
    contextHash: createHash('sha256').update(JSON.stringify(contexts)).digest('hex'),
    entries: contexts.map(context => {
      const area = `[area: ${context.area}]`;
      const product = `[category: ${context.categoryPhrase}]`;
      const englishProduct = `${/s$/.test(context.categoryPhrase) ? "" : "a "}${product}`;
      const business = `${context.business}, ${context.city}`;
      const templates = {
        en: [
          `I came from ${area} to ${business} to buy ${englishProduct} for [recipient], and [experience].`,
          `I went from ${area} to ${business} to choose ${englishProduct} for [recipient], and [experience].`,
          `From ${area}, I visited ${business} to buy ${englishProduct} for [recipient], and [experience].`,
          `I travelled from ${area} to ${business} to pick ${englishProduct} for [recipient], and [experience].`,
          `We came from ${area} to ${business} to look at ${englishProduct} for [recipient], and [experience].`,
          `We went from ${area} to ${business} to buy ${englishProduct} for [recipient], and [experience].`,
          `After coming from ${area}, I stopped at ${business} to buy ${englishProduct} for [recipient], and [experience].`,
          `From ${area}, I went to ${business} to choose ${englishProduct} for [recipient], and [experience].`,
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
          `Hu ${area} thi ${business} par [recipient] mate ${product} jova gayo hato ane [experience].`,
          `Ame [recipient] mate ${product} jova ${area} thi ${business} aavya hata ane [experience].`,
          `Hu ${area} thi ${business} ma [recipient] mate ${product} kharidva aavyo hato ane [experience].`,
        ],
      };
      return { contextId: context.contextId, categoryPhrase: context.categoryPhrase, text: templates[context.language][context.styleIndex % 8] };
    }),
  };
}

function firstContext(language = 'en') {
  return buildReviewContexts({ research }).find(context => context.language === language);
}

test('four-field schema compiles 500 unique templates with no product-brand fields or slots', () => {
  const contexts = buildReviewContexts({ research });
  const manifest = makeManifest(contexts);
  const entries = validateGeminiDrafts(contexts, manifest);
  const catalog = buildReviewCatalog({ research, generated: manifest });
  assert.equal(entries.length, 500);
  assert.equal(new Set(catalog.map(item => item.text)).size, 500);
  assert.deepEqual(CUSTOMER_POV_SLOTS, ['area', 'category', 'recipient', 'experience']);
  for (let index = 0; index < entries.length; index++) {
    assert.equal(entries[index].kind, CUSTOMER_POV_KIND);
    assert.deepEqual(entries[index].templateSlots, CUSTOMER_POV_SLOTS);
    assert.ok(Object.isFrozen(entries[index].templateSlots));
    assert.equal(entries[index].text.match(/\[[^\[\]]+\]/g)?.length, 4);
    assert.ok(entries[index].text.includes(`[area: ${contexts[index].area}]`));
    assert.ok(entries[index].text.includes(`[category: ${contexts[index].categoryPhrase}]`));
    assert.equal('brand' in catalog[index], false);
    assert.doesNotMatch(entries[index].text, /\[brand:/i);
  }
});

test('schema migration fails closed on old manifests, old metadata and extra named product text', () => {
  const contexts = [firstContext()];
  const manifest = makeManifest(contexts);
  const original = manifest.entries[0].text;
  for (const change of [
    data => { data.schemaVersion = 1; },
    data => { delete data.kind; },
    data => { data.kind = 'business-context-draft'; },
    data => { data.entries[0].brand = 'UnlistedName'; },
    data => { data.entries[0].text = original.replace('[category:', '[brand: UnlistedName] [category:'); },
    data => { data.entries[0].text = original.replace('to buy', 'to buy UnlistedName'); },
    data => { data.entries[0].categoryPhrase = 'UnlistedName ladies watch'; data.entries[0].text = original.replace(contexts[0].categoryPhrase, data.entries[0].categoryPhrase); },
  ]) {
    const bad = clone(manifest); change(bad);
    assert.throws(() => validateGeminiDrafts(contexts, bad));
    assert.throws(() => buildReviewCatalog({ research, generated: bad }));
  }
  const oldContext = { ...contexts[0], brand: 'UnlistedName' };
  const oldManifest = makeManifest([oldContext]);
  assert.throws(() => validateGeminiDrafts([oldContext], oldManifest), /generic-category schema/);
});

test('all four factual slots stay unresolved and customer feedback is never prefilled', () => {
  const contexts = [firstContext()];
  const manifest = makeManifest(contexts);
  const original = manifest.entries[0].text;
  for (const text of [
    original.replace('[recipient]', 'my papa'),
    original.replace('[experience]', 'the staff was helpful'),
    original.replace('[experience]', '[experience: good prices]'),
    original.replace('[experience]', '[experience] and it cost 2000'),
    original.replace('[recipient]', '[recipient] [recipient]'),
    original.replace('[recipient]', '[recipient'),
    original.replace('[recipient]', '[[recipient]]'),
    original.replace('[recipient]', '[unknown]'),
    original.replace('[area: Varachha]', 'Varachha'),
    original.replace('I came', 'People came'),
    original.replace('[experience]', '[experience] અને'),
    original.replace('I came', 'I’ve come'),
  ]) {
    const bad = clone(manifest); bad.entries[0].text = text;
    assert.throws(() => validateGeminiDrafts(contexts, bad), text);
  }
});

test('closed scaffold vocabulary rejects emotional feedback in all supported languages', () => {
  for (const language of ['en', 'hi', 'gu']) {
    const context = firstContext(language);
    const manifest = makeManifest([context]);
    const original = manifest.entries[0].text;
    const feedback = { en: ['loved', 'wonderful', 'delighted', 'enjoyed'], hi: ['maza', 'khush', 'zabardast'], gu: ['gamyu', 'khushi', 'jordar'] }[language];
    for (const word of feedback) {
      const bad = clone(manifest); bad.entries[0].text = `${word} ${original}`;
      assert.throws(() => validateGeminiDrafts([context], bad), error => error.message.includes('outside-slot words') && error.message.includes(word));
    }
  }
});

test('recipient attaches to the purchase before a separate final experience clause', () => {
  for (const language of ['en', 'hi', 'gu']) {
    const context = firstContext(language);
    const manifest = makeManifest([context]);
    const original = manifest.entries[0].text;
    const link = { en: 'for [recipient]', hi: '[recipient] ke liye', gu: '[recipient] mate' }[language];
    manifest.entries[0].text = original.replace(link, '').replace('[experience]', `${link} [experience]`);
    assert.throws(() => validateGeminiDrafts([context], manifest), /attach recipient/);
    manifest.entries[0].text = original.replace('[experience].', '[experience] there.');
    assert.throws(() => validateGeminiDrafts([context], manifest), /final experience clause/);
  }
});

test('area remains customer origin and a past visit is distinct from a future plan', () => {
  for (const language of ['en', 'hi', 'gu']) {
    const context = firstContext(language);
    const manifest = makeManifest([context]);
    const original = manifest.entries[0].text;
    manifest.entries[0].text = language === 'en' ? original.replace('from [area:', 'in [area:')
      : original.replace(`] ${language === 'hi' ? 'se' : 'thi'}`, `] ${language === 'hi' ? 'mein' : 'ma'}`);
    assert.throws(() => validateGeminiDrafts([context], manifest), /coming from/);
    if (language === 'en') {
      manifest.entries[0].text = original.replace('I came', 'I plan to come');
      assert.throws(() => validateGeminiDrafts([context], manifest), /past visit/);
    }
    if (language === 'gu') {
      manifest.entries[0].text = original.replace('ane [experience]', 'ane jova aavyo hato ane [experience]');
      assert.throws(() => validateGeminiDrafts([context], manifest), /one clear visit/);
    }
  }
});

test('assigned category and article agreement survive singular and plural wording', () => {
  const contexts = buildReviewContexts({ research });
  const plural = contexts.find(context => context.language === 'en' && context.categoryPhrase === 'ladies watches');
  const manifest = makeManifest([plural]);
  assert.equal(validateGeminiDrafts([plural], manifest).length, 1);
  manifest.entries[0].text = manifest.entries[0].text.replace('buy [category:', 'buy a [category:');
  assert.throws(() => validateGeminiDrafts([plural], manifest), /article\/category-number/);
  const singular = firstContext();
  const bad = makeManifest([singular]);
  bad.entries[0].text = bad.entries[0].text.replace('buy a [category:', 'buy an [category:');
  assert.throws(() => validateGeminiDrafts([singular], bad), /article\/category-number/);
  bad.entries[0].categoryPhrase = 'gents watch';
  assert.throws(() => validateGeminiDrafts([singular], bad), /assigned generic/);
});

test('English browsing refers to plural items while a singular item is checked or chosen', () => {
  const contexts=buildReviewContexts({research});
  const singular=contexts.find(c=>c.language==='en'&&c.categoryPhrase==='ladies watch');
  const one=makeManifest([singular]);one.entries[0].text=one.entries[0].text.replace('to buy a','to browse a');
  assert.throws(()=>validateGeminiDrafts([singular],one),/singular-item wording/);
  one.entries[0].text=one.entries[0].text.replace('to browse a','to check a');
  assert.equal(validateGeminiDrafts([singular],one).length,1);
  const plural=contexts.find(c=>c.language==='en'&&c.categoryPhrase==='ladies watches');
  const many=makeManifest([plural]);many.entries[0].text=many.entries[0].text.replace('to buy','to browse');
  assert.equal(validateGeminiDrafts([plural],many).length,1);
});

test('Hindi arrival agrees with its speaker and Gujarati arrival is not repeated as a gerund', () => {
  const hi=firstContext('hi');const h=makeManifest([hi]);
  h.entries[0].text=h.entries[0].text.replace('aaya tha','pahunche');
  assert.throws(()=>validateGeminiDrafts([hi],h),/singular main/);
  h.entries[0].text=h.entries[0].text.replace('Main','Hum');
  assert.equal(validateGeminiDrafts([hi],h).length,1);
  const gu=firstContext('gu');const g=makeManifest([gu]);
  g.entries[0].text=g.entries[0].text.replace(`${gu.business}, ${gu.city}`,`${gu.business}, ${gu.city} aavine`);
  assert.throws(()=>validateGeminiDrafts([gu],g),/repeat arrival/);
});

test('generated grammar keeps shopper origin, recipient and buying purpose attached correctly', () => {
  const en = firstContext();
  const manifest = makeManifest([en]);
  const original = manifest.entries[0].text;
  for (const text of [original.replace('came from','stopped from'), original.replace('came from','visited from'), original.replace('buy a [category:','buy [category:')]) {
    manifest.entries[0].text=text;
    assert.throws(()=>validateGeminiDrafts([en],manifest));
  }
  manifest.entries[0].text=original.replace('came from','arrived from');
  assert.throws(()=>validateGeminiDrafts([en],manifest),/arrival uses at/);
  manifest.entries[0].text=original.replace('came from','arrived from').replace(`] to ${en.business}`, `] at ${en.business}`);
  assert.equal(validateGeminiDrafts([en],manifest).length,1);
  manifest.entries[0].text=`For [recipient], ${original.replace(' for [recipient]', '')}`;
  assert.equal(validateGeminiDrafts([en],manifest).length,1);
  manifest.entries[0].text=`I came from [area: ${en.area}] to ${en.business}, ${en.city} to look for [recipient] a [category: ${en.categoryPhrase}] and [experience].`;
  assert.throws(()=>validateGeminiDrafts([en],manifest),/recipient/);
  const hi=firstContext('hi');
  const hiManifest=makeManifest([hi]);
  hiManifest.entries[0].text=hiManifest.entries[0].text.replace('lene','').replace('aaya tha','chuna');
  assert.throws(()=>validateGeminiDrafts([hi],hiManifest),/past arrival/);
  const gu=firstContext('gu');
  const guManifest=makeManifest([gu]);
  guManifest.entries[0].text=`Hu [area: ${gu.area}] thi ${gu.business}, ${gu.city} aavyo hato ane [recipient] mate [category: ${gu.categoryPhrase}] leva ane [experience].`;
  assert.throws(()=>validateGeminiDrafts([gu],guManifest),/complete shopping-purpose/);
});

test('context identities deterministically distribute generic phrases and neutral style hints', () => {
  const contexts = buildReviewContexts({ research });
  assert.equal(contexts.length, 500);
  assert.equal(new Set(contexts.map(context => context.contextId)).size, 500);
  assert.deepEqual(contexts, buildReviewContexts({ research }));
  for (const context of contexts) {
    assert.ok(Object.isFrozen(context));
    assert.equal('brand' in context, false);
    const identity = [context.business, context.city, context.language, context.area, context.category, context.topic, context.variant, context.categoryPhrase, context.styleIndex];
    assert.equal(context.contextId, createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0, 20));
    assert.equal(context.categoryPhrase, CATEGORY_PHRASES_BY_CATEGORY[context.category][Math.floor(context.variant / 4) % CATEGORY_PHRASES_BY_CATEGORY[context.category].length]);
    assert.equal(context.styleIndex, Math.floor(context.variant / (4 * CATEGORY_PHRASES_BY_CATEGORY[context.category].length)));
  }
});

test('category and language coverage preserves the supplied business mix', () => {
  const contexts = buildReviewContexts({ research });
  assert.deepEqual(countBy(contexts, 'category'), { women: 270, men: 180, clock: 50 });
  assert.deepEqual(countBy(contexts, 'language'), { en: 200, hi: 150, gu: 150 });
  for (const category of BUSINESS_PROFILE.categories) {
    for (const [language, count] of Object.entries(category.languages)) {
      assert.equal(contexts.filter(context => context.category === category.id && context.language === language).length, count);
    }
  }
});

test('invalid provenance, duplicate identities and duplicate full sentences fail without fallback', () => {
  const contexts = buildReviewContexts({ research });
  const manifest = makeManifest(contexts);
  for (const change of [
    data => { data.entries.pop(); },
    data => { data.entries[1].contextId = data.entries[0].contextId; },
    data => { data.entries[0].contextId = 'unknown'; },
    data => { data.contextHash = '0'.repeat(64); },
    data => { data.provider = 'other-provider'; },
    data => { data.model = ''; },
    data => { data.generatedAt = 'not-a-date'; },
  ]) {
    const bad = clone(manifest); change(bad);
    assert.throws(() => validateGeminiDrafts(contexts, bad));
    assert.throws(() => buildReviewCatalog({ research, generated: bad }));
  }
  const repeated = contexts.findIndex((context, index) => index > 0 && context.language === contexts[0].language && context.area === contexts[0].area && context.categoryPhrase === contexts[0].categoryPhrase);
  const duplicate = clone(manifest);
  duplicate.entries[repeated].text = duplicate.entries[0].text;
  assert.throws(() => validateGeminiDrafts(contexts, duplicate), /unique full sentences/);
});

test('mixed model provenance exactly matches actual entry models', () => {
  const contexts = buildReviewContexts({ research });
  const manifest = makeManifest(contexts);
  manifest.entries[1].model = 'gemini-3.1-flash-lite';
  manifest.modelsUsed = ['gemini-2.5-flash', 'gemini-3.1-flash-lite'];
  const entries = validateGeminiDrafts(contexts, manifest);
  assert.equal(entries[1].model, 'gemini-3.1-flash-lite');
  const catalog = buildReviewCatalog({ research, generated: manifest });
  assert.equal(catalog[1].generatorModel, 'gemini-3.1-flash-lite');
  for (const change of [
    data => { data.entries[0].model = 'other-provider'; },
    data => { data.entries[0].model = null; },
    data => { data.modelsUsed = ['gemini-2.5-flash']; },
    data => { data.modelsUsed = ['gemini-3.1-flash-lite']; },
    data => { data.modelsUsed = ['gemini-2.5-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite']; },
  ]) {
    const bad = clone(manifest); change(bad);
    assert.throws(() => validateGeminiDrafts(contexts, bad));
  }
});

test('keyword selection rejects named products, unsupported claims, wrong categories and invented sources', () => {
  for (const change of [
    data => { data.selectedKeywords = data.selectedKeywords.filter(entry => entry.category !== 'clock'); },
    data => { data.selectedKeywords[0].term = 'UnlistedName ladies watches'; },
    data => { data.selectedKeywords[0].phrase = 'ladies watches. Five stars'; },
    data => { data.selectedKeywords[0].phrase = 'best ladies watches'; },
    data => { data.selectedKeywords[0].phrase = 'mens watches'; },
    data => { data.selectedKeywords[0].sourceType = 'invented-trend'; },
  ]) {
    const bad = clone(research); change(bad);
    assert.throws(() => buildReviewContexts({ research: bad }));
  }
});

test('evergreen fallback topics do not invent retrieved source provenance', () => {
  const fallbackResearch = { ...research, selectedKeywords: [
    { category: 'women', term: 'ladies watches', sourceType: 'evergreen', sourceUrl: null, retrievedAt: null },
    { category: 'men', term: 'gents watches', sourceType: 'evergreen', sourceUrl: null, retrievedAt: null },
    { category: 'clock', term: 'wall clocks', sourceType: 'evergreen', sourceUrl: null, retrievedAt: null },
  ] };
  const contexts = buildReviewContexts({ research: fallbackResearch });
  assert.equal(buildReviewCatalog({ research: fallbackResearch, generated: makeManifest(contexts) }).length, 500);
  for (const provenance of [
    { sourceUrl: 'https://suggestqueries.google.com/', retrievedAt: null },
    { sourceUrl: null, retrievedAt: research.researchedAt },
    { sourceUrl: undefined, retrievedAt: null },
  ]) {
    const bad = clone(fallbackResearch); Object.assign(bad.selectedKeywords[0], provenance);
    assert.throws(() => buildReviewContexts({ research: bad }), /Evergreen keyword/);
  }
});

test('a trend label needs the same literal observed term and matching publication within 48 hours', () => {
  const verified = clone(research);
  const entry = verified.selectedKeywords[0];
  const publishedAt = new Date(Date.parse(verified.researchedAt) - 10 * 60 * 1000).toISOString();
  entry.sourceType = 'google-trends';
  entry.sourceUrl = 'https://trends.google.com/trending/rss?geo=IN';
  entry.evidence = { term: entry.term.toUpperCase(), publishedAt };
  verified.trends.observed = [{ term: entry.term.toUpperCase(), publishedAt }];
  assert.equal(buildReviewContexts({ research: verified }).length, 500);
  for (const change of [
    data => { delete data.selectedKeywords[0].evidence; },
    data => { data.selectedKeywords[0].evidence.term = 'unrelated news'; },
    data => { data.trends.observed = []; },
    data => { delete data.selectedKeywords[0].evidence.publishedAt; },
    data => { data.selectedKeywords[0].evidence.publishedAt = 'not-a-date'; },
    data => { data.selectedKeywords[0].evidence.publishedAt = new Date(Date.parse(data.researchedAt) - 49 * 60 * 60 * 1000).toISOString(); data.trends.observed[0].publishedAt = data.selectedKeywords[0].evidence.publishedAt; },
    data => { data.selectedKeywords[0].evidence.publishedAt = new Date(Date.parse(data.researchedAt) + 2 * 60 * 60 * 1000).toISOString(); data.trends.observed[0].publishedAt = data.selectedKeywords[0].evidence.publishedAt; },
    data => { data.trends.observed[0].publishedAt = new Date(Date.parse(data.researchedAt) - 11 * 60 * 1000).toISOString(); },
  ]) {
    const bad = clone(verified); change(bad);
    assert.throws(() => buildReviewContexts({ research: bad }), /matching literal observed and entry evidence/);
  }
});

test('published catalog matches current validated schema and complete business mix', () => {
  assert.equal(REVIEW_CATALOG.length, 500);
  assert.equal(new Set(REVIEW_CATALOG.map(item => item.text)).size, 500);
  assert.equal(new Set(REVIEW_CATALOG.map(item => item.id)).size, 500);
  assert.deepEqual(REVIEW_CATALOG, buildReviewCatalog());
  assert.deepEqual(countBy(REVIEW_CATALOG, 'category'), { women: 270, men: 180, clock: 50 });
  assert.deepEqual(countBy(REVIEW_CATALOG, 'language'), { en: 200, hi: 150, gu: 150 });
  for (const item of REVIEW_CATALOG) {
    assert.equal('brand' in item, false);
    assert.equal(item.templateSlots.length, 4);
    assert.ok(Object.isFrozen(item));
  }
});

test('selection reaches both catalog ends and excludes previous opaque IDs', () => {
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
