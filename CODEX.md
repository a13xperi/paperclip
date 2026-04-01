# CODEX.md — Paperclip (Codex Context)

## Project
Paperclip — Control plane for AI-agent companies. Manages tasks, governance, multi-agent coordination. V1 monorepo.

## Stack
- TypeScript 5.7 (ES2023 target, NodeNext modules)
- Monorepo with pnpm workspaces
- Server: Express-based API
- UI: React frontend
- Vitest 3.0 + Playwright 1.58 for testing
- PostgreSQL via Drizzle ORM (packages/db)

## Structure
```
server/src/
  adapters/     — External service adapters
  auth/         — Authentication logic
  middleware/   — Express middleware
  realtime/     — WebSocket/SSE real-time features
  routes/       — API route handlers
  secrets/      — Secret management
  services/     — Business logic services
  __tests__/    — Server test files
ui/src/
  components/   — React UI components
  context/      — React context providers
  pages/        — Page-level components
  hooks/        — Custom React hooks
  lib/          — Utilities
packages/
  db/           — Drizzle ORM schema and migrations
  shared/       — Shared types and utilities
  adapters/     — IDE adapter packages (claude, codex, cursor, etc.)
  plugins/      — Plugin SDK and examples
```

## Commands
- `npx vitest run` — Run Vitest test suite
- `npm run build` — Build all packages
- `npm run typecheck` — TypeScript type checking
- `npm run dev` — Development server

## Branch Convention
- All Codex branches: `codex/{description}`
- Target branch: `master` (not main)

## PR Convention
- PR title: concise description of the change
- Target: `master`

## DO NOT MODIFY
- `AGENTS.md` — Paperclip's own agent framework docs (not Codex context)
- `packages/db/drizzle/` — Migration files (requires careful planning)
- `.env*` files — Environment configuration

## Coding Standards
- ES module syntax throughout
- Strict TypeScript
- Drizzle ORM for all database access (not raw SQL)
- pnpm for package management (not npm)
- Real-time features use SSE pattern

## Testing Patterns
- Vitest with `describe`, `it`, `expect`
- Context provider tests mock query clients
- Server tests in `server/src/__tests__/`
- UI tests colocated with components
- E2E tests via Playwright in separate suite
