import test from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_PROFILE, buildReviewCatalog } from '../business-profile.js';
import { REVIEW_CATALOG } from '../review-catalog.js';
import { createAutomaticReviewGenerator } from '../auto-review-generator.js';

const countBy = key => REVIEW_CATALOG.reduce((counts, item) => ({ ...counts, [item[key]]: (counts[item[key]] || 0) + 1 }), {});

test('the published pool contains 500 unique, deterministic full drafts', () => {
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

test('every concise Roman-script draft contains the business, local keyword and category', () => {
  for (const record of REVIEW_CATALOG) {
    const text = record.text.toLowerCase();
    assert.ok(text.includes('ambika watch & gift'));
    assert.ok(text.includes('surat'));
    assert.ok(text.includes(record.keyword.toLowerCase()), record.id);
    assert.ok(text.includes(record.topic.toLowerCase()), record.id);
    assert.equal(record.keyword, BUSINESS_PROFILE.keywords[record.language]);
    assert.ok(record.text.split(/\s+/u).length <= 50, record.text);
    assert.ok(record.text.length < 1000);
    assert.doesNotMatch(record.text, /[\u0900-\u097f\u0a80-\u0aff]/u);
  }
});

test('drafts omit the rejected area advice, brand enquiries and invented customer experiences', () => {
  for (const { text } of REVIEW_CATALOG) {
    assert.doesNotMatch(text, /\b(I |my |bought|purchased|visited|maine|mera|maro|lidhu|lidhi|kharid|khareed)|five.star|5.star|helpful staff|best watch|in stock|available now|branch|guaranteed|genuine|authentic|discount|satisfied|excellent|amazing/i);
    assert.doesNotMatch(text, /shortlist|visit plan|planning a visit|check current|current options|availability|enquir|shoppers|compare|can help|check kari|pooch|puchhi/i);
    for (const area of BUSINESS_PROFILE.servingAreas) assert.ok(!text.includes(area));
    assert.doesNotMatch(text, /Casio|Titan|Onex|Fossil|Tommy Hilfiger/);
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
