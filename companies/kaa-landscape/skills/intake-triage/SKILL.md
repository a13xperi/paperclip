---
name: intake-triage
description: >
  Triage incoming client leads into service tiers and urgency scores.
  Use when a new intake form arrives, a referral comes in, or when
  re-prioritizing the lead pipeline. Produces a structured triage card
  with tier classification, urgency score, and PM assignment recommendation.
---

# Intake Triage

Parse and classify incoming landscape architecture leads so the CEO can prioritize the pipeline and delegate to the right PM.

## Input

An intake form or lead signal containing some or all of:

| Field | Required | Example |
|---|---|---|
| Client name | yes | "Maria Chen" |
| Address | yes | "142 Hillcrest Dr, Mill Valley, CA" |
| Lot size | yes | 4,200 sq ft |
| Budget | yes | $45,000 |
| Style preferences | no | "drought-tolerant modern", "Japanese-inspired" |
| Timeline | no | "Want to start before summer" |
| Referral source | no | "Houzz", "past client Jane Kim" |
| Scope notes | no | "Full backyard redesign, existing pool to keep" |

If required fields are missing, flag them — don't guess.

## Step 1: Classify Service Tier

Assign one tier based on budget and scope:

| Tier | Budget Range | Scope Indicators |
|---|---|---|
| **Concept** | Under $15K | Single-area refresh, planting plan only, consultation |
| **Builder** | $15K–$75K | Full yard or front/back, hardscape + softscape, standard materials |
| **Concierge** | $75K–$200K | Multi-phase, premium materials, water features, outdoor structures |
| **White Glove** | $200K+ | Estate-scale, custom fabrication, phased multi-year, architecture coordination |

**Edge cases:**
- If budget says Builder but scope is clearly Concierge-level (e.g., pool + ADU + full landscape), classify as Concierge and note the budget gap.
- If budget is missing, classify based on lot size + scope and flag budget as TBD.

## Step 2: Score Urgency (1–5)

Score each factor, then take the highest as the overall urgency:

| Factor | Score 5 (urgent) | Score 3 (moderate) | Score 1 (low) |
|---|---|---|---|
| **Timeline** | "Need it done in 4 weeks" | "This season" | "No rush" / unspecified |
| **Season** | Planting window closing (<6 weeks to frost/heat) | Mid-season | Off-season / flexible |
| **Referral** | Past client or architect partner referral | Houzz / Google lead | Cold inquiry |
| **Scope decay** | Active erosion, safety hazard, HOA deadline | Aesthetic concern | Enhancement / wishlist |

## Step 3: Recommend PM Assignment

Based on current PM workload and project fit:

- If the PM with the fewest active projects has capacity → assign them
- If the project matches a PM's geographic or style expertise → prefer that PM
- If all PMs are at capacity (5+ active projects) → flag for CEO to hire or defer

## Output: Triage Card

Produce this structured output:

```
## Triage Card

**Client:** [name]
**Address:** [address]
**Lot Size:** [sq ft]
**Budget:** [amount or TBD]

**Service Tier:** [Concept / Builder / Concierge / White Glove]
**Tier Notes:** [any edge case explanation]

**Urgency Score:** [1–5]
**Urgency Factors:**
- Timeline: [score] — [reason]
- Season: [score] — [reason]
- Referral: [score] — [reason]
- Scope decay: [score] — [reason]

**Recommended PM:** [name or "needs hire"]
**Assignment Rationale:** [1 sentence]

**Missing Info:** [list any required fields not provided]
**Next Action:** [e.g., "Schedule site visit", "Request budget clarification", "Add to waitlist"]
```
