/** Public review destination, supported languages and generic product wording. */
export const GOOGLE_REVIEW_URL =
  'https://search.google.com/local/writereview?placeid=ChIJ4dkN_wJP4DsRaUIpMlm4KN8';

export const LANGUAGES = Object.freeze(['en', 'hi', 'gu']);

export const CATEGORY_PHRASES_BY_CATEGORY = Object.freeze({
  women: Object.freeze(['ladies watch', 'ladies watches', "women's watch", "women's watches", 'ladies wrist watch', 'ladies wrist watches']),
  men: Object.freeze(['gents watch', 'gents watches', "men's watch", "men's watches", 'gents wrist watch', 'gents wrist watches']),
  clock: Object.freeze(['wall clock', 'wall clocks', 'hanging wall clock', 'hanging wall clocks']),
});
export const CATEGORY_PHRASES = Object.freeze(Object.values(CATEGORY_PHRASES_BY_CATEGORY).flat());
