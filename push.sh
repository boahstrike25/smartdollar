#!/usr/bin/env bash
# $martDollar — automated push to GitHub
# Uses Method A from PUSH_TO_GITHUB.md (clone remote, replace, commit, push).
# Safe: never destroys remote history, always fast-forwards cleanly.
#
# Usage:
#   ./push.sh                                  # uses default repo URL below
#   ./push.sh git@github.com:you/repo.git      # override the remote URL
#   ./push.sh https://github.com/you/repo.git  # HTTPS works too

set -euo pipefail

REMOTE="${1:-https://github.com/boahstrike25/smartdollar.git}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$(mktemp -d -t smartdollar-push-XXXXXX)"
BRANCH="main"

echo "==> Source folder:  $HERE"
echo "==> Remote repo:    $REMOTE"
echo "==> Workspace:      $WORK"
echo

cd "$WORK"
echo "==> Cloning remote..."
if ! git clone "$REMOTE" repo 2>/dev/null; then
  echo "    Remote is empty or unreachable — initialising fresh."
  mkdir repo && cd repo
  git init -q
  git branch -M "$BRANCH"
  git remote add origin "$REMOTE"
else
  cd repo
  # Detect actual default branch
  CURRENT="$(git symbolic-ref --short HEAD 2>/dev/null || echo "$BRANCH")"
  BRANCH="$CURRENT"
fi

echo "==> Wiping tracked files (preserving .git)..."
if [ -n "$(git ls-files)" ]; then
  git ls-files -z | xargs -0 rm -f
  find . -type d -empty -not -path './.git*' -delete 2>/dev/null || true
fi

echo "==> Copying $martDollar files into repo..."
# Copy everything from the source folder except this script and the macOS .DS_Store
( cd "$HERE" && tar --exclude='./push.sh' --exclude='./.DS_Store' -cf - . ) | tar -xf - -C .

echo "==> Staging changes..."
git add -A

if git diff --cached --quiet; then
  echo "    No changes to commit. Repo is already up to date."
  exit 0
fi

git -c user.email="${GIT_AUTHOR_EMAIL:-you@example.com}" \
    -c user.name="${GIT_AUTHOR_NAME:-\$martDollar}" \
    commit -q -m "Release \$martDollar: rebrand, glassmorphism, 25 lessons, deployment guide"

echo "==> Pushing to $REMOTE ($BRANCH)..."
git push -u origin "$BRANCH"

echo
echo "✓ Done. Your repo is at:"
echo "    $REMOTE"
echo
echo "Next: enable GitHub Pages (Settings → Pages → Source: GitHub Actions)"
echo "Workspace was: $WORK  (you can delete it if you like)"
