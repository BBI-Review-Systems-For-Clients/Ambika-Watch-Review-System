import { createHash } from 'node:crypto';

export const BUSINESS_PROFILE = Object.freeze({
  name: 'Ambika Watch & Gift',
  city: 'Surat',
  servingAreas: Object.freeze(['Varachha', 'Mota Varachha', 'Katargam', 'Amroli']),
  // Watches: 60% women / 40% men. Wall clocks: 10% of overall sales.
  categories: Object.freeze([
    Object.freeze({ id: 'women', count: 270, languages: { en: 108, hi: 81, gu: 81 } }),
    Object.freeze({ id: 'men', count: 180, languages: { en: 72, hi: 54, gu: 54 } }),
    Object.freeze({ id: 'clock', count: 50, languages: { en: 20, hi: 15, gu: 15 } }),
  ]),
  keywords: Object.freeze({ en: 'watch shop in Surat', hi: 'watch shop', gu: 'watch shop' }),
});

const TOPICS = {
  en: {
    women: ["women's watches", 'ladies watches', "women's watches for gifting", 'everyday watches for women', "women's wristwatches"],
    men: ["men's watches", 'gents watches', "men's watches for gifting", 'everyday watches for men', "men's wristwatches"],
    clock: ['wall clocks', 'hanging wall clocks', 'wall clocks for home', 'wall clocks for gifting', 'wall clock designs'],
  },
  hi: {
    women: ['ladies watches', 'mahilaon ki ghadiyan', 'gift ke liye ladies watches', 'daily wear ladies watches', 'ladies ki wristwatches'],
    men: ['gents watches', 'purushon ki ghadiyan', 'gift ke liye gents watches', 'daily wear gents watches', 'gents ki wristwatches'],
    clock: ['wall clocks', 'deewar ki ghadiyan', 'ghar ke liye wall clocks', 'hanging wall clocks', 'gifting ke liye wall clocks'],
  },
  gu: {
    women: ['ladies watches', 'mahilao ni ghadiyalo', 'gift mate ladies watches', 'roj paherva mate ladies watches', 'ladies wristwatches'],
    men: ['gents watches', 'purusho ni ghadiyalo', 'gift mate gents watches', 'roj paherva mate gents watches', 'gents wristwatches'],
    clock: ['wall clocks', 'deeval ni ghadiyalo', 'ghar mate wall clocks', 'hanging wall clocks', 'gift mate wall clocks'],
  },
};

// Short descriptions use the supplied business categories, not imagined visits.
// Serving areas belong in the footer; a customer's location is not inferred.
const OPENINGS = {
  en: [
    (b, k, t) => `${b} is a ${k} with ${t}.`,
    (b, k, t) => `${b}, a ${k}, has ${t} in its range.`,
    (b, k, t) => `${t} are part of the range at ${b}, a ${k}.`,
    (b, k, t) => `${b} is a ${k}, and its collection includes ${t}.`,
    (b, k, t) => `The range at ${b}, a ${k}, includes ${t}.`,
    (b, k, t) => `${b} is a ${k} that carries ${t}.`,
    (b, k, t) => `At ${b}, a ${k}, ${t} are part of the collection.`,
    (b, k, t) => `${b} is a ${k} where the range includes ${t}.`,
  ],
  hi: [
    (b, k, t) => `Surat ki ${b} ${k} mein ${t} milti hain.`,
    (b, k, t) => `${b} ki Surat wali ${k} mein ${t} hain.`,
    (b, k, t) => `${b} Surat mein hai. Is ${k} mein ${t} hain.`,
    (b, k, t) => `${b}, Surat mein ${t} wali ${k}.`,
    (b, k, t) => `${b} ki ${k} Surat mein hai, aur yahan ${t} milti hain.`,
    (b, k, t) => `Surat mein ${b} ki ${k} par ${t} hain.`,
    (b, k, t) => `${b} ki Surat wali ${k} ki range mein ${t} hain.`,
    (b, k, t) => `Surat mein ${b} ki ${k} hai, jahan ${t} milti hain.`,
  ],
  gu: [
    (b, k, t) => `Surat ni ${b} ${k} ma ${t} male chhe.`,
    (b, k, t) => `${b} ni Surat vali ${k} ma ${t} chhe.`,
    (b, k, t) => `${b} Surat ma chhe. Aa ${k} ma ${t} male chhe.`,
    (b, k, t) => `${b}, Surat ma ${t} mate ni ${k}.`,
    (b, k, t) => `${b} ni ${k} Surat ma chhe ane ahi ${t} male chhe.`,
    (b, k, t) => `Surat ma ${b} ni ${k} par ${t} chhe.`,
    (b, k, t) => `${b} ni Surat vali ${k} na collection ma ${t} chhe.`,
    (b, k, t) => `Surat ma ${b} ni ${k} chhe, jya ${t} male chhe.`,
  ],
};

const DETAILS = {
  en: {
    women: ["The shop has men's watches and wall clocks too.", "There are men's watches and wall clocks too.", "The shop also carries men's watches and hanging wall clocks.", "Men's watches and hanging wall clocks are sold here too."],
    men: ["The shop has women's watches and wall clocks too.", "There are ladies watches and wall clocks too.", "The shop also carries women's watches and hanging wall clocks.", "Ladies watches and hanging wall clocks are sold here too."],
    clock: ["There are ladies and gents watches too.", "The shop also has women's and men's watches.", "Ladies watches and gents watches are also part of the range.", "Watches for women and men are part of the collection too."],
  },
  hi: {
    women: ['Gents watches aur wall clocks bhi hain.', 'Saath mein gents watches aur deewar ki ghadiyan bhi milti hain.', 'Gents watches ke saath wall clocks bhi yahan ki range mein hain.', 'Yahan gents watches aur ghar ke liye wall clocks bhi hain.'],
    men: ['Ladies watches aur wall clocks bhi hain.', 'Saath mein ladies watches aur deewar ki ghadiyan bhi milti hain.', 'Ladies watches ke saath wall clocks bhi yahan ki range mein hain.', 'Yahan ladies watches aur ghar ke liye wall clocks bhi hain.'],
    clock: ['Ladies aur gents watches bhi hain.', 'Saath mein ladies watches aur gents watches bhi milti hain.', 'Ladies aur gents watches bhi yahan ki range mein hain.', 'Yahan mahilaon aur purushon ki ghadiyan bhi hain.'],
  },
  gu: {
    women: ['Gents watches ane wall clocks pan chhe.', 'Sathe gents watches ane deeval ni ghadiyalo pan male chhe.', 'Gents watches sathe wall clocks pan ahini range ma chhe.', 'Ahi gents watches ane ghar mate wall clocks pan chhe.'],
    men: ['Ladies watches ane wall clocks pan chhe.', 'Sathe ladies watches ane deeval ni ghadiyalo pan male chhe.', 'Ladies watches sathe wall clocks pan ahini range ma chhe.', 'Ahi ladies watches ane ghar mate wall clocks pan chhe.'],
    clock: ['Ladies ane gents watches pan chhe.', 'Sathe ladies watches ane gents watches pan male chhe.', 'Ladies ane gents watches pan ahini range ma chhe.', 'Ahi mahilao ane purusho ni ghadiyalo pan chhe.'],
  },
};

export function buildReviewCatalog() {
  const records = [];
  const seen = new Set();
  for (const category of BUSINESS_PROFILE.categories) {
    for (const language of ['en', 'hi', 'gu']) {
      for (let n = 0; n < category.languages[language]; n++) {
        // Walk all opening/topic/detail combinations without adding filler.
        const topic = TOPICS[language][category.id][n % 5];
        const opening = OPENINGS[language][Math.floor(n / 5) % 8](BUSINESS_PROFILE.name, BUSINESS_PROFILE.keywords[language], topic);
        const detail = DETAILS[language][category.id][Math.floor(n / 40) % 4];
        const text = `${opening.charAt(0).toUpperCase()}${opening.slice(1)} ${detail}`;
        if (seen.has(text)) throw new Error('Duplicate draft in review catalog');
        seen.add(text);
        const id = createHash('sha256').update(text).digest('hex').slice(0, 16);
        records.push(Object.freeze({ id, language, category: category.id, keyword: BUSINESS_PROFILE.keywords[language], topic, text }));
      }
    }
  }
  if (records.length !== 500 || seen.size !== 500) throw new Error('Expected 500 unique complete drafts');
  return Object.freeze(records);
}
