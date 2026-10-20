import test from 'node:test';
import assert from 'node:assert/strict';
import { BRAND_NAMES, GOOGLE_REVIEW_URL, LANGUAGES } from '../review-core.js';

test('verified brand spellings are unique and uncertain original names remain withheld', () => {
  assert.equal(BRAND_NAMES.length, 29);
  assert.equal(new Set(BRAND_NAMES).size, 29);
  assert.ok(Object.isFrozen(BRAND_NAMES));
  for (const brand of ['Lee Cooper', 'Emporio Armani', 'NAVIFORCE', 'REWARD', 'Canon Quartz']) assert.ok(BRAND_NAMES.includes(brand));
  for (const brand of ['Lee Copper', 'Emporia Armani', 'Navi Force', 'Rewards', 'Canon', 'Mont Beree', 'Jean Friendi', 'Hong Kong']) assert.ok(!BRAND_NAMES.includes(brand));
});

test('the review destination and supported languages remain fixed', () => {
  assert.deepEqual(LANGUAGES, ['en', 'hi', 'gu']);
  assert.equal(GOOGLE_REVIEW_URL, 'https://search.google.com/local/writereview?placeid=ChIJ4dkN_wJP4DsRaUIpMlm4KN8');
});
