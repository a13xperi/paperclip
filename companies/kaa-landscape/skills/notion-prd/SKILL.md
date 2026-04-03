---
name: notion-prd
description: >
  Manage Project PRDs (Product Requirement Documents) in Notion for KAA
  landscape projects. Use when creating a new project PRD, updating an
  existing PRD section, or querying PRD status across active projects.
  Requires Notion MCP tools.
---

# Notion PRD

Create, update, and query KAA landscape project PRDs in Notion. The Project PRD is the immutable source of truth for each project — treat it with care.

## Prerequisites

This skill uses Notion MCP tools:
- `notion-search` — find existing PRDs
- `notion-create-pages` — create new PRD pages
- `notion-update-page` — update PRD sections
- `notion-fetch` — read PRD content

## Operation 1: Create New PRD

When creating a PRD for a new project, build a page with these sections:

### Page Structure

**Title:** `PRD — [Client Last Name] — [Address Short]`
(e.g., "PRD — Chen — 142 Hillcrest")

**Sections (in order):**

#### 1. Project Overview
- Client name and contact
- Property address
- Lot size (sq ft)
- Service tier (from intake triage)
- Project start date
- Target completion date

#### 2. Site Conditions
- USDA hardiness zone
- Sunset climate zone
- Sun exposure (by area if variable)
- Soil type (if known from survey)
- Existing features to preserve
- Existing features to remove
- Slope/grading notes
- Drainage observations
- Utility locations
- Fire zone status (WUI yes/no)

#### 3. Design Brief
- Client style preferences
- Functional requirements (entertaining, kids play, pets, edible garden, etc.)
- Privacy/screening needs
- View corridors to preserve or create
- Materials preferences or exclusions
- Plant preferences or exclusions (allergies, maintenance tolerance)
- Lighting requirements

#### 4. Budget
- Total approved budget
- Breakdown by phase (if multi-phase)
- Contingency allocation (minimum 10%)
- Payment schedule

#### 5. Milestones
Create a table with columns: Milestone | Target Date | Status | Notes

Default milestones:
1. Site survey complete
2. Concept design approved
3. Construction documents complete
4. Permit submitted
5. Construction start
6. Planting complete
7. Final walkthrough
8. 90-day check-in

#### 6. Change Log
Table with columns: Date | Section | Change | Reason | Changed By

First entry: `[today] | All | PRD created | Project intake | [agent name]`

### Create Flow

1. Search Notion for existing PRD with same client/address to avoid duplicates
2. If no duplicate found, create the page using `notion-create-pages`
3. Confirm creation and return the page URL

## Operation 2: Update PRD Section

When updating an existing PRD:

1. Search for the PRD using `notion-search` with the client name or project ID
2. Fetch current content with `notion-fetch` to read the section being updated
3. Apply the update using `notion-update-page`
4. **Always add a change log entry** with:
   - Date
   - Section updated
   - What changed (brief)
   - Why (client request, survey data, code requirement, etc.)
   - Who initiated the change

**Rules:**
- Never delete existing content — mark superseded sections with `~~strikethrough~~` and add `[Superseded — see updated section below]`
- Never update budget without CEO approval noted in the change log
- Never update milestones without verifying downstream dependencies

## Operation 3: Query PRD Status

When checking status across projects:

1. Search Notion for all pages matching "PRD —" prefix
2. For each PRD, read the Milestones section
3. Produce a status summary:

```
## Active Project Status

| Project | Tier | Current Milestone | Status | Next Due | Blockers |
|---|---|---|---|---|---|
| Chen — Hillcrest | Builder | Concept design | On track | Apr 15 | None |
| Park — Dolores | Concierge | Permits | Blocked | Overdue | City review pending |
```

Flag any project where:
- A milestone is overdue by more than 5 days
- Status is "Blocked" for more than 2 days
- No change log entry in the past 14 days (may be stale)
