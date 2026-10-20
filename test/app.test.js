import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { initReviewApp, COPY } from '../app.js';
import { LAST_REVIEW_KEY } from '../auto-review-generator.js';
import { REVIEW_CATALOG } from '../review-catalog.js';
import { ANDROID_MAPS_INTENT } from '../review-navigation.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const googleURL = 'https://search.google.com/local/writereview?placeid=ChIJ4dkN_wJP4DsRaUIpMlm4KN8';
const androidAgent = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/143.0 Mobile Safari/537.36';
const languageTags = { en: 'en', hi: 'hi-Latn', gu: 'gu-Latn' };
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture(t, { configure = () => {}, navigate, random = () => 0.5, storage } = {}) {
  const win = new Window({
    url: 'https://example.test/ambika-watch-review-system/',
    settings: {
      enableJavaScriptEvaluation: false,
      disableJavaScriptFileLoading: true,
      enableCSSFileLoading: false,
      enableImageFileLoading: false,
    },
  });
  const doc = win.document;
  let networkRequests = 0;
  let popupRequests = 0;
  let modelRequests = 0;
  win.fetch = () => { networkRequests++; throw new Error('Unexpected network request'); };
  win.open = () => { popupRequests++; throw new Error('Unexpected popup'); };
  Object.defineProperty(win, 'LanguageModel', {
    configurable: true,
    get() { modelRequests++; throw new Error('Unexpected model access'); },
  });
  doc.write(html);
  configure(win, doc);
  const destinations = [];
  const app = initReviewApp(doc, win, {
    navigate: navigate || (url => destinations.push(url)), random, storage,
  });
  t.after(async () => {
    app.dispose();
    await win.happyDOM.close();
    assert.equal(networkRequests, 0, 'drafting and editing require no network request');
    assert.equal(popupRequests, 0, 'navigation does not require a popup');
    assert.equal(modelRequests, 0, 'the automatic catalog does not access a language model');
  });
  const $ = id => doc.getElementById(id);
  const type = value => {
    $('review-text').value = value;
    $('review-text').dispatchEvent(new win.Event('input', { bubbles: true }));
  };
  const submit = () => $('review-form').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  return { win, doc, $, app, type, submit, destinations };
}

function setClipboard(win, writeText) {
  Object.defineProperty(win.navigator, 'clipboard', { configurable: true, value: { writeText } });
}

function setAndroid(win) {
  Object.defineProperty(win.navigator, 'userAgent', { configurable: true, value: androidAgent });
}

function memoryStorage() {
  const values = new Map();
  const reads = [];
  const writes = [];
  return {
    values, reads, writes,
    getItem(key) { reads.push(key); return values.get(key) ?? null; },
    setItem(key, value) { writes.push([key, String(value)]); values.set(key, String(value)); },
  };
}

test('the page immediately loads one complete editable keyword draft with one action and no options', t => {
  const { app, doc, $ } = fixture(t);
  const editor = $('review-text');
  assert.equal(editor.value, app.draft.text);
  assert.ok(editor.value.trim().split(/\s+/u).length >= 10, 'the initial value is a full draft');
  assert.match(editor.value, /Ambika Watch & Gift/);
  assert.match(editor.value, /Surat/);
  assert.ok(editor.value.includes(app.draft.keyword));
  assert.ok(editor.value.includes(app.draft.area));
  assert.ok(editor.value.includes(app.draft.brand));
  assert.equal(editor.value.match(/[.!?]/g)?.length, 1);
  assert.ok(['women', 'men', 'clock'].includes(app.draft.category));
  assert.ok(editor.value.length <= 1000);
  assert.equal(editor.maxLength, 1000);
  assert.equal(editor.readOnly, false);
  assert.ok(Number.parseFloat(editor.style.height) > 0, 'the draft resizes on load');
  assert.equal($('copy-open').disabled, false);
  assert.equal($('copy-open').textContent.trim(), 'Copy & Leave Review');
  assert.match(doc.body.textContent, /Suggested draft\. Edit it to match your visit\./);
  for (const area of ['Varachha', 'Mota Varachha', 'Katargam', 'Amroli']) {
    assert.ok(doc.querySelector('footer').textContent.includes(area));
  }
  assert.equal(doc.querySelectorAll('.primary-button, button[type="submit"]').length, 1);
  assert.equal(doc.querySelectorAll('button').length, 1);
  assert.equal(doc.querySelector('select, option, details, [data-experience], [name="rating"], [role="radio"], input[type="radio"]'), null);
  assert.equal(doc.querySelector('#polish-review, #refresh-draft, #direct-google, #personalize-review, #language, #product, #brand, .paste-help'), null);
  assert.doesNotMatch(doc.body.textContent, /real.time AI|on.device AI|polish review|refresh draft|personalize your review/i);
});

test('catalog language metadata changes draft tags while the interface remains English', t => {
  for (const language of ['en', 'hi', 'gu']) {
    const index = REVIEW_CATALOG.findIndex(draft => draft.language === language);
    assert.ok(index >= 0);
    const { app, doc, $ } = fixture(t, { random: () => (index + 0.5) / REVIEW_CATALOG.length });
    assert.equal(app.draft.language, language);
    assert.equal($('review-text').lang, languageTags[language]);
    assert.equal(doc.documentElement.lang, languageTags[language]);
    assert.equal($('copy-open').textContent.trim(), 'Copy & Leave Review');
    assert.match(doc.body.textContent, /Suggested draft\. Edit it to match your visit\./);
    assert.doesNotMatch($('review-text').value, /[\u0900-\u097f\u0a80-\u0aff]/u);
    assert.equal($('review-text').value, app.draft.text);
    assert.ok($('review-text').value.includes(app.draft.keyword));
  }
});

test('refreshing within one session avoids the previous draft even with fixed randomness', t => {
  const storage = memoryStorage();
  const first = fixture(t, { random: () => 0, storage });
  const second = fixture(t, { random: () => 0, storage });
  assert.notEqual(second.app.draft.id, first.app.draft.id);
  assert.notEqual(second.$('review-text').value, first.$('review-text').value);
  assert.deepEqual(storage.reads, [LAST_REVIEW_KEY, LAST_REVIEW_KEY]);
  assert.deepEqual(storage.writes, [
    [LAST_REVIEW_KEY, first.app.draft.id],
    [LAST_REVIEW_KEY, second.app.draft.id],
  ]);
});

test('the default session storage keeps only the opaque catalog ID and never stores customer words', async t => {
  const session = memoryStorage();
  const { app, $, type, submit } = fixture(t, {
    configure: win => {
      Object.defineProperty(win, 'sessionStorage', { configurable: true, value: session });
      Object.defineProperty(win, 'localStorage', {
        configurable: true,
        get() { assert.fail('local storage must not be accessed'); },
      });
      setClipboard(win, async () => {});
    },
  });
  assert.deepEqual(session.reads, [LAST_REVIEW_KEY]);
  assert.deepEqual(session.writes, [[LAST_REVIEW_KEY, app.draft.id]]);
  assert.match(app.draft.id, /^[A-Za-z0-9._:-]+$/u);
  assert.ok(app.draft.id.length < 100);
  type('My personal visit details and a phone number 98765 43210.');
  submit();
  await settle();
  assert.deepEqual(session.writes, [[LAST_REVIEW_KEY, app.draft.id]]);
  assert.equal(session.values.size, 1);
  assert.notEqual(session.values.get(LAST_REVIEW_KEY), $('review-text').value);
});

test('blocked storage access, reads and writes cannot prevent a ready editable draft', t => {
  const configurations = [
    win => Object.defineProperty(win, 'sessionStorage', { configurable: true, get() { throw new Error('Storage blocked'); } }),
    win => Object.defineProperty(win, 'sessionStorage', { configurable: true, value: {
      getItem() { throw new Error('Read blocked'); },
      setItem() { throw new Error('Write blocked'); },
    } }),
    win => Object.defineProperty(win, 'sessionStorage', { configurable: true, value: {
      getItem() { return 'old-id'; },
      setItem() { throw new Error('Quota exceeded'); },
    } }),
  ];
  for (const configure of configurations) {
    const { $, type } = fixture(t, { configure });
    assert.ok($('review-text').value.trim());
    assert.equal($('copy-open').disabled, false);
    assert.equal($('review-text').readOnly, false);
    type('My own words.');
    assert.equal($('review-text').value, 'My own words.');
  }
});

test('copy finishes before navigation and duplicate submits are ignored while copying', async t => {
  const events = [];
  let finishCopy;
  const { $, type, submit } = fixture(t, {
    configure: win => setClipboard(win, text => {
      events.push(['copy', text]);
      return new Promise(resolve => { finishCopy = resolve; });
    }),
    navigate: url => events.push(['navigate', url]),
  });
  type('  Helpful staff and a good watch collection.  ');
  submit();
  submit();
  assert.deepEqual(events, [['copy', 'Helpful staff and a good watch collection.']]);
  assert.equal($('copy-open').disabled, true);
  assert.equal($('copy-open').textContent.trim(), COPY.busy);
  assert.equal($('review-text').readOnly, true);
  finishCopy();
  await settle();
  assert.deepEqual(events, [
    ['copy', 'Helpful staff and a good watch collection.'],
    ['navigate', googleURL],
  ]);
  assert.equal($('review-text').value, '  Helpful staff and a good watch collection.  ');
  assert.equal($('copy-open').disabled, false);
  assert.equal($('copy-open').textContent.trim(), COPY.leaveReview);
  assert.equal($('review-text').readOnly, false);
  assert.equal($('status').textContent, COPY.copied);
});

test('clipboard rejection copies trimmed text and restores the editor value and customer selection', async t => {
  let legacyCopies = 0;
  const selectedCopies = [];
  const { $, type, submit, destinations } = fixture(t, {
    configure: (win, doc) => {
      setClipboard(win, async () => { throw new Error('Permission denied'); });
      doc.execCommand = command => {
        legacyCopies++;
        assert.equal(command, 'copy');
        assert.equal(doc.activeElement.id, 'review-text');
        const editor = $('review-text');
        assert.equal(editor.selectionStart, editor.value.length - editor.value.trimStart().length);
        assert.equal(editor.selectionEnd, editor.value.trimEnd().length);
        selectedCopies.push(editor.value.slice(editor.selectionStart, editor.selectionEnd));
        return true;
      };
    },
  });
  const manualText = '  \nI explored wall clocks. \n ';
  type(manualText);
  $('review-text').setSelectionRange(2, 7);
  submit();
  await settle();
  assert.equal(legacyCopies, 1);
  assert.deepEqual(selectedCopies, ['I explored wall clocks.']);
  assert.equal($('review-text').value, manualText);
  assert.equal($('review-text').selectionStart, 2);
  assert.equal($('review-text').selectionEnd, 7);
  assert.deepEqual(destinations, [googleURL]);
  assert.equal($('status').textContent, COPY.copied);
});

test('without Clipboard API support selected-text copy can still leave for Google', async t => {
  let legacyCopies = 0;
  const { submit, destinations } = fixture(t, {
    configure: (win, doc) => {
      Object.defineProperty(win.navigator, 'clipboard', { configurable: true, value: undefined });
      doc.execCommand = command => { legacyCopies++; assert.equal(command, 'copy'); return true; };
    },
  });
  submit();
  await settle();
  assert.equal(legacyCopies, 1);
  assert.deepEqual(destinations, [googleURL]);
});

test('failed copy selects the review and the same button leaves without another clipboard request', async t => {
  let copyRequests = 0;
  let legacyCopies = 0;
  const { $, type, submit, doc, destinations } = fixture(t, {
    configure: (win, doc) => {
      setClipboard(win, async () => { copyRequests++; throw new Error('Permission denied'); });
      doc.execCommand = () => { legacyCopies++; return false; };
    },
  });
  type('The service could improve.');
  const button = $('copy-open');
  submit();
  await settle();
  assert.equal(copyRequests, 1);
  assert.equal(legacyCopies, 1);
  assert.deepEqual(destinations, []);
  assert.equal($('status').textContent, COPY.copyFailed);
  assert.equal($('status').dataset.tone, 'error');
  assert.equal(doc.activeElement, $('review-text'));
  assert.equal($('review-text').selectionStart, 0);
  assert.equal($('review-text').selectionEnd, $('review-text').value.length);
  assert.equal($('copy-open'), button);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent.trim(), COPY.leaveReview);
  submit();
  await settle();
  assert.equal(copyRequests, 1);
  assert.equal(legacyCopies, 1);
  assert.deepEqual(destinations, [googleURL]);
});

test('a navigation error preserves the review and supports retry without copying again', async t => {
  let copyRequests = 0;
  let attempts = 0;
  const destinations = [];
  const { $, type, submit } = fixture(t, {
    configure: win => setClipboard(win, async () => { copyRequests++; }),
    navigate: url => {
      attempts++;
      if (attempts === 1) throw new Error('Browser did not navigate');
      destinations.push(url);
    },
  });
  type('I only browsed Casio watches.');
  submit();
  await settle();
  assert.equal($('review-text').value, 'I only browsed Casio watches.');
  assert.equal($('status').textContent, COPY.openFailed);
  assert.equal($('status').dataset.tone, 'error');
  assert.equal($('copy-open').textContent.trim(), COPY.leaveReview);
  submit();
  await settle();
  assert.equal(copyRequests, 1);
  assert.equal(attempts, 2);
  assert.deepEqual(destinations, [googleURL]);
});

test('editing resets readiness, keeps exact customer words, and disables the action for blank text', async t => {
  const copied = [];
  const { $, type, submit, destinations } = fixture(t, {
    configure: win => setClipboard(win, async text => copied.push(text)),
  });
  type('The staff helped.');
  submit();
  await settle();
  assert.equal($('copy-open').textContent.trim(), COPY.leaveReview);
  const edited = '  My own words.\nThe service was slow.  ';
  type(edited);
  assert.equal($('review-text').value, edited);
  assert.equal($('copy-open').textContent.trim(), COPY.copyOpen);
  assert.ok(Number.parseFloat($('review-text').style.height) > 0);
  submit();
  await settle();
  assert.deepEqual(copied, ['The staff helped.', edited.trim()]);
  assert.deepEqual(destinations, [googleURL, googleURL]);
  type('  \n  ');
  assert.equal($('copy-open').disabled, true);
  submit();
  await settle();
  assert.equal($('status').textContent, COPY.empty);
  assert.equal(copied.length, 2);
  assert.equal(destinations.length, 2);
});

test('Android async copying finishes before the Maps intent opens', async t => {
  const copied = [];
  const { type, submit, destinations } = fixture(t, {
    configure: win => {
      setAndroid(win);
      setClipboard(win, async text => copied.push(text));
    },
  });
  type('A good collection of watches.');
  submit();
  assert.deepEqual(destinations, []);
  await settle();
  assert.deepEqual(copied, ['A good collection of watches.']);
  assert.deepEqual(destinations, [ANDROID_MAPS_INTENT]);
});

test('Android synchronous copying opens Maps during the original tap without Clipboard API access', t => {
  let clipboardRequests = 0;
  const events = [];
  const { $, type, submit } = fixture(t, {
    configure: (win, doc) => {
      setAndroid(win);
      setClipboard(win, async () => { clipboardRequests++; });
      doc.execCommand = command => {
        assert.equal(command, 'copy');
        const editor = doc.getElementById('review-text');
        events.push(['copy', editor.value.slice(editor.selectionStart, editor.selectionEnd)]);
        return true;
      };
    },
    navigate: url => events.push(['navigate', url]),
  });
  const manualText = '  I explored the watch collection.\n ';
  type(manualText);
  submit();
  assert.deepEqual(events, [
    ['copy', 'I explored the watch collection.'],
    ['navigate', ANDROID_MAPS_INTENT],
  ]);
  assert.equal(clipboardRequests, 0);
  assert.equal($('review-text').value, manualText);
  assert.equal($('copy-open').disabled, false);
  assert.equal($('review-text').readOnly, false);
});

test('expired Android activation after async copying waits for another tap without recopying', async t => {
  const activation = { isActive: true };
  let finishCopy;
  let clipboardRequests = 0;
  const { $, type, submit, destinations } = fixture(t, {
    configure: (win, doc) => {
      setAndroid(win);
      Object.defineProperty(win.navigator, 'userActivation', { configurable: true, value: activation });
      doc.execCommand = () => false;
      setClipboard(win, () => {
        clipboardRequests++;
        return new Promise(resolve => { finishCopy = resolve; });
      });
    },
  });
  type('The staff helped me browse Casio watches.');
  submit();
  activation.isActive = false;
  finishCopy();
  await settle();
  assert.equal(clipboardRequests, 1);
  assert.deepEqual(destinations, []);
  assert.equal($('status').textContent, COPY.openFailed);
  assert.equal($('copy-open').textContent.trim(), COPY.leaveReview);
  assert.equal($('copy-open').disabled, false);
  activation.isActive = true;
  submit();
  assert.deepEqual(destinations, [ANDROID_MAPS_INTENT]);
  assert.equal(clipboardRequests, 1);
});

test('an ignored Android launch lets the same button open HTTPS on the next tap', t => {
  let clipboardRequests = 0;
  let synchronousCopies = 0;
  const { $, type, submit, destinations } = fixture(t, {
    configure: (win, doc) => {
      setAndroid(win);
      doc.execCommand = () => { synchronousCopies++; return true; };
      setClipboard(win, async () => { clipboardRequests++; });
    },
  });
  type('I browsed watches for gifting.');
  const button = $('copy-open');
  submit();
  assert.deepEqual(destinations, [ANDROID_MAPS_INTENT]);
  assert.equal(button.textContent.trim(), COPY.leaveReview);
  submit();
  assert.deepEqual(destinations, [ANDROID_MAPS_INTENT, googleURL]);
  assert.equal($('copy-open'), button);
  assert.equal(synchronousCopies, 1);
  assert.equal(clipboardRequests, 0);
  assert.equal($('review-text').value, 'I browsed watches for gifting.');
});

test('a refused Android intent keeps the HTTPS fallback ready without another copy', t => {
  const attempts = [];
  let copies = 0;
  const { $, submit } = fixture(t, {
    configure: (win, doc) => {
      setAndroid(win);
      doc.execCommand = () => { copies++; return true; };
    },
    navigate: url => {
      attempts.push(url);
      if (url === ANDROID_MAPS_INTENT) throw new Error('Intent refused');
    },
  });
  submit();
  assert.equal($('status').textContent, COPY.openFailed);
  assert.equal($('copy-open').textContent.trim(), COPY.leaveReview);
  submit();
  assert.deepEqual(attempts, [ANDROID_MAPS_INTENT, googleURL]);
  assert.equal(copies, 1);
});

test('a persisted pagehide keeps handlers and manual edits usable after restoring the page', async t => {
  const copied = [];
  const { $, win, type, submit, destinations } = fixture(t, {
    configure: win => setClipboard(win, async text => copied.push(text)),
  });
  const firstReview = $('review-text').value;
  submit();
  await settle();
  const pagehide = new win.Event('pagehide');
  Object.defineProperty(pagehide, 'persisted', { value: true });
  win.dispatchEvent(pagehide);
  type('The service could be quicker.');
  assert.equal($('copy-open').textContent.trim(), COPY.copyOpen);
  submit();
  await settle();
  assert.deepEqual(copied, [firstReview, 'The service could be quicker.']);
  assert.deepEqual(destinations, [googleURL, googleURL]);
  assert.equal($('copy-open').disabled, false);
});

test('disposing a page while copying prevents pending navigation and removes the submit handler', async t => {
  let finishCopy;
  let requests = 0;
  const { app, submit, destinations } = fixture(t, {
    configure: win => setClipboard(win, () => {
      requests++;
      return new Promise(resolve => { finishCopy = resolve; });
    }),
  });
  submit();
  app.dispose();
  finishCopy();
  await settle();
  assert.deepEqual(destinations, []);
  submit();
  await settle();
  assert.equal(requests, 1);
  assert.deepEqual(destinations, []);
});

test('a nonpersisted pagehide prevents pending clipboard completion from navigating', async t => {
  let finishCopy;
  const { win, submit, destinations } = fixture(t, {
    configure: win => setClipboard(win, () => new Promise(resolve => { finishCopy = resolve; })),
  });
  submit();
  win.dispatchEvent(new win.Event('pagehide'));
  finishCopy();
  await settle();
  assert.deepEqual(destinations, []);
});
