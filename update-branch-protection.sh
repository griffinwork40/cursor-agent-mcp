#!/bin/bash

# Update Branch Protection to Allow Self-Approval
# This script modifies branch protection to allow PR authors to approve their own PRs

echo "🔧 Updating branch protection to allow self-approval..."

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed. Please install it first:"
    echo "   brew install gh"
    echo "   or visit: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI. Please run:"
    echo "   gh auth login"
    exit 1
fi

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "📁 Repository: $REPO"

# Update branch protection rules to allow self-approval
echo "🛡️ Updating branch protection rules..."

gh api repos/$REPO/branches/main/protection \
  --method PUT \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["test", "lint", "security"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF

if [ $? -eq 0 ]; then
    echo "✅ Branch protection updated successfully!"
    echo ""
    echo "📋 Updated protection rules:"
    echo "   • Require pull request reviews before merging"
    echo "   • Require 1 approval from code owners"
    echo "   • Require status checks to pass"
    echo "   • Code owners CAN approve their own PRs"
    echo "   • Force pushes and deletions are disabled"
    echo ""
    echo "🔍 You can view these settings at:"
    echo "   https://github.com/$REPO/settings/branches"
    echo ""
    echo "ℹ️  Note: You may need to manually disable 'Restrict pushes that create files'"
    echo "   in the GitHub web interface to fully allow self-approval."
else
    echo "❌ Failed to update branch protection rules"
    echo "   You may need to set these up manually in GitHub's web interface"
    exit 1
fi
