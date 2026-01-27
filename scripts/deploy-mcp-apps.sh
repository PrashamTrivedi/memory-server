#!/bin/bash
# Deploy MCP Apps bundles to KV storage

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MCP_APPS_DIR="$PROJECT_ROOT/mcp-apps"
DIST_DIR="$MCP_APPS_DIR/dist"

# Check if dist exists
if [ ! -d "$DIST_DIR" ]; then
  echo "Building MCP Apps..."
  cd "$MCP_APPS_DIR"
  npm run build
  cd "$PROJECT_ROOT"
fi

# Apps to deploy
APPS=("memory-browser" "memory-editor" "triage-dashboard" "tag-manager")

echo "Deploying MCP Apps to KV..."

for app in "${APPS[@]}"; do
  APP_FILE="$DIST_DIR/$app/index.html"

  if [ -f "$APP_FILE" ]; then
    echo "Deploying $app..."

    # Upload to KV using wrangler
    wrangler kv key put "mcp-app:$app" --path="$APP_FILE" --binding=MCP_APPS_KV

    echo "  ✓ $app deployed"
  else
    echo "  ✗ $app not found at $APP_FILE"
  fi
done

echo ""
echo "Done! MCP Apps deployed to KV."
