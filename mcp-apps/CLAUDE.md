# MCP Apps

Interactive UIs served via `ui://` scheme for MCP hosts supporting Apps extension.

## Commands

- `npm run build` - Build all apps
- `npm run build:<app-name>` - Build single app (memory-browser, memory-editor, triage-dashboard, tag-manager)
- `npm run dev` - Vite dev server

## Stack

- Preact (not React), vite-plugin-singlefile
- Tailwind CSS, PostCSS
- Each app builds to a single `.html` file

## Structure

- `src/<app-name>/` - Each app has index.html + main.tsx
- `src/shared/` - Shared hooks (useApp), components (Button, Spinner), styles

## Apps

| App | Purpose |
|-----|---------|
| memory-browser | Browse/filter memories with bulk actions |
| memory-editor | Markdown editor with live preview |
| triage-dashboard | Temp memory review with urgency indicators |
| tag-manager | Hierarchical tag tree with merge/rename |

## Deploying

```bash
npm run build
../scripts/deploy-mcp-apps.sh
```

Bundles are stored in `MCP_APPS_KV` and served by the main Worker.
