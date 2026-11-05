import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectTemplate, checkCustomerDraft, TemplateFormatError } from '../src/index.js';

const requiredFields = ['area', 'brand', 'category', 'recipient', 'experience'];
const example = 'Main [area: Varachha] se [recipient] ke liye [brand: Casio] [category: ladies watch] lene gaya tha aur [experience].';

test('inspects five fields without identifying real customer details', () => {
  const result = inspectTemplate(example, { requiredFields });
  assert.deepEqual(result.names, ['area', 'recipient', 'brand', 'category', 'experience']);
  assert.equal(result.fields[0].suggestion, 'Varachha');
  assert.equal(result.fields[1].suggestion, null);
  assert.equal(example.slice(result.fields[2].start, result.fields[2].end), '[brand: Casio]');
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.fields));
  assert.ok(Object.isFrozen(result.fields[0]));
});

test('accepts Unicode language-neutral template values', () => {
  const result = inspectTemplate('હું [area: રાજકોટ] થી આવ્યો અને [experience].', { requiredFields: ['area', 'experience'] });
  assert.equal(result.fields[0].suggestion, 'રાજકોટ');
});

test('rejects missing, duplicate, unexpected and malformed fields', () => {
  const failures = [
    ['Hi [a] [a].', 'DUPLICATE_FIELD'],
    ['Hi [a].', 'MISSING_FIELDS', ['a', 'b']],
    ['Hi [a] [unexpected].', 'UNEXPECTED_FIELDS', ['a']],
    ['Hi [[a]].', 'MALFORMED_FIELD'],
    ['Hi [a.', 'MALFORMED_FIELD'],
    ['Hi a].', 'MALFORMED_FIELD'],
    ['Hi [a: ].', 'MALFORMED_FIELD'],
    ['Hi [a: line\nbreak].', 'MALFORMED_FIELD'],
  ];
  for (const [template, code, required] of failures) {
    assert.throws(() => inspectTemplate(template, { requiredFields: required ?? [] }), error => error instanceof TemplateFormatError && error.code === code, template);
  }
});

test('rejects invalid required fields', () => {
  for (const fields of [['a', 'a'], ['with space'], [1], 'area']) {
    assert.throws(() => inspectTemplate('[area]', { requiredFields: fields }), error => error.code === 'INVALID_FIELDS');
  }
});

test('copy gate rejects empty and unresolved text, but allows honest criticism', () => {
  assert.deepEqual(checkCustomerDraft('  '), { ok: false, reason: 'empty' });
  assert.deepEqual(checkCustomerDraft(null), { ok: false, reason: 'invalid-input' });
  assert.deepEqual(checkCustomerDraft(example), { ok: false, reason: 'unresolved-fields' });
  assert.deepEqual(checkCustomerDraft('I visited and the service was poor.'), { ok: true, reason: null });
  assert.deepEqual(checkCustomerDraft('મને સેવા પસંદ નહોતી.'), { ok: true, reason: null });
});

test('copy gate rejects texts beyond the caller limit and invalid limits', () => {
  assert.deepEqual(checkCustomerDraft('Long draft', { maxLength: 4 }), { ok: false, reason: 'too-long' });
  assert.throws(() => checkCustomerDraft('Text', { maxLength: 0 }), TypeError);
  assert.throws(() => checkCustomerDraft('Text', { maxLength: NaN }), TypeError);
});
