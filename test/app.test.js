import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { initReviewApp } from '../app.js';
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
  return { win, doc, $, choose, type, tap, submit };
}

function setClipboard(win, writeText) {
  Object.defineProperty(win.navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
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

test('initial page requires customer input and does not preselect a rating or experience', t => {
  const { doc, $ } = fixture(t);
  assert.equal($('review-text').value, '');
  assert.equal($('copy-open').disabled, true);
  assert.equal($('word-count').textContent, '0 words');
  assert.equal(doc.querySelectorAll('[data-experience][aria-pressed="true"]').length, 0);
  assert.equal(doc.querySelectorAll('[name="rating"], [role="radio"], input[type="radio"]').length, 0);
  assert.equal($('direct-google').href, googleURL);
  assert.equal($('direct-google').target, '_blank');
  assert.match($('direct-google').rel, /noopener/);
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

test('a critical review has the same copy and Google destination as any other feedback', async t => {
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
  assert.deepEqual(destinations, [googleURL]);
  assert.equal($('status').textContent, COPY.en.copied);
});

test('manual wording survives new choices and language changes until an explicit refresh', t => {
  const { $, type, tap, choose, win, doc } = fixture(t);
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
  let confirmations = 0;
  win.confirm = message => {
    confirmations++;
    assert.equal(message, COPY.gu.confirmRefresh);
    return true;
  };
  $('refresh-draft').click();
  assert.equal(confirmations, 1);
  assert.notEqual($('review-text').value, ownWords);
  assert.match($('review-text').value, /Casio/);
  assert.match($('review-text').value, /પુરુષોની ઘડિયાળો/);
});

test('cancelling a draft refresh preserves the original manual wording', t => {
  const { $, type, tap, win } = fixture(t);
  type('I only browsed. Please keep these exact words.');
  tap('mixed');
  win.confirm = () => false;
  $('refresh-draft').click();
  assert.equal($('review-text').value, 'I only browsed. Please keep these exact words.');
  assert.equal($('copy-open').disabled, false);
});

test('copy reserves a popup synchronously, writes once, and then opens the fixed Google form', async t => {
  const events = [];
  const { popup, destinations } = popupStub();
  let finishCopy;
  const { $, type, submit } = fixture(t, win => {
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
  finishCopy();
  await settle();
  assert.deepEqual(destinations, [googleURL]);
  assert.equal($('status').textContent, COPY.en.copied);
  assert.equal($('copy-open').disabled, false);
});

test('clipboard permission rejection falls back to a selected-text copy', async t => {
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
  assert.deepEqual(destinations, [googleURL]);
  assert.equal($('status').textContent, COPY.en.copied);
});

test('total copy failure closes the empty popup and gives a manual copy instruction', async t => {
  const { popup, destinations } = popupStub();
  const { $, type, submit, doc } = fixture(t, (win, doc) => {
    win.open = () => popup;
    setClipboard(win, async () => { throw new Error('Permission denied'); });
    doc.execCommand = () => false;
  });
  type('The service could improve.');
  submit();
  await settle();
  assert.equal(popup.closed, true);
  assert.deepEqual(destinations, []);
  assert.equal($('status').textContent, COPY.en.copyFailed);
  assert.equal($('status').dataset.tone, 'error');
  assert.equal(doc.activeElement, $('review-text'));
  assert.equal($('review-text').selectionStart, 0);
  assert.equal($('review-text').selectionEnd, $('review-text').value.length);
  assert.equal($('direct-google').href, googleURL);
  assert.equal($('copy-open').disabled, false);
});

test('a blocked popup still copies the review and points to the direct Google link', async t => {
  const copied = [];
  const { $, type, submit } = fixture(t, win => {
    win.open = () => null;
    setClipboard(win, async text => copied.push(text));
  });
  type('I looked at Casio watches.');
  submit();
  await settle();
  assert.deepEqual(copied, ['I looked at Casio watches.']);
  assert.equal($('status').textContent, COPY.en.popupBlocked);
  assert.equal($('direct-google').href, googleURL);
  assert.equal($('copy-open').disabled, false);
});

test('optional AI is hidden when the browser does not offer an on-device model', t => {
  const { $, win } = fixture(t);
  assert.equal(win.LanguageModel, undefined);
  assert.equal($('polish-review').hidden, true);
});

test('on-device AI edits existing text without network requests and leaves the result editable', async t => {
  const calls = [];
  let networkRequests = 0;
  let destroyed = 0;
  const { $, type } = fixture(t, win => {
    win.fetch = () => { networkRequests++; throw new Error('Unexpected network request'); };
    win.LanguageModel = {
      availability: async options => { calls.push(['availability', options]); return 'available'; },
      create: async options => {
        calls.push(['create', options]);
        return {
          prompt: async prompt => { calls.push(['prompt', prompt]); return 'I browsed Casio watches. The service was slow.'; },
          destroy: () => { destroyed++; },
        };
      },
    };
  });
  assert.equal($('polish-review').hidden, false);
  type('I look at Casio watches. Service slow.');
  $('polish-review').click();
  await settle();
  assert.equal($('review-text').value, 'I browsed Casio watches. The service was slow.');
  assert.match(calls.find(([name]) => name === 'prompt')[1], /I look at Casio watches\. Service slow\./);
  assert.deepEqual(calls[0][1].expectedInputs, [{ type: 'text', languages: ['en'] }]);
  assert.equal(networkRequests, 0);
  assert.equal(destroyed, 1);
  assert.equal($('status').textContent, COPY.en.polished);
  assert.equal($('review-text').readOnly, false);
  type('My final words, including criticism.');
  assert.equal($('review-text').value, 'My final words, including criticism.');
  assert.equal($('copy-open').disabled, false);
});

test('an AI response cannot overwrite words typed while polishing is pending', async t => {
  let completePrompt;
  let destroyed = 0;
  const { $, type } = fixture(t, win => {
    win.LanguageModel = {
      availability: async () => 'available',
      create: async () => ({
        prompt: () => new Promise(resolve => { completePrompt = resolve; }),
        destroy: () => { destroyed++; },
      }),
    };
  });
  type('The staff helped.');
  $('polish-review').click();
  await settle();
  assert.equal(typeof completePrompt, 'function');
  assert.equal($('polish-review').disabled, true);
  type('I changed my mind: the service was slow.');
  completePrompt('The staff were helpful.');
  await settle();
  assert.equal($('review-text').value, 'I changed my mind: the service was slow.');
  assert.equal($('status').textContent, COPY.en.aiChanged);
  assert.equal($('polish-review').disabled, false);
  assert.equal(destroyed, 1);
});
