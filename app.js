import { ANDROID_MAPS_INTENT, BRAND_NAMES, GOOGLE_REVIEW_URL, LANGUAGES, composeReview } from './review-core.js';
import { COPY } from './i18n.js';

export function initReviewApp(doc = document, win = window) {
  const $ = id => doc.getElementById(id);
  const editor = $('review-text');
  const language = $('language');
  const product = $('product');
  const brand = $('brand');
  const submit = $('copy-open');
  const selected = new Set();
  const android = /Android/i.test(win.navigator.userAgentData?.platform || win.navigator.userAgent);
  const destination = android ? ANDROID_MAPS_INTENT : GOOGLE_REVIEW_URL;
  let recoveryDestination = destination;
  let edited = false;
  let copying = false;
  let disposed = false;
  const listeners = [];
  const on = (element, event, handler) => {
    element.addEventListener(event, handler);
    listeners.push(() => element.removeEventListener(event, handler));
  };
  const copy = () => COPY[language.value] || COPY.en;
  const notify = (key, tone = '', recovery = false) => {
    $('status-message').textContent = key ? copy()[key] : '';
    $('status').dataset.tone = tone;
    $('status').hidden = !key;
    $('open-google').hidden = !recovery;
  };
  const updateEditor = () => {
    submit.disabled = copying || !editor.value.trim();
    const words = editor.value.trim().split(/\s+/u).filter(Boolean).length;
    $('word-count').textContent = `${words} ${copy().words}`;
  };
  const draft = () => composeReview({ language: language.value, experiences: [...selected], product: product.value, brand: brand.value });
  const refresh = () => {
    editor.value = draft();
    edited = false;
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
  on(editor, 'input', () => { edited = true; updateEditor(); notify(''); });
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
      } catch { /* Try a selected-text copy before asking for a manual copy. */ }
      finally { win.clearTimeout(timer); }
    }
    try { return legacyCopy(); } catch { return false; }
  }
  function navigate(target = destination) {
    try {
      win.location.assign(target);
      // Some Android browsers silently refuse an intent. Keep a normal HTTPS
      // fallback available if the customer remains on this page.
      recoveryDestination = GOOGLE_REVIEW_URL;
      notify(target === ANDROID_MAPS_INTENT ? 'copiedMaps' : 'copied', '', target === ANDROID_MAPS_INTENT);
    } catch {
      // Keep a user-initiated retry available if the browser rejects navigation.
      recoveryDestination = GOOGLE_REVIEW_URL;
      notify('popupBlocked', '', true);
    }
  }
  on($('open-google'), 'click', () => navigate(recoveryDestination));
  on($('review-form'), 'submit', async event => {
    event.preventDefault();
    if (copying) return;
    if (!editor.value.trim()) { notify('empty', 'error'); editor.focus(); return; }
    const text = editor.value.trim();
    recoveryDestination = destination;
    copying = true;
    notify('');
    updateEditor();
    submit.querySelector('span').textContent = copy().busy;
    let popup;
    try {
      // Copy synchronously on Android when possible so app launch stays within
      // the original customer gesture. No background searches or clicks run.
      let copied = false;
      if (android) {
        try { copied = legacyCopy(); } catch { /* Use the Clipboard API below. */ }
      } else {
        // Reserve the tab before awaiting clipboard permission on other devices.
        try { popup = win.open('about:blank', '_blank'); if (popup) popup.opener = null; } catch { popup = null; }
      }
      const copiedDuringClick = copied;
      if (!copied) copied = await clipboardWrite(text);
      if (disposed) { try { popup?.close(); } catch {} return; }
      if (!copied) {
        try { popup?.close(); } catch {}
        editor.focus();
        editor.select();
        notify('copyFailed', 'error', true);
      } else if (android) {
        // A permission prompt can consume the gesture required by Chrome's
        // Android intents. Offer a real tap instead of a timer-based retry.
        if (!copiedDuringClick && win.navigator.userActivation?.isActive === false) {
          notify('popupBlocked', '', true);
        } else navigate();
      } else if (popup && !popup.closed) {
        try { popup.location.replace(GOOGLE_REVIEW_URL); notify('copied'); }
        catch { try { popup.close(); } catch {} navigate(); }
      } else navigate();
    } finally {
      copying = false;
      submit.querySelector('span').textContent = copy().copyOpen;
      updateEditor();
    }
  });

  translate();
  const dispose = () => { disposed = true; listeners.forEach(remove => remove()); };
  on(win, 'pagehide', event => { if (!event.persisted) dispose(); });
  return { dispose };
}

if (typeof document !== 'undefined' && document.getElementById('review-form')) initReviewApp();
