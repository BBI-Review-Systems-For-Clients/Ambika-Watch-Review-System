import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { initReviewApp } from '../app.js';
import { ANDROID_MAPS_INTENT } from '../review-navigation.js';
import { COPY } from '../i18n.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const googleURL = 'https://search.google.com/local/writereview?placeid=ChIJ4dkN_wJP4DsRaUIpMlm4KN8';
const allowedBrands = [
  'Casio', 'Timex', 'Tommy Hilfiger', 'Police', 'Kenneth Cole', 'Obaku',
  'DKNY', 'Guess', 'Anne Klein', 'Lee Copper', 'Daniel Wellington',
  'Armani Exchange', 'Emporia Armani', 'Bering', 'Fossil', 'Michael Kors',
  'Skagen', 'Mont Beree', 'Navi Force', 'Rewards', 'Valentine',
  'Jean Friendi', 'Hong Kong', 'Hislon', 'Titan', 'Fastrack', 'Sonata',
  'Logues', 'Onex', 'Crony', 'Canon', 'Time Square',
];

function fixture(t, { configure = () => {}, navigate } = {}) {
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
  win.fetch = () => { networkRequests++; throw new Error('Unexpected network request'); };
  win.open = () => { popupRequests++; throw new Error('Unexpected popup'); };
  doc.write(html);
  configure(win, doc);
  const destinations = [];
  const app = initReviewApp(doc, win, { navigate: navigate || (url => destinations.push(url)) });
  t.after(async () => {
    app.dispose();
    await win.happyDOM.close();
    assert.equal(networkRequests, 0, 'the page does not send customer text to a network endpoint');
    assert.equal(popupRequests, 0, 'navigation does not require a popup');
  });
  const $ = id => doc.getElementById(id);
  const choose = (id, value) => {
    $(id).value = value;
    $(id).dispatchEvent(new win.Event('change', { bubbles: true }));
  };
  const type = value => {
    $('review-text').value = value;
    $('review-text').dispatchEvent(new win.Event('input', { bubbles: true }));
  };
  const tap = experience => doc.querySelector(`[data-experience="${experience}"]`).click();
  const submit = () => $('review-form').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  return { win, doc, $, choose, type, tap, submit, destinations };
}

function setClipboard(win, writeText) {
  Object.defineProperty(win.navigator, 'clipboard', { configurable: true, value: { writeText } });
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('the initial page has one primary action, no preset rating, and no removed secondary controls', t => {
  const { doc, $ } = fixture(t);
  assert.equal($('review-text').value, '');
  assert.equal($('copy-open').disabled, true);
  assert.equal($('word-count').textContent, '0 words');
  assert.equal(doc.querySelectorAll('[data-experience][aria-pressed="true"]').length, 0);
  assert.equal(doc.querySelectorAll('[name="rating"], [role="radio"], input[type="radio"]').length, 0);
  assert.equal(doc.querySelectorAll('.primary-button').length, 1);
  assert.equal(doc.querySelectorAll('button[type="submit"]').length, 1);
  assert.equal(doc.querySelector('#polish-review, #refresh-draft, #direct-google, .paste-help'), null);
  assert.equal($('copy-open').textContent.trim(), COPY.en.copyOpen);
});

test('customer choices create a short editable draft with exactly the supplied brand names', t => {
  const { doc, $, choose, tap } = fixture(t);
  assert.deepEqual([...$('brand').options].map(option => option.value), ['', ...allowedBrands]);
  tap('selection');
  tap('staff');
  choose('product', 'women');
  choose('brand', 'Titan');
  assert.equal(doc.querySelector('[data-experience="selection"]').getAttribute('aria-pressed'), 'true');
  assert.match($('review-text').value, /Titan women's watches at Ambika Watch & Gift in Surat/);
  assert.match($('review-text').value, /the selection and helpful staff/);
  assert.doesNotMatch($('review-text').value, /bought|purchased|five.star|best/i);
  assert.ok($('review-text').value.split(/\s+/u).length <= 60);
  assert.equal($('review-text').readOnly, false);
  assert.equal($('copy-open').disabled, false);
  tap('staff');
  assert.doesNotMatch($('review-text').value, /helpful staff/);
});

test('critical feedback can copy and leave through the same Google review destination', async t => {
  const copied = [];
  const { $, tap, submit, destinations } = fixture(t, {
    configure: win => setClipboard(win, async text => copied.push(text)),
  });
  tap('improve');
  const review = $('review-text').value;
  assert.match(review, /room for improvement/);
  assert.equal($('copy-open').disabled, false);
  submit();
  await settle();
  assert.deepEqual(copied, [review]);
  assert.deepEqual(destinations, [googleURL]);
  assert.equal($('status').textContent, COPY.en.copied);
});

test('manual wording survives changes to chips, watch details, and language', t => {
  const { $, type, tap, choose, doc } = fixture(t);
  const ownWords = 'The strap was uncomfortable.\nI did not buy the watch.';
  type(ownWords);
  tap('staff');
  choose('product', 'men');
  choose('brand', 'Casio');
  assert.equal($('review-text').value, ownWords);
  assert.equal($('status').textContent, COPY.en.kept);
  choose('language', 'gu');
  assert.equal(doc.documentElement.lang, 'gu');
  assert.equal($('page-title').textContent, COPY.gu.heading);
  assert.equal($('review-text').value, ownWords);
  assert.equal($('status').textContent, COPY.gu.languageKept);
  assert.equal($('copy-open').disabled, false);
});

test('copy finishes before navigation; repeated clicks cannot copy or navigate twice while pending', async t => {
  const events = [];
  let finishCopy;
  const { $, type, submit, doc } = fixture(t, {
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
  assert.equal($('copy-open').textContent.trim(), COPY.en.busy);
  assert.equal($('review-text').readOnly, true);
  for (const control of doc.querySelectorAll('select, [data-experience]')) {
    assert.equal(control.disabled, true, `${control.id || control.dataset.experience} must stay fixed while copying`);
  }
  finishCopy();
  await settle();
  assert.deepEqual(events, [
    ['copy', 'Helpful staff and a good watch collection.'],
    ['navigate', googleURL],
  ]);
  assert.equal($('copy-open').disabled, false);
  assert.equal($('copy-open').textContent.trim(), COPY.en.leaveReview);
  assert.equal($('review-text').readOnly, false);
  for (const control of doc.querySelectorAll('select, [data-experience]')) assert.equal(control.disabled, false);
});

test('clipboard permission rejection can use selected-text copy before navigation', async t => {
  let legacyCopies = 0;
  const { $, type, submit, destinations } = fixture(t, {
    configure: (win, doc) => {
      setClipboard(win, async () => { throw new Error('Permission denied'); });
      doc.execCommand = command => {
        legacyCopies++;
        assert.equal(command, 'copy');
        assert.equal(doc.activeElement.id, 'review-text');
        assert.equal($('review-text').selectionStart, 0);
        assert.equal($('review-text').selectionEnd, $('review-text').value.length);
        return true;
      };
    },
  });
  type('I explored wall clocks.');
  $('review-text').setSelectionRange(2, 7);
  submit();
  await settle();
  assert.equal(legacyCopies, 1);
  assert.equal($('review-text').selectionStart, 2);
  assert.equal($('review-text').selectionEnd, 7);
  assert.deepEqual(destinations, [googleURL]);
  assert.equal($('status').textContent, COPY.en.copied);
});

test('failed copy selects the review and reuses the same button to leave without another clipboard request', async t => {
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
  assert.equal($('status').textContent, COPY.en.copyFailed);
  assert.equal($('status').dataset.tone, 'error');
  assert.equal(doc.activeElement, $('review-text'));
  assert.equal($('review-text').selectionStart, 0);
  assert.equal($('review-text').selectionEnd, $('review-text').value.length);
  assert.equal($('copy-open'), button);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent.trim(), COPY.en.leaveReview);
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
  assert.equal($('status').textContent, COPY.en.openFailed);
  assert.equal($('status').dataset.tone, 'error');
  assert.equal($('copy-open').textContent.trim(), COPY.en.leaveReview);
  submit();
  await settle();
  assert.equal(copyRequests, 1);
  assert.equal(attempts, 2);
  assert.deepEqual(destinations, [googleURL]);
});

test('editing a previously copied review resets the button and copies the new words before leaving', async t => {
  const copied = [];
  const { $, type, submit, destinations } = fixture(t, {
    configure: win => setClipboard(win, async text => copied.push(text)),
  });
  type('The staff helped.');
  submit();
  await settle();
  assert.equal($('copy-open').textContent.trim(), COPY.en.leaveReview);
  type('I changed my mind: the service was slow.');
  assert.equal($('copy-open').textContent.trim(), COPY.en.copyOpen);
  submit();
  await settle();
  assert.deepEqual(copied, ['The staff helped.', 'I changed my mind: the service was slow.']);
  assert.deepEqual(destinations, [googleURL, googleURL]);
  type('   ');
  assert.equal($('copy-open').disabled, true);
});

test('Android uses the Maps intent only after the customer review has been copied', async t => {
  const copied = [];
  const { type, submit, destinations } = fixture(t, {
    configure: win => {
      Object.defineProperty(win.navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/143.0 Mobile Safari/537.36' });
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

test('Android synchronous copy opens Maps during the original tap without requesting the Clipboard API', t => {
  let clipboardRequests = 0;
  const events = [];
  const { $, type, submit } = fixture(t, {
    configure: (win, doc) => {
      Object.defineProperty(win.navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Linux; Android 15) Chrome/143.0' });
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
  type('I explored the watch collection.');
  submit();
  // No promise or timer needs to settle before the app intent is attempted.
  assert.deepEqual(events, [
    ['copy', 'I explored the watch collection.'],
    ['navigate', ANDROID_MAPS_INTENT],
  ]);
  assert.equal(clipboardRequests, 0);
  assert.equal($('copy-open').disabled, false);
  assert.equal($('review-text').readOnly, false);
});

test('expired Android activation after async copy waits for a second tap without recopying', async t => {
  const activation = { isActive: true };
  let finishCopy;
  let clipboardRequests = 0;
  const { $, type, submit, destinations } = fixture(t, {
    configure: (win, doc) => {
      Object.defineProperty(win.navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Linux; Android 15) Chrome/143.0' });
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
  assert.equal($('status').textContent, COPY.en.openFailed);
  assert.equal($('copy-open').textContent.trim(), COPY.en.leaveReview);
  assert.equal($('copy-open').disabled, false);
  activation.isActive = true;
  submit();
  assert.deepEqual(destinations, [ANDROID_MAPS_INTENT]);
  assert.equal(clipboardRequests, 1);
});

test('an ignored Android app launch lets the same button open the HTTPS review form on the next tap', t => {
  let clipboardRequests = 0;
  let synchronousCopies = 0;
  const { $, type, submit, destinations } = fixture(t, {
    configure: (win, doc) => {
      Object.defineProperty(win.navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Linux; Android 15) Chrome/143.0' });
      doc.execCommand = () => { synchronousCopies++; return true; };
      setClipboard(win, async () => { clipboardRequests++; });
    },
  });
  type('I browsed watches for gifting.');
  const button = $('copy-open');
  submit();
  // The navigation stub accepts the intent but does not leave this page.
  assert.deepEqual(destinations, [ANDROID_MAPS_INTENT]);
  assert.equal(button.textContent.trim(), COPY.en.leaveReview);
  submit();
  assert.deepEqual(destinations, [ANDROID_MAPS_INTENT, googleURL]);
  assert.equal($('copy-open'), button);
  assert.equal(synchronousCopies, 1);
  assert.equal(clipboardRequests, 0);
  assert.equal($('review-text').value, 'I browsed watches for gifting.');
});

test('a persisted pagehide keeps the restored page interactive and able to copy a new review', async t => {
  const copied = [];
  const { $, win, doc, tap, choose, type, submit, destinations } = fixture(t, {
    configure: win => setClipboard(win, async text => copied.push(text)),
  });
  tap('staff');
  const firstReview = $('review-text').value;
  submit();
  await settle();
  const pagehide = new win.Event('pagehide');
  Object.defineProperty(pagehide, 'persisted', { value: true });
  win.dispatchEvent(pagehide);
  choose('language', 'hi');
  assert.equal(doc.documentElement.lang, 'hi');
  type('The service could be quicker.');
  assert.equal($('copy-open').textContent.trim(), COPY.hi.copyOpen);
  submit();
  await settle();
  assert.deepEqual(copied, [firstReview, 'The service could be quicker.']);
  assert.deepEqual(destinations, [googleURL, googleURL]);
  assert.equal($('copy-open').disabled, false);
});
