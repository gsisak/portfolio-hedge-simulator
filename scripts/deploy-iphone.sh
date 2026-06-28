#!/bin/bash
# Run this once in Terminal to put the app online for iPhone:
#   cd ~/Projects/portfolio-hedge-simulator && bash scripts/deploy-iphone.sh

set -e
cd "$(dirname "$0")/.."

echo "→ Building app..."
npm run build

echo "→ Setting up git..."
if [ ! -d .git ] || [ ! -f .git/HEAD ]; then
  rm -rf .git
  git init
fi

git add .
git diff --cached --quiet || git commit -m "Portfolio hedge simulator — PWA + voice input"

if ! git remote get-url origin &>/dev/null; then
  echo "→ Creating GitHub repo (gsisak/portfolio-hedge-simulator)..."
  gh repo create portfolio-hedge-simulator --public --source=. --remote=origin --push
else
  echo "→ Pushing to GitHub..."
  git push -u origin HEAD
fi

echo ""
echo "=============================================="
echo "  GitHub done. Now deploy to Vercel:"
echo "=============================================="
echo ""
echo "  1. Open https://vercel.com/new"
echo "  2. Sign in with GitHub"
echo "  3. Import: portfolio-hedge-simulator"
echo "  4. Click Deploy (no settings to change)"
echo ""
echo "  When done, open the Vercel URL in iPhone Safari →"
echo "  Share → Add to Home Screen"
echo ""
echo "  Or run: npx vercel --prod"
echo "  (login once when prompted)"
echo ""
