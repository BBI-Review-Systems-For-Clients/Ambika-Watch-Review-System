#!/usr/bin/env python3
"""Fetch Google evidence for an AI-reviewed keyword policy, without API keys.

Autocomplete is discovery evidence, not popularity/growth data. Only a literal
match from Google's Trends RSS is labeled google-trends. No customer data is sent.
"""
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
TRENDS_URL = 'https://trends.google.com/trending/rss?geo=IN'
CATEGORIES = {'women', 'men', 'clock'}
MAX_BYTES = 2 * 1024 * 1024


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def read_url(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'AmbikaKeywordResearch/1.0'})
    with urllib.request.urlopen(request, timeout=20) as response:
        data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError('Google response exceeds the size limit')
        return data


def parse_trends(raw):
    root = ET.fromstring(raw)
    if root.tag != 'rss' or root.find('channel') is None:
        raise ValueError('Expected a Google Trends RSS channel')
    result = []
    for item in root.findall('./channel/item'):
        title = (item.findtext('title') or '').strip()
        if title:
            result.append({
                'term': title,
                'publishedAt': item.findtext('pubDate'),
                'approximateTraffic': next((node.text for node in item if node.tag.endswith('approx_traffic')), None),
            })
    return result


def parse_predictions(raw, query):
    payload = json.loads(raw)
    if not isinstance(payload, list) or len(payload) < 2 or payload[0] != query or not isinstance(payload[1], list):
        raise ValueError('Unexpected Google Autocomplete response')
    if not all(isinstance(term, str) for term in payload[1]):
        raise ValueError('Prediction terms must be strings')
    return list(dict.fromkeys(term.strip() for term in payload[1] if term.strip()))


def validate_policy(policy):
    if policy.get('schemaVersion') != 1 or policy.get('region') != 'IN':
        raise ValueError('Expected the India keyword policy, schemaVersion 1')
    queries = policy.get('queries')
    if not isinstance(queries, list) or not 1 <= len(queries) <= 8 or not all(isinstance(q, str) and 0 < len(q) <= 80 for q in queries):
        raise ValueError('Expected 1–8 bounded discovery queries')
    for section in ['candidates', 'fallbacks']:
        rows = policy.get(section)
        if not isinstance(rows, list) or not rows:
            raise ValueError(f'Expected {section}')
        for row in rows:
            if row.get('category') not in CATEGORIES:
                raise ValueError('Unknown keyword category')
            for key in ['term', 'phrase']:
                value = row.get(key)
                if not isinstance(value, str) or not 1 <= len(value) <= 100 or re.search(r'[.!?\n\r<>]', value):
                    raise ValueError('Expected a short keyword phrase')
    if {row['category'] for row in policy['fallbacks']} != CATEGORIES:
        raise ValueError('Need an evergreen fallback for each category')


def collect(policy, fetch=read_url, now=None):
    validate_policy(policy)
    now = now or utc_now()
    sources, suggestions, errors = [], [], []
    trends = {'sourceUrl': TRENDS_URL, 'retrievedAt': now, 'geography': 'India', 'status': 'unavailable', 'observed': [], 'relevant': []}
    jobs = [('google-trends', TRENDS_URL, None)]
    for query in policy['queries']:
        url = 'https://suggestqueries.google.com/complete/search?' + urllib.parse.urlencode({'client': 'firefox', 'hl': 'en', 'gl': 'in', 'q': query})
        jobs.append(('google-autocomplete', url, query))

    def fetch_source(job):
        kind, url, query = job
        try:
            raw = fetch(url)
            values = parse_trends(raw) if kind == 'google-trends' else parse_predictions(raw, query)
            return job, values, None
        except Exception as error:
            # Do not expose response bodies, headers or credentials.
            return job, None, type(error).__name__

    with ThreadPoolExecutor(max_workers=4) as pool:
        for (kind, url, query), values, error in pool.map(fetch_source, jobs):
            source = {'sourceType': kind, 'sourceUrl': url, 'retrievedAt': now, 'status': 'unavailable' if error else 'ok'}
            if error:
                errors.append({'sourceUrl': url, 'errorType': error})
            else:
                source['observedCount'] = len(values)
                if kind == 'google-trends':
                    trends.update(status='ok', observed=values)
                else:
                    suggestions.append({'query': query, **source, 'terms': values})
            sources.append(source)
    if not any(source['status'] == 'ok' for source in sources):
        raise RuntimeError('All Google sources failed; keep the last published dataset')

    predictions = {}
    for source in suggestions:
        for term in source['terms']:
            predictions.setdefault(term.casefold(), source)
    trend_terms = {item['term'].casefold(): item for item in trends['observed']}
    selected = []
    for candidate in policy['candidates']:
        key = candidate['term'].casefold()
        if key in trend_terms:
            row = {**candidate, 'sourceType': 'google-trends', 'sourceUrl': TRENDS_URL, 'retrievedAt': now, 'evidence': trend_terms[key]}
            trends['relevant'].append(trend_terms[key])
        elif key in predictions:
            source = predictions[key]
            row = {**candidate, 'sourceType': 'google-autocomplete', 'sourceUrl': source['sourceUrl'], 'retrievedAt': now}
        else:
            continue
        selected.append(row)
    for category in ['women', 'men', 'clock']:
        if not any(row['category'] == category for row in selected):
            fallback = next(row for row in policy['fallbacks'] if row['category'] == category)
            selected.append({**fallback, 'sourceType': 'evergreen', 'sourceUrl': None, 'retrievedAt': None})
    return {'schemaVersion': 1, 'researchedAt': now, 'region': 'IN', 'sources': sources, 'trends': trends, 'suggestions': suggestions, 'selectedKeywords': selected, 'errors': errors}


def main():
    policy = json.loads((ROOT / 'keyword-policy.json').read_text())
    result = collect(policy)
    # Replace only after collection succeeds; outages do not erase last-good data.
    target = ROOT / 'keyword-research.json'
    pending = target.with_suffix('.pending')
    pending.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    pending.replace(target)
    print(f"Researched {len(result['selectedKeywords'])} keyword phrases; {len(result['trends']['relevant'])} verified relevant Trends matches.")
    if not result['trends']['relevant']:
        print('No relevant verified Google trend: using labeled predictions/evergreen phrases.')


if __name__ == '__main__':
    main()
