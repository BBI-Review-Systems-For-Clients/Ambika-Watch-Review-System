import { BRAND_NAMES, GOOGLE_REVIEW_URL, LANGUAGES, composeReview, getPolishPrompt } from './review-core.js';
import { COPY } from './i18n.js';

export function initReviewApp(doc = document, win = window) {
  const $ = id => doc.getElementById(id);
  const editor = $('review-text');
  const language = $('language');
  const product = $('product');
  const brand = $('brand');
  const submit = $('copy-open');
  const polish = $('polish-review');
  const selected = new Set();
  let edited = false;
  let copying = false;
  let polishing = false;
  let revision = 0;
  let session;
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
    polish.disabled = polishing || !editor.value.trim();
    polish.hidden = language.value !== 'en' || !win.LanguageModel || typeof win.LanguageModel.create !== 'function';
    const words = editor.value.trim().split(/\s+/u).filter(Boolean).length;
    $('word-count').textContent = `${words} ${copy().words}`;
  };
  const draft = () => composeReview({ language: language.value, experiences: [...selected], product: product.value, brand: brand.value });
  const refresh = () => {
    editor.value = draft();
    edited = false;
    revision++;
    notify('');
    updateEditor();
  };
  const changeChoices = () => {
    revision++;
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
  on(editor, 'input', () => { edited = true; revision++; updateEditor(); notify(''); });
  on(product, 'change', changeChoices);
  on(brand, 'change', changeChoices);
  on($('refresh-draft'), 'click', () => {
    if (!edited || !editor.value.trim() || win.confirm(copy().confirmRefresh)) refresh();
  });
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
    if (edited && editor.value.trim()) { revision++; notify('languageKept'); }
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
  on($('review-form'), 'submit', async event => {
    event.preventDefault();
    if (copying) return;
    if (!editor.value.trim()) { notify('empty', 'error'); editor.focus(); return; }
    const text = editor.value.trim();
    // Reserve the tab during the user click, before the asynchronous clipboard call.
    let popup;
    try { popup = win.open('about:blank', '_blank'); if (popup) popup.opener = null; } catch { popup = null; }
    copying = true;
    updateEditor();
    submit.querySelector('span').textContent = copy().busy;
    const copied = await clipboardWrite(text);
    if (!copied) {
      try { popup?.close(); } catch { /* The manual link remains available. */ }
      editor.focus(); editor.select();
      notify('copyFailed', 'error');
    } else if (popup && !popup.closed) {
      try { popup.location.replace(GOOGLE_REVIEW_URL); notify('copied'); }
      catch { try { popup.close(); } catch {} notify('popupBlocked'); }
    } else notify('popupBlocked');
    copying = false;
    submit.querySelector('span').textContent = copy().copyOpen;
    updateEditor();
  });

  // Chrome's optional Prompt API runs the model on the customer's device.
  // No API keys, external AI endpoint, telemetry, or customer data collection.
  const LanguageModel = win.LanguageModel;
  on(polish, 'click', async () => {
    if (polishing || !editor.value.trim()) return;
    const source = editor.value;
    const sourceRevision = revision;
    const sourceLanguage = language.value;
    polishing = true;
    updateEditor();
    polish.textContent = copy().polishing;
    try {
      const availability = await LanguageModel?.availability?.({ expectedInputs: [{ type: 'text', languages: [sourceLanguage] }], expectedOutputs: [{ type: 'text', languages: [sourceLanguage] }] });
      if (!availability || availability === 'unavailable') { notify('polishUnavailable'); return; }
      if (availability === 'downloadable' && !win.confirm(copy().aiDownload)) return;
      if (availability === 'downloading') { notify('polishUnavailable'); return; }
      if (session) { session.destroy(); session = undefined; }
      session = await LanguageModel.create({ expectedInputs: [{ type: 'text', languages: [sourceLanguage] }], expectedOutputs: [{ type: 'text', languages: [sourceLanguage] }] });
      const result = await session.prompt(getPolishPrompt({ text: source, language: sourceLanguage }));
      if (disposed) return;
      if (revision !== sourceRevision) { notify('aiChanged'); return; }
      const output = typeof result === 'string' ? result.trim() : '';
      if (!output || output.length > 1000) throw new Error('Invalid edit');
      editor.value = output;
      edited = true;
      revision++;
      notify('polished');
    } catch { if (!disposed) notify('polishFailed', 'error'); }
    finally {
      try { session?.destroy(); } catch {}
      session = undefined;
      polishing = false;
      polish.textContent = copy().polish;
      updateEditor();
    }
  });
  translate();
  const dispose = () => { disposed = true; listeners.forEach(remove => remove()); try { session?.destroy(); } catch {} };
  on(win, 'pagehide', dispose);
  return { dispose };
}

if (typeof document !== 'undefined' && document.getElementById('review-form')) initReviewApp();
