/** Customer-grounded review drafting. No purchase, rating or brand is inferred. */
export const BRAND_NAMES = Object.freeze([
  'Casio', 'Timex', 'Tommy Hilfiger', 'Police', 'Kenneth Cole', 'Obaku',
  'DKNY', 'Guess', 'Anne Klein', 'Lee Cooper', 'Daniel Wellington',
  'Armani Exchange', 'Emporio Armani', 'Bering', 'Fossil', 'Michael Kors',
  'Skagen', 'NAVIFORCE', 'REWARD', 'Valentine', 'Hislon', 'Titan',
  'Fastrack', 'Sonata', 'Logues', 'Onex', 'Crony', 'Canon Quartz', 'Time Square',
]);

export const GOOGLE_REVIEW_URL =
  'https://search.google.com/local/writereview?placeid=ChIJ4dkN_wJP4DsRaUIpMlm4KN8';

export const LANGUAGES = Object.freeze(['en', 'hi', 'gu']);

const positiveIds = ['selection', 'staff', 'value', 'quick'];
const productIds = ['women', 'men', 'gift', 'clock'];
const products = {
  en: { women: "women's watches", men: "men's watches", gift: 'watches for gifting', clock: 'wall clocks', none: 'watches' },
  hi: { women: 'ladies watches', men: 'gents watches', gift: 'gift ke liye watches', clock: 'wall clocks', none: 'watches' },
  gu: { women: 'ladies watches', men: 'gents watches', gift: 'gift maate watches', clock: 'wall clocks', none: 'watches' },
};
const positiveText = {
  en: { selection: 'the selection', staff: 'helpful staff', value: 'value for money', quick: 'quick service' },
  hi: { selection: 'variety achhi thi', staff: 'staff ne madad ki', value: 'price ke hisaab se value achhi lagi', quick: 'service jaldi mili' },
  gu: { selection: 'variety sari hati', staff: 'staff e madad kari', value: 'kimat pramane sari value lagi', quick: 'service jhadpi mali' },
};

function joinItems(items, language) {
  if (items.length < 2) return items[0] || '';
  const conjunction = { en: 'and', hi: 'aur', gu: 'ane' }[language];
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items.at(-1)}`;
}

/**
 * Each selected experience is an explicit statement supplied by the customer.
 * Notes are never shortened, translated, rewritten or silently discarded.
 */
export function composeReview(input = {}) {
  const { language: requestedLanguage, experiences, product, brand, notes } = input || {};
  const language = LANGUAGES.includes(requestedLanguage) ? requestedLanguage : 'en';
  const chosen = new Set(Array.isArray(experiences) ? experiences : []);
  const chosenProduct = productIds.includes(product) ? product : 'none';
  const chosenBrand = BRAND_NAMES.includes(brand) ? brand : '';
  const customerNotes = typeof notes === 'string' && notes.trim() ? notes : '';
  const sentences = [];

  if (chosenProduct !== 'none' || chosenBrand) {
    const item = products[language][chosenProduct];
    if (language === 'en') {
      sentences.push(`I explored ${chosenBrand ? `${chosenBrand} ` : ''}${item} at Ambika Watch & Gift in Surat.`);
    } else if (language === 'hi') {
      sentences.push(`Maine Surat ke Ambika Watch & Gift mein ${chosenBrand ? `${chosenBrand} brand ki ` : ''}${item} dekhi.`);
    } else {
      sentences.push(`Me Surat na Ambika Watch & Gift ma ${chosenBrand ? `${chosenBrand} brand ni ` : ''}${item} joi.`);
    }
  }

  const positives = positiveIds.filter(id => chosen.has(id)).map(id => positiveText[language][id]);
  if (positives.length) {
    const list = joinItems(positives, language);
    if (language === 'en') {
      sentences.push(`${sentences.length ? 'I appreciated' : 'At Ambika Watch & Gift in Surat, I appreciated'} ${list}.`);
    } else if (language === 'hi') {
      sentences.push(`${sentences.length ? 'Yahan' : 'Surat ke Ambika Watch & Gift mein'} ${list}.`);
    } else {
      sentences.push(`${sentences.length ? 'Ahiyan' : 'Surat na Ambika Watch & Gift ma'} ${list}.`);
    }
  }

  const mixed = chosen.has('mixed');
  const improve = chosen.has('improve');
  if (mixed || improve) {
    const hasContext = sentences.length > 0;
    if (language === 'en') {
      const context = hasContext ? 'My experience' : 'My experience at Ambika Watch & Gift in Surat';
      sentences.push(mixed
        ? `${context} was mixed${improve ? ', with room for improvement' : ''}.`
        : `${hasContext ? 'I felt there' : 'At Ambika Watch & Gift in Surat, I felt there'} was room for improvement.`);
    } else if (language === 'hi') {
      const context = hasContext ? 'Mera experience' : 'Surat ke Ambika Watch & Gift mein mera experience';
      sentences.push(mixed
        ? `${context} mila-jula raha${improve ? ' aur sudhaar ki gunjaish lagi' : ''}.`
        : `${hasContext ? 'Mujhe' : 'Surat ke Ambika Watch & Gift mein mujhe'} sudhaar ki gunjaish lagi.`);
    } else {
      const context = hasContext ? 'Maro experience' : 'Surat na Ambika Watch & Gift ma maro experience';
      sentences.push(mixed
        ? `${context} mixed rahyo${improve ? ' ane sudhar ni jarur lagi' : ''}.`
        : `${hasContext ? 'Mane' : 'Surat na Ambika Watch & Gift ma mane'} sudhar ni jarur lagi.`);
    }
  }

  const draft = sentences.join(' ');
  return customerNotes ? (draft ? `${draft}\n\n${customerNotes}` : customerNotes) : draft;
}
