import { BRAND_NAMES, LANGUAGES } from './review-core.js';

const EXPERIENCE_IDS = ['selection', 'staff', 'value', 'quick', 'mixed', 'improve'];
const POSITIVE_IDS = EXPERIENCE_IDS.slice(0, 4);
const PRODUCT_IDS = ['women', 'men', 'gift', 'clock'];
const MAX_POOL_SIZE = 500;

// Neutral introductions are editable starting points, not invented experiences.
const STARTERS = {
  en: [
    'Sharing my feedback about Ambika Watch & Gift in Surat.',
    'My review is about Ambika Watch & Gift, Surat.',
    'I would like to share feedback about Ambika Watch & Gift in Surat.',
    'A few words about Ambika Watch & Gift in Surat.',
    'Here is my feedback for Ambika Watch & Gift, Surat.',
    'Writing my review of Ambika Watch & Gift in Surat.',
    'This review is for Ambika Watch & Gift in Surat.',
    'My feedback for Ambika Watch & Gift, Surat.',
    'A short review of Ambika Watch & Gift in Surat.',
    "I'm sharing a review of Ambika Watch & Gift, Surat.",
  ],
  hi: [
    'Surat ke Ambika Watch & Gift ke baare mein meri rai.',
    'Yeh mera Ambika Watch & Gift, Surat ka review hai.',
    'Ambika Watch & Gift, Surat ke liye meri taraf se feedback.',
    'Ambika Watch & Gift, Surat ke baare mein kuch shabd.',
    'Ambika Watch & Gift, Surat ke liye meri apni rai.',
    'Surat ke Ambika Watch & Gift ke liye mera review.',
    'Yahan Ambika Watch & Gift, Surat par apna feedback likhna hai.',
    'Ambika Watch & Gift, Surat par mera chhota sa review.',
    'Surat ke Ambika Watch & Gift par meri taraf se kuch baatein.',
    'Yeh feedback Ambika Watch & Gift, Surat ke liye hai.',
  ],
  gu: [
    'Suratna Ambika Watch & Gift vishe maro abhipray.',
    'Aa maro Ambika Watch & Gift, Suratno review chhe.',
    'Ambika Watch & Gift, Surat mate maro feedback.',
    'Ambika Watch & Gift, Surat vishe thoda shabdo.',
    'Suratna Ambika Watch & Gift vishe mari vat.',
    'Ambika Watch & Gift, Surat mate mari tarafthi review.',
    'Aa feedback Ambika Watch & Gift, Surat mate chhe.',
    'Ambika Watch & Gift, Surat vishe maro tunko review.',
    'Suratna Ambika Watch & Gift mate mari nodh.',
    'Ambika Watch & Gift, Surat vishe mari tarafthi thodi vato.',
  ],
};

const PRODUCTS = {
  en: { women: "women's watches", men: "men's watches", gift: 'watches for gifting', clock: 'wall clocks', none: 'watches' },
  hi: { women: 'mahilaon ki ghadiyan', men: 'purushon ki ghadiyan', gift: 'gift dene ke liye ghadiyan', clock: 'deewar ghadiyan', none: 'ghadiyan' },
  gu: { women: 'mahilao ni ghadiyalo', men: 'purusho ni ghadiyalo', gift: 'bhet aapva mate ghadiyalo', clock: 'deeval ghadiyalo', none: 'ghadiyalo' },
};

const POSITIVES = {
  en: {
    selection: ['the selection', 'the collection', 'the variety on offer'],
    staff: ['the helpful staff', "the staff's help", 'the helpful assistance'],
    value: ['the fair prices', 'the reasonable prices', 'the value for money'],
    quick: ['the quick service', 'the prompt service', 'the short wait for service'],
  },
  hi: {
    selection: ['collection achha tha', 'variety achhi thi', 'achhe options the'],
    staff: ['staff ne madad ki', 'staff madadgar tha', 'mujhe achhi madad mili'],
    value: ['daam wajib lage', 'keematein sahi lagi', 'keemat ke hisaab se value achhi lagi'],
    quick: ['service jaldi mili', 'service tez thi', 'service ke liye kam intezar karna pada'],
  },
  gu: {
    selection: ['collection saru hatu', 'variety sari hati', 'sara vikalpo hata'],
    staff: ['staffe madad kari', 'staff madadrup hato', 'mane sari madad mali'],
    value: ['bhav vajbi lagya', 'kimat yogya lagi', 'kimat pramane sari value lagi'],
    quick: ['service jhadapthi mali', 'service jhadpi hati', 'service mate ochhi rah jovi padi'],
  },
};

const SENTIMENTS = {
  en: {
    mixed: ['My experience was mixed.', 'Overall, it was a mixed experience.', 'I had both positive and negative impressions.'],
    improve: ['There is room for improvement.', 'I felt some things could be better.', 'I think the experience could improve.'],
    both: ['My experience was mixed, with room for improvement.', 'Overall, it was a mixed experience and some things could be better.', 'I had mixed impressions and felt there was room for improvement.'],
  },
  hi: {
    mixed: ['Mera anubhav mila-jula raha.', 'Anubhav mein achhi aur kam achhi, dono baatein thi.', 'Meri rai mili-juli hai.'],
    improve: ['Sudhar ki gunjaish hai.', 'Mujhe laga ki kuch baatein aur behtar ho sakti hain.', 'Mere hisaab se anubhav aur behtar ho sakta tha.'],
    both: ['Mera anubhav mila-jula raha aur sudhar ki gunjaish hai.', 'Meri rai mili-juli hai; kuch baatein aur behtar ho sakti hain.', 'Anubhav mein achhi aur kam achhi baatein thi, aur sudhar ki zarurat lagi.'],
  },
  gu: {
    mixed: ['Maro anubhav mishra rahyo.', 'Anubhavma sari ane ochhi sari, banne vato hati.', 'Maro abhipray mishra chhe.'],
    improve: ['Sudharani jarur lagi.', 'Haju saru thai shake.', 'Mane lagyu ke ketlik vato sudhari shake.'],
    both: ['Maro anubhav mishra rahyo ane sudharani jarur lagi.', 'Maro abhipray mishra chhe; haju saru thai shake.', 'Anubhavma sari ane ochhi sari vato hati, ane ketlik vato sudhari shake.'],
  },
};

function normalizeContext(context = {}) {
  const input = context || {};
  return {
    language: LANGUAGES.includes(input.language) ? input.language : 'en',
    experiences: EXPERIENCE_IDS.filter(id => Array.isArray(input.experiences) && input.experiences.includes(id)),
    product: PRODUCT_IDS.includes(input.product) ? input.product : 'none',
    brand: BRAND_NAMES.includes(input.brand) ? input.brand : '',
    notes: typeof input.notes === 'string' && input.notes.trim() ? input.notes : '',
  };
}

function contextSentences({ language, product, brand }) {
  if (product === 'none' && !brand) {
    return {
      en: ['My feedback is about Ambika Watch & Gift in Surat.', 'This is my review of Ambika Watch & Gift, Surat.', "I'm sharing my experience with Ambika Watch & Gift in Surat."],
      hi: ['Yeh mera Ambika Watch & Gift, Surat ka anubhav hai.', 'Meri rai Surat ke Ambika Watch & Gift ke baare mein hai.', 'Ambika Watch & Gift, Surat ke baare mein mera feedback hai.'],
      gu: ['Aa maro Ambika Watch & Gift, Suratno anubhav chhe.', 'Maro abhipray Suratna Ambika Watch & Gift vishe chhe.', 'Aa Ambika Watch & Gift, Surat vishe maro feedback chhe.'],
    }[language];
  }

  const item = PRODUCTS[language][product];
  if (language === 'en') {
    const namedItem = product === 'none' ? `the ${brand} brand` : `${brand ? `${brand} ` : ''}${item}`;
    return [
      `I explored ${namedItem} at Ambika Watch & Gift in Surat.`,
      `I looked at ${namedItem} at Ambika Watch & Gift, Surat.`,
      `At Ambika Watch & Gift in Surat, I checked out ${namedItem}.`,
      `I had a look at ${namedItem} at Ambika Watch & Gift in Surat.`,
    ];
  }
  if (language === 'hi') {
    const brandPrefix = brand ? `${brand} ki ` : '';
    const namedItem = {
      women: `mahilaon ke liye ${brandPrefix}ghadiyan`,
      men: `purushon ke liye ${brandPrefix}ghadiyan`,
      gift: `gift dene ke liye ${brandPrefix}ghadiyan`,
      clock: `${brandPrefix}deewar ghadiyan`,
      none: `${brand} brand`,
    }[product];
    const seen = product === 'none' ? 'dekha' : 'dekhi';
    return [
      `Maine Surat ke Ambika Watch & Gift mein ${namedItem} ${seen}.`,
      `Surat ke Ambika Watch & Gift mein maine ${namedItem} ${seen}.`,
      `Ambika Watch & Gift, Surat mein maine ${namedItem} par nazar dali.`,
    ];
  }
  const brandPrefix = brand ? `${brand} ni ` : '';
  const namedItem = {
    women: `mahilao mate ${brandPrefix}ghadiyalo`,
    men: `purusho mate ${brandPrefix}ghadiyalo`,
    gift: `bhet aapva mate ${brandPrefix}ghadiyalo`,
    clock: `${brandPrefix}deeval ghadiyalo`,
    none: `${brand} brand`,
  }[product];
  const seen = product === 'none' ? 'joyo' : 'joi';
  return [
    `Me Suratna Ambika Watch & Giftma ${namedItem} ${seen}.`,
    `Suratna Ambika Watch & Giftma me ${namedItem} ${seen}.`,
    `Ambika Watch & Gift, Suratma me ${namedItem} ${seen}.`,
  ];
}

function joinItems(items, language) {
  if (items.length < 2) return items[0] || '';
  const conjunction = { en: 'and', hi: 'aur', gu: 'ane' }[language];
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items.at(-1)}`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function positiveSentences(language, chosen) {
  const ids = POSITIVE_IDS.filter(id => chosen.includes(id));
  if (!ids.length) return [''];
  let combinations = [[]];
  for (const id of ids) {
    combinations = combinations.flatMap(previous => POSITIVES[language][id].map(phrase => [...previous, phrase]));
  }
  const sentences = new Set();
  for (const combination of combinations) {
    const orders = combination.length > 1 ? [combination, [...combination].reverse()] : [combination];
    for (const order of orders) {
      const list = joinItems(order, language);
      const variants = {
        en: [`I appreciated ${list}.`, `I liked ${list}.`, `${capitalize(list)} stood out to me.`],
        hi: [`Yahan ${list}.`, `Mere liye ${list}.`, `${capitalize(list)}.`],
        gu: [`Ahiya ${list}.`, `Mara anubhavma ${list}.`, `${capitalize(list)}.`],
      };
      for (const sentence of variants[language]) sentences.add(sentence);
    }
  }
  return [...sentences];
}

/** Build complete, customer-grounded drafts. Unknown choices never add facts. */
export function buildReviewPool(context = {}) {
  const normalized = normalizeContext(context);
  const { language, experiences, product, brand, notes } = normalized;
  if (!experiences.length && product === 'none' && !brand) {
    return notes ? [notes] : [...STARTERS[language]];
  }

  const contexts = contextSentences(normalized);
  const positives = positiveSentences(language, experiences);
  const sentiment = experiences.includes('mixed') && experiences.includes('improve') ? 'both'
    : experiences.includes('mixed') ? 'mixed'
      : experiences.includes('improve') ? 'improve' : null;
  const negatives = sentiment ? SENTIMENTS[language][sentiment] : [''];
  const drafts = new Set();
  for (const opening of contexts) {
    for (const positive of positives) {
      for (const negative of negatives) {
        const draft = [opening, positive, negative].filter(Boolean).join(' ');
        // Keep the generated text brief without truncating any supplied fact or note.
        if (draft.split(/\s+/u).length > 65) continue;
        drafts.add(notes ? `${draft}\n\n${notes}` : draft);
      }
    }
  }
  const pool = [...drafts];
  if (pool.length <= MAX_POOL_SIZE) return pool;
  // Even sampling retains different openings and phrases throughout the full set.
  return Array.from({ length: MAX_POOL_SIZE }, (_, index) => pool[Math.floor(index * pool.length / MAX_POOL_SIZE)]);
}

/**
 * Select a random complete draft, exhausting a context's pool before reuse.
 * State stays in this instance's memory; reordered/duplicate choices share a pool.
 */
export function createReviewGenerator({ random = Math.random } = {}) {
  const contexts = new Map();
  return {
    generate(context = {}) {
      const normalized = normalizeContext(context);
      const key = JSON.stringify(normalized);
      let state = contexts.get(key);
      if (!state) {
        state = { pool: buildReviewPool(normalized), remaining: [], previous: '' };
        contexts.set(key, state);
      }
      if (!state.remaining.length) state.remaining = state.pool.map((_, index) => index);
      const eligible = state.remaining.length > 1
        ? state.remaining.filter(index => state.pool[index] !== state.previous)
        : state.remaining;
      const index = eligible[Math.floor(random() * eligible.length)];
      state.remaining.splice(state.remaining.indexOf(index), 1);
      state.previous = state.pool[index];
      return state.previous;
    },
  };
}
