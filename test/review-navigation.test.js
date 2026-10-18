import test from 'node:test';
import assert from 'node:assert/strict';
import { ANDROID_MAPS_INTENT, MAPS_PLACE_URL, getReviewDestination } from '../review-navigation.js';

const googleURL = 'https://search.google.com/local/writereview?placeid=ChIJ4dkN_wJP4DsRaUIpMlm4KN8';
const placeID = 'ChIJ4dkN_wJP4DsRaUIpMlm4KN8';

test('the Maps listing is restricted to the supplied Ambika Watch place ID', () => {
  const url = new URL(MAPS_PLACE_URL);
  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.pathname, '/maps/search/');
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('query'), 'Ambika Watch & Gift, Surat');
  assert.equal(url.searchParams.get('query_place_id'), placeID);
});

test('Android intent names Google Maps and preserves the exact direct-review browser fallback', () => {
  assert.ok(ANDROID_MAPS_INTENT.startsWith('intent://www.google.com/maps/search/?'));
  const [listing, intent] = ANDROID_MAPS_INTENT.split('#Intent;');
  const listingURL = new URL(listing.replace('intent://', 'https://'));
  assert.equal(listingURL.searchParams.get('query_place_id'), placeID);
  const options = Object.fromEntries(intent.split(';').filter(part => part.includes('=')).map(part => {
    const index = part.indexOf('=');
    return [part.slice(0, index), part.slice(index + 1)];
  }));
  assert.equal(options.scheme, 'https');
  assert.equal(options.package, 'com.google.android.apps.maps');
  assert.equal(decodeURIComponent(options['S.browser_fallback_url']), googleURL);
  assert.ok(ANDROID_MAPS_INTENT.endsWith(';end'));
});

test('Android is identified from the user agent or browser platform data', () => {
  assert.equal(getReviewDestination({ userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/143.0' }), ANDROID_MAPS_INTENT);
  assert.equal(getReviewDestination({ userAgent: 'Mozilla/5.0 (linux; android 14)' }), ANDROID_MAPS_INTENT);
  assert.equal(getReviewDestination({ userAgentData: { platform: 'Android' } }), ANDROID_MAPS_INTENT);
});

test('desktop, iPhone, iPad, and unknown browsers open the direct Google review form', () => {
  const navigators = [
    undefined,
    {},
    { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/143.0' },
    { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) Safari/605.1.15' },
    { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) Version/19.0 Mobile Safari/604.1' },
    { userAgent: 'Mozilla/5.0 (iPad; CPU OS 19_0 like Mac OS X) Version/19.0 Mobile Safari/604.1' },
    { userAgentData: { platform: 'iOS' } },
  ];
  for (const navigator of navigators) assert.equal(getReviewDestination(navigator), googleURL);
});
