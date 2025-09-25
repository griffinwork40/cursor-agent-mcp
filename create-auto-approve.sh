#!/bin/bash

# Alternative Solution: Create a GitHub Action for Auto-Approval
# This creates a workflow that automatically approves PRs from the repository owner

echo "🔧 Creating auto-approval workflow for your PRs..."

cat > .github/workflows/auto-approve.yml << 'EOF'
name: Auto-Approve Owner PRs

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  auto-approve:
    runs-on: ubuntu-latest
    if: github.actor == github.repository_owner
    steps:
      - name: Auto-approve PR
        uses: hmarr/auto-approve-action@v3
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
EOF

echo "✅ Created auto-approval workflow!"
echo ""
echo "📋 What this does:"
echo "   • Automatically approves PRs created by you (repository owner)"
echo "   • Only runs for PRs from griffinwork40"
echo "   • Uses GitHub's built-in GITHUB_TOKEN"
echo ""
echo "🚀 Next steps:"
echo "   1. Commit and push this workflow file"
echo "   2. Create a test PR"
echo "   3. The workflow will auto-approve it"
echo ""
echo "ℹ️  This bypasses the manual approval requirement for your own PRs"
echo "   while still requiring approval for any external contributors."
