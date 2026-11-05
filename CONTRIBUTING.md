# Contributing

Thanks for considering a contribution. This repository currently serves one
business, while the experimental [Customer Draft Guard](packages/customer-draft-guard/README.md)
is intended to be reusable without that business's branding.

## Get started

1. Fork the repository and create a branch describing the intended improvement.
2. Use Node.js 24.5+ and Python 3 for the full application test suite.
3. Run `npm ci`, `npm run check`, and `npm test` before a pull request.
4. For the standalone component, run
   `node --test packages/customer-draft-guard/test/*.test.js` (Node.js 20+).
5. Explain the behavior being changed, include regression tests, and link to
   reproducible evidence where appropriate.

Never commit API keys, customer information, private screenshots, real customer
reviews, or unlicensed third-party assets. Do not invent first-person
testimonials, verified purchases, ratings, stock claims, or Google search
statistics. Autocomplete suggestions must not be represented as proven search
volume or trending queries.

The existing customer-facing flow must remain customer-controlled: no fabricated
experiences, automatic star ratings, or automated Google review submissions.
The live application is deployed separately; pull requests should not change
production behavior without dedicated tests and review.

By submitting a contribution, you agree to license your contribution under the
repository's [Apache License, Version 2.0](LICENSE). Third-party trademarks
and customer-owned content are not part of the source-code license.
