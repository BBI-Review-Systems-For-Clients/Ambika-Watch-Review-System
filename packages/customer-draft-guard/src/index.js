/**
 * Portable, zero-dependency checks for customer-authored feedback templates.
 *
 * These checks validate syntax and unresolved fields, not the truthfulness of
 * statements. They never generate, publish, or submit customer reviews.
 */

const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;
const FIELD_TOKEN = /\[([A-Za-z][A-Za-z0-9_-]{0,63})(?:: ([^\[\]\r\n]{1,160}))?\]/gu;

export class TemplateFormatError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TemplateFormatError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new TemplateFormatError(code, message);
}

/**
 * Inspect named slots such as [experience] or [area: Varachha].
 *
 * A requiredFields list makes missing, repeated, or unexpected slots fail
 * closed. The function is independent of business names and languages.
 */
export function inspectTemplate(template, { requiredFields = [] } = {}) {
  if (typeof template !== 'string' || !template.trim()) {
    fail('INVALID_TEMPLATE', 'A nonempty template string is required.');
  }
  if (!Array.isArray(requiredFields)
    || requiredFields.some(name => typeof name !== 'string' || !FIELD_NAME.test(name))
    || new Set(requiredFields).size !== requiredFields.length) {
    fail('INVALID_FIELDS', 'Required field names must be unique identifiers.');
  }

  const fields = [];
  const seen = new Set();
  for (const match of template.matchAll(FIELD_TOKEN)) {
    const name = match[1];
    if (seen.has(name)) fail('DUPLICATE_FIELD', `Duplicate template field: ${name}`);
    seen.add(name);
    fields.push(Object.freeze({
      name,
      suggestion: match[2] ?? null,
      start: match.index,
      end: match.index + match[0].length,
    }));
  }

  // Any leftover square bracket is an incomplete, nested, or malformed slot.
  if (/[\[\]]/u.test(template.replace(FIELD_TOKEN, ''))) {
    fail('MALFORMED_FIELD', 'Template contains malformed or unbalanced brackets.');
  }
  const missing = requiredFields.filter(name => !seen.has(name));
  if (missing.length) fail('MISSING_FIELDS', `Required template fields missing: ${missing.join(', ')}`);
  if (requiredFields.length) {
    const allowed = new Set(requiredFields);
    const unexpected = fields.filter(field => !allowed.has(field.name)).map(field => field.name);
    if (unexpected.length) fail('UNEXPECTED_FIELDS', `Unexpected template fields: ${unexpected.join(', ')}`);
  }

  return Object.freeze({ fields: Object.freeze(fields), names: Object.freeze(fields.map(field => field.name)) });
}

/**
 * A conservative copy gate for an actual customer-edited draft.
 *
 * A user may legitimately write critical feedback. We never attempt to
 * enforce positive sentiment or make factual claims on the user's behalf.
 * The caller must still obtain the customer's own consent before sharing.
 */
export function checkCustomerDraft(text, { maxLength = 10000 } = {}) {
  if (!Number.isSafeInteger(maxLength) || maxLength < 1) {
    throw new TypeError('maxLength must be a positive safe integer.');
  }
  if (typeof text !== 'string') return Object.freeze({ ok: false, reason: 'invalid-input' });
  const trimmed = text.trim();
  if (!trimmed) return Object.freeze({ ok: false, reason: 'empty' });
  if (trimmed.length > maxLength) return Object.freeze({ ok: false, reason: 'too-long' });
  if (/[\[\]]/u.test(trimmed)) return Object.freeze({ ok: false, reason: 'unresolved-fields' });
  return Object.freeze({ ok: true, reason: null });
}
