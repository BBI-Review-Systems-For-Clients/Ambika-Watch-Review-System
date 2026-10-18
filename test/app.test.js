import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { initReviewApp } from '../app.js';
import { COPY } from '../i18n.js';
import { ANDROID_MAPS_INTENT, GOOGLE_REVIEW_URL } from '../review-core.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const allowedBrands = [
  'Casio', 'Timex', 'Tommy Hilfiger', 'Police', 'Kenneth Cole', 'Obaku',
  'DKNY', 'Guess', 'Anne Klein', 'Lee Copper', 'Daniel Wellington',
  'Armani Exchange', 'Emporia Armani', 'Bering', 'Fossil', 'Michael Kors',
  'Skagen', 'Mont Beree', 'Navi Force', 'Rewards', 'Valentine',
  'Jean Friendi', 'Hong Kong', 'Hislon', 'Titan', 'Fastrack', 'Sonata',
  'Logues', 'Onex', 'Crony', 'Canon', 'Time Square',
];

function fixture(t, configure = () => {}) {
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
  const navigations = [];
  win.location.assign = url => navigations.push(url);
  doc.write(html);
  configure(win, doc);
  const app = initReviewApp(doc, win);
  t.after(async () => {
    app.dispose();
    await win.happyDOM.close();
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
  return { win, doc, $, choose, type, tap, submit, navigations };
}

function setClipboard(win, writeText) {
  Object.defineProperty(win.navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
}

function setNavigator(win, property, value) {
  Object.defineProperty(win.navigator, property, { configurable: true, value });
}

function setAndroid(win) {
  setNavigator(win, 'userAgent', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36');
}

function popupStub() {
  const destinations = [];
  const popup = {
    closed: false,
    opener: 'parent',
    location: { replace: url => destinations.push(url) },
    close() { this.closed = true; },
  };
  return { popup, destinations };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('initial page has one primary action and requires customer input', t => {
  const { doc, $ } = fixture(t);
  assert.equal($('review-text').value, '');
  assert.equal($('copy-open').disabled, true);
  assert.equal($('copy-open').querySelector('span').textContent, COPY.en.copyOpen);
  assert.equal($('word-count').textContent, '0 words');
  assert.equal(doc.querySelectorAll('[data-experience][aria-pressed="true"]').length, 0);
  assert.equal(doc.querySelectorAll('[name="rating"], [role="radio"], input[type="radio"]').length, 0);
  for (const id of ['polish-review', 'refresh-draft', 'direct-google']) assert.equal($(id), null);
  assert.equal($('open-google').hidden, true);
  assert.equal($('status-message').textContent, '');
});

test('customer choices compose a short editable draft using exactly the supplied brand list', t => {
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

test('critical feedback uses the same copy action and Google destination', async t => {
  const copied = [];
  const { popup, destinations } = popupStub();
  const { $, tap, submit } = fixture(t, win => {
    setClipboard(win, async text => copied.push(text));
    win.open = () => popup;
  });
  tap('improve');
  const review = $('review-text').value;
  assert.match(review, /room for improvement/);
  assert.equal($('copy-open').disabled, false);
  submit();
  await settle();
  assert.deepEqual(copied, [review]);
  assert.deepEqual(destinations, [GOOGLE_REVIEW_URL]);
  assert.equal($('status-message').textContent, COPY.en.copied);
});

test('manual wording survives choices and language changes; clearing permits a new draft', t => {
  const { $, type, tap, choose, doc } = fixture(t);
  const ownWords = 'The strap was uncomfortable.\nI did not buy the watch.';
  type(ownWords);
  tap('staff');
  choose('product', 'men');
  choose('brand', 'Casio');
  assert.equal($('review-text').value, ownWords);
  assert.equal($('status-message').textContent, COPY.en.kept);
  choose('language', 'gu');
  assert.equal(doc.documentElement.lang, 'gu');
  assert.equal($('page-title').textContent, COPY.gu.heading);
  assert.equal($('review-text').value, ownWords);
  assert.equal($('status-message').textContent, COPY.gu.languageKept);
  type('');
  assert.equal($('copy-open').disabled, true);
  choose('product', 'women');
  assert.match($('review-text').value, /Casio/);
  assert.match($('review-text').value, /મહિલાઓની ઘડિયાળો/);
});

test('desktop reserves a popup synchronously, copies once, and then opens the fixed review form', async t => {
  const events = [];
  const { popup, destinations } = popupStub();
  let finishCopy;
  const { $, type, submit, navigations } = fixture(t, win => {
    win.open = (...args) => { events.push(['open', ...args]); return popup; };
    setClipboard(win, text => {
      events.push(['copy', text]);
      return new Promise(resolve => { finishCopy = resolve; });
    });
  });
  type('  Helpful staff and a good watch collection.  ');
  submit();
  submit();
  assert.deepEqual(events, [
    ['open', 'about:blank', '_blank'],
    ['copy', 'Helpful staff and a good watch collection.'],
  ]);
  assert.equal(popup.opener, null);
  assert.equal($('copy-open').disabled, true);
  assert.deepEqual(destinations, []);
  assert.deepEqual(navigations, []);
  finishCopy();
  await settle();
  assert.deepEqual(destinations, [GOOGLE_REVIEW_URL]);
  assert.equal($('status-message').textContent, COPY.en.copied);
  assert.equal($('copy-open').disabled, false);
  assert.equal($('open-google').hidden, true);
});

test('desktop clipboard rejection falls back to selected-text copy and restores selection', async t => {
  const { popup, destinations } = popupStub();
  let legacyCopies = 0;
  const { $, type, submit } = fixture(t, (win, doc) => {
    win.open = () => popup;
    setClipboard(win, async () => { throw new Error('Permission denied'); });
    doc.execCommand = command => {
      legacyCopies++;
      assert.equal(command, 'copy');
      assert.equal(doc.activeElement.id, 'review-text');
      assert.equal($('review-text').selectionStart, 0);
      assert.equal($('review-text').selectionEnd, $('review-text').value.length);
      return true;
    };
  });
  type('I explored wall clocks.');
  $('review-text').setSelectionRange(2, 7);
  submit();
  await settle();
  assert.equal(legacyCopies, 1);
  assert.equal($('review-text').selectionStart, 2);
  assert.equal($('review-text').selectionEnd, 7);
  assert.deepEqual(destinations, [GOOGLE_REVIEW_URL]);
  assert.equal($('status-message').textContent, COPY.en.copied);
});

test('desktop copy failure closes its popup, selects text, and waits for manual recovery', async t => {
  const { popup, destinations } = popupStub();
  const { $, type, submit, doc, navigations } = fixture(t, (win, doc) => {
    win.open = () => popup;
    setClipboard(win, async () => { throw new Error('Permission denied'); });
    doc.execCommand = () => false;
  });
  type('The service could improve.');
  submit();
  await settle();
  assert.equal(popup.closed, true);
  assert.deepEqual(destinations, []);
  assert.deepEqual(navigations, []);
  assert.equal($('status-message').textContent, COPY.en.copyFailed);
  assert.equal($('status').dataset.tone, 'error');
  assert.equal(doc.activeElement, $('review-text'));
  assert.equal($('review-text').selectionStart, 0);
  assert.equal($('review-text').selectionEnd, $('review-text').value.length);
  assert.equal($('open-google').hidden, false);
  assert.equal($('copy-open').disabled, false);
  $('open-google').click();
  assert.deepEqual(navigations, [GOOGLE_REVIEW_URL]);
});

test('a blocked desktop popup copies first and then opens the review form in the current tab', async t => {
  const copied = [];
  const { $, type, submit, navigations } = fixture(t, win => {
    win.open = () => null;
    setClipboard(win, async text => copied.push(text));
  });
  type('I looked at Casio watches.');
  submit();
  assert.deepEqual(navigations, []);
  await settle();
  assert.deepEqual(copied, ['I looked at Casio watches.']);
  assert.deepEqual(navigations, [GOOGLE_REVIEW_URL]);
  assert.equal($('status-message').textContent, COPY.en.copied);
  assert.equal($('open-google').hidden, true);
});

for (const detection of ['userAgent', 'userAgentData']) {
  test(`Android detection via ${detection} copies synchronously before opening Maps without a popup`, async t => {
    const events = [];
    const { $, type, submit, navigations } = fixture(t, (win, doc) => {
      if (detection === 'userAgent') setAndroid(win);
      else setNavigator(win, 'userAgentData', { platform: 'Android' });
      setNavigator(win, 'userActivation', { isActive: false });
      win.open = () => { events.push('popup'); return null; };
      setClipboard(win, async () => { events.push('async-copy'); });
      doc.execCommand = command => {
        events.push(command);
        assert.equal(doc.activeElement.id, 'review-text');
        return true;
      };
    });
    type('The collection was good.');
    submit();
    assert.deepEqual(events, ['copy']);
    assert.deepEqual(navigations, [ANDROID_MAPS_INTENT]);
    await settle();
    assert.deepEqual(events, ['copy']);
    assert.deepEqual(navigations, [ANDROID_MAPS_INTENT]);
    assert.equal($('open-google').hidden, false);
  });
}

test('Android falls back to async clipboard and opens Maps while activation remains available', async t => {
  const events = [];
  const { type, submit, navigations } = fixture(t, (win, doc) => {
    setAndroid(win);
    setNavigator(win, 'userActivation', { isActive: true });
    win.open = () => { events.push('popup'); return null; };
    doc.execCommand = () => { events.push('sync-copy'); return false; };
    setClipboard(win, async text => { events.push(['async-copy', text]); });
  });
  type('I only browsed watches.');
  submit();
  await settle();
  assert.deepEqual(events, ['sync-copy', ['async-copy', 'I only browsed watches.']]);
  assert.deepEqual(navigations, [ANDROID_MAPS_INTENT]);
});

test('Android async copy with lost activation waits for a fresh recovery click before opening Maps', async t => {
  let finishCopy;
  let copies = 0;
  const activation = { isActive: true };
  const { $, type, submit, navigations } = fixture(t, (win, doc) => {
    setAndroid(win);
    setNavigator(win, 'userActivation', activation);
    win.open = () => { throw new Error('Android must not open a popup'); };
    doc.execCommand = () => false;
    setClipboard(win, () => {
      copies++;
      return new Promise(resolve => { finishCopy = resolve; });
    });
  });
  type('The strap was uncomfortable.');
  submit();
  submit();
  assert.equal(copies, 1);
  assert.deepEqual(navigations, []);
  activation.isActive = false;
  finishCopy();
  await settle();
  assert.deepEqual(navigations, []);
  assert.equal($('status-message').textContent, COPY.en.popupBlocked);
  assert.equal($('open-google').hidden, false);
  activation.isActive = true;
  $('open-google').click();
  assert.deepEqual(navigations, [ANDROID_MAPS_INTENT]);
  assert.equal($('open-google').hidden, false);
  $('open-google').click();
  assert.deepEqual(navigations, [ANDROID_MAPS_INTENT, GOOGLE_REVIEW_URL]);
  assert.equal(copies, 1);
});

test('an Android intent silently ignored by the browser leaves a direct review fallback', async t => {
  let copies = 0;
  const { $, type, submit, navigations } = fixture(t, (win, doc) => {
    setAndroid(win);
    doc.execCommand = () => { copies++; return true; };
  });
  type('I browsed the watch collection.');
  submit();
  assert.deepEqual(navigations, [ANDROID_MAPS_INTENT]);
  await settle();
  assert.equal($('open-google').hidden, false);
  $('open-google').click();
  assert.deepEqual(navigations, [ANDROID_MAPS_INTENT, GOOGLE_REVIEW_URL]);
  assert.equal(copies, 1);
});

test('a rejected Android intent offers a direct browser review retry without copying again', async t => {
  const attempts = [];
  let copies = 0;
  const { $, type, submit } = fixture(t, (win, doc) => {
    setAndroid(win);
    doc.execCommand = () => { copies++; return true; };
    win.location.assign = url => {
      attempts.push(url);
      if (attempts.length === 1) throw new Error('Intent navigation rejected');
    };
  });
  type('The staff answered my questions.');
  submit();
  await settle();
  assert.deepEqual(attempts, [ANDROID_MAPS_INTENT]);
  assert.equal($('status-message').textContent, COPY.en.popupBlocked);
  assert.equal($('open-google').hidden, false);
  $('open-google').click();
  assert.deepEqual(attempts, [ANDROID_MAPS_INTENT, GOOGLE_REVIEW_URL]);
  assert.equal(copies, 1);
});

test('a page kept in the back-forward cache retains choice, editor, and submit handlers', async t => {
  const copied = [];
  const { popup, destinations } = popupStub();
  const { win, doc, $, choose, tap, type, submit } = fixture(t, win => {
    setClipboard(win, async text => copied.push(text));
    win.open = () => popup;
  });
  tap('selection');
  const pagehide = new win.Event('pagehide');
  Object.defineProperty(pagehide, 'persisted', { value: true });
  win.dispatchEvent(pagehide);
  win.dispatchEvent(new win.Event('pageshow'));
  choose('brand', 'Casio');
  assert.match($('review-text').value, /Casio/);
  tap('staff');
  assert.equal(doc.querySelector('[data-experience="staff"]').getAttribute('aria-pressed'), 'true');
  assert.match($('review-text').value, /helpful staff/);
  const ownWords = 'I only browsed Casio watches and asked about the warranty.';
  type(ownWords);
  choose('language', 'hi');
  assert.equal(doc.documentElement.lang, 'hi');
  assert.equal($('review-text').value, ownWords);
  submit();
  await settle();
  assert.deepEqual(copied, [ownWords]);
  assert.deepEqual(destinations, [GOOGLE_REVIEW_URL]);
});

test('Android copy failure never navigates until the customer uses manual recovery', async t => {
  let copies = 0;
  const { $, doc, type, submit, navigations } = fixture(t, (win, doc) => {
    setAndroid(win);
    win.open = () => { throw new Error('Android must not open a popup'); };
    doc.execCommand = () => false;
    setClipboard(win, async () => { copies++; throw new Error('Permission denied'); });
  });
  type('The staff were helpful.');
  submit();
  await settle();
  assert.equal(copies, 1);
  assert.deepEqual(navigations, []);
  assert.equal($('status-message').textContent, COPY.en.copyFailed);
  assert.equal($('open-google').hidden, false);
  assert.equal(doc.activeElement, $('review-text'));
  assert.equal($('review-text').selectionStart, 0);
  assert.equal($('review-text').selectionEnd, $('review-text').value.length);
  $('open-google').click();
  assert.deepEqual(navigations, [ANDROID_MAPS_INTENT]);
  assert.equal($('open-google').hidden, false);
  $('open-google').click();
  assert.deepEqual(navigations, [ANDROID_MAPS_INTENT, GOOGLE_REVIEW_URL]);
  assert.equal(copies, 1);
});
