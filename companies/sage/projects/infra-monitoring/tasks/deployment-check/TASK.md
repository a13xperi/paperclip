---
name: Initial Deployment Health Check
assignee: devops-monitor
project: infra-monitoring
---

Run the first health check across all Delphi OS deployments:

1. **Atlas Frontend (Vercel)** — Hit delphi-atlas.vercel.app and staging-delphi-atlas.vercel.app. Record HTTP status and response time. Check for blank pages or console errors.
2. **Atlas Backend (Railway)** — Hit api-production-9bef.up.railway.app health endpoint. Record status and latency.
3. **OpenClaw (BetterStack)** — Check heartbeat status. Verify it's green.
4. **Produce Report** — Summarize: all-green, degraded (which service), or incident. Post as a comment on this task.
