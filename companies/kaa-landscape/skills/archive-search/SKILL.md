---
name: archive-search
description: >
  Search the KAA project archive for precedent designs, plant palettes,
  and material specifications. Use when researching comparable projects,
  building plant selections for a new design, or finding material specs
  that match project parameters. Filters by climate zone, lot size,
  aesthetic style, budget, and sun exposure.
---

# Archive Search

Query KAA's 10,000+ project archive to find precedent designs, plant palettes, material specs, and irrigation references for new projects.

## Input Parameters

Every search should specify as many of these as available:

| Parameter | Type | Example |
|---|---|---|
| Climate zone | USDA zone (and/or Sunset zone) | 9b, Sunset 16 |
| Lot size range | sq ft range | 2,000–5,000 |
| Aesthetic style | keyword(s) | "drought-tolerant modern" |
| Budget range | dollar range | $40K–$75K |
| Sun exposure | category | full sun, partial shade, mixed |

Optional refinements:
- **Fire zone:** WUI yes/no (filters to fire-safe palettes)
- **Soil type:** clay, sandy loam, fill (affects plant viability)
- **Feature type:** specific element to find (water feature, edible garden, screening, slope stabilization)
- **Year range:** limit to recent projects (e.g., 2020+) for current material availability

## Search Strategy

### 1. Filter by Hard Constraints First

Apply in this order (each narrows the result set):
1. **Climate zone** — exclude projects outside the zone tolerance (±1 USDA zone)
2. **Lot size** — ±30% of target range
3. **Fire zone** — if WUI, exclude projects with non-compliant palettes
4. **Sun exposure** — match primary exposure type

### 2. Score by Soft Matches

Rank remaining results by relevance:
- Aesthetic style match (keyword overlap with project tags)
- Budget proximity (closer = higher score)
- Recency (newer projects weighted slightly higher for material availability)
- Completeness (projects with as-built photos and maintenance data ranked higher)

### 3. Return Top Matches

Return 5–10 best matches. For each, provide the data specified in the output sections below.

## Output: Project Summaries

For each matching project:

```
### [Project ID] — [Client/Location], [Year]

**Match Score:** [high/medium/low] — [1-line reason]
**Zone:** [USDA] / [Sunset]
**Lot Size:** [sq ft]
**Style:** [tags]
**Budget:** [total]
**Sun:** [exposure]

**Key Design Elements:**
- [element 1 — e.g., "sunken patio with bluestone pavers"]
- [element 2 — e.g., "native meadow screening along north fence"]

**Condition Notes:** [if maintenance/as-built data available]
```

## Output: Plant Palettes

When the search is for plant selections, return a structured palette:

```
### Plant Palette — [style] / [zone]

#### Canopy Trees
| Species | Common Name | Size (H×W) | Water | Sun | WUCOLS | Notes |
|---|---|---|---|---|---|---|
| Quercus agrifolia | Coast Live Oak | 40'×40' | VL | Full | VL | Evergreen, native |

#### Understory Trees
[same table format]

#### Shrubs
[same table format]

#### Groundcover
[same table format]

#### Accent / Specimen
[same table format]
```

**Required columns:**
- **Water:** VL (very low), L (low), M (moderate), H (high) — from WUCOLS
- **WUCOLS:** official WUCOLS rating for the specific region
- **Notes:** bloom season, fire safety status, invasive status, availability

**Validation rules:**
- Cross-check every species against **Cal-IPC invasive plant inventory** — exclude any species on High, Moderate, or Limited tiers. Note exclusions.
- If project is in a WUI fire zone, flag fire-prone species and include fire-resistant alternatives.
- Include aggregate water budget estimate for the palette (gallons/month in peak season for a reference lot size).

## Output: Material Specifications

When the search is for materials:

```
### Materials — [category]

| Material | Product/Type | Cost Tier | Source | Notes |
|---|---|---|---|---|
| Pavers | Belgard Catalina Slate | $$ | Local distributor | 60mm, permeable option available |
```

**Cost tiers:** $ (budget), $$ (mid-range), $$$ (premium), $$$$ (custom/luxury)

Include:
- Current availability status (in stock / lead time / special order)
- Local supplier when known
- Maintenance requirements
- Warranty or lifespan notes

## Cross-Reference: Nursery Availability

For plant palettes, cross-reference selections against known nursery availability:

- **Common nursery stock:** available at wholesale in 1, 5, 15 gallon
- **Specialty grower:** limited availability, may need 6–12 month pre-order
- **Seed/plug only:** long establishment time, note in recommendations
- **Unavailable:** discontinued or not currently propagated — suggest alternatives

Flag any species where the specified size (specimen, multi-trunk, etc.) requires specialty sourcing or extended lead time.

## No-Result Handling

If the archive has fewer than 3 matches:
1. Relax the loosest constraint (usually aesthetic style or budget range) and re-search
2. Note which constraints were relaxed
3. If still insufficient, report honestly: "Archive lacks strong precedent for this combination. Recommend original research using [WUCOLS database / Sunset Western Garden Book / supplier catalogs]."

Never fabricate archive data. Always cite source project IDs.
