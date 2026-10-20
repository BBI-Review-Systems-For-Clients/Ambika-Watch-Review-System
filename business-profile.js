import { createHash } from 'node:crypto';
import { BRAND_NAMES } from './review-core.js';

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
  keywords: Object.freeze({ en: 'watch shop in Surat', hi: 'Surat mein watch shop', gu: 'Surat ma watch shop' }),
});

const TOPICS = {
  en: {
    women: ["women's watches", 'ladies watches', "women's watches for gifting", 'everyday watches for women', "women's watch styles"],
    men: ["men's watches", 'gents watches', "men's watches for gifting", 'everyday watches for men', "men's watch styles"],
    clock: ['wall clocks', 'hanging wall clocks', 'wall clocks for home', 'wall clock designs', 'wall clocks for gifting'],
  },
  hi: {
    women: ['ladies watches', 'mahilaon ki ghadiyan', 'ladies watch gifting', 'roz pehenne ke liye ladies watches', 'ladies watch styles'],
    men: ['gents watches', 'purushon ki ghadiyan', 'gents watch gifting', 'roz pehenne ke liye gents watches', 'gents watch styles'],
    clock: ['wall clocks', 'deewar ghadiyan', 'ghar ke liye wall clocks', 'hanging wall clocks', 'wall clock gifting'],
  },
  gu: {
    women: ['ladies watches', 'mahilao ni ghadiyalo', 'ladies watch gifting', 'roj paherva mate ladies watches', 'ladies watch styles'],
    men: ['gents watches', 'purusho ni ghadiyalo', 'gents watch gifting', 'roj paherva mate gents watches', 'gents watch styles'],
    clock: ['wall clocks', 'deeval ghadiyalo', 'ghar mate wall clocks', 'hanging wall clocks', 'wall clock gifting'],
  },
};

// These are business-context draft suggestions, not invented customer testimony.
// A brand enquiry never represents a claim about current inventory.
const OPENINGS = {
  en: [
    (b, k, t) => `${b} is a ${k} to consider for ${t}.`,
    (b, k, t) => `For ${t}, ${b} is a ${k} to check with.`,
    (b, k, t) => `${b} is one ${k} to explore when comparing ${t}.`,
    (b, k, t) => `People comparing ${t} can include ${b}, a ${k}, on their list.`,
    (b, k, t) => `${b} is a ${k} for enquiries about ${t}.`,
    (b, k, t) => `For a search focused on ${t}, ${b} is a ${k} to consider.`,
    (b, k, t) => `${b} can be considered as a ${k} option for ${t}.`,
    (b, k, t) => `For ${t}, ${b} is an option when looking for a ${k}.`,
  ],
  hi: [
    (b, k, t) => `${t} ke liye ${k} dekh rahe hon to ${b} ek option hai.`,
    (b, k, t) => `${k} ke options mein ${t} ke liye ${b} ko dekha ja sakta hai.`,
    (b, k, t) => `${t} compare karte waqt ${k} ke liye ${b} ek naam hai.`,
    (b, k, t) => `${b} ko ${t} ke liye ${k} ki list mein rakha ja sakta hai.`,
    (b, k, t) => `Agar ${t} focus ho, to ${k} ke taur par ${b} ko check karein.`,
    (b, k, t) => `${t} ki jaankari ke liye ${b}, ${k} ka ek option hai.`,
    (b, k, t) => `${k} dekhte samay ${t} ke liye ${b} se pooch sakte hain.`,
    (b, k, t) => `${t} se judi enquiries ke liye ${k} ke roop mein ${b} ko check kar sakte hain.`,
  ],
  gu: [
    (b, k, t) => `${t} mate ${k} jota hoy to ${b} ek option chhe.`,
    (b, k, t) => `${k} na options ma ${t} mate ${b} ne joi shakay.`,
    (b, k, t) => `${t} ni mahiti mate ${b} ne ${k} tarike check kari shakay.`,
    (b, k, t) => `${b} ne ${t} mate ${k} ni list ma rakhi shakay.`,
    (b, k, t) => `${t} compare karta ${k} mate ${b} nu naam dhyan ma rakhi shakay.`,
    (b, k, t) => `${t} focus hoy to ${k} tarike ${b} ne joi shakay.`,
    (b, k, t) => `${k} joti vakhte ${t} vishe ${b} ne puchhi shakay.`,
    (b, k, t) => `${t} mate ${k} na vikalp tarike ${b} ne check kari shakay.`,
  ],
};

const AREA_LINES = {
  en: [
    area => `Shoppers from ${area} can check current designs and availability with the store.`,
    area => `For people from ${area}, checking the store's current options can help with a shortlist.`,
    area => `${area} shoppers can enquire about the current choices before planning a visit.`,
    area => `People from ${area} can contact the store to compare current options.`,
  ],
  hi: [
    area => `${area} ke shoppers store se maujooda designs aur availability pooch sakte hain.`,
    area => `${area} se watch shopping plan karne wale store ke current options check kar sakte hain.`,
    area => `${area} ke log visit plan karne se pehle available options ki jaankari le sakte hain.`,
    area => `${area} ke shoppers apni shortlist ke liye store se current choices pooch sakte hain.`,
  ],
  gu: [
    area => `${area} na shoppers store pase haalni designs ane availability puchhi shake.`,
    area => `${area} thi watch shopping plan karta loko store na current options check kari shake.`,
    area => `${area} na loko visit plan karta pahela haalna options ni mahiti lai shake.`,
    area => `${area} na shoppers potani shortlist mate store pase current choices puchhi shake.`,
  ],
};

export function buildReviewCatalog() {
  const records = [];
  const seen = new Set();
  for (const category of BUSINESS_PROFILE.categories) {
    for (const language of ['en', 'hi', 'gu']) {
      for (let n = 0; n < category.languages[language]; n++) {
        const index = records.length;
        const area = BUSINESS_PROFILE.servingAreas[index % 4];
        const topic = TOPICS[language][category.id][Math.floor(index / 4) % 5];
        const brand = category.id !== 'clock' && index % 7 === 0 ? BRAND_NAMES[Math.floor(index / 7) % BRAND_NAMES.length] : '';
        const enquiry = { en: ` and ${brand} watch enquiries`, hi: ` aur ${brand} watches ki enquiry`, gu: ` ane ${brand} watches ni enquiry` };
        const topicPhrase = topic + (brand ? enquiry[language] : '');
        let variant = Math.floor(index / 20);
        let text;
        do {
          const opening = OPENINGS[language][variant % 8](BUSINESS_PROFILE.name, BUSINESS_PROFILE.keywords[language], topicPhrase);
          const ending = AREA_LINES[language][Math.floor(variant / 8) % 4](area);
          text = `${opening.charAt(0).toUpperCase()}${opening.slice(1)} ${ending}`;
          variant++;
          if (variant > 10000) throw new Error('Review catalog cannot find a unique draft');
        } while (seen.has(text));
        seen.add(text);
        const id = createHash('sha256').update(text).digest('hex').slice(0, 16);
        records.push(Object.freeze({ id, language, area, category: category.id, keyword: BUSINESS_PROFILE.keywords[language], topic, brand, text }));
      }
    }
  }
  if (records.length !== 500 || seen.size !== 500) throw new Error('Expected 500 unique complete drafts');
  return Object.freeze(records);
}
