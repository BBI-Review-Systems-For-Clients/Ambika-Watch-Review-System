import { BRAND_NAMES, GOOGLE_REVIEW_URL, LANGUAGES } from './review-core.js';
import { ANDROID_MAPS_INTENT, getReviewDestination } from './review-navigation.js';
import { COPY } from './i18n.js';
import { getExperienceOptions, getOnDeviceExperienceOptions } from './experience-options.js';
import { createReviewGenerator } from './review-generator.js';

export function initReviewApp(doc = document, win = window, { navigate = url => win.location.assign(url), random = Math.random, generateOptions = getOnDeviceExperienceOptions } = {}) {
  const $ = id => doc.getElementById(id);
  const editor = $('review-text');
  const language = $('language');
  const product = $('product');
  const brand = $('brand');
  const submit = $('copy-open');
  const selected = new Set();
  const generator = createReviewGenerator({ random });
  let edited = false;
  let copying = false;
  let readyToLeave = false;
  let nextDestination = getReviewDestination(win.navigator);
  let disposed = false;
  let interacted = false;
  const optionController = new AbortController();
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
    editor.value = generator.generate({ language: language.value, experiences: [...selected], product: product.value, brand: brand.value });
    resizeEditor();
    edited = false;
    readyToLeave = false;
    nextDestination = getReviewDestination(win.navigator);
    notify('');
    updateEditor();
  };
  const resizeEditor = () => {
    editor.style.height = 'auto';
    editor.style.height = `${Math.max(124, editor.scrollHeight)}px`;
  };
  const changeChoices = () => {
    if (edited && editor.value.trim()) notify('kept');
    else refresh();
  };
  const markInteraction = () => { interacted = true; optionController.abort(); };
  const renderExperiences = options => {
    const container = $('experience-chips');
    for (const option of options) {
      const chip = container.querySelector(`[data-experience="${option.id}"]`);
      if (chip) { chip.textContent = option.label; container.append(chip); }
    }
  };
  on($('review-form'), 'pointerdown', markInteraction);
  on($('review-form'), 'keydown', markInteraction);

  for (const name of BRAND_NAMES) {
    const option = doc.createElement('option');
    option.value = name;
    option.textContent = name;
    brand.append(option);
  }
  for (const chip of doc.querySelectorAll('[data-experience]')) {
    on(chip, 'click', () => {
      markInteraction();
      const id = chip.dataset.experience;
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      chip.setAttribute('aria-pressed', String(selected.has(id)));
      changeChoices();
    });
  }
  on(editor, 'focus', markInteraction);
  on(editor, 'input', () => { markInteraction(); edited = true; readyToLeave = false; nextDestination = getReviewDestination(win.navigator); resizeEditor(); updateEditor(); notify(''); });
  on(product, 'change', () => { markInteraction(); changeChoices(); });
  on(brand, 'change', () => { markInteraction(); changeChoices(); });
  function translate() {
    doc.documentElement.lang = language.value === 'en' ? 'en' : `${language.value}-Latn`;
    doc.querySelectorAll('[data-i18n]').forEach(element => {
      const value = copy()[element.dataset.i18n];
      if (value) element.textContent = value;
    });
    editor.placeholder = copy().placeholder;
    $('experience-chips').dataset.optionsSource = 'local';
    renderExperiences(getExperienceOptions({ language: language.value, random }));
    updateEditor();
  }
  on(language, 'change', () => {
    markInteraction();
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
    markInteraction();
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
  refresh();
  if (win.LanguageModel && language.value === 'en') {
    Promise.resolve(generateOptions({ LanguageModel: win.LanguageModel, language: language.value, random, signal: optionController.signal }))
      .then(result => {
        if (!disposed && !interacted && result.usedAI && language.value === 'en') {
          renderExperiences(result.options);
          $('experience-chips').dataset.optionsSource = 'on-device-ai';
        }
      }).catch(() => { /* The immediate local choices remain usable. */ });
  }
  const dispose = () => { disposed = true; optionController.abort(); listeners.forEach(remove => remove()); };
  on(win, 'pagehide', event => { if (!event.persisted) dispose(); });
  return { dispose };
}

if (typeof document !== 'undefined' && document.getElementById('review-form')) initReviewApp();
