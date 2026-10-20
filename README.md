# Ambika Watch Review System

A short, mobile-friendly review page for **Ambika Watch & Gift, Surat**, in navy (`#20355c`), red (`#ed1c24`) and white.

Live: https://bbi-review-systems-for-clients.github.io/Ambika-Watch-Review-System/

## Customer flow

A complete, editable suggested draft appears when the page opens. There are no language, brand, product or experience selectors. The only action is **Copy & Leave Review**. The customer can edit the draft to reflect their visit, then copy it and open Google.

Each page load randomly selects one full draft from a 500-entry catalog. English, Roman Hindi and Roman Gujarati are selected automatically. With session storage available, refreshing in the same tab excludes the previous draft. Only its opaque catalog ID is saved; customer text and edits are never stored or transmitted. If storage is blocked, selection still works but a refresh can repeat by chance.

## Business context and keywords

`business-profile.js` holds the supplied public business context and wording rules. `npm run generate` creates the deterministic `review-catalog.js` catalog. Each complete suggestion includes:

- Ambika Watch & Gift, **Surat** and **watch shop** in natural sentences. English drafts use **watch shop in Surat**; Roman Hindi/Gujarati use native sentence order instead of forcing an exact search phrase.
- A women's watch, men's watch, watch gifting or wall-clock topic.

Serving areas **Varachha, Mota Varachha, Katargam and Amroli** appear in the footer, outside the review text. No area-advice sentence, visitor location or branch claim is inserted into a draft.

The 500 unique suggestions contain 270 women's-watch drafts, 180 men's-watch drafts and 50 wall-clock drafts, reflecting the supplied 60/40 watch mix and 10% wall-clock share. There are 200 English, 150 Roman Hindi and 150 Roman Gujarati drafts. Each is at most 50 words before customer edits.

Automatic brand-enquiry clauses have been removed along with the advisory wording about planning visits, checking stock and shortlisting. Drafts now use short descriptions of the supplied business categories. The 29 approved brand names remain in `review-core.js` as business configuration; the generator does not randomly claim a specific brand is in stock. Corrected spellings include **Lee Cooper**, **Emporio Armani**, **NAVIFORCE**, **REWARD** and **Canon Quartz**. Unconfirmed “Mont Beree”, “Jean Friendi” and “Hong Kong” remain withheld. No brand logos are used.

These are labeled business-context draft suggestions, not invented customer testimonials. No personal visit, purchase, service, price, authenticity, rating or inventory experience is inferred. The editor preserves customer changes exactly. There is no sentiment filtering or separate destination for negative feedback.

## Generator and reference sites

The existing HK Factory Outlet and MUKALAL reference sites each select a complete string from a 500-review array using `Math.random()` and load it into the editor. Their Python generator is an optional offline authoring tool, not a live AI service. Ambika follows that full-draft catalog, random selection and automatic display pattern, with refresh exclusion and business-context keyword coverage added. The brand header is centered on mobile and desktop.

The wording rules run during catalog generation. The deployed GitHub Pages site selects a prepared draft; it has no backend, external AI endpoint, model download or API key. It does not claim live AI generation or conceal automated content. There are no analytics, third-party scripts, customer database or network requests for generation.

References: [HK runtime](https://github.com/AnkitVaghasiya/HK-Factory-Outlet-VethiQ-Review/blob/main/review.js), [MUKALAL runtime](https://github.com/AnkitVaghasiya/MUKALAL-review/blob/main/review.js).

## Google handoff

Android requests Google Maps at the supplied Ambika Place ID. The browser fallback opens the supplied HTTPS Google review form; other devices open that form directly. Google controls the review composer, sign-in, rating, pasting and posting. No supported Maps URL guarantees opening the native review composer or preselecting stars and filling its textbox.

Copying finishes before navigation. Android first tries synchronous selected-text copying to retain the original tap's activation. If clipboard access fails, the text stays selected and the same button becomes **Leave Review**. If an Android app launch is refused or ignored, the next real tap uses the HTTPS form. Returning via the back-forward cache retains edits and working handlers. No simulated searches, clicks or automated Google submissions run.

- Place ID: `ChIJ4dkN_wJP4DsRaUIpMlm4KN8`
- Review form: https://search.google.com/local/writereview?placeid=ChIJ4dkN_wJP4DsRaUIpMlm4KN8
- Business profile: https://www.instagram.com/ambikawatchandgift/
- The exact wide navy/red logo shown in chat still needs accessible original file bytes or a downloadable URL. The old circular Instagram image is removed; the header currently displays business-name text.

References: [Google Maps URLs](https://developers.google.com/maps/documentation/urls/guide), [Chrome Android intents](https://developer.chrome.com/docs/android/intents).

Brand spelling sources: [Lee Cooper](https://www.leecooper.com/accessories), [Emporio Armani](https://www.armani.com/en-us/emporio-armani/man/accessories/watches/), [NAVIFORCE](https://www.naviforce.com/), [REWARD](https://www.rewardwatch.com/), [Canon Quartz](https://canonquartz.com/), [Valentine](https://valentinewatch.in/about), [Hislon](https://hislon.com/), [Logues](https://www.logueswatches.com/pages/about-logues), [Onex](https://onexwatches.in/), [Crony](https://cronywatches.com/), [Time Square](https://www.timesquarewatches.com/about-us/).

## Development

Requires Node 20.19+ for development dependencies. Production is static and needs no npm packages.

```sh
npm ci
npm run generate
npm run check
npm test
python3 -m http.server 8080
```

Edit `business-profile.js` for business wording, then regenerate the catalog. `npm run check` rejects a stale generated catalog. Use HTTP locally; modules do not load by opening `index.html` as a file. Clipboard access requires HTTPS or localhost.

The 30 automated tests cover catalog uniqueness, category/language coverage, local keywords, exclusion of the rejected advisory copy, verified brand spellings, immediate display, refresh exclusion, blocked storage, customer edits, clipboard failures, duplicate taps, Android destinations and page lifecycle. They use DOM/navigation stubs and do not establish actual native Android composer behavior. The customer previously confirmed the Maps listing opens on their phone. No reviews are submitted by tests.

## Deployment

The repository is `BBI-Review-Systems-For-Clients/Ambika-Watch-Review-System`, transferred from the original personal-account location. GitHub Pages publishes `main` at `/(root)` with HTTPS and `.nojekyll`.

`bash deploy-github.sh` verifies the account, exact repository ID, branch and remote, runs checks and pushes without force. No other repository or custom domain is changed.
