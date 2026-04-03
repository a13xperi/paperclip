# CLAUDE.md — Paperclip Development Guide

Paperclip is a Node.js control plane for orchestrating AI agent teams into autonomous businesses. This guide covers architecture, development practices, build commands, and plugin development patterns.

## Quick Start

**Requirements:** Node.js 20+, pnpm 9.15+

```bash
git clone https://github.com/paperclipai/paperclip.git
cd paperclip
pnpm install
pnpm dev
```

This starts:
- API server: http://localhost:3100
- UI: served at same origin (dev middleware mode)
- Embedded PostgreSQL: persisted at ~/.paperclip/instances/default/db

Reset dev DB: `rm -rf ~/.paperclip/instances/default/db && pnpm dev`

## Project Structure

### Core Architecture

```
paperclip/
├── server/                 # Express API + orchestration services
├── ui/                     # React + Vite board UI
├── cli/                    # paperclipai CLI tool
├── packages/
│   ├── db/                 # Drizzle schema, migrations (61 tables)
│   ├── shared/             # Types, constants, validators, API paths
│   ├── adapters/           # Agent adapter implementations
│   │   ├── claude-local/
│   │   ├── codex-local/
│   │   ├── cursor-local/
│   │   ├── gemini-local/
│   │   ├── opencode-local/
│   │   ├── pi-local/
│   │   └── openclaw-gateway/
│   ├── adapter-utils/      # Shared adapter utilities
│   └── plugins/
│       ├── sdk/            # Stable public plugin API
│       ├── create-paperclip-plugin/  # Plugin scaffolder
│       └── examples/       # Reference plugins
├── doc/                    # Product, architecture, operational docs
└── pnpm-workspace.yaml     # Monorepo config (8 workspaces)
```

## Package Manager & Dependencies

**Package Manager:** pnpm 9.15.4 (strict lockfile policy)

**Key Production Dependencies:**
- **Web Framework:** Express 5.1.0
- **Database:** Drizzle ORM 0.38.4, postgres 3.4.5, embedded-postgres 18.1.0-beta.16
- **Authentication:** better-auth 1.4.18
- **File Upload:** multer 2.0.2
- **Realtime:** ws 8.19.0 (WebSocket)
- **Validation:** zod 3.24.2, ajv 8.18.0
- **Logging:** pino 9.6.0, pino-http 10.4.0
- **Image Processing:** sharp 0.34.5
- **Storage:** @aws-sdk/client-s3 3.888.0
- **UI:** React 19.0.0, Vite 6.1.0, Tailwind CSS 4.0.7, Lexical Editor 0.35.0
- **CLI:** commander 13.1.0, @clack/prompts 0.10.0

**Dev Tools:**
- TypeScript 5.7.3
- Vitest 3.0.5 (test runner)
- tsx 4.19.2 (TypeScript executor)
- Playwright 1.58.2 (E2E tests)

**Lockfile Policy:**
- GitHub Actions owns `pnpm-lock.yaml`
- Do NOT commit lockfile in PRs — CI validates when manifests change
- Pushes to `master` regenerate lockfile via CI

## TypeScript Configuration

**Base:** `tsconfig.base.json` → `ES2023`, `NodeNext` module system

**All packages extend `tsconfig.base.json` with:**
- `strict: true`
- `declaration: true` (emit .d.ts)
- `sourceMap: true`
- `skipLibCheck: true`
- `isolatedModules: true`

**Each workspace specifies:**
```json
{
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["src/__tests__"]
}
```

## Build System

### Build Commands (Root)

```bash
pnpm build              # Build all packages in dependency order
pnpm typecheck          # Type check all packages
pnpm test:run           # Run tests (Vitest)
pnpm dev                # Full dev (API + UI, watch mode, auto-restart on changes)
pnpm dev:once           # Full dev without file watching
pnpm dev:server         # Server only
pnpm dev:ui             # UI only
pnpm dev:list           # List managed dev processes
pnpm dev:stop           # Stop managed dev process
```

### Per-Package Build Scripts

**Server** (`server/package.json`):
```bash
pnpm dev                # tsx dev with file watching, preflight checks
pnpm dev:watch          # Same as dev
pnpm build              # tsc + copy onboarding assets
pnpm start              # node dist/index.js
pnpm typecheck          # tsc --noEmit + plugin-sdk build
```

**UI** (`ui/package.json`):
```bash
pnpm dev                # vite dev server
pnpm build              # tsc + vite build
pnpm preview            # vite preview
pnpm typecheck          # tsc -b
```

**CLI** (`cli/package.json`):
```bash
pnpm dev                # tsx dev
pnpm build              # esbuild into standalone executable
```

**DB** (`packages/db/package.json`):
```bash
pnpm build              # tsc + copy migrations to dist
pnpm generate           # tsc + drizzle-kit generate
pnpm migrate            # tsx src/migrate.ts (apply pending migrations)
pnpm seed               # tsx src/seed.ts
```

### Development Workflow

**File Watching:** `pnpm dev` watches:
- Server source files
- Workspace package changes (auto-rebuild)
- Pending migrations (shows "Restart required" banner)

**Dev Middleware Mode:**
- API server at `:3100` serves UI via dev middleware (same origin)
- UI requests route to Vite dev server for hot reload

**Auto-Restart:**
- Dev runner is idempotent — running `pnpm dev` twice returns same process
- Enable auto-restart in Instance Settings > Experimental
- Waits for queued/running agent runs before restarting

**Tailscale Auth Dev:**
```bash
pnpm dev --tailscale-auth
```
Runs as `authenticated/private`, binds to `0.0.0.0` for private network access.

## Testing

**Test Frameworks:** Vitest 3.0.5

**Test Configuration:** `vitest.config.ts`
```typescript
test: {
  testTimeout: 120_000,
  projects: ["packages/db", "packages/adapters/codex-local", 
             "packages/adapters/opencode-local", "server", "ui", "cli"]
}
```

**Run Tests:**
```bash
pnpm test              # Watch mode
pnpm test:run          # Run once
```

**E2E Tests:** Playwright
```bash
pnpm test:e2e          # Run E2E tests
pnpm test:e2e:headed   # Run with browser visible
pnpm test:release-smoke      # Release smoke tests
```

## Code Style & Formatting

**No ESLint/Prettier Config:** This project relies on TypeScript strict mode for code quality. Follow these conventions:

1. **Naming:** camelCase for variables/functions, PascalCase for types/classes
2. **Exports:** Named exports preferred; use default exports for single-entry files (e.g., plugin manifests)
3. **Module Resolution:** Use absolute paths via workspace aliases (e.g., `@paperclipai/db`)
4. **Database Types:** Re-export Drizzle types from `@paperclipai/db`
5. **API Paths:** Import from `@paperclipai/shared` (shared constants)
6. **Error Handling:** Return HTTP status codes explicitly; log with pino
7. **Async/Await:** Prefer async/await over .then() chains
8. **Comments:** JSDoc for public APIs; inline comments for non-obvious logic

## Database

**ORM:** Drizzle ORM 0.38.4  
**Database:** Embedded PostgreSQL (dev) or external Postgres (prod)  
**Migrations:** Located in `packages/db/src/migrations/` (49+ migrations)

### Database Setup

**Development (Default):**
- Embedded PostgreSQL automatically created
- Data persisted at: `~/.paperclip/instances/default/db`
- No external setup required

**Production:**
- Set `DATABASE_URL` to external Postgres connection string
- Dockerfile.railway sets this via environment variable

### Schema (packages/db/src/schema/)

61 tables including:
- **Core:** companies, agents, issues, goals, projects
- **Tasks:** agent_task_sessions, activity_log
- **Budget:** budget_policies, budget_incidents, cost_events
- **Auth:** auth_users, company_memberships, agent_api_keys
- **Approval:** approvals, approval_comments
- **Skills:** company_skills
- **Artifacts:** documents, assets, attachments
- **Execution:** execution_workspaces, agent_runtime_state

### Database Commands

```bash
pnpm db:generate       # Generate migration from schema changes
pnpm db:migrate        # Apply pending migrations
pnpm db:backup         # Backup database (./scripts/backup-db.sh)
```

**Schema Changes Workflow:**
1. Edit schema files in `packages/db/src/schema/`
2. `pnpm db:generate` → creates migration in `packages/db/src/migrations/`
3. `pnpm db:migrate` → applies migration
4. Commit migration files to git

**Reset Dev DB:**
```bash
rm -rf ~/.paperclip/instances/default/db
pnpm dev
```

## Server Architecture (server/src/)

**Entry Point:** `server/src/index.ts` (startServer function)

**Key Modules:**

```
src/
├── index.ts                  # Server bootstrap, db init, listener setup
├── app.ts                    # Express app factory
├── config.ts                 # Config loading (env, file, defaults)
├── middleware/               # Express middleware
│   ├── logger.ts             # Pino HTTP middleware
│   ├── auth.ts               # JWT/session validation
│   └── error-handler.ts
├── routes/ (27 route modules)
│   ├── agents.ts             # Agent CRUD, config, heartbeat
│   ├── issues.ts             # Issue checkout, transitions, comments
│   ├── companies.ts          # Company config, membership
│   ├── goals.ts              # Goal tracking
│   ├── costs.ts              # Cost tracking, budgets
│   ├── skills.ts             # Skill registration
│   ├── plugins.ts            # Plugin management
│   ├── access.ts             # Access control
│   └── ...                   # Other domains
├── services/ (66 service modules)
│   ├── heartbeat.ts          # Agent heartbeat scheduling
│   ├── routine.ts            # Scheduled routines
│   ├── task-checkout.ts      # Atomic task assignment
│   ├── adapter-registry.ts   # Adapter loader + multiplexer
│   ├── plugin-registry.ts    # Plugin lifecycle management
│   └── ...                   # Other domain services
├── adapters/                 # Adapter glue code
│   ├── index.ts              # Adapter factory
│   └── ...                   # Adapter-specific setup
├── realtime/                 # WebSocket connections
│   └── live-events-ws.ts     # Event broadcasts
├── storage/                  # File storage abstraction
│   ├── local-disk.ts         # Local storage (dev default)
│   └── s3.ts                 # AWS S3 storage
├── secrets/                  # Secret management
├── auth/                     # Authentication (better-auth)
├── types/                    # Express type augmentations
└── startup-banner.ts         # Pretty startup output
```

### Server Architecture Principles

**Company-Scoped Domain Logic:**
- Every entity scoped to company ID
- Routes enforce company boundaries in authorization
- Services retrieve company-owned resources only

**Middleware Pattern:**
- Express middleware validates auth, logs requests
- Routes delegate to services
- Services orchestrate domain logic + DB operations

**Adapter Pattern:**
- Adapter registry loads all enabled adapters (Claude, Codex, Cursor, Gemini, OpenCode, PI, OpenClaw)
- Server multiplexes to correct adapter based on agent config
- Adapters implement common interface (run task, check quota, etc.)

**Service Layer:**
- 66 services implement domain-specific orchestration
- heartbeatService: triggers agent wakeups on schedule
- routineService: executes scheduled company routines
- Plugin registry: loads/manages plugins with lifecycle hooks

**WebSocket/Realtime:**
- live-events-ws.ts handles board real-time updates
- Event types: task assignments, status changes, agent messages
- Frontend subscribes to company events

## Plugin Development

**SDK:** `packages/plugins/sdk/` (stable public API, version 1.0.0)

### Plugin Structure

```
my-plugin/
├── src/
│   ├── index.ts          # Export manifest + worker
│   ├── manifest.ts       # Plugin metadata + UI slot definitions
│   ├── worker.ts         # Worker lifecycle hooks
│   └── ui/
│       └── index.tsx     # React UI components (optional)
├── dist/                 # Build output
│   ├── manifest.js
│   ├── worker.js
│   └── ui/
├── tsconfig.json
└── package.json
```

### Manifest (manifest.ts)

```typescript
import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "plugin.my-plugin",           // Stable, reverse-domain style
  apiVersion: 1,
  version: "0.1.0",
  displayName: "My Plugin",
  description: "What it does",
  author: "You",
  categories: ["ui", "data", "integration"],
  capabilities: ["ui.dashboardWidget.register", ...],
  
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui"
  },
  
  ui: {
    slots: [
      {
        type: "dashboardWidget",
        id: "my-widget",
        displayName: "Widget Name",
        exportName: "MyWidgetComponent"
      }
    ]
  }
};

export default manifest;
```

### Worker (worker.ts)

```typescript
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

const plugin = definePlugin({
  async setup(ctx) {
    // Called on host plugin start
    ctx.logger.info("Plugin setup");
    // ctx has: logger, config, utils, host APIs
  },
  
  async onHealth() {
    // Called by health probe
    return { status: "ok", message: "Ready" };
  },
  
  // Optional lifecycle hooks:
  // async onTick() { }  // Called periodically
  // async onDestroy() { }
});

export default plugin;
runWorker(plugin, import.meta.url);
```

### UI Component (ui/index.tsx)

```typescript
import type { PluginWidgetProps } from "@paperclipai/plugin-sdk/ui";

export function MyWidgetComponent({ context }: PluginWidgetProps) {
  // context: { companyId, boardId, ...}
  return <div>Plugin UI</div>;
}
```

### SDK Exports

- **Main:** `@paperclipai/plugin-sdk` → definePlugin, runWorker, types
- **Protocol:** `@paperclipai/plugin-sdk/protocol` → Message types
- **Types:** `@paperclipai/plugin-sdk/types` → Interfaces
- **UI:** `@paperclipai/plugin-sdk/ui` → React hooks, components
- **Testing:** `@paperclipai/plugin-sdk/testing` → Test utilities
- **Dev Server:** `@paperclipai/plugin-sdk/dev-server` → Plugin dev server

### Build & Deploy

```bash
cd packages/plugins/examples/my-plugin
pnpm build
```

Produces: `dist/manifest.js`, `dist/worker.js`, `dist/ui/`

**Paperclip discovers plugins via:**
1. `packages/plugins/examples/` (bundled examples)
2. NPM packages with `"paperclipPlugin"` field in package.json:
   ```json
   {
     "name": "@myorg/my-plugin",
     "paperclipPlugin": {
       "manifest": "./dist/manifest.js",
       "worker": "./dist/worker.js",
       "ui": "./dist/ui/"
     }
   }
   ```

### Reference Plugins

- `plugin-hello-world-example`: Minimal UI-only plugin
- `plugin-kitchen-sink-example`: Demonstrates all SDK features
- `plugin-notion-sync`: Integration example (Notion API)
- `plugin-atlas-api`: External API integration example
- `plugin-file-browser-example`: File system access
- `plugin-authoring-smoke-example`: Authoring workflow

## Deployment

### Docker

**Development:**
```bash
docker build -t paperclip-local .
docker run -p 3100:3100 \
  -e PAPERCLIP_HOME=/paperclip \
  -v $(pwd)/data/docker-paperclip:/paperclip \
  paperclip-local
```

**Docker Compose (Quick Start):**
```bash
docker compose -f docker-compose.quickstart.yml up --build
```

### Production Dockerfile

- **Dockerfile:** Standard production build (emits compiled server)
- **Dockerfile.railway:** Railway-optimized build (uses tsx at runtime, no tsc)

**Key Environment Variables:**
```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=3100
SERVE_UI=true
PAPERCLIP_HOME=/paperclip         # Instance data directory
PAPERCLIP_INSTANCE_ID=default     # Instance identifier
PAPERCLIP_CONFIG=/paperclip/...   # Config file path
PAPERCLIP_DEPLOYMENT_MODE=authenticated  # local_trusted | authenticated
PAPERCLIP_DEPLOYMENT_EXPOSURE=private    # private | public
DATABASE_URL=postgres://...       # External Postgres (or unset for embedded)
```

### Deployment Modes

**local_trusted:** Single user, local-only, no auth
**authenticated:** Multi-user, auth required, role-based access
**private/public:** Exposure (private network vs. open internet)

See `doc/DEPLOYMENT-MODES.md` for full details.

## Environment Variables

**Development (Optional):**
```bash
DATABASE_URL=postgres://...       # Leave unset for embedded Postgres
PORT=3100                         # API port (default)
SERVE_UI=false                    # Serve UI from API (default: false in dev)
PAPERCLIP_HOME=~/.paperclip       # Instance directory
PAPERCLIP_INSTANCE_ID=default     # Instance ID
```

**Secrets/Auth:**
```bash
ANTHROPIC_API_KEY=sk-...          # Claude API key (for agents)
OPENAI_API_KEY=...                # OpenAI API key (for Codex)
OPENCODE_API_KEY=...              # OpenCode API key
CODEX_HOME=~/.codex               # Codex home directory (local)
```

**Advanced:**
```bash
PAPERCLIP_MIGRATION_PROMPT=never  # Skip migration confirmations
PAPERCLIP_MIGRATION_AUTO_APPLY=true
PAPERCLIP_SECRETS_PROVIDER=...    # Secret backend (default: local)
```

See `.env.example` and config loading in `server/src/config.ts`.

## Git Conventions

### Commit Message Style

Based on recent commits — focus on "thinking path" (why, not just what):

```
feat: add per-adapter context compaction configuration

Paperclip orchestrates many agent types with different context limits.
Some adapters (Claude) auto-compact context; others don't (OpenCode).
This adds per-adapter config so each provider runs optimally.
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

### Pull Request Process

**Small Changes (< 50 lines, single concern):**
- Describe clearly in PR title + description
- Run tests locally first
- Greptile feedback must be addressed

**Larger Changes:**
1. Discuss in Discord #dev channel first
2. Share approach + rationale
3. After agreement, implement
4. Include in PR:
   - Before/after screenshots (UI changes)
   - Clear description of what + why
   - Proof of testing (manual notes)
   - All tests passing

**Required Checks:**
- No new lint/test failures
- Greptile comments addressed
- Commit messages clear
- One logical change per PR (unless small related group)

See `CONTRIBUTING.md` for full details.

## Core Engineering Rules

**From AGENTS.md:**

1. **Keep changes company-scoped.**
   - Every domain entity must be scoped to company
   - Routes/services enforce company boundaries
   - No cross-company data leakage

2. **Keep contracts synchronized.**
   - When you change schema → update:
     - `packages/db` schema + exports
     - `packages/shared` types/validators
     - `server` routes/services
     - `ui` API clients

3. **Preserve control-plane invariants:**
   - Single-assignee task model
   - Atomic issue checkout semantics
   - Approval gates for governed actions
   - Budget hard-stop auto-pause
   - Activity logging for mutations

4. **Database:**
   - All entities scoped to company_id
   - Use Drizzle schema types
   - Migrations tracked in git
   - Reset dev DB cleanly

5. **API:**
   - REST routes under `/api/`
   - Status codes explicit (200, 201, 400, 401, 403, 404, 500)
   - Error responses include message
   - Paths centralized in `@paperclipai/shared`

## Documentation

**Key Docs in doc/:**
- `GOAL.md` — Product vision
- `PRODUCT.md` — Feature overview
- `SPEC-implementation.md` — V1 build contract
- `DATABASE.md` — Schema relationships
- `DEVELOPING.md` — Full dev guide
- `SPEC.md` — Long-horizon architecture
- `RELEASING.md` — Release process
- `DOCKER.md` — Docker setup details
- `CLI.md` — CLI documentation

## Useful Commands Cheat Sheet

```bash
# Development
pnpm dev                    # Full dev (API + UI, watch mode)
pnpm dev:once               # Full dev without watching
pnpm dev:server             # Server only
pnpm dev:ui                 # UI only
pnpm dev:list               # List managed dev processes
pnpm dev:stop               # Stop managed dev

# Build & Test
pnpm build                  # Build all packages
pnpm typecheck              # Type check everything
pnpm test:run               # Run all tests once
pnpm test:e2e               # Run E2E tests
pnpm test:e2e:headed        # Run E2E with browser visible

# Database
pnpm db:generate            # Generate migration
pnpm db:migrate             # Apply migrations
pnpm db:backup              # Backup database

# CLI
pnpm paperclipai onboard    # Initialize instance
pnpm paperclipai configure  # Edit settings
pnpm paperclipai run        # One-command startup
pnpm paperclipai doctor     # Health check

# Release
pnpm release                # Release next version
pnpm release:canary         # Canary release
pnpm release:github         # Create GitHub release
```

## Troubleshooting

**Dev server won't start:**
```bash
pnpm dev:stop               # Kill managed process
rm -rf ~/.paperclip/instances/default/db  # Reset DB
pnpm dev
```

**Type errors after dependency update:**
```bash
pnpm typecheck              # Full typecheck
pnpm build                  # Full build
```

**Test failures:**
```bash
pnpm test:run --reporter=verbose
```

**Plugin not loading:**
- Verify manifest has `id`, `apiVersion`, `entrypoints`
- Check dist output: `dist/manifest.js`, `dist/worker.js`
- Restart dev server for bundled plugins

## Key References

- **GitHub:** https://github.com/paperclipai/paperclip
- **Docs:** https://paperclip.ing/docs
- **Discord:** https://discord.gg/m4HZY7xNG3
- **License:** MIT

---

Last updated: April 2026 | Paperclip v0.3.1
