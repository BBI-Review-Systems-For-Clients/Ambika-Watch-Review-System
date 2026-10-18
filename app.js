import { BRAND_NAMES, GOOGLE_REVIEW_URL, LANGUAGES, composeReview } from './review-core.js';
import { ANDROID_MAPS_INTENT, getReviewDestination } from './review-navigation.js';
import { COPY } from './i18n.js';

export function initReviewApp(doc = document, win = window, { navigate = url => win.location.assign(url) } = {}) {
  const $ = id => doc.getElementById(id);
  const editor = $('review-text');
  const language = $('language');
  const product = $('product');
  const brand = $('brand');
  const submit = $('copy-open');
  const selected = new Set();
  let edited = false;
  let copying = false;
  let readyToLeave = false;
  let nextDestination = getReviewDestination(win.navigator);
  let disposed = false;
  const listeners = [];
  const on = (element, event, handler) => {
    element.addEventListener(event, handler);
    listeners.push(() => element.removeEventListener(event, handler));
  };
  const copy = () => COPY[language.value] || COPY.en;
  const notify = (key, tone = '') => {
    $('status').textContent = key ? copy()[key] : '';
    $('status').dataset.tone = tone;
  };
  const updateEditor = () => {
    submit.disabled = copying || !editor.value.trim();
    editor.readOnly = copying;
    doc.querySelectorAll('select, [data-experience]').forEach(control => { control.disabled = copying; });
    submit.querySelector('span').textContent = copying ? copy().busy : readyToLeave ? copy().leaveReview : copy().copyOpen;
    const words = editor.value.trim().split(/\s+/u).filter(Boolean).length;
    $('word-count').textContent = `${words} ${copy().words}`;
  };
  const refresh = () => {
    editor.value = composeReview({ language: language.value, experiences: [...selected], product: product.value, brand: brand.value });
    edited = false;
    readyToLeave = false;
    nextDestination = getReviewDestination(win.navigator);
    notify('');
    updateEditor();
  };
  const changeChoices = () => {
    if (edited && editor.value.trim()) notify('kept');
    else refresh();
  };

  for (const name of BRAND_NAMES) {
    const option = doc.createElement('option');
    option.value = name;
    option.textContent = name;
    brand.append(option);
  }
  for (const chip of doc.querySelectorAll('[data-experience]')) {
    on(chip, 'click', () => {
      const id = chip.dataset.experience;
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      chip.setAttribute('aria-pressed', String(selected.has(id)));
      changeChoices();
    });
  }
  on(editor, 'input', () => { edited = true; readyToLeave = false; nextDestination = getReviewDestination(win.navigator); updateEditor(); notify(''); });
  on(product, 'change', changeChoices);
  on(brand, 'change', changeChoices);
  function translate() {
    doc.documentElement.lang = language.value;
    doc.querySelectorAll('[data-i18n]').forEach(element => {
      const value = copy()[element.dataset.i18n];
      if (value) element.textContent = value;
    });
    editor.placeholder = copy().placeholder;
    updateEditor();
  }
  on(language, 'change', () => {
    if (!LANGUAGES.includes(language.value)) language.value = 'en';
    translate();
    if (edited && editor.value.trim()) notify('languageKept');
    else refresh();
  });

  function legacyCopy() {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.focus();
    editor.select();
    const success = typeof doc.execCommand === 'function' && doc.execCommand('copy');
    if (success) editor.setSelectionRange(start, end);
    return Boolean(success);
  }
  async function clipboardWrite(text) {
    if (win.navigator.clipboard?.writeText) {
      let timer;
      try {
        await Promise.race([
          win.navigator.clipboard.writeText(text),
          new Promise((_, reject) => { timer = win.setTimeout(() => reject(new Error('Clipboard timeout')), 2500); }),
        ]);
        return true;
      } catch { /* Fall back to a selected-text copy. */ }
      finally { win.clearTimeout(timer); }
    }
    try { return legacyCopy(); } catch { return false; }
  }
  function leaveReview() {
    const target = nextDestination;
    try { navigate(target); }
    catch { notify('openFailed', 'error'); }
    // A second real tap uses HTTPS if the app launch is refused or ignored.
    if (target === ANDROID_MAPS_INTENT) nextDestination = GOOGLE_REVIEW_URL;
  }
  on($('review-form'), 'submit', async event => {
    event.preventDefault();
    if (copying) return;
    if (!editor.value.trim()) { notify('empty', 'error'); editor.focus(); return; }
    if (readyToLeave) { leaveReview(); return; }
    const text = editor.value.trim();
    copying = true;
    // Keep the visible and copied draft consistent while the clipboard is pending.
    editor.readOnly = true;
    updateEditor();
    const android = nextDestination === ANDROID_MAPS_INTENT;
    let copied = false;
    // Preserve the original click's activation for Android app intents.
    if (android) { try { copied = legacyCopy(); } catch {} }
    const copiedDuringClick = copied;
    if (!copied) copied = await clipboardWrite(text);
    copying = false;
    editor.readOnly = false;
    readyToLeave = true;
    if (disposed) { updateEditor(); return; }
    if (!copied) {
      editor.focus(); editor.select();
      notify('copyFailed', 'error');
    } else {
      notify('copied');
      if (android && !copiedDuringClick && win.navigator.userActivation?.isActive === false) notify('openFailed', 'error');
      else leaveReview();
    }
    updateEditor();
  });

  translate();
  const dispose = () => { disposed = true; listeners.forEach(remove => remove()); };
  on(win, 'pagehide', event => { if (!event.persisted) dispose(); });
  return { dispose };
}

if (typeof document !== 'undefined' && document.getElementById('review-form')) initReviewApp();
