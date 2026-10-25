# Scheduled AI refresh

The user's connected ChatGPT task **Refresh Ambika review drafts** is enabled every **15 days**, starting **4 November 2026 (UTC)**. It researches Google keyword evidence, generates full sentences through the Gemini API, validates and publishes the result. The scheduler is managed in ChatGPT Tasks; cloning this repository does not create another schedule. Keep one task to avoid duplicate updates.

The public page remains a fast static page: it randomly displays a validated Gemini-written sentence on every load. It does not call an AI model, expose keys or send customer text for generation. Scheduled AI work happens separately from the customer's visit to the webpage.

## Allowed scope

- Repository: `BBI-Review-Systems-For-Clients/Ambika-Watch-Review-System`
- Stable repository ID: `1424225570`
- Branch: `main`; preserve unrelated concurrent changes and never force-push.
- Pages: https://bbi-review-systems-for-clients.github.io/Ambika-Watch-Review-System/
- Update the existing Drive ZIP, preview and notes identified in the task prompt; do not change the client's read-only source folder or any other repository.

Fetch the current repository before doing work. If identity, access or the repository ID differs, stop and report the actual failure without modifying the site.

## Research and wording

1. Read the latest `keyword-policy.json`, `keyword-research.json`, `draft-wording.json`, `business-profile.js`, `gemini-drafts.json` and `review-core.js`.
2. Research relevant terms using Google Trends India RSS and Google Autocomplete predictions; connected web search can verify official sources and additional current evidence. Keep discovery queries related to the supplied watch categories, serving areas and approved brand names. Do not send customer data.
3. Use AI to review new candidate keywords; let the Gemini maintenance step write complete context-specific sentences. Update `keyword-policy.json` with safe, unbranded category terms. `term` stores the literal observed phrase; `phrase` can use natural grammar, such as `mens watches` → `men's watches`.
4. Run `npm run research` to collect fresh evidence. A literal approved candidate appearing in the current Google Trends RSS can be labeled `google-trends`. Autocomplete results are labeled `google-autocomplete`; they do not establish search volume, growth or ranking. When no relevant trend is verified, use labeled suggestions/evergreen phrases and report that. Do not replace watch topics with unrelated trending news.
5. Run `npm run refresh:gemini`. It loads `GEMINI_API_KEY` from the private process environment or existing ignored `.env` in the maintenance checkout, sends only public business contexts, and writes `gemini-drafts.json` after all sentences validate. Node 24.5+ `--use-env-proxy` preserves the managed proxy. A sentence may render the category naturally instead of repeating an awkward literal search query. Do not rewrite/publish the old placeholder templates as if they were a successful Gemini run.
6. Keep the private credential in the maintained workspace. Never put it in GitHub source, public HTML, task prompts, logs, reports, Drive backups or `.env.example`. The already-configured private checkout is `/workspace/work/ambika-watch-review-system`; fetching current source must preserve its ignored `.env`. The GitHub integration has not granted Actions-secret installation access (HTTP 403), so do not claim a GitHub secret or Actions backend was installed. If a fresh environment lacks a private credential, report the blocked API refresh and preserve published data; do not fetch credentials from old chat text.
7. `work/gemini-checkpoint.json` stores only accepted draft content and context/model hashes, no key. The refresh command resumes compatible rows and repairs only invalid outputs. API or validation failures leave the published manifest/catalog unchanged; re-run after fixing the cause rather than distributing partial results.

Every generated suggestion must contain exactly one supplied serving area and one approved brand with one category/topic. Use Onex for wall-clock drafts; the approved watch list remains in `review-core.js`. Refer to shopper interest, without claiming a current stock position or an actual customer's location, visit, purchase, satisfaction, service, price or rating. These remain editable suggestions. Do not conceal automation, make ranking/detection promises, select Google stars, paste into Maps or submit reviews.

Preserve all 500 unique drafts and the existing mixes: women 270, men 180, wall clocks 50; English 200, Roman Hindi 150, Roman Gujarati 150. The centered brand header and simple one-button customer flow stay intact.

## Validation and publication

Requires Node 24.5+, npm, Python 3 and authenticated GitHub access. Install development dependencies with `npm ci`.

```sh
npm run research
npm run refresh:gemini
npm run generate
npm run check
npm test
```

Inspect samples in every language and category. Check the actual keyword source records and generated output; a successful fetch alone does not establish relevance or natural wording. The tests reject malformed sources, falsely labeled trends, fabricated claims, multiple sentences, missing/duplicate entities, stale contexts, invalid model output and unsafe error reporting. A live API response is also reviewed; mocked transport tests do not establish provider availability.

Review the patch, commit only the relevant Ambika changes and push the current branch without force. Verify that Pages has actually built the new commit, then compare the served files to the checkout:

```sh
python3 scripts/verify-live.py --tests 59 --out work/delivery
python3 scripts/build-delivery.py --out work/delivery
```

Use the actual passing test count if tests change. Verification must finish successfully before distributing backups. The build script uses the local esbuild development dependency and packages tracked source files, a standalone HTML preview, notes and current live verification. Upload the three deliverables to their existing Drive file IDs from the task prompt. Preserve their sharing settings.

The connected GitHub app's normal commits already trigger the existing branch-based Pages deployment. Do not replace this with an untested workflow; commits made using a GitHub Actions `GITHUB_TOKEN` do not automatically trigger Pages builds.

If source collection, validation, access, publishing or Drive upload fails, retain the last working published data where possible and report the failed step. Do not report a completed deployment or invented keyword metrics. Send the user a short update with live URL, keyword/source changes, test count and deployment/backup status.

Sources: [Google Trending Now and RSS](https://support.google.com/trends/answer/3076011?hl=en), [Autocomplete versus Google Trends](https://support.google.com/websearch/answer/7368877?hl=en), [GitHub workflow token behavior](https://docs.github.com/en/actions/concepts/security/github_token).
