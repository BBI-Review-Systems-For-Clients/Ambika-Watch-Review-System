import { REVIEW_CATALOG } from './review-catalog.js';

export const LAST_REVIEW_KEY = 'ambika-review:last-id:v1';

/** Select a complete prebuilt suggestion. No customer details are inferred. */
export function createAutomaticReviewGenerator({ random = Math.random } = {}) {
  let lastId;
  return {
    generate({ previousId } = {}) {
      const candidates = REVIEW_CATALOG.filter(record => record.id !== previousId && record.id !== lastId);
      const eligible = candidates.length ? candidates : REVIEW_CATALOG;
      const next = eligible[Math.floor(random() * eligible.length)];
      lastId = next.id;
      return next;
    },
  };
}
