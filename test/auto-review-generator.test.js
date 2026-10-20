import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BUSINESS_PROFILE, buildReviewCatalog } from '../business-profile.js';
import { REVIEW_CATALOG } from '../review-catalog.js';
import { BRAND_NAMES } from '../review-core.js';
import { createAutomaticReviewGenerator } from '../auto-review-generator.js';

const research = JSON.parse(await readFile(new URL('../keyword-research.json', import.meta.url), 'utf8'));
const wording = JSON.parse(await readFile(new URL('../draft-wording.json', import.meta.url), 'utf8'));
const countBy = key => REVIEW_CATALOG.reduce((counts, item) => ({ ...counts, [item[key]]: (counts[item[key]] || 0) + 1 }), {});
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const entities = values => new RegExp(`\\b(?:${values.map(escapeRegExp).sort((a, b) => b.length - a.length).join('|')})\\b`, 'gi');

// A refresh can change wording and topics, but not the required customer-facing format.
test('the published pool contains 500 unique sourced one-sentence drafts', () => {
  assert.equal(REVIEW_CATALOG.length, 500);
  assert.equal(new Set(REVIEW_CATALOG.map(x => x.text)).size, 500);
  assert.equal(new Set(REVIEW_CATALOG.map(x => x.id)).size, 500);
  assert.deepEqual(REVIEW_CATALOG, buildReviewCatalog());
  assert.ok(Object.isFrozen(REVIEW_CATALOG));
  for (const item of REVIEW_CATALOG) assert.ok(Object.isFrozen(item));
});

test('category and language coverage follows the supplied business mix', () => {
  assert.deepEqual(countBy('category'), { women: 270, men: 180, clock: 50 });
  assert.deepEqual(countBy('language'), { en: 200, hi: 150, gu: 150 });
  for (const category of BUSINESS_PROFILE.categories) {
    for (const [language, count] of Object.entries(category.languages)) {
      assert.equal(REVIEW_CATALOG.filter(x => x.category === category.id && x.language === language).length, count);
    }
  }
});

test('each concise Roman draft names one area, one approved brand and one sourced category topic', () => {
  for (const record of REVIEW_CATALOG) {
    const text = record.text.toLowerCase();
    assert.ok(text.includes('ambika watch & gift'));
    assert.ok(text.includes('surat'));
    assert.ok(text.includes(record.keyword.toLowerCase()));
    assert.ok(text.includes(record.topic.toLowerCase()));
    assert.equal(record.keyword, BUSINESS_PROFILE.keywords[record.language]);
    assert.ok(record.text.endsWith('.'));
    assert.equal(record.text.match(/[.!?]/g)?.length, 1, record.text);
    assert.deepEqual(record.text.match(entities(BUSINESS_PROFILE.servingAreas)), [record.area]);
    assert.deepEqual(record.text.match(entities(BRAND_NAMES)), [record.brand]);
    assert.ok(BRAND_NAMES.includes(record.brand));
    if (record.category === 'clock') assert.equal(record.brand, 'Onex');
    const selected = research.selectedKeywords.filter(x => x.category === record.category).map(x => x.phrase || x.term);
    assert.ok(selected.includes(record.topic), `Unknown topic ${record.topic}`);
    assert.ok(record.text.split(/\s+/u).length <= 50, record.text);
    assert.ok(record.text.length < 1000);
    assert.doesNotMatch(record.text, /[\u0900-\u097f\u0a80-\u0aff]/u);
  }
  assert.deepEqual(new Set(REVIEW_CATALOG.filter(x => x.category !== 'clock').map(x => x.brand)), new Set(BRAND_NAMES));
});

test('drafts do not invent customer experiences, current stock, ratings or extra product suffixes', () => {
  for (const { text } of REVIEW_CATALOG) {
    assert.doesNotMatch(text, /\b(I |my |bought|purchased|visited|maine|mera|maro|lidhu|lidhi|kharid|khareed)|five.star|5.star|helpful staff|best watch|in stock|available now|branch|guaranteed|genuine|authentic|discount|satisfied|excellent|amazing/i);
    assert.doesNotMatch(text, /shortlist|visit plan|planning a visit|check current|current options|availability|enquir|saath mein|sathe |bhi hain|pan chhe|wall clocks too/i);
  }
});

test('invalid refresh topics or wording fail instead of publishing unsupported copy', () => {
  const clone = value => JSON.parse(JSON.stringify(value));
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
    assert.throws(() => buildReviewCatalog({ research: bad, wording }));
  }
  for (const template of [
    '{business} is a watch shop in {city} for {area} shoppers interested in {brand} {topic}. Other watches too.',
    '{business} is a watch shop in {city} for {area} shoppers interested in {topic}.',
    '{business} is a watch shop in {city} for {area} shoppers interested in {brand} {topic} and {brand}.',
    'I bought {brand} {topic} from {business}, a watch shop in {city}, after visiting from {area}.',
  ]) {
    const bad = clone(wording); bad.templates.en[0] = template;
    assert.throws(() => buildReviewCatalog({ research, wording: bad }));
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
  const catalog = buildReviewCatalog({ research: fallbackResearch, wording });
  assert.equal(catalog.length, 500);
  assert.equal(new Set(catalog.map(item => item.text)).size, 500);
  assert.deepEqual(new Set(catalog.map(item => item.topic)), new Set(['ladies watches', 'gents watches', 'wall clocks']));
  for (const provenance of [
    { sourceUrl: 'https://suggestqueries.google.com/', retrievedAt: null },
    { sourceUrl: null, retrievedAt: research.researchedAt },
    { sourceUrl: undefined, retrievedAt: null },
  ]) {
    const bad = structuredClone(fallbackResearch);
    Object.assign(bad.selectedKeywords[0], provenance);
    assert.throws(() => buildReviewCatalog({ research: bad, wording }), /Evergreen keyword/);
  }
});

test('a Google Trends label requires the literal keyword in observed data and entry evidence', () => {
  const verified = structuredClone(research);
  const entry = verified.selectedKeywords[0];
  entry.sourceType = 'google-trends';
  entry.sourceUrl = 'https://trends.google.com/trending/rss?geo=IN';
  entry.evidence = { term: entry.term.toUpperCase() };
  verified.trends.observed = [{ term: entry.term.toUpperCase() }];
  assert.equal(buildReviewCatalog({ research: verified, wording }).length, 500);
  for (const change of [
    data => { delete data.selectedKeywords[0].evidence; },
    data => { data.selectedKeywords[0].evidence.term = 'unrelated news'; },
    data => { data.trends.observed = []; },
    data => { data.trends.observed = [{ term: 'unrelated news' }]; },
    data => { delete data.selectedKeywords[0].evidence; data.trends.observed = []; },
  ]) {
    const bad = structuredClone(verified); change(bad);
    assert.throws(() => buildReviewCatalog({ research: bad, wording }), /matching literal observed and entry evidence/);
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
