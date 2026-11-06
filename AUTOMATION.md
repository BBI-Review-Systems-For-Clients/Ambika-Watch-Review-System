# Scheduled AI refresh

The user's connected ChatGPT task **Refresh Ambika review drafts** researches Google keyword evidence, generates customer-POV templates through the Gemini API, validates and publishes the result. The scheduler is managed in ChatGPT Tasks; cloning this repository does not create another schedule. Keep one task to avoid duplicate updates.

The observed task configuration on 25 October 2026 was enabled, with timezone `Asia/Calcutta` and a flexible daily rule (`BYDAY=MO,TU,WE,TH,FR,SA,SU;BYHOUR=22;BYMINUTE=0`). This differs from the earlier requested 15-day cadence. The task had no recorded last or next run in that inspection. Do not silently replace a user's later scheduler edits or infer a completed refresh from the enabled state; inspect the task's current configuration before reporting its timing.

The public page remains a fast static page: it randomly displays a validated Gemini-written fill-in template on every load. It does not call an AI model, expose keys or send customer text for generation. Scheduled AI work happens separately from the customer's visit to the webpage.

## Allowed scope

- Repository: `BBI-Review-Systems-For-Clients/Ambika-Watch-Review-System`
- Stable repository ID: `1424225570`
- Branch: `main`; preserve unrelated concurrent changes and never force-push.
- Pages: https://bbi-review-systems-for-clients.github.io/Ambika-Watch-Review-System/
- Update the existing Drive ZIP, preview and notes identified in the task prompt; do not change the client's read-only source folder or any other repository.

Fetch the current repository before doing work. If identity, access or the repository ID differs, stop and report the actual failure without modifying the site.

## Research and wording

1. Read the latest `keyword-policy.json`, `keyword-research.json`, `draft-wording.json`, `business-profile.js`, `gemini-drafts.json` and `review-core.js`.
2. Research relevant terms using Google Trends India RSS and Google Autocomplete predictions; connected web search can verify official sources and additional current evidence. Keep discovery queries related to the supplied generic watch or wall-clock categories and serving areas. Do not send customer data.
3. Use AI to review new candidate keywords; let the Gemini maintenance step write natural first-person fill-in templates. Update `keyword-policy.json` with safe, unbranded category terms. `term` stores the literal observed phrase; `phrase` can use natural grammar, such as `mens watches` → `men's watches`. Keyword research never establishes what an individual customer purchased or experienced.
4. Run `npm run research` to collect fresh evidence. A literal approved candidate appearing in the current Google Trends RSS can be labeled `google-trends` only with a verified publication time no more than 48 hours before retrieval and no more than one hour in the future. Autocomplete results are labeled `google-autocomplete`; they do not establish search volume, growth or ranking. When no relevant trend is verified, use labeled suggestions/evergreen phrases and report that. Do not replace watch topics with unrelated trending news. Public observation lists keep approved candidate matches only: `observedCount` describes the full screened response, and `retainedCount` describes the retained prediction subset. Preserve these scope labels; an empty retained list is not an empty feed.
5. Run `npm run refresh:gemini`. It loads `GEMINI_API_KEY` from the private process environment or existing ignored `.env` in the maintenance checkout, sends only public business contexts, and writes `gemini-drafts.json` with `schemaVersion: 2` and `kind: customer-pov-template` after all templates validate. Node 24.5+ `--use-env-proxy` preserves the managed proxy. Category wording may be natural rather than an awkward literal search query. Do not substitute old shop-description output or hand-authored templates and report a successful Gemini run.
6. Keep the private credential in the maintained workspace. Never put it in GitHub source, public HTML, task prompts, logs, reports, Drive backups or `.env.example`. The already-configured private checkout is `/workspace/work/ambika-watch-review-system`; fetching current source must preserve its ignored `.env`. The GitHub integration has not granted Actions-secret installation access (HTTP 403), so do not claim a GitHub secret or Actions backend was installed. If a fresh environment lacks a private credential, report the blocked API refresh and preserve published data; do not fetch credentials from old chat text.
7. `work/gemini-checkpoint.json` stores only accepted template content, mode and context/model hashes, no key. The refresh command resumes compatible version-2 `customer-pov-template` rows and repairs only invalid outputs. Descriptive-mode and older brand-field checkpoints must not resume into this catalog. API or validation failures leave the published manifest/catalog unchanged; re-run after fixing the cause rather than distributing partial results.

A semantic failure in one batch does not discard accepted rows or prevent checking later independent batches. Publication still requires all 500 templates to validate; provider/network failures can stop the run while preserving its private checkpoint.

If a small set of rejected rows repeatedly collides with accepted wording, resume the same checkpoint with `GEMINI_BATCH_SIZE=4 npm run refresh:gemini`. This changes request grouping only; the default is 40 and the existing bounded validation accepts 1–100. Keep the same contexts and require all normal checks. A supported Flash-Lite fallback handles quota responses or primary-model unavailability after bounded retries, recording the actual model for each accepted sentence.

Every generated template is exactly one first-person sentence containing the known business name and Surat, plus exactly four unresolved bracket fields, each once: `[area: supplied area]`, `[category: categoryPhrase]`, `[recipient]` and `[experience]`. Area and category examples occur only inside their brackets. There is no brand field, and no third-party watch or clock brand name may be configured, sent as context or generated. Keep category wording inside the closed 16-phrase generic vocabulary in `review-core.js` (six women's-watch, six men's-watch and four wall-clock phrases); do not restore the removed brand list. Recipient and experience are never prefilled with a parent, friend, purchase detail, staff praise, price feedback or satisfaction. A past-visit grammatical frame is clearly marked as a template, not verified customer testimony.

Use the context's generic category-phrase hint and neutral style index for wording diversity while Gemini writes each complete sentence. Preserve exactly one category and one customer-origin area per template. Do not claim a store branch is in a serving area. The retired `draft-wording.json` bootstrap notice must not become a substitute for successful API generation.

Preserve the clearly labeled template UI with one editable textarea and no selectors. The customer replaces all bracketed details with actual facts, or removes anything inapplicable. Copy stays disabled while any `[` or `]` remains; the submit handler must independently block unresolved text before clipboard use or navigation. Do not force positive feedback, alter criticism or infer facts from a keyword. Do not conceal automation, make ranking/detection promises, select Google stars, paste into Maps or submit reviews.

Preserve all 500 unique templates and the existing context mixes: women 270, men 180, wall clocks 50; English 200, Roman Hindi 150, Roman Gujarati 150. The centered brand header and simple one-button customer flow stay intact. Do not revert to third-person shop advice during a scheduled wording refresh.

## Validation and publication

Requires Node 24.5+, npm, Python 3 and authenticated GitHub access. Install development dependencies with `npm ci`.

```sh
npm run research
npm run refresh:gemini
npm run generate
npm run check
npm test
```

Inspect samples in every language and category. Check the actual keyword source records and generated output; a successful fetch alone does not establish relevance or natural wording. The tests reject malformed sources, falsely labeled trends, ungrounded facts outside the four slots, multiple sentences, missing/duplicate slots or entities, stale contexts, invalid model output and unsafe error reporting. UI tests must cover unresolved and unmatched brackets, direct programmatic submit, and customer criticism. A live API response is also reviewed; mocked transport tests do not establish provider availability.

Review the patch, commit only the relevant Ambika changes and push the current branch without force. Verify that Pages has actually built the new commit, then compare the served files to the checkout:

```sh
python3 scripts/verify-live.py --tests <actual-passing-count> --out work/delivery
python3 scripts/build-delivery.py --out work/delivery
```

Use the actual passing test count if tests change. Verification must finish successfully before distributing backups. The build script uses the local esbuild development dependency and packages tracked source files, a standalone HTML preview, notes and current live verification. Upload the three deliverables to their existing Drive file IDs from the task prompt. Preserve their sharing settings.

The connected GitHub app's normal commits already trigger the existing branch-based Pages deployment. Do not replace this with an untested workflow; commits made using a GitHub Actions `GITHUB_TOKEN` do not automatically trigger Pages builds.

If source collection, validation, access, publishing or Drive upload fails, retain the last working published data where possible and report the failed step. Do not report a completed deployment or invented keyword metrics. Send the user a short update with live URL, keyword/source changes, test count and deployment/backup status.

Sources: [Google Trending Now and RSS](https://support.google.com/trends/answer/3076011?hl=en), [Autocomplete versus Google Trends](https://support.google.com/websearch/answer/7368877?hl=en), [GitHub workflow token behavior](https://docs.github.com/en/actions/concepts/security/github_token).
