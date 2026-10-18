# Ambika Watch Review System

A short, mobile-friendly Google review page for **Ambika Watch & Gift, Surat**. Built as a separate static website in the Ambika navy (`#20355c`), red (`#ed1c24`) and white palette.

## Customer flow

1. Choose English, Hindi or Gujarati.
2. Tap details that reflect the visit, or write a review directly. A watch category and brand are optional.
3. Edit the short draft, then select **Copy review & open Google**.
4. On Google, choose a rating, paste the text and submit.

Google's review form cannot be reliably prefilled or automatically pasted by an unrelated website. The page copies first and opens the exact supplied review link. A direct Google link is always available; clipboard and popup failures show manual instructions. A Google sign-in may be required by Google.

## AI and honest feedback

The fast, multilingual draft composer uses only the customer's selected details. It does not assign a rating, invent a purchase, choose random brands, or hide critical feedback. No reviews are posted automatically. Brand names are limited to the supplied allowlist and do not confirm current stock; no third-party brand logos or generated watch imagery are used.

Optional **Polish my words** uses Chrome's on-device Prompt API when supported. It is shown for English on browsers exposing `LanguageModel`; actual model availability is checked on click. A model download requires customer confirmation. The prompt preserves supplied facts and sentiment. The customer should check any edit before posting. Hindi and Gujarati drafts and unsupported/mobile browsers use the local composer and editable text without a model download. This is not a claim of AI support on every phone or browser.

No third-party AI endpoint, secret API key, tracking script, login, backend, customer database or browser storage is used. Draft text stays in page memory until the customer chooses to copy it or open Google. The site does not try to evade Google's systems or guarantee publication, ranking or detection outcomes.

Prompt API reference: https://developer.chrome.com/docs/ai/prompt-api

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

Open `http://localhost:8080` locally. ES modules require HTTP, not opening `index.html` as a `file://` URL. Clipboard access requires HTTPS or localhost. Automated DOM tests cover drafts, edits, translation labels, copy behavior, failure fallbacks, and the optional AI integration using a stub. They do not establish real Google form behavior or actual model/hardware availability. No Google reviews are submitted during tests.

## Deployment

GitHub Pages serves the `main` branch at `/` with HTTPS and `.nojekyll`. No CNAME from another client's review system is used. Pushes to `main` are automatically published by GitHub Pages. The site is entirely self-contained; production does not depend on a package CDN.

To publish an update, run `bash deploy-github.sh`. It checks the account and exact repository, runs the checks, pushes without force, then enables Pages when needed. It refuses an unexpected remote or branch and never changes another repository.
