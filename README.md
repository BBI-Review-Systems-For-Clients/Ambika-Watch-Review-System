# Ambika Watch Review System

A short mobile-friendly review page for **Ambika Watch & Gift, Surat**, in navy, red and white.

Live: https://bbi-review-systems-for-clients.github.io/Ambika-Watch-Review-System/

## Customer flow

The page opens with an editable **one-sentence customer-POV template**, clearly labeled as a template. It describes a possible visit or purchase in the first person and leaves five details in brackets: **area, brand, category, recipient and actual experience**. No language, brand, product or experience selectors are shown. The only action is **Copy & Leave Review**.

Example: “Main [area: Varachha] se [recipient] ke liye [brand: Casio] ki [category: ladies watch] lene Ambika Watch & Gift, Surat aaya tha aur [experience].”

The customer replaces **all** bracketed details with their own experience, or removes anything that does not apply. For example, the recipient could be the customer, a parent or a friend; the experience can describe staff, pricing or the overall visit, including criticism. Suggested area/brand/category values are examples, not claims about that customer. Copying is disabled while any opening or closing bracket remains, and the submit handler repeats this check before copying or navigation. The page never fills in praise, relatives or a completed purchase as facts.

One of 500 unique templates is selected automatically on page load. English, Roman Hindi and Roman Gujarati are supported. With session storage available, refresh excludes the previous template; only an opaque ID is saved, never the customer's words. Blocked storage still permits drafting, with a chance of a repeated selection. Manual edits remain intact until reload.

## Areas, brands, categories and keywords

Each generated template includes exactly one suggested area from **Varachha, Mota Varachha, Katargam or Amroli**, one suggested brand from the 29 approved names in `review-core.js`, and one category phrase. These values occur only inside editable brackets. They do not establish a customer's home area, purchase, or a store branch. **Onex** is the example brand used for wall-clock templates. Customers must use their actual product details; examples do not confirm stock.

Corrected spellings include **Lee Cooper, Emporio Armani, NAVIFORCE, REWARD** and **Canon Quartz**. Unconfirmed “Mont Beree”, “Jean Friendi” and “Hong Kong” remain withheld. No third-party brand logos are used.

The catalog keeps 270 women's-watch, 180 men's-watch and 50 wall-clock template contexts; English 200, Roman Hindi 150, Roman Gujarati 150. Gifting can be a watch-category topic, while the actual recipient remains unknown until entered by the customer. No generic “other watches/wall clocks are also available” sentence is appended.

`keyword-policy.json` lists reviewed discovery queries and candidate phrases. `npm run research` fetches Google's India Trends RSS and Search Autocomplete predictions into `keyword-research.json`, with source URLs, retrieval dates and source types. Literal observed keywords are kept separately from their natural wording, such as `mens watches` → `men's watches`.

**Autocomplete predictions are keyword ideas, not proof of a Google trend or search volume.** Only a literal relevant match in current Trends evidence gets the `google-trends` label. Otherwise, labeled predictions and approved evergreen topics are used. The initial 20 October 2026 research found nine approved prediction phrases and no verified relevant watch term in the current India Trends feed. New relevant trends are not guaranteed on every refresh.

Sources: [Google Trending Now/RSS](https://support.google.com/trends/answer/3076011?hl=en), [Autocomplete and Trends differ](https://support.google.com/websearch/answer/7368877?hl=en).

## Gemini template generation and scheduled refresh

The Gemini API writes natural first-person fill-in templates for each public business context. `scripts/refresh-gemini-drafts.mjs` accepts a result only after all 500 templates pass validation. The required fields are exactly `[area: supplied area]`, `[brand: supplied brand]`, `[category: categoryPhrase]`, `[recipient]` and `[experience]`, each once. Unknown personal facts and feedback must stay unresolved. English and Roman Hindi/Gujarati use natural wording; the literal Google search phrase remains separate source evidence.

`gemini-drafts.json` records `kind: customer-pov-template`, provider, model, generation date, context hash and validated templates. `npm run generate` compiles it into `review-catalog.js`. A present invalid/stale model result fails; an API failure never silently becomes a successful refresh. Private checkpoints resume only compatible template-mode rows; older shop-description checkpoints cannot enter the customer-POV catalog.

Each template records its actual Gemini model, including a supported Flash-Lite fallback when the primary model returns a quota limit. The API key is loaded only in the private maintenance process from `GEMINI_API_KEY` or the ignored mode-0600 `.env`. `.env.example` contains empty configuration, never a real key. No credential is committed, bundled, logged or placed in a task prompt. The browser selects prepared templates immediately; it does not call Gemini on every visitor refresh or expose an API key.

The connected ChatGPT task **Refresh Ambika review drafts** uses its configured schedule in ChatGPT Tasks. The schedule is managed separately from this repository; see [AUTOMATION.md](AUTOMATION.md) for the observed configuration and the earlier cadence request. Its workflow researches Google evidence, runs Gemini maintenance, tests and publishes only this repository, then updates the existing Drive backups. It needs access to the private credential at run time; if that environment is replaced or the credential/API is unavailable, it preserves the last published page and reports the blocked refresh. GitHub's connection currently does not permit installing an Actions secret (HTTP 403); this is not presented as a deployed GitHub Actions job.

Legacy shop-description wording remains only for explicit offline bootstrap before a Gemini manifest exists. Production uses the validated customer-POV template manifest. A first-person grammatical frame is not a real testimonial: personal details, staff feedback, pricing and overall experience must come from the customer before copying. No rating, stock confirmation or praise is supplied as fact.

Gemini references: [Generate Content API](https://ai.google.dev/api/generate-content), [Structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).

## Google handoff and branding

Android requests Google Maps at Ambika's exact Place ID; its browser fallback and other devices open the supplied HTTPS review form. Google controls the composer, sign-in, stars, paste and posting. The page does not simulate searches/clicks or submit reviews.

Copying finishes before navigation. Android first tries synchronous selected-text copying to retain tap activation. Clipboard failure leaves text selected and changes the same button to **Leave Review**. If an app launch is refused or ignored, another real tap uses HTTPS. Returning through the back-forward cache preserves working handlers and edits.

- Place ID: `ChIJ4dkN_wJP4DsRaUIpMlm4KN8`
- Review form: https://search.google.com/local/writereview?placeid=ChIJ4dkN_wJP4DsRaUIpMlm4KN8
- Instagram: https://www.instagram.com/ambikawatchandgift/
- The existing text brand header is centered on mobile and desktop. The exact wide logo shown in chat still needs accessible original file bytes or a downloadable URL; the circular Instagram image is removed.

Sources: [Maps URLs](https://developers.google.com/maps/documentation/urls/guide), [Android browser intents](https://developer.chrome.com/docs/android/intents).

## Development

Requires Node 24.5+ for the proxy-aware Gemini maintenance command, npm and Python 3. Production is static.

```sh
npm ci
npm run research
# Configure GEMINI_API_KEY privately, then:
npm run refresh:gemini
npm run generate
npm run check
npm test
python3 -m http.server 8080
```

Use HTTP locally, not a file URL, for modules. Clipboard access requires HTTPS or localhost. Research runs during scheduled maintenance/development and never sends customer text to Google.

The automated tests cover Gemini transport/timeout/error sanitization, template output and atomic failure handling, keyword evidence, the five required slots, ungrounded claims outside slots, catalog uniqueness and mix, initial display, unresolved or unmatched brackets, programmatic submit guards, negative customer feedback, refresh exclusion, storage privacy, editing, clipboard failure, Android handoff and page lifecycle. DOM/navigation stubs do not verify native Maps review-composer behavior. No Google reviews are submitted during tests.

## Reusable open-source tooling

The repository also includes an experimental, business-independent
[Customer Draft Guard](packages/customer-draft-guard/README.md). It provides
dependency-free JavaScript checks for editable feedback template fields and
unresolved placeholders, without generating or submitting reviews. The module
has its own tests and TypeScript declarations; it is source-available under
Apache-2.0 and is **not published to a package registry**.

Developers interested in improving the shared safeguards can read the
[contribution guide](CONTRIBUTING.md). Secret-free GitHub Actions checks run the
existing application test suite on pushes to `main` and pull requests.

## Deployment and backups

Only `BBI-Review-Systems-For-Clients/Ambika-Watch-Review-System` is modified. GitHub Pages publishes `main` at `/(root)` with HTTPS. `bash deploy-github.sh` validates the account, exact repository ID, branch and remote before checking and pushing without force.

After Pages builds the current commit:

```sh
python3 scripts/verify-live.py --tests <actual-passing-count> --out work/delivery
python3 scripts/build-delivery.py --out work/delivery
```

The 11 served runtime/data files, including the Gemini manifest, are verified against the committed source. The ZIP, standalone preview and notes replace the existing Drive deliverables. Other repositories, custom domains and the client's read-only source folder are not changed.

## License

The original source code and documentation in this repository are licensed under the [Apache License, Version 2.0](LICENSE) (SPDX: `Apache-2.0`). Copyright (c) 2026 Ankit Vaghasiya.

The license does not grant trademark rights to the names of Ambika Watch & Gift or third-party product brands, rights to third-party services or data, or rights to customer-authored feedback. Those remain with their respective owners.
