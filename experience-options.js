/** Phrase choices describe possibilities; only the customer selects their experience. */
export const EXPERIENCE_IDS = Object.freeze([
  'selection', 'staff', 'value', 'quick', 'mixed', 'improve',
]);

const PHRASES = {
  en: {
    selection: ['Good collection', 'Good watch selection', 'Plenty of options', 'Nice variety of watches', 'A collection I liked'],
    staff: ['Helpful staff', 'Friendly assistance', 'Staff were helpful', 'Supportive staff', 'Helpful service'],
    value: ['Fair prices', 'Good value', 'Reasonable prices', 'Prices felt fair', 'Good value for money'],
    quick: ['Quick service', 'Prompt service', 'Service was quick', 'Help without much waiting', 'Fast assistance'],
    mixed: ['Mixed experience', 'Some good, some not', 'An uneven experience', 'Both positives and negatives', 'A mixed visit'],
    improve: ['Could be better', 'Room for improvement', 'Needs improvement', 'A few things could improve', 'I expected better'],
  },
  hi: {
    selection: ['अच्छा कलेक्शन', 'अच्छी वैरायटी', 'घड़ियों के अच्छे विकल्प', 'पसंद आने वाला कलेक्शन', 'अच्छा घड़ी कलेक्शन'],
    staff: ['मददगार स्टाफ', 'स्टाफ ने मदद की', 'अच्छी सहायता मिली', 'मदद करने वाला स्टाफ', 'स्टाफ का अच्छा सहयोग'],
    value: ['उचित कीमतें', 'वाजिब दाम', 'कीमतों के हिसाब से अच्छी वैल्यू', 'पैसों के हिसाब से अच्छी वैल्यू', 'दाम सही लगे'],
    quick: ['जल्दी मिली सर्विस', 'तेज़ सर्विस', 'बिना ज़्यादा इंतज़ार के मदद', 'मदद जल्दी मिली', 'सर्विस में कम समय लगा'],
    mixed: ['मिला-जुला अनुभव', 'कुछ अच्छा, कुछ कम अच्छा', 'अनुभव में उतार-चढ़ाव', 'अच्छी और कम अच्छी बातें', 'कुछ बातें अच्छी, कुछ नहीं'],
    improve: ['और बेहतर हो सकता है', 'सुधार की गुंजाइश है', 'सुधार की ज़रूरत है', 'कुछ बातें सुधर सकती हैं', 'उम्मीद से कम अच्छा'],
  },
  gu: {
    selection: ['સારું કલેક્શન', 'સારી વેરાયટી', 'ઘડિયાળોના સારા વિકલ્પો', 'ગમ્યું એવું કલેક્શન', 'ઘડિયાળોની સારી પસંદગી'],
    staff: ['મદદરૂપ સ્ટાફ', 'સ્ટાફે મદદ કરી', 'સારી મદદ મળી', 'સ્ટાફનો સારો સહકાર', 'મદદ કરવા તૈયાર સ્ટાફ'],
    value: ['વાજબી ભાવ', 'કિંમત પ્રમાણે સારી વેલ્યુ', 'ભાવ યોગ્ય લાગ્યા', 'સારા ભાવે સારી વેલ્યુ', 'યોગ્ય કિંમત'],
    quick: ['ઝડપી સર્વિસ', 'સર્વિસ ઝડપથી મળી', 'મદદ ઝડપથી મળી', 'ઓછા સમયમાં સર્વિસ', 'વધુ રાહ જોવી ન પડી'],
    mixed: ['મિશ્ર અનુભવ', 'થોડું સારું, થોડું ઓછું સારું', 'સારો અને ઓછો સારો અનુભવ', 'કેટલીક વાતો સારી, કેટલીક નહીં', 'અનુભવમાં ઉતાર-ચઢાવ'],
    improve: ['હજુ સારું થઈ શકે', 'સુધારાની જરૂર છે', 'સુધારાની તક છે', 'કેટલીક વાતો સુધરી શકે', 'અપેક્ષા કરતાં ઓછું સારું'],
  },
};

function shuffle(options, random) {
  // Fisher–Yates: each remaining position has the same probability at every step.
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

export function getExperienceOptions({ language = 'en', random = Math.random } = {}) {
  const catalog = Object.hasOwn(PHRASES, language) ? PHRASES[language] : PHRASES.en;
  const options = EXPERIENCE_IDS.map(id => ({
    id,
    label: catalog[id][Math.floor(random() * catalog[id].length)],
  }));
  return shuffle(options, random);
}

function readApprovedIndexes(raw) {
  if (typeof raw !== 'string') return null;
  let indexes;
  try { indexes = JSON.parse(raw); } catch { return null; }
  if (!indexes || Array.isArray(indexes) || typeof indexes !== 'object') return null;
  const keys = Object.keys(indexes);
  if (keys.length !== EXPERIENCE_IDS.length || keys.some(key => !EXPERIENCE_IDS.includes(key))) return null;
  // Reject repeated JSON keys too, rather than silently accepting the last value.
  const suppliedKeys = [...raw.matchAll(/"([^"\\]*)"\s*:/gu)].map(match => match[1]);
  if (suppliedKeys.length !== EXPERIENCE_IDS.length || new Set(suppliedKeys).size !== EXPERIENCE_IDS.length) return null;
  return EXPERIENCE_IDS.every(id => Number.isInteger(indexes[id]) && indexes[id] >= 0 && indexes[id] < PHRASES.en[id].length)
    ? indexes : null;
}

/**
 * Uses only an already-installed browser model, with no customer data or downloads.
 * The model can select approved labels; it cannot write reviews or invent labels.
 */
export async function getOnDeviceExperienceOptions({ LanguageModel, language = 'en', random = Math.random, signal } = {}) {
  const fallback = () => ({ options: getExperienceOptions({ language, random }), usedAI: false });
  if (language !== 'en' || signal?.aborted || typeof LanguageModel?.availability !== 'function' || typeof LanguageModel?.create !== 'function') {
    return fallback();
  }

  const controller = new AbortController();
  const cancelFromCaller = () => controller.abort();
  signal?.addEventListener('abort', cancelFromCaller, { once: true });
  let rejectCanceled;
  const canceled = new Promise((_, reject) => { rejectCanceled = reject; });
  const cancel = () => rejectCanceled(new Error('On-device label selection canceled'));
  controller.signal.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(), 2000);
  let session;
  const destroyed = new WeakSet();
  function destroy(created) {
    if (!created || typeof created.destroy !== 'function' || destroyed.has(created)) return;
    destroyed.add(created);
    try { Promise.resolve(created.destroy()).catch(() => {}); } catch { /* Cleanup must not block the local fallback. */ }
  }
  const wait = operation => Promise.race([operation, canceled]);
  const modelOptions = {
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
  };

  try {
    // Every state other than "available" returns before create(), including downloading.
    const availability = await wait(Promise.resolve().then(() => LanguageModel.availability(modelOptions)));
    if (availability !== 'available' || controller.signal.aborted) return fallback();

    const creation = Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new Error('Model creation canceled');
      return LanguageModel.create({ ...modelOptions, signal: controller.signal });
    });
    // Creation can finish after a timeout even if the API ignores AbortSignal.
    creation.then(created => { if (controller.signal.aborted) destroy(created); }, () => {});
    session = await wait(creation);
    if (controller.signal.aborted || typeof session?.prompt !== 'function') return fallback();

    const prompt = [
      'Choose the wording for six customer-experience buttons on a watch-shop feedback page.',
      'Return ONLY one JSON object mapping each required ID to one zero-based integer index from its approved phrase list.',
      'Required IDs: selection, staff, value, quick, mixed, improve. Include every ID exactly once and no other keys.',
      'Retain the positive, mixed and critical meanings. These are choices for a customer, not statements about their visit.',
      'Do not generate reviews, ratings, recommendations, purchases, new wording or any claims about a customer.',
      `Approved phrase catalog: ${JSON.stringify(PHRASES.en)}`,
    ].join('\n');
    const raw = await wait(Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new Error('Model prompt canceled');
      return session.prompt(prompt, { signal: controller.signal });
    }));
    if (controller.signal.aborted) return fallback();
    const indexes = readApprovedIndexes(raw);
    if (!indexes) return fallback();
    return {
      options: shuffle(EXPERIENCE_IDS.map(id => ({ id, label: PHRASES.en[id][indexes[id]] })), random),
      usedAI: true,
    };
  } catch {
    return fallback();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancelFromCaller);
    controller.signal.removeEventListener('abort', cancel);
    destroy(session);
  }
}
