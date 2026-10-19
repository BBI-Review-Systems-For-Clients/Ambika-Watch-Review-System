# Ambika Watch Review System

A short, mobile-friendly review page for **Ambika Watch & Gift, Surat**, using navy (`#20355c`), red (`#ed1c24`) and white.

Live: https://bbi-review-systems-for-clients.github.io/Ambika-Watch-Review-System/

## Customer flow

1. A short editable starter draft appears automatically when the page opens.
2. Choose English, Roman Hindi or Roman Gujarati. Optional **Personalize your review** details are collapsed below the editor.
3. Select only details that reflect the visit, or write directly. The complete draft is randomly selected from a pool of alternative wordings for those details. Edit it, then tap **Copy & Leave Review**.

## Review generator

The existing HK Factory Outlet and MUKALAL reference sites each load `review.js`, select one complete string from a 500-review array with `Math.random()`, put it into the textarea on `DOMContentLoaded`, and resize the editor. Their Python generator is an optional offline authoring tool; it is not a live AI service.

Ambika now follows that full-draft pool/selection/auto-load mechanism instead of returning the same fixed sentence for the same choices. `review-generator.js` builds unique complete drafts for the selected context, capped at 500, then selects one randomly. Within a tab, revisiting the same details avoids immediately repeating its last draft. No cross-visit history or browser storage is used.

Without customer-supplied details, the opening pool contains neutral business-only starter text. Product, brand, service, value, praise and criticism appear only when supplied by the customer. Selected facts and sentiment remain constant across wording variants. User-written notes and manual edits are preserved. The draft auto-resizes, and the previously removed refresh/polish controls remain absent.

References: [HK runtime](https://github.com/AnkitVaghasiya/HK-Factory-Outlet-VethiQ-Review/blob/main/review.js), [MUKALAL runtime](https://github.com/AnkitVaghasiya/MUKALAL-review/blob/main/review.js).

On Android, the button requests Google Maps at Ambika's exact Place ID. If Maps is unavailable, Chrome's intent fallback opens the supplied HTTPS Google review form. Other devices open that form directly. Google controls the review action, sign-in, pasting and submission. No documented Maps intent guarantees opening the native review composer.

The page has one primary button. Polishing, refresh, the permanent paste instruction and the additional Google link have been removed. If clipboard access is denied, the review stays selected for manual copying and the same button becomes **Leave Review**. If an Android intent is blocked or ignored, the next real tap uses the normal HTTPS review form. No background searches, simulated clicks, timed navigation or automated reviews are used. Rating and pasting remain customer actions inside Google.

Android first attempts synchronous selected-text copying to retain the customer's click activation. If a clipboard prompt consumes that activation, the page waits for another real tap. Choice controls stay disabled while copying, and returning through the browser back-forward cache retains the page handlers.

## Reviews and privacy

Personalized drafts use only the customer's selected experiences. Manual words are preserved when choices or the interface language change; clearing the editor allows the next choice to create a new draft. Hindi and Gujarati generated copy uses Roman letters as requested; customer-written native-script text is kept verbatim. No rating, purchase, random brand or recommendation is invented. Critical and mixed feedback use the same destination as positive feedback.

The dropdown contains 29 verified names from the supplied list. Corrected spellings include **Lee Cooper**, **Emporio Armani**, **NAVIFORCE**, **REWARD**, and the full brand name **Canon Quartz**. Unverified “Mont Beree”, “Jean Friendi” and “Hong Kong” are withheld until the customer confirms their package-label spellings. The list does not confirm stock.

The six underlying experience categories remain available in every shuffle, including mixed and critical feedback. Where the browser has an already-installed English `LanguageModel`, a live on-device AI request can choose wording from approved phrase pools. It never downloads a model, adds a customer claim, changes sentiment, or writes/posts a review. A two-second timeout and every unsupported browser/language use immediate randomized local variants. AI results stop affecting the page as soon as the customer interacts. This is not a claim of real-time AI support on Android or every browser; no secured server-side AI endpoint is configured.

No third-party brand logos, generated watch imagery, external AI endpoint, secret, tracking, customer database or browser storage is used. The page does not attempt to disguise automation or guarantee Google ranking or detection outcomes.

## Configuration and branding

- Place ID: `ChIJ4dkN_wJP4DsRaUIpMlm4KN8`
- Review form: https://search.google.com/local/writereview?placeid=ChIJ4dkN_wJP4DsRaUIpMlm4KN8
- Business profile: https://www.instagram.com/ambikawatchandgift/
- The circular Instagram logo has been removed. The exact wide navy/red logo shown in chat is pending an accessible original file or downloadable URL. The header currently uses business-name text; no substitute logo has been generated or presented as the original.

References: [Google Maps URLs](https://developers.google.com/maps/documentation/urls/guide), [Chrome Android intents](https://developer.chrome.com/docs/android/intents).

Brand spelling sources: [Lee Cooper](https://www.leecooper.com/accessories), [Emporio Armani](https://www.armani.com/en-us/emporio-armani/man/accessories/watches/), [NAVIFORCE](https://www.naviforce.com/), [REWARD](https://www.rewardwatch.com/), [Canon Quartz](https://canonquartz.com/). Other verified regional names: [Valentine](https://valentinewatch.in/about), [Hislon](https://hislon.com/), [Logues](https://www.logueswatches.com/pages/about-logues), [Onex](https://onexwatches.in/), [Crony](https://cronywatches.com/), [Time Square](https://www.timesquarewatches.com/about-us/).

On-device model API: [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api).

## Development

Requires Node 20.19+ for development dependencies. Production needs no build or npm packages.

```sh
npm ci
npm run check
npm test
python3 -m http.server 8080
```

Use HTTP locally; ES modules do not work by opening `index.html` as a `file://` URL. Clipboard access requires HTTPS or localhost. Automated tests use DOM, navigation and model stubs; they do not establish native Android review-form behavior or actual model/hardware availability. The customer confirmed that the Maps handoff opens on their phone. No Google reviews are submitted during tests.

## Deployment

The repository is `BBI-Review-Systems-For-Clients/Ambika-Watch-Review-System`, transferred from the original personal-account location. GitHub Pages publishes `main` at `/(root)` with HTTPS and `.nojekyll`. No other repository or custom domain is changed.

From a clone of this repository, `bash deploy-github.sh` verifies the GitHub account, exact repository ID, branch and remote, runs checks, then pushes without force. GitHub automatically publishes the new commit.
