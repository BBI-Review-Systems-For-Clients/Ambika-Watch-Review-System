import { GOOGLE_REVIEW_URL } from './review-core.js';
import { ANDROID_MAPS_INTENT, getReviewDestination } from './review-navigation.js';
import { createAutomaticReviewGenerator, LAST_REVIEW_KEY } from './auto-review-generator.js';

export { LAST_REVIEW_KEY };
export const COPY = Object.freeze({
  copyOpen: 'Copy & Leave Review',
  leaveReview: 'Leave Review',
  copied: 'Review copied.',
  empty: 'Write a few words before continuing.',
  busy: 'Copying…',
  copyFailed: 'Copy the selected text, then tap Leave Review.',
  openFailed: 'Could not open Google. Tap Leave Review to try again.',
});

export function initReviewApp(doc = document, win = window, { navigate = url => win.location.assign(url), random = Math.random, storage } = {}) {
  const $ = id => doc.getElementById(id);
  const editor = $('review-text');
  const submit = $('copy-open');
  const generator = createAutomaticReviewGenerator({ random });
  // Store an opaque catalog ID only, never the draft or the customer's edits.
  if (storage === undefined) {
    try { storage = win.sessionStorage; } catch { storage = null; }
  }
  let previousId;
  try { previousId = storage?.getItem(LAST_REVIEW_KEY); } catch { /* Storage can be blocked. */ }
  const draft = generator.generate({ previousId });
  try { storage?.setItem(LAST_REVIEW_KEY, draft.id); } catch { /* Drafts work without storage. */ }
  editor.value = draft.text;
  editor.lang = draft.language === 'en' ? 'en' : `${draft.language}-Latn`;
  doc.documentElement.lang = editor.lang;
  let copying = false;
  let readyToLeave = false;
  let nextDestination = getReviewDestination(win.navigator);
  let disposed = false;
  const listeners = [];
  const on = (element, event, handler) => {
    element.addEventListener(event, handler);
    listeners.push(() => element.removeEventListener(event, handler));
  };
  const notify = (key, tone = '') => {
    $('status').textContent = key ? COPY[key] : '';
    $('status').dataset.tone = tone;
  };
  const updateEditor = () => {
    submit.disabled = copying || !editor.value.trim();
    editor.readOnly = copying;
    submit.querySelector('span').textContent = copying ? COPY.busy : readyToLeave ? COPY.leaveReview : COPY.copyOpen;
  };
  const resizeEditor = () => {
    editor.style.height = 'auto';
    editor.style.height = `${Math.max(124, editor.scrollHeight)}px`;
  };
  on(editor, 'input', () => {
    readyToLeave = false;
    nextDestination = getReviewDestination(win.navigator);
    resizeEditor();
    updateEditor();
    notify('');
  });

  function legacyCopy() {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.focus();
    const left = editor.value.length - editor.value.trimStart().length;
    editor.setSelectionRange(left, editor.value.trimEnd().length);
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
    updateEditor();
    const android = nextDestination === ANDROID_MAPS_INTENT;
    let copied = false;
    // Preserve the original click's activation for Android app intents.
    if (android) { try { copied = legacyCopy(); } catch {} }
    const copiedDuringClick = copied;
    if (!copied) copied = await clipboardWrite(text);
    copying = false;
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
  resizeEditor();
  updateEditor();
  const dispose = () => { disposed = true; listeners.forEach(remove => remove()); };
  on(win, 'pagehide', event => { if (!event.persisted) dispose(); });
  return { dispose, draft };
}

if (typeof document !== 'undefined' && document.getElementById('review-form')) initReviewApp();
