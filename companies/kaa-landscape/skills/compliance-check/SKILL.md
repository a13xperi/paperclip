---
name: compliance-check
description: >
  Run plan compliance reviews against building codes, ADA, MWELO, grading,
  and fire safety requirements. Use when a landscape plan or deliverable
  needs compliance validation before client presentation or permit
  submission. Covers Portland, Seattle, and SF Bay Area jurisdictions.
---

# Compliance Check

Structured compliance review for KAA landscape architecture plans. Every plan passes through this skill before it reaches clients or permitting agencies.

## Input

- **Project PRD** — the source of truth for project scope and site conditions
- **Plan deliverable** — the specific document, sheet, or specification under review
- **Jurisdiction** — which code set applies (required)

## Jurisdiction Database

### San Francisco Bay Area (Primary)

**Zoning & Setbacks:**
- Residential setbacks vary by district — check specific zoning designation (R-1, R-2, RH, etc.)
- San Francisco: typically 25% front setback, varies by block pattern
- Oakland: R-35/R-50 districts have specific side/rear setback tables
- Peninsula cities (Palo Alto, Menlo Park, Atherton): generous setbacks, often 20'+ front, 15'+ rear
- Marin County: variable by community plan, check specific APN

**Height Restrictions:**
- Fences: 6' max side/rear, 3.5' max front (most Bay Area cities)
- Retaining walls: typically 4' max without engineering, 6' max with permit
- Structures (pergolas, gazebos): subject to building height limits, usually 15'–35' depending on zone
- Tree height: generally unrestricted except for view corridor ordinances (Tiburon, parts of SF)

**Grading:**
- Minimum 2% slope away from structures for drainage
- Grading permits required for cuts/fills exceeding 50 cubic yards (most jurisdictions)
- Erosion control plan required for disturbed areas >500 sq ft on slopes >15%

**Fire Safety (CalFire / Local):**
- WUI zones: Zone 0 (0–5'), Zone 1 (5–30'), Zone 2 (30–100')
- Zone 0: no combustible materials, hardscape or low-growing succulents only
- Zone 1: fire-resistant plants, 6' spacing between shrub canopies, no trees within 10' of structures
- Zone 2: reduce fuel continuity, limb up trees to 6', thin shrub coverage to 50%
- Prohibited species in fire zones: juniper, eucalyptus, acacia, bamboo, pampas grass, Italian cypress

### Portland, OR

**Setbacks:**
- R5: 10' front, 5' side, 5' rear
- R2.5: 10' front, 3' side, 5' rear
- Ecoroofs and bioswales may encroach into setbacks with approval

**Height:**
- Fences: 6' max side/rear, 3.5' max front
- Structures: varies by base zone (30'–45' residential)

**Stormwater:**
- On-site stormwater management required for all new impervious surfaces >500 sq ft
- Rain gardens or bioswales required for projects adding >1,000 sq ft impervious
- Portland Stormwater Management Manual governs design standards

**Tree Protection:**
- Street trees: City Forester permit required for removal or root zone work
- Significant trees (>12" DBH): mitigation planting required if removed

### Seattle, WA

**Setbacks:**
- SF 5000: 20' front, 5' side, 25' rear
- SF 7200: 20' front, 5' side, 25' rear
- Exceptional tree root zone: no disturbance within drip line + 50%

**Height:**
- Fences: 6' max side/rear, 4' max front
- Arbors/pergolas: exempt under 8' if open-sided

**Drainage:**
- Rainwater harvesting encouraged, cisterns exempt from setbacks under 600 gal
- Green stormwater infrastructure (GSI) incentives available
- Side sewer connection required for drainage exceeding on-site capacity

**Tree Protection:**
- Exceptional trees (>30" DBH or species-specific): removal requires Director's approval
- Heritage trees: cannot be removed

## Review Checklist

Run each check. For each item, record: Pass / Conditional / Fail with specific findings.

### 1. Zoning & Setbacks
- [ ] All structures, walls, and hardscape within setback lines
- [ ] Lot coverage does not exceed maximum (calculate impervious %)
- [ ] Fence heights within limits by location (front vs. side/rear)
- [ ] Any variances needed are identified and noted

### 2. Height Restrictions
- [ ] All structures (pergolas, walls, arbors) under height limit
- [ ] Retaining walls within permit-free thresholds or engineering provided
- [ ] No view corridor violations (if applicable)

### 3. ADA Compliance
- [ ] Primary accessible route ≥48" wide (60" for passing)
- [ ] Route slopes ≤1:20 (5%) for walks, ≤1:12 (8.33%) for ramps with handrails
- [ ] Surface materials are firm, stable, and slip-resistant
- [ ] Level landing areas at grade changes and entries (5' x 5' min)
- [ ] Accessible connection from parking/street to primary outdoor living areas

### 4. MWELO Irrigation Compliance
- [ ] Maximum Applied Water Allowance (MAWA) calculated: `MAWA = (ETo)(0.55)(LA)(0.62)`
- [ ] Estimated Total Water Use (ETWU) calculated: `ETWU = (ETo)(PF)(HA)(0.62)(IE)`
- [ ] ETWU ≤ MAWA
- [ ] Hydrozoning implemented (high/moderate/low/very-low water use areas separated)
- [ ] Smart controller specified with weather-based adjustment
- [ ] Separate meters for landscape irrigation (if >5,000 sq ft landscape area)

### 5. Grading & Drainage
- [ ] Minimum 2% slope away from all structures
- [ ] Grading plan accounts for runoff volume (no adverse drainage to neighbors)
- [ ] Cut/fill volumes calculated and under permit-free thresholds (or permit noted)
- [ ] Erosion control measures specified for disturbed slopes

### 6. Fire Safety (if WUI zone)
- [ ] Zone 0 compliant (no combustible material within 5')
- [ ] Zone 1 plant spacing meets clearance requirements
- [ ] No prohibited species used in any fire zone
- [ ] Mulch type compliant (no bark mulch in Zone 0, composted chips only in Zone 1)
- [ ] Irrigation coverage in all fire zones confirmed

## Output: Compliance Review

```
## Compliance Review

**Project:** [client — address]
**Jurisdiction:** [city/county]
**Plan Reviewed:** [deliverable name / sheet numbers]
**Review Date:** [date]

### Verdict: [Pass / Conditional Pass / Fail]

### Findings

#### [Category — e.g., "Zoning & Setbacks"]
- **[Pass/Conditional/Fail]** — [specific finding with location reference]
  - Sheet: [L-1, Detail 3]
  - Required action: [what must change, or "None"]

[repeat for each category]

### Required Actions (blocking)
1. [action] — [location] — [code reference]

### Recommendations (non-blocking)
1. [suggestion] — [rationale]

### Missing Information
- [anything needed to complete the review]
```
