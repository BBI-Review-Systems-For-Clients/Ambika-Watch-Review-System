import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../review-core.js';

test('public product wording is a closed generic category vocabulary without product brands', () => {
  assert.equal('BRAND_NAMES' in core, false);
  assert.equal(core.CATEGORY_PHRASES.length, 16);
  assert.equal(new Set(core.CATEGORY_PHRASES).size, 16);
  assert.ok(Object.isFrozen(core.CATEGORY_PHRASES));
  assert.deepEqual(Object.keys(core.CATEGORY_PHRASES_BY_CATEGORY), ['women', 'men', 'clock']);
  for (const [category, phrases] of Object.entries(core.CATEGORY_PHRASES_BY_CATEGORY)) {
    assert.equal(phrases.length, category === 'clock' ? 4 : 6);
    assert.ok(Object.isFrozen(phrases));
  }
});

test('the review destination and supported languages remain fixed', () => {
  assert.deepEqual(core.LANGUAGES, ['en', 'hi', 'gu']);
  assert.equal(core.GOOGLE_REVIEW_URL, 'https://search.google.com/local/writereview?placeid=ChIJ4dkN_wJP4DsRaUIpMlm4KN8');
});
