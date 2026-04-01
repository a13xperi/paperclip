# SAGE

Meta-operations layer for Delphi OS. SAGE doesn't build features or write content — it ensures all processes, automations, and infrastructure across the organization run smoothly.

## How it works

SAGE operates as a **hub-and-spoke** organization. The Ops Director coordinates all activity and dispatches work to three specialists who report back independently.

## Org Chart

| Agent | Title | Reports To | Focus |
|-------|-------|------------|-------|
| Ops Director | CEO | — | Cross-project coordination, escalations, approvals |
| Project Manager | Project Manager | Ops Director | Task tracking, status reports, priority sequencing |
| Process Auditor | Process Auditor | Ops Director | Session hygiene, backlog health, Notion organization |
| DevOps Monitor | DevOps Monitor | Ops Director | Vercel/Railway/BetterStack deployment health |

## Projects

- **Process Health** — session audits, backlog hygiene, Notion compliance
- **Infra Monitoring** — deployment checks, uptime tracking, incident response
- **Cross-Project Coordination** — handoff management, priority alignment

## Getting Started

```bash
paperclipai company import --from companies/sage/
```

## References

- [Agent Companies Specification](https://agentcompanies.io/specification)
- [Paperclip](https://github.com/paperclipai/paperclip)
