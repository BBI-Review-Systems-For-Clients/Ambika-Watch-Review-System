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

## AI refresh every 15 days

The connected ChatGPT task **Refresh Ambika review drafts** is enabled every **15 days**, beginning **4 November 2026 (UTC)**. It uses AI to review current keyword evidence and rewrite sentence templates, regenerate the catalog, run checks, publish only this repository and update the existing Drive backups. See [AUTOMATION.md](AUTOMATION.md) for the exact workflow and failure handling.

`draft-wording.json` holds the AI-authored English/Roman Hindi/Roman Gujarati templates. `business-profile.js` validates the wording and keyword provenance, then generates `review-catalog.js`. The production page selects prepared drafts without a model download, external generation request, browser secret or customer database. The scheduled AI task runs separately from customer page visits; this is not a live AI call on each refresh.

The reference HK Factory Outlet and MUKALAL sites also select complete strings from a 500-entry pool. Their repositories remain untouched. Ambika adds business-specific format validation, source-aware keyword research and the scheduled AI refresh.

## Google handoff and branding

Android requests Google Maps at Ambika's exact Place ID; its browser fallback and other devices open the supplied HTTPS review form. Google controls the composer, sign-in, stars, paste and posting. The page does not simulate searches/clicks or submit reviews.

Copying finishes before navigation. Android first tries synchronous selected-text copying to retain tap activation. Clipboard failure leaves text selected and changes the same button to **Leave Review**. If an app launch is refused or ignored, another real tap uses HTTPS. Returning through the back-forward cache preserves working handlers and edits.

- Place ID: `ChIJ4dkN_wJP4DsRaUIpMlm4KN8`
- Review form: https://search.google.com/local/writereview?placeid=ChIJ4dkN_wJP4DsRaUIpMlm4KN8
- Instagram: https://www.instagram.com/ambikawatchandgift/
- The existing text brand header is centered on mobile and desktop. The exact wide logo shown in chat still needs accessible original file bytes or a downloadable URL; the circular Instagram image is removed.

Sources: [Maps URLs](https://developers.google.com/maps/documentation/urls/guide), [Android browser intents](https://developer.chrome.com/docs/android/intents).

## Development

Requires Node 20.19+, npm and Python 3. Production is static.

```sh
npm ci
npm run research
npm run generate
npm run check
npm test
python3 -m http.server 8080
```

Use HTTP locally, not a file URL, for modules. Clipboard access requires HTTPS or localhost. Research runs during scheduled maintenance/development and never sends customer text to Google.

The 39 tests cover keyword evidence and failure handling, exactly one sentence/area/brand/category, catalog uniqueness and mix, rejected claims, initial display, refresh exclusion, storage privacy, editing, clipboard failure, Android handoff and page lifecycle. DOM/navigation stubs do not verify native Maps review-composer behavior. No Google reviews are submitted during tests.

## Deployment and backups

Only `BBI-Review-Systems-For-Clients/Ambika-Watch-Review-System` is modified. GitHub Pages publishes `main` at `/(root)` with HTTPS. `bash deploy-github.sh` validates the account, exact repository ID, branch and remote before checking and pushing without force.

After Pages builds the current commit:

```sh
python3 scripts/verify-live.py --tests 39 --out work/delivery
python3 scripts/build-delivery.py --out work/delivery
```

The ZIP, standalone preview and notes replace the existing Drive deliverables. Other repositories, custom domains and the client's read-only source folder are not changed.
