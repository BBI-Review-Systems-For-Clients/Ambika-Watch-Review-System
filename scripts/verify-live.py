#!/usr/bin/env python3
"""Verify the exact Ambika Pages commit and deployed file bytes.

This performs HTTP/source checks only. It does not execute a browser or a native
Google Maps flow. Run checks/tests separately before passing their count here.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = 'BBI-Review-Systems-For-Clients/Ambika-Watch-Review-System'
REPOSITORY_ID = 1424225570
REMOTE = f'https://github.com/{REPOSITORY}.git'
BASE_URL = 'https://bbi-review-systems-for-clients.github.io/Ambika-Watch-Review-System/'
DEPLOYED_FILES = (
    'index.html', 'style.css', 'app.js', 'review-core.js',
    'review-navigation.js', 'auto-review-generator.js', 'review-catalog.js',
    'keyword-policy.json', 'keyword-research.json', 'draft-wording.json',
)
MAX_BYTES = 4 * 1024 * 1024


def run(*args):
    return subprocess.check_output(args, cwd=ROOT).decode('utf-8').strip()


def get_json(path):
    return json.loads(run('gh', 'api', path))


def verify_file(path):
    url = BASE_URL + ('' if path == 'index.html' else path)
    request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=30) as response:
        content = response.read(MAX_BYTES + 1)
        if len(content) > MAX_BYTES:
            raise RuntimeError(f'Deployed {path} exceeds the response size limit')
        expected = subprocess.check_output(['git', 'show', f'HEAD:{path}'], cwd=ROOT)
        result = {
            'file': path,
            'url': url,
            'status': response.status,
            'sha256': hashlib.sha256(content).hexdigest(),
            'matchesCommittedFile': content == expected,
        }
    if result['status'] != 200 or not result['matchesCommittedFile']:
        raise RuntimeError(f'Deployed {path} does not match HEAD: {result}')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=ROOT / 'work' / 'delivery', help='Directory for live-verification.json')
    parser.add_argument('--tests', type=int, help='Number of automated tests the caller has just confirmed passed; this script does not run them')
    args = parser.parse_args()
    if args.tests is not None and args.tests < 0:
        parser.error('--tests must be nonnegative')
    if run('git', 'remote', 'get-url', 'origin') != REMOTE:
        raise RuntimeError('Unexpected repository remote; stopped')
    if run('git', 'branch', '--show-current') != 'main':
        raise RuntimeError('Expected main branch; stopped')
    repository = get_json(f'repos/{REPOSITORY}')
    if repository.get('id') != REPOSITORY_ID or repository.get('default_branch') != 'main':
        raise RuntimeError('Unexpected repository identity or default branch; stopped')
    commit = run('git', 'rev-parse', 'HEAD')
    build = get_json(f'repos/{REPOSITORY}/pages/builds/latest')
    if build.get('status') != 'built' or build.get('commit') != commit:
        raise RuntimeError(f'Pages is not built at HEAD {commit}; status={build.get("status")}, commit={build.get("commit")}')
    with ThreadPoolExecutor(max_workers=len(DEPLOYED_FILES)) as pool:
        files = list(pool.map(verify_file, DEPLOYED_FILES))
    report = {
        'verifiedAt': datetime.now(timezone.utc).isoformat(),
        'repository': REPOSITORY,
        'repositoryId': REPOSITORY_ID,
        'commit': commit,
        'pagesStatus': build['status'],
        'files': files,
        'limits': ['HTTP and committed-source checks only; no browser, native Android app or Google review submission was tested by this script.'],
    }
    if args.tests is not None:
        report['automatedTests'] = args.tests
        report['testEvidence'] = 'Passing test count supplied by the caller after its separate test run.'
    args.out.mkdir(parents=True, exist_ok=True)
    target = args.out / 'live-verification.json'
    pending = target.with_suffix('.pending')
    pending.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    pending.replace(target)
    print(json.dumps({'commit': commit, 'pagesStatus': build['status'], 'liveFilesMatched': len(files), 'report': str(target)}, indent=2))


if __name__ == '__main__':
    main()
