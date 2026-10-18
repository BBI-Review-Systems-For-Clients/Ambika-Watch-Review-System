# Ambika Watch Review System

A short, mobile-friendly Google review page for **Ambika Watch & Gift, Surat**. Built as a separate static website in the Ambika navy (`#20355c`), red (`#ed1c24`) and white palette.

## Customer flow

1. Choose English, Hindi or Gujarati.
2. Tap details that reflect the visit, or write a review directly. A watch category and brand are optional.
3. Edit the short draft, then select **Copy & leave review**.
4. On Android, open **Reviews → Write a review** in the business's Google Maps profile. On other devices, the Google review form opens directly. Choose a rating, paste the text and submit.

Google's review form cannot be reliably prefilled or automatically pasted by an unrelated website. The page copies first. On Android it launches an intent targeting the Google Maps app with the exact Place ID; Chrome uses the Google review form as a browser fallback if the app is unavailable. App opening depends on the browser and device settings. Maps URLs do not provide a documented action to open the native review composer directly. The page does not automate searches or clicks inside Google Maps.

Android first tries a synchronous selected-text copy so app launch can remain within the customer's tap, then falls back to the Clipboard API. If a permission prompt consumes the browser's user activation, a **Continue to Google** recovery button requests another real tap. If the app launch is silently blocked, the same recovery button opens the HTTPS review form. Clipboard failure keeps the review selected for manual copying. Other devices reserve a new tab before the clipboard call and fall back to the current tab if popups are blocked. A Google sign-in may be required by Google.

## Honest feedback

The fast, multilingual draft composer uses only the customer's selected details. It does not assign a rating, invent a purchase, choose random brands, or hide critical feedback. No reviews are posted automatically. Brand names are limited to the supplied allowlist and do not confirm current stock; no third-party brand logos or generated watch imagery are used.

Drafts use the local multilingual composer and remain editable. Manual wording is preserved when choices or the interface language change; clearing the editor allows the next choice to create a new draft. There is no AI polishing, model download, or refresh button.

No third-party AI endpoint, secret API key, tracking script, login, backend, customer database or browser storage is used. Draft text stays in page memory until the customer chooses to copy it or open Google. The site does not try to evade Google's systems or guarantee publication, ranking or detection outcomes.

## Configuration and assets

- Place ID: `ChIJ4dkN_wJP4DsRaUIpMlm4KN8`
- Review URL: https://search.google.com/local/writereview?placeid=ChIJ4dkN_wJP4DsRaUIpMlm4KN8
- Public profile and authentic logo source: https://www.instagram.com/ambikawatchandgift/
- `assets/ambika-logo.jpg` is the downloaded original public profile image, also used as the favicon. It is not AI-generated. The low-resolution source is deliberately displayed small.
- User-supplied Drive folder reviewed for context: https://drive.google.com/drive/folders/1wzUAmL-MEvjuWHFdj743nCG42pFbvrwm
- Existing review systems were inspected as references only. No existing repository or custom-domain configuration was changed.

Business names in reviews are only included where the customer supplies experience details. Private business metrics, marketing notes, sales figures and customer data are not published in this repository.

## Development

Requires Node 20.19+ for development dependencies. The live page itself needs no build or npm packages.

```sh
npm ci
npm run check
npm test
python3 -m http.server 8080
```

Open `http://localhost:8080` locally. ES modules require HTTP, not opening `index.html` as a `file://` URL. Clipboard access requires HTTPS or localhost. Automated DOM tests cover drafts, edits, translation labels, clipboard behavior, popup and navigation recovery, Android intent selection, user-activation recovery, and returning through the browser's back-forward cache. These tests stub navigation and do not establish actual Android app opening, installed-app behavior, or real Google form behavior. No Google reviews are submitted during tests.

For device validation, use an Android phone with and without Google Maps installed: verify copy and profile opening, the fallback review page, clipboard denial/manual recovery, and returning to the page with Back. References: [Maps URLs](https://developers.google.com/maps/documentation/urls/guide) and [Chrome Android intents](https://developer.chrome.com/docs/android/intents).

## Deployment

GitHub Pages serves the `main` branch at `/` with HTTPS and `.nojekyll`. No CNAME from another client's review system is used. Pushes to `main` are automatically published by GitHub Pages. The site is entirely self-contained; production does not depend on a package CDN.

To publish an update, run `bash deploy-github.sh`. It checks the account and exact repository, runs the checks, pushes without force, then enables Pages when needed. It refuses an unexpected remote or branch and never changes another repository.
