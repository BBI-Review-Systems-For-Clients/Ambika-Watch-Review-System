import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewPool, createReviewGenerator } from '../review-generator.js';

const richContext = {
  product: 'gift',
  brand: 'Daniel Wellington',
  experiences: ['selection', 'staff', 'value', 'quick', 'mixed', 'improve'],
};

function assertBrief(pool) {
  for (const draft of pool) {
    assert.equal(typeof draft, 'string');
    assert.ok(draft.trim());
    assert.ok(draft.split(/\s+/u).length <= 65, draft);
    assert.ok(draft.split('.').filter(Boolean).length <= 3, draft);
  }
}

test('empty contexts offer ten neutral complete starters without invented experiences', () => {
  for (const language of ['en', 'hi', 'gu']) {
    const pool = buildReviewPool({ language });
    assert.equal(pool.length, 10);
    assert.equal(new Set(pool).size, 10);
    assertBrief(pool);
    for (const draft of pool) {
      assert.match(draft, /Ambika Watch & Gift/);
      assert.match(draft, /Surat/);
      assert.doesNotMatch(draft, /bought|purchas|quality|helpful|quick|recommend|fair prices|five.star|5.star|best|Casio|Titan|visit|mulakat|madadgar|achha|saru|jhadpi/i);
    }
  }
});

test('rich contexts create a diverse pool of up to 500 unique full drafts', () => {
  for (const language of ['en', 'hi', 'gu']) {
    const pool = buildReviewPool({ ...richContext, language });
    assert.equal(pool.length, 500);
    assert.equal(new Set(pool).size, pool.length);
    assert.ok(new Set(pool.map(draft => draft.split('.')[0])).size >= 3);
    assertBrief(pool);
    for (const draft of pool) {
      assert.match(draft, /Daniel Wellington/);
      assert.match(draft, /Ambika Watch & Gift/);
      assert.match(draft, /Surat/);
      assert.doesNotMatch(draft, /bought|purchased|stock|five.star|5.star|highly recommend|best|Katargam|Amroli/i);
    }
  }
});

test('every selected positive and critical fact survives every English variant', () => {
  for (const draft of buildReviewPool({ ...richContext, language: 'en' })) {
    assert.match(draft, /selection|collection|variety/);
    assert.match(draft, /staff|assistance/);
    assert.match(draft, /prices|value for money/);
    assert.match(draft, /quick service|prompt service|short wait/);
    assert.match(draft, /mixed/);
    assert.match(draft, /improvement|could be better/);
    assert.match(draft, /watches for gifting/);
  }
});

test('Roman Hindi and Gujarati preserve selected facts and sentiment throughout', () => {
  const expected = {
    hi: {
      selection: /collection|variety|options/, staff: /staff|madad/,
      value: /daam|keemat/, quick: /jaldi|tez|kam intezar/,
      mixed: /mila-jula|mili-juli|achhi aur kam achhi/,
      improve: /sudhar|behtar/, product: /gift dene ke liye daniel wellington ki ghadiyan/,
    },
    gu: {
      selection: /collection|variety|vikalpo/, staff: /staff|madad/,
      value: /bhav|kimat/, quick: /jhadapthi|jhadpi|ochhi rah/,
      mixed: /mishra|sari ane ochhi sari/,
      improve: /sudhar|saru thai shake/, product: /bhet aapva mate daniel wellington ni ghadiyalo/,
    },
  };
  for (const language of ['hi', 'gu']) {
    for (const draft of buildReviewPool({ ...richContext, language })) {
      assert.doesNotMatch(draft, /[\u0900-\u097f\u0a80-\u0aff]/u);
      for (const pattern of Object.values(expected[language])) assert.match(draft.toLowerCase(), pattern);
    }
  }
});

test('critical-only and mixed-only drafts never turn into praise', () => {
  for (const language of ['en', 'hi', 'gu']) {
    for (const experiences of [['mixed'], ['improve'], ['mixed', 'improve']]) {
      const pool = buildReviewPool({ language, experiences });
      assert.ok(pool.length > 1);
      for (const draft of pool) {
        assert.doesNotMatch(draft, /I liked|I appreciated|helpful|fair prices|quick service|recommend|madadgar|vajbi|jhadpi/i);
      }
    }
  }
});

test('unselected details, unknown products and unapproved brands never enter a draft', () => {
  const selectionOnly = buildReviewPool({ experiences: ['selection'], product: 'jewellery', brand: 'Rolex' });
  assert.deepEqual(selectionOnly, buildReviewPool({ experiences: ['selection'] }));
  for (const draft of selectionOnly) {
    assert.doesNotMatch(draft, /Rolex|jewellery|watches|clocks|helpful|prices|quick|bought|purchased/);
  }
  assert.deepEqual(buildReviewPool({ language: 'unknown', product: 'unknown', brand: 'unknown', experiences: ['unknown'] }), buildReviewPool());
  assert.deepEqual(buildReviewPool(null), buildReviewPool());
  for (const draft of buildReviewPool({ product: 'clock', brand: 'Onex' })) {
    assert.match(draft, /Onex wall clocks/);
    assert.doesNotMatch(draft, /bought|purchased|liked|helpful|fair prices|quick/);
  }
  for (const language of ['en', 'hi', 'gu']) {
    for (const draft of buildReviewPool({ language, brand: 'Casio' })) {
      assert.match(draft, /Casio/);
      assert.doesNotMatch(draft, /watches|clocks|ghadiyan|ghadiyalo/);
    }
  }
});

test('notes are preserved verbatim, with notes-only input returned exactly', () => {
  const notes = '  The strap was uncomfortable.\nI did not buy it.  ';
  for (const language of ['en', 'hi', 'gu']) {
    assert.deepEqual(buildReviewPool({ language, notes }), [notes]);
    assert.equal(createReviewGenerator().generate({ language, notes }), notes);
    for (const draft of buildReviewPool({ ...richContext, language, notes })) {
      assert.ok(draft.endsWith(`\n\n${notes}`));
      assert.equal(draft.split(notes).length, 2);
    }
  }
  const longNotes = 'A'.repeat(700);
  assert.deepEqual(buildReviewPool({ notes: longNotes }), [longNotes]);
});

test('random values choose actual complete draft text from the pool', () => {
  const pool = buildReviewPool(richContext);
  const first = createReviewGenerator({ random: () => 0 }).generate(richContext);
  const last = createReviewGenerator({ random: () => 0.999999 }).generate(richContext);
  assert.equal(first, pool[0]);
  assert.equal(last, pool.at(-1));
  assert.notEqual(first, last);
  assert.notEqual(first.split('.')[0], last.split('.')[0]);
});

test('all complete drafts are used before reuse and a new cycle avoids an immediate repeat', () => {
  const context = { product: 'women', brand: 'Casio' };
  const pool = buildReviewPool(context);
  const generator = createReviewGenerator({ random: () => 0 });
  const draws = Array.from({ length: pool.length }, () => generator.generate(context));
  assert.deepEqual(draws, pool);
  const next = generator.generate(context);
  assert.notEqual(next, draws.at(-1));
  assert.ok(pool.includes(next));

  const lastFirst = createReviewGenerator({ random: () => 0.999999 });
  const backwards = Array.from({ length: pool.length }, () => lastFirst.generate(context));
  assert.deepEqual(backwards, [...pool].reverse());
  assert.notEqual(lastFirst.generate(context), backwards.at(-1));
});

test('normalized contexts share nonrepeat history while separate contexts keep their own', () => {
  const generator = createReviewGenerator({ random: () => 0 });
  const first = generator.generate({ experiences: ['staff', 'selection'], language: 'en' });
  const second = generator.generate({ experiences: ['selection', 'staff', 'staff', 'unknown'] });
  assert.notEqual(first, second);
  assert.equal(generator.generate({ notes: 'My own words.' }), 'My own words.');
  assert.equal(generator.generate({ notes: 'My own words.' }), 'My own words.');
  const third = generator.generate({ language: 'unknown', experiences: ['staff', 'selection'] });
  assert.notEqual(third, first);
  assert.notEqual(third, second);
  assert.equal(createReviewGenerator({ random: () => 0 }).generate({ experiences: ['selection', 'staff'] }), first);
});
