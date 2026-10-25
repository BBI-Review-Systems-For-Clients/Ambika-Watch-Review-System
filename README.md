# Ambika Watch Review System

A short mobile-friendly review page for **Ambika Watch & Gift, Surat**, in navy, red and white.

Live: https://bbi-review-systems-for-clients.github.io/Ambika-Watch-Review-System/

## Customer flow

The page opens with an editable **one-sentence** draft. It contains Ambika Watch & Gift, Surat/watch-shop context, **one serving area, one approved brand and one category**. No language, brand, product or experience selectors are shown. The only action is **Copy & Leave Review**.

Example: “For Varachha shoppers looking at Casio ladies watches, Ambika Watch & Gift is a watch shop in Surat.”

The 500 unique complete drafts are selected automatically on page load. English, Roman Hindi and Roman Gujarati are supported. With session storage available, refresh excludes the previous draft; only an opaque ID is saved, never the customer's words. Blocked storage still permits drafting, with a chance of a repeated selection. Manual edits remain intact until reload.

## Areas, brands, categories and keywords

Each generated sentence mentions exactly one area from **Varachha, Mota Varachha, Katargam or Amroli**, as a shopper catchment, without inventing a visitor's location or a store branch. It names one brand from the 29 approved names in `review-core.js`. **Onex** is used for wall-clock drafts. These are shopper-interest suggestions, not stock confirmation or invented customer experiences.

Corrected spellings include **Lee Cooper, Emporio Armani, NAVIFORCE, REWARD** and **Canon Quartz**. Unconfirmed “Mont Beree”, “Jean Friendi” and “Hong Kong” remain withheld. No third-party brand logos are used.

The catalog keeps 270 women's-watch, 180 men's-watch and 50 wall-clock drafts; English 200, Roman Hindi 150, Roman Gujarati 150. Gifting can be a watch-category topic. No generic “other watches/wall clocks are also available” sentence is appended.

`keyword-policy.json` lists reviewed discovery queries and candidate phrases. `npm run research` fetches Google's India Trends RSS and Search Autocomplete predictions into `keyword-research.json`, with source URLs, retrieval dates and source types. Literal observed keywords are kept separately from their natural wording, such as `mens watches` → `men's watches`.

**Autocomplete predictions are keyword ideas, not proof of a Google trend or search volume.** Only a literal relevant match in current Trends evidence gets the `google-trends` label. Otherwise, labeled predictions and approved evergreen topics are used. The initial 20 October 2026 research found nine approved prediction phrases and no verified relevant watch term in the current India Trends feed. New relevant trends are not guaranteed on every refresh.

Sources: [Google Trending Now/RSS](https://support.google.com/trends/answer/3076011?hl=en), [Autocomplete and Trends differ](https://support.google.com/websearch/answer/7368877?hl=en).

## Gemini sentence generation and 15-day refresh

The Gemini API now writes complete sentences for each context instead of inserting keywords into fixed sentence templates. `scripts/refresh-gemini-drafts.mjs` sends only public business context to Gemini and accepts a result only after all 500 sentences pass validation. English and Roman Hindi/Gujarati use natural category wording; the literal Google search phrase remains separate source evidence.

`gemini-drafts.json` records the provider, model, generation date, context hash and validated complete sentences. `npm run generate` compiles it into `review-catalog.js`. A present invalid/stale model result fails; an API failure never silently becomes a successful template refresh. Private checkpoints allow interrupted runs to resume without repurchasing accepted sentences.

Each sentence records its actual Gemini model, including a supported Flash-Lite fallback when the primary model returns a quota limit. The API key is loaded only in the private maintenance process from `GEMINI_API_KEY` or the ignored mode-0600 `.env`. `.env.example` contains empty configuration, never a real key. No credential is committed, bundled, logged or placed in a task prompt. The browser still selects prepared sentences immediately; it does not call Gemini on every visitor refresh or expose an API key.

The connected ChatGPT task **Refresh Ambika review drafts** remains enabled every **15 days**, starting **4 November 2026**. Its updated workflow researches Google evidence, runs the Gemini maintenance step, tests and publishes only this repository, then updates the existing Drive backups. It needs access to the configured private credential at run time; if that environment is replaced or the credential/API is unavailable, it preserves the last published page and reports the blocked refresh. GitHub's connection currently does not permit installing an Actions secret (HTTP 403); this is not presented as a deployed GitHub Actions job. See [AUTOMATION.md](AUTOMATION.md).

The old placeholder wording remains only for explicit offline bootstrap before a Gemini manifest exists. Once model output is present, production generation uses the validated model sentences. No customer purchase, visit, staff feedback, price, rating, stock confirmation or praise is invented.

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

The automated tests cover Gemini transport/timeout/error sanitization, complete model output and atomic failure handling, keyword evidence and failure handling, exactly one sentence/area/brand/category, catalog uniqueness and mix, rejected claims, initial display, refresh exclusion, storage privacy, editing, clipboard failure, Android handoff and page lifecycle. DOM/navigation stubs do not verify native Maps review-composer behavior. No Google reviews are submitted during tests.

## Deployment and backups

Only `BBI-Review-Systems-For-Clients/Ambika-Watch-Review-System` is modified. GitHub Pages publishes `main` at `/(root)` with HTTPS. `bash deploy-github.sh` validates the account, exact repository ID, branch and remote before checking and pushing without force.

After Pages builds the current commit:

```sh
python3 scripts/verify-live.py --tests 59 --out work/delivery
python3 scripts/build-delivery.py --out work/delivery
```

The 11 served runtime/data files, including the Gemini manifest, are verified against the committed source. The ZIP, standalone preview and notes replace the existing Drive deliverables. Other repositories, custom domains and the client's read-only source folder are not changed.
