# Admin UI

React 18 SPA deployed as a separate Cloudflare Worker.

## Commands

- `npm run dev` - Vite dev server
- `npm run build` - Production build
- `npm run type-check` - TypeScript check
- `npm run worker:deploy` - Build + deploy Worker

## Stack

- React 18, React Router 6, TanStack Query
- Vite bundler, Tailwind CSS
- `worker.ts` - Worker entry serving built assets

## Structure

- `pages/` - Route pages (MemoryManagement, TemporaryMemoryReview, TagManagement, ApiKeys, McpAppsAdmin, SkillDownload)
- `components/` - Reusable components (MemoryForm, MemoryList, MemoryCard, SearchBar, TagTree, etc.)
- `hooks/` - Custom hooks (useDebounce, useTagHierarchy)
- `contexts/` - Theme context

## Notes

- Calls the main memory-server API for all data operations
- Has its own `wrangler.toml` for Worker deployment
- Separate `package.json` - run `npm install` from this directory
