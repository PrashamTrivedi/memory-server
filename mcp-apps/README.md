# MCP Apps

Interactive UI applications served via the MCP Apps extension (`ui://` scheme).

## Apps

| App | Resource URI | Description |
|-----|--------------|-------------|
| Memory Browser | `ui://memory-browser` | Browse, search, and filter memories with bulk actions |
| Memory Editor | `ui://memory-editor` | Markdown editor with live preview for memory content |
| Triage Dashboard | `ui://triage-dashboard` | Review temporary memories with urgency indicators |
| Tag Manager | `ui://tag-manager` | Visual tag hierarchy with rename, merge, reparent |

## Tech Stack

- **Framework**: Preact
- **Styling**: Tailwind CSS
- **Build**: Vite with vite-plugin-singlefile
- **MCP Integration**: @modelcontextprotocol/ext-apps

## Development

```bash
npm install
npm run dev              # Start dev server
npm run build            # Build all apps
npm run build:memory-browser   # Build single app
```

## Deployment

Apps are bundled as single-file HTML and stored in the `MCP_APPS_KV` namespace.

```bash
# From project root
./scripts/deploy-mcp-apps.sh
```

The deploy script:
1. Builds all apps if dist/ doesn't exist
2. Uploads each app's index.html to KV with key `mcp-app:{app-name}`

## Structure

```
src/
├── memory-browser/    # Memory browsing and filtering
├── memory-editor/     # Markdown editing with preview
├── triage-dashboard/  # Temporary memory review
├── tag-manager/       # Tag hierarchy management
└── shared/            # Shared components and utilities
```

## Adding a New App

1. Create directory under `src/{app-name}/`
2. Add entry point `main.tsx` with Preact app
3. Add build script to package.json: `"build:{app-name}": "APP={app-name} vite build"`
4. Add to the build script chain
5. Add app name to `scripts/deploy-mcp-apps.sh` APPS array
