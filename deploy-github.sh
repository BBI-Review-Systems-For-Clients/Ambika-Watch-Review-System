#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

# This script can only publish this new Ambika repository. It never force-pushes.
target='BBI-Review-Systems-For-Clients/Ambika-Watch-Review-System'
remote='https://github.com/BBI-Review-Systems-For-Clients/Ambika-Watch-Review-System.git'
actor="$(gh api user --jq .login)"
if [[ "$actor" != 'AnkitVaghasiya' ]]; then
  printf '%s\n' 'Use the AnkitVaghasiya GitHub account before deploying.' >&2
  exit 1
fi
npm run check
npm test
[[ "$(gh api "repos/$target" --jq .id)" == '1424225570' ]] || { printf '%s\n' 'Unexpected repository; stopped.' >&2; exit 1; }
if [[ ! -d .git ]]; then git init -b main; fi
if git remote get-url origin >/dev/null 2>&1; then
  [[ "$(git remote get-url origin)" == "$remote" ]] || { printf '%s\n' 'Unexpected origin; stopped without changing it.' >&2; exit 1; }
else
  git remote add origin "$remote"
fi
[[ "$(git branch --show-current)" == 'main' ]] || { printf '%s\n' 'Expected main branch; stopped.' >&2; exit 1; }
git add .gitignore .nojekyll README.md index.html style.css app.js i18n.js review-core.js review-navigation.js package.json package-lock.json test deploy-github.sh
if ! git diff --cached --quiet; then git commit -m 'Build Ambika Watch Review System'; fi
git push -u origin main
if ! gh api "repos/$target/pages" >/dev/null 2>&1; then
  gh api --method POST "repos/$target/pages" -f 'source[branch]=main' -f 'source[path]=/' --jq '{html_url,status}'
fi
gh api "repos/$target/pages" --jq '{html_url,status,source}'
printf '%s\n' 'GitHub Pages is configured. Its initial build may take a few minutes.'
