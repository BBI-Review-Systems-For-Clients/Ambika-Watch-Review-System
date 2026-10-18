import { GOOGLE_REVIEW_URL } from './review-core.js';

export const MAPS_PLACE_URL = 'https://www.google.com/maps/search/?api=1&query=Ambika%20Watch%20%26%20Gift%2C%20Surat&query_place_id=ChIJ4dkN_wJP4DsRaUIpMlm4KN8';

// Google documents opening a listing; it controls the review action in Maps.
export const ANDROID_MAPS_INTENT = `${MAPS_PLACE_URL.replace('https://', 'intent://')}#Intent;scheme=https;package=com.google.android.apps.maps;S.browser_fallback_url=${encodeURIComponent(GOOGLE_REVIEW_URL)};end`;

export function getReviewDestination(navigator = {}) {
  const android = navigator.userAgentData?.platform === 'Android' || /Android/i.test(navigator.userAgent || '');
  return android ? ANDROID_MAPS_INTENT : GOOGLE_REVIEW_URL;
}
