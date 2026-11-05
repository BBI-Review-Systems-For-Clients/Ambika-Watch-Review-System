# Customer Draft Guard (experimental)

A tiny, zero-dependency JavaScript module for **customer-authored** feedback workflows.
It checks fill-in template structure and whether bracketed details remain before
copying. It works with Unicode and Romanized languages, with no API keys, network
requests, browser storage, customer data collection, or automated submissions.

This is an experimental source package within the Ambika Watch Review System
repository. **It is not published to npm**, and has no claimed downloads or
external dependents. Its current version is `0.1.0`.

## Example

```js
import { inspectTemplate, checkCustomerDraft } from './src/index.js';

const template = 'I visited [business: Local Shop] and [experience].';
const inspection = inspectTemplate(template, {
  requiredFields: ['business', 'experience'],
});
console.log(inspection.names); // ['business', 'experience']

// The application must let the actual customer edit their own words.
const customerEditedText = 'I visited Local Shop and my experience was disappointing.';
const result = checkCustomerDraft(customerEditedText);
if (result.ok) {
  // Offer a manual copy action only when the customer requests it.
}
```

## API

- `inspectTemplate(text, { requiredFields? })` checks syntax, duplicate slots,
  missing required slots, and unexpected slots. Named slots use `[field]` or
  `[field: suggested value]`; returned offsets are JavaScript string indices.
- `checkCustomerDraft(text, { maxLength? })` returns an immutable `{ ok, reason }`
  object. It rejects empty text, unresolved square brackets, and text longer
  than the configured limit (10,000 characters by default).
- `TemplateFormatError` supplies a stable `code` for syntax errors.

These are **structural safeguards only**. They cannot establish whether the
customer really visited a business, verify any claimed purchase, or authenticate
the author. Callers must obtain consent and follow the review platform's rules;
they must never treat a suggested detail as an observed fact. Do not use this
module to fabricate testimonials or automate review submissions.

## Test

From this directory, run `node --test test/*.test.js` (Node.js 20+). No
dependencies are required. Apache-2.0 licensed under the repository's root
[`LICENSE`](../../LICENSE).
