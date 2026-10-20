# Scheduled AI refresh

The user's connected ChatGPT task **Refresh Ambika review drafts** is enabled every **15 days**, starting **4 November 2026 (UTC)**. It researches Google keyword evidence, rewrites approved sentence templates with AI, validates and publishes the result. The scheduler is managed in ChatGPT Tasks; cloning this repository does not create another schedule. Keep one task to avoid duplicate updates.

The public page remains a fast static page: it randomly displays a prepared complete draft on every load. It does not call an AI model, expose keys or send customer text for generation. Scheduled AI work happens separately from the customer's visit to the webpage.

## Allowed scope

- Repository: `BBI-Review-Systems-For-Clients/Ambika-Watch-Review-System`
- Stable repository ID: `1424225570`
- Branch: `main`; preserve unrelated concurrent changes and never force-push.
- Pages: https://bbi-review-systems-for-clients.github.io/Ambika-Watch-Review-System/
- Update the existing Drive ZIP, preview and notes identified in the task prompt; do not change the client's read-only source folder or any other repository.

Fetch the current repository before doing work. If identity, access or the repository ID differs, stop and report the actual failure without modifying the site.

## Research and wording

1. Read the latest `keyword-policy.json`, `keyword-research.json`, `draft-wording.json`, `business-profile.js` and `review-core.js`.
2. Research relevant terms using Google Trends India RSS and Google Autocomplete predictions; connected web search can verify official sources and additional current evidence. Keep discovery queries related to the supplied watch categories, serving areas and approved brand names. Do not send customer data.
3. Use AI to review new candidate keywords and rewrite the sentence templates. Update `keyword-policy.json` with safe, unbranded category terms. `term` stores the literal observed phrase; `phrase` can use natural grammar, such as `mens watches` → `men's watches`.
4. Run `npm run research` to collect fresh evidence. A literal approved candidate appearing in the current Google Trends RSS can be labeled `google-trends`. Autocomplete results are labeled `google-autocomplete`; they do not establish search volume, growth or ranking. When no relevant trend is verified, use labeled suggestions/evergreen phrases and report that. Do not replace watch topics with unrelated trending news.
5. Refresh `draft-wording.json` using AI and update its `updatedAt`. Each English/Roman Hindi/Roman Gujarati template must use `{business}`, `{city}`, `{area}`, `{brand}` and `{topic}` exactly once and form exactly one sentence. Include the local `watch shop` keyword. Keep it concise and readable; no generic second sentence or second product category.

Every generated suggestion must contain exactly one supplied serving area and one approved brand with one category/topic. Use Onex for wall-clock drafts; the approved watch list remains in `review-core.js`. Refer to shopper interest, without claiming a current stock position or an actual customer's location, visit, purchase, satisfaction, service, price or rating. These remain editable suggestions. Do not conceal automation, make ranking/detection promises, select Google stars, paste into Maps or submit reviews.

Preserve all 500 unique drafts and the existing mixes: women 270, men 180, wall clocks 50; English 200, Roman Hindi 150, Roman Gujarati 150. The centered brand header and simple one-button customer flow stay intact.

## Validation and publication

Requires Node 20.19+, npm, Python 3 and authenticated GitHub access. Install development dependencies with `npm ci`.

```sh
npm run research
npm run generate
npm run check
npm test
```

Inspect samples in every language and category. Check the actual keyword source records and generated output; a successful fetch alone does not establish relevance or natural wording. The tests reject malformed sources, falsely labeled trends, fabricated claims, multiple sentences, missing/duplicate brand or area tokens, missing categories and stale catalogs.

Review the patch, commit only the relevant Ambika changes and push the current branch without force. Verify that Pages has actually built the new commit, then compare the served files to the checkout:

```sh
python3 scripts/verify-live.py --tests 39 --out work/delivery
python3 scripts/build-delivery.py --out work/delivery
```

Use the actual passing test count if tests change. Verification must finish successfully before distributing backups. The build script uses the local esbuild development dependency and packages tracked source files, a standalone HTML preview, notes and current live verification. Upload the three deliverables to their existing Drive file IDs from the task prompt. Preserve their sharing settings.

The connected GitHub app's normal commits already trigger the existing branch-based Pages deployment. Do not replace this with an untested workflow; commits made using a GitHub Actions `GITHUB_TOKEN` do not automatically trigger Pages builds.

If source collection, validation, access, publishing or Drive upload fails, retain the last working published data where possible and report the failed step. Do not report a completed deployment or invented keyword metrics. Send the user a short update with live URL, keyword/source changes, test count and deployment/backup status.

Sources: [Google Trending Now and RSS](https://support.google.com/trends/answer/3076011?hl=en), [Autocomplete versus Google Trends](https://support.google.com/websearch/answer/7368877?hl=en), [GitHub workflow token behavior](https://docs.github.com/en/actions/concepts/security/github_token).
