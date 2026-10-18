# Ambika Watch Review System

A short, mobile-friendly review page for **Ambika Watch & Gift, Surat**, using navy (`#20355c`), red (`#ed1c24`) and white.

Live: https://bbi-review-systems-for-clients.github.io/Ambika-Watch-Review-System/

## Customer flow

1. Choose English, Hindi or Gujarati.
2. Tap details that reflect the visit, or write directly. Watch category and brand are optional.
3. Edit the short review, then tap **Copy & Leave Review**.

On Android, the button requests Google Maps at Ambika's exact Place ID. If Maps is unavailable, Chrome's intent fallback opens the supplied HTTPS Google review form. Other devices open that form directly. Google controls the review action, sign-in, pasting and submission. No documented Maps intent guarantees opening the native review composer.

The page has one primary button. AI polishing, refresh, the permanent paste instruction and the additional Google link have been removed. If clipboard access is denied, the review stays selected for manual copying and the same button becomes **Leave Review**. If an Android intent is blocked or ignored, the next real tap uses the normal HTTPS review form. No background searches, simulated clicks, timed navigation or automated reviews are used.

Android first attempts synchronous selected-text copying to retain the customer's click activation. If a clipboard prompt consumes that activation, the page waits for another real tap. Choice controls stay disabled while copying, and returning through the browser back-forward cache retains the page handlers.

## Reviews and privacy

Drafts use only the customer's selected experiences. Manual words are preserved when choices or the interface language change; clearing the editor allows the next choice to create a new draft. No rating, purchase, random brand or recommendation is invented. Critical and mixed feedback use the same destination as positive feedback.

The brand dropdown contains only the supplied brand names. It does not confirm stock. No third-party brand logos, generated watch imagery, AI editing, external AI endpoints, secrets, tracking, customer database or browser storage are used. The page does not attempt to disguise automation or guarantee Google ranking or detection outcomes.

## Configuration and branding

- Place ID: `ChIJ4dkN_wJP4DsRaUIpMlm4KN8`
- Review form: https://search.google.com/local/writereview?placeid=ChIJ4dkN_wJP4DsRaUIpMlm4KN8
- Business profile: https://www.instagram.com/ambikawatchandgift/
- The circular Instagram logo has been removed. The exact wide navy/red logo shown in chat is pending an accessible original file or downloadable URL. The header currently uses business-name text; no substitute logo has been generated or presented as the original.

References: [Google Maps URLs](https://developers.google.com/maps/documentation/urls/guide), [Chrome Android intents](https://developer.chrome.com/docs/android/intents).

## Development

Requires Node 20.19+ for development dependencies. Production needs no build or npm packages.

```sh
npm ci
npm run check
npm test
python3 -m http.server 8080
```

Use HTTP locally; ES modules do not work by opening `index.html` as a `file://` URL. Clipboard access requires HTTPS or localhost. Automated tests use DOM and navigation stubs; they do not establish actual Android app behavior or native review-form opening. No Google reviews are submitted during tests.

## Deployment

The repository is `BBI-Review-Systems-For-Clients/Ambika-Watch-Review-System`, transferred from the original personal-account location. GitHub Pages publishes `main` at `/(root)` with HTTPS and `.nojekyll`. No other repository or custom domain is changed.

From a clone of this repository, `bash deploy-github.sh` verifies the GitHub account, exact repository ID, branch and remote, runs checks, then pushes without force. GitHub automatically publishes the new commit.
