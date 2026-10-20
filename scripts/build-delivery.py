#!/usr/bin/env python3
"""Build the standalone preview, source ZIP and delivery notes for verified HEAD.

Requires npm ci (including local esbuild) and a successful verify-live.py report
for the same commit. Does not upload files, deploy code or submit Google reviews.
"""
import argparse
import base64
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = 'BBI-Review-Systems-For-Clients/Ambika-Watch-Review-System'
REPOSITORY_ID = 1424225570
LIVE_URL = 'https://bbi-review-systems-for-clients.github.io/Ambika-Watch-Review-System/'
SOURCE_URL = f'https://github.com/{REPOSITORY}'
REQUIRED_FILES = {
    'index.html', 'style.css', 'app.js', 'review-core.js',
    'review-navigation.js', 'auto-review-generator.js', 'review-catalog.js',
    'keyword-policy.json', 'keyword-research.json', 'draft-wording.json',
}


def run(*args):
    return subprocess.check_output(args, cwd=ROOT).decode('utf-8').strip()


def validate_report(report, commit):
    if report.get('commit') != commit:
        raise RuntimeError('Live verification is stale; run verify-live.py for current HEAD before packaging')
    if report.get('repository') != REPOSITORY or report.get('repositoryId') != REPOSITORY_ID or report.get('pagesStatus') != 'built':
        raise RuntimeError('Expected a built verification report for the exact Ambika repository')
    files = report.get('files', [])
    if {item.get('file') for item in files} != REQUIRED_FILES or len(files) != len(REQUIRED_FILES):
        raise RuntimeError('Verification report must cover all ten runtime/data files')
    if any(item.get('status') != 200 or item.get('matchesCommittedFile') is not True for item in files):
        raise RuntimeError('All verified files must return HTTP 200 and match the committed source')


def make_preview():
    esbuild = ROOT / 'node_modules' / '.bin' / 'esbuild'
    if not esbuild.is_file():
        raise RuntimeError('Local esbuild is missing; run npm ci in this repository')
    javascript = subprocess.check_output([
        str(esbuild), 'app.js', '--bundle', '--format=iife', '--platform=browser',
        '--target=es2022', '--log-level=error',
    ], cwd=ROOT).decode('utf-8')
    javascript = re.sub(r'</script', lambda _: '<\\/script', javascript, flags=re.IGNORECASE)
    css = (ROOT / 'style.css').read_text(encoding='utf-8')
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    stylesheet = '<link rel="stylesheet" href="style.css">'
    module = '<script type="module" src="app.js"></script>'
    if html.count(stylesheet) != 1 or html.count(module) != 1 or html.count('</body>') != 1:
        raise RuntimeError('Unexpected HTML resource structure; review bundling before delivery')
    html = html.replace(stylesheet, '<style>' + css + '</style>').replace(module, '')
    script_hash = base64.b64encode(hashlib.sha256(javascript.encode('utf-8')).digest()).decode('ascii')
    style_hash = base64.b64encode(hashlib.sha256(css.encode('utf-8')).digest()).decode('ascii')
    csp = f"default-src 'none'; script-src 'sha256-{script_hash}'; style-src 'sha256-{style_hash}'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
    html, replaced = re.subn(
        r'(<meta http-equiv="Content-Security-Policy" content=")[^"]+(">)',
        lambda match: match[1] + csp + match[2], html,
    )
    if replaced != 1:
        raise RuntimeError('Expected one content-security-policy meta tag')
    return html.replace('</body>', '<script>' + javascript + '</script>\n</body>')


def make_notes(commit, report, research):
    selected = research.get('selectedKeywords', [])
    source_counts = Counter(item.get('sourceType', 'unknown') for item in selected)
    source_summary = ', '.join(f'{kind}: {count}' for kind, count in sorted(source_counts.items())) or 'none'
    relevant = research.get('trends', {}).get('relevant', [])
    trend_status = research.get('trends', {}).get('status', 'unknown')
    tests = report.get('automatedTests')
    test_line = f'{tests} passing automated tests were reported by the caller after a separate test run.' if tests is not None else 'No automated test count was supplied to the verification script.'
    terms = '\n'.join(f"- {item.get('term')} [{item.get('category')}; {item.get('sourceType')}]" for item in selected)
    return f'''Ambika Watch Review System

LIVE: {LIVE_URL}
SOURCE: {SOURCE_URL}
Commit: {commit}
Verified at: {report.get('verifiedAt')}

The page opens with one editable suggested draft and one Copy & Leave Review action, without selectors. Every generated draft is exactly ONE sentence containing Ambika Watch & Gift, Surat/watch-shop context, ONE serving area (Varachha, Mota Varachha, Katargam or Amroli), ONE approved brand name and ONE category topic. Brand references describe shopper interest, not confirmed inventory. Onex is the only wall-clock brand used. There is no generic second product sentence.

The catalog contains 500 unique drafts: 270 women's-watch, 180 men's-watch and 50 wall-clock topics; 200 English, 150 Roman Hindi and 150 Roman Gujarati. Refreshing uses a new random draft, excluding the previous ID when session storage is available. Only an opaque catalog ID is stored; customer words stay in the editor and are not transmitted by this page.

A connected ChatGPT AI research task is scheduled separately from the static page to refresh wording and Google keyword research every 15 days. The task researches, validates, publishes only this Ambika repository and verifies Pages; it reports blockers rather than claiming a failed refresh succeeded. The browser does not call an AI endpoint or expose an API key.

Current keyword research timestamp: {research.get('researchedAt')}
Selected keyword phrases: {len(selected)} ({source_summary})
Google Trends feed status: {trend_status}; verified relevant trend matches: {len(relevant)}.
Google Autocomplete predictions are keyword ideas, not measured trending or popularity data. When no relevant watch trend is verified, predictions or approved evergreen phrases remain explicitly labeled. Every observed phrase retains its source type, URL and retrieval time in keyword-research.json; evergreen fallbacks have no fabricated external provenance.

Selected terms:
{terms}

Suggested text does not invent customer visits, purchases, ratings, staff/service experiences, stock confirmation or praise, and makes no search-ranking or automation-detection guarantee. Customers can edit the sentence to match their actual visit. Google controls rating, pasting and posting in its own app; these native steps remain manual.

The navy/red business-name header is centered on desktop and mobile. The exact wide logo still requires accessible original file bytes or a downloadable URL; no replacement image has been generated. The approved brand list retains 29 verified spellings; Mont Beree, Jean Friendi and Hong Kong remain withheld pending confirmation.

{test_line}
The ten deployed runtime/data files return HTTP 200 and match committed HEAD bytes. HTTP/source verification does not establish browser behavior, native Android review-composer behavior or review submission.

Only the Ambika repository is packaged. This ZIP contains tracked source, standalone Preview.html, these notes and live-verification.json for the same commit. Use the live HTTPS page for the normal clipboard and Maps handoff; local-file browser policies can limit clipboard/app launching in the standalone preview.
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=ROOT / 'work' / 'delivery', help='Directory containing live-verification.json and receiving delivery files')
    args = parser.parse_args()
    if run('git', 'remote', 'get-url', 'origin') != SOURCE_URL + '.git' or run('git', 'branch', '--show-current') != 'main':
        raise RuntimeError('Expected the exact Ambika main repository; stopped')
    if subprocess.run(['git', 'diff', '--quiet', 'HEAD', '--'], cwd=ROOT).returncode != 0:
        raise RuntimeError('Tracked files differ from HEAD; commit the reviewed changes before packaging')
    commit = run('git', 'rev-parse', 'HEAD')
    verification = args.out / 'live-verification.json'
    if not verification.is_file():
        raise RuntimeError('Run verify-live.py with the same --out directory before packaging')
    report = json.loads(verification.read_text(encoding='utf-8'))
    validate_report(report, commit)
    research = json.loads((ROOT / 'keyword-research.json').read_text(encoding='utf-8'))
    preview_html = make_preview()
    notes_text = make_notes(commit, report, research)
    args.out.mkdir(parents=True, exist_ok=True)
    preview = args.out / 'Ambika Watch Review System.html'
    notes = args.out / 'Ambika Watch - Delivery notes.txt'
    preview.write_text(preview_html, encoding='utf-8')
    notes.write_text(notes_text, encoding='utf-8')
    files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode('utf-8').split('\0')
    archive_path = args.out / 'Ambika-Watch-Review-System.zip'
    pending = archive_path.with_suffix('.pending')
    with zipfile.ZipFile(pending, 'w', zipfile.ZIP_DEFLATED) as archive:
        for file in filter(None, files):
            archive.write(ROOT / file, 'Ambika-Watch-Review-System/' + file)
        archive.write(preview, 'Ambika-Watch-Review-System/Preview.html')
        archive.write(notes, 'Ambika-Watch-Review-System/Delivery notes.txt')
        archive.write(verification, 'Ambika-Watch-Review-System/live-verification.json')
    pending.replace(archive_path)
    print(json.dumps({'commit': commit, 'preview': str(preview), 'notes': str(notes), 'zip': str(archive_path)}, indent=2))


if __name__ == '__main__':
    main()
