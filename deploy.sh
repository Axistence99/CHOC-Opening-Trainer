#!/bin/bash
# Redalgin Opening Trainer — One-command deploy to GitHub
# Usage: ./deploy.sh "commit message"
#
# This pushes from the sandbox directly to GitHub.
# On your local machine: git pull

set -e
cd "$(dirname "$0")"

MSG="${1:-"update from sandbox $(date +%Y-%m-%d_%H:%M)"}"

# Stage all changes (respect .gitignore)
git add -A

# Check if there's anything to commit
if git diff --cached --quiet; then
  echo "✅ Nothing to commit — workspace is up to date"
  exit 0
fi

# Commit and push
git commit -m "$MSG"
git push origin main 2>&1

echo ""
echo "✅ Pushed to GitHub: $MSG"
echo "   On your local machine: git pull"
