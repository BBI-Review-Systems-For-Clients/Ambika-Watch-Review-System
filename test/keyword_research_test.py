import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('keyword_research', ROOT / 'scripts/research-google-keywords.py')
research = importlib.util.module_from_spec(spec)
spec.loader.exec_module(research)
POLICY = json.loads((ROOT / 'keyword-policy.json').read_text())
NOW = '2026-10-20T00:00:00+00:00'


def rss(title='unrelated news'):
    return f'<rss xmlns:ht="https://trends.google.com/trending/rss"><channel><item><title>{title}</title><pubDate>Tue, 20 Oct 2026 00:00:00 GMT</pubDate><ht:approx_traffic>200+</ht:approx_traffic></item></channel></rss>'.encode()


def responses(trend_title='unrelated news'):
    def fetch(url):
        if 'trends.google.com' in url:
            return rss(trend_title)
        query = research.urllib.parse.parse_qs(research.urllib.parse.urlparse(url).query)['q'][0]
        terms = {'ladies watches': ['ladies watches'], 'gents watches': ['mens watches'], 'wall clocks': ['wall clocks', 'wall clocks for living room']}.get(query, [])
        return json.dumps([query, terms]).encode()
    return fetch


class KeywordResearchTests(unittest.TestCase):
    def test_google_predictions_are_not_labeled_as_trends(self):
        result = research.collect(POLICY, fetch=responses(), now=NOW)
        self.assertEqual(result['trends']['relevant'], [])
        self.assertTrue(result['selectedKeywords'])
        self.assertTrue(all(row['sourceType'] == 'google-autocomplete' for row in result['selectedKeywords']))
        self.assertTrue(all(row['sourceUrl'].startswith('https://suggestqueries.google.com/') for row in result['selectedKeywords']))
        self.assertEqual({row['category'] for row in result['selectedKeywords']}, {'women', 'men', 'clock'})

    def test_only_observed_literal_trends_get_the_trend_label(self):
        result = research.collect(POLICY, fetch=responses('wall clocks'), now=NOW)
        rows = [row for row in result['selectedKeywords'] if row['sourceType'] == 'google-trends']
        self.assertEqual([row['term'] for row in rows], ['wall clocks'])
        self.assertEqual(rows[0]['evidence']['approximateTraffic'], '200+')
        self.assertEqual(rows[0]['retrievedAt'], NOW)

    def test_mismatched_or_malformed_google_payloads_are_rejected(self):
        for payload in [b'not json', b'{}', b'["wrong query", []]', b'["ladies watches", [42]]']:
            with self.assertRaises((ValueError, json.JSONDecodeError)):
                research.parse_predictions(payload, 'ladies watches')
        with self.assertRaises(ValueError):
            research.parse_trends(b'<html/>')

    def test_total_network_outage_fails_instead_of_creating_fake_evidence(self):
        def unavailable(url):
            raise TimeoutError('Test outage')
        with self.assertRaises(RuntimeError):
            research.collect(POLICY, fetch=unavailable, now=NOW)

    def test_partial_source_failure_is_recorded_and_fallbacks_are_honest(self):
        def only_trends(url):
            if 'trends.google.com' in url:
                return rss()
            raise TimeoutError('Test outage')
        result = research.collect(POLICY, fetch=only_trends, now=NOW)
        self.assertEqual(len(result['errors']), len(POLICY['queries']))
        self.assertEqual({row['category'] for row in result['selectedKeywords']}, {'women', 'men', 'clock'})
        for row in result['selectedKeywords']:
            self.assertEqual(row['sourceType'], 'evergreen')
            self.assertIsNone(row['sourceUrl'])
            self.assertIsNone(row['retrievedAt'])

    def test_policy_cannot_drop_a_category_or_add_sentence_injection(self):
        for mutate in [lambda p: p['fallbacks'].pop(), lambda p: p['candidates'][0].update(phrase='Watches. I bought one.')]:
            policy = json.loads(json.dumps(POLICY))
            mutate(policy)
            with self.assertRaises(ValueError):
                research.validate_policy(policy)


if __name__ == '__main__':
    unittest.main()
