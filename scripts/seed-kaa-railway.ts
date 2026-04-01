/**
 * Seed KAA Landscape data into Railway Paperclip database.
 * Run: railway run -- node --import ./server/node_modules/tsx/dist/loader.mjs scripts/seed-kaa-railway.ts
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import {
  companies,
  agents,
  goals,
  projects,
  issues,
  routines,
  routineTriggers,
  costEvents,
} from "@paperclipai/db";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

// === IDs ===
const COMPANY_ID = randomUUID();
const CEO_ID = randomUUID();
const PM_ID = randomUUID();
const QA_ID = randomUUID();
const CC_ID = randomUUID();

const GOAL_Q2 = randomUUID();
const GOAL_ARCHIVE = randomUUID();
const GOAL_SATISFACTION = randomUUID();
const GOAL_INTAKE = randomUUID();

const PROJ_OPS = randomUUID();
const PROJ_DEMO = randomUUID();
const PROJ_CHEN = randomUUID();
const PROJ_JOHNSON = randomUUID();
const PROJ_DOE = randomUUID();

const ROUTINE_WEEKLY = randomUUID();
const ROUTINE_DAILY = randomUUID();
const ROUTINE_COMMS = randomUUID();

async function main() {
  console.log("Seeding KAA Landscape on Railway...");

  // 1. Company
  await db.insert(companies).values({
    id: COMPANY_ID,
    name: "KAA Landscape",
    description: "Tiered landscape architecture service platform — 4 tiers from DIY ($299) to White Glove (custom). AI agents handle intake triage, project management, QA compliance, and client communications.",
    status: "active",
    issuePrefix: "KAA",
    issueCounter: 1,
    budgetMonthlyCents: 10000,
    spentMonthlyCents: 0,
    brandColor: "#22c55e",
  });
  console.log("  Company: KAA Landscape");

  // 2. Agents
  const agentRows = [
    { id: CEO_ID, companyId: COMPANY_ID, name: "CEO", role: "ceo" as const, title: "Chief Executive Officer", icon: "crown" as const, status: "idle" as const, reportsTo: null, budgetMonthlyCents: 3000, spentMonthlyCents: 0, capabilities: "Strategic oversight for KAA Landscape Architecture. Triages client intake signals, orchestrates weekly project reviews, approves Concierge/White Glove tier scopes, ensures all agent outputs align with the KAA PRD source of truth. Produces weekly board summaries.", adapterType: "claude_local" as const, adapterConfig: { model: "claude-opus-4-6" } },
    { id: PM_ID, companyId: COMPANY_ID, name: "Project Manager", role: "pm" as const, title: "Project Manager", icon: "target" as const, status: "idle" as const, reportsTo: CEO_ID, budgetMonthlyCents: 2500, spentMonthlyCents: 0, capabilities: "Manages KAA landscape projects from intake to delivery. Tracks milestones across all 4 service tiers. Creates PRDs, coordinates with QA for compliance, flags blockers to CEO.", adapterType: "claude_local" as const, adapterConfig: { model: "claude-sonnet-4-6" } },
    { id: QA_ID, companyId: COMPANY_ID, name: "QA Reviewer", role: "qa" as const, title: "Plan Compliance Reviewer", icon: "shield" as const, status: "idle" as const, reportsTo: PM_ID, budgetMonthlyCents: 2000, spentMonthlyCents: 0, capabilities: "Reviews landscape plans against local building codes, zoning requirements, ADA compliance, irrigation/drainage standards, project budget constraints, and PRD specifications.", adapterType: "claude_local" as const, adapterConfig: { model: "claude-sonnet-4-6" } },
    { id: CC_ID, companyId: COMPANY_ID, name: "Client Comms", role: "general" as const, title: "Client Communications Specialist", icon: "mail" as const, status: "idle" as const, reportsTo: PM_ID, budgetMonthlyCents: 2000, spentMonthlyCents: 0, capabilities: "Drafts client-facing communications: project updates, milestone notifications, welcome packages, proposal language, meeting prep briefs. Adapts tone per service tier.", adapterType: "claude_local" as const, adapterConfig: { model: "claude-sonnet-4-6" } },
  ];
  for (const a of agentRows) {
    await db.insert(agents).values(a);
  }
  console.log("  Agents: 4 hired");

  // 3. Goals
  const goalRows = [
    { id: GOAL_Q2, companyId: COMPANY_ID, title: "Q2 2026: Deliver 5 Client Projects on Schedule", description: "Complete intake-to-delivery for 5 landscape architecture projects across all service tiers.", level: "company" as const, status: "active" as const, ownerAgentId: CEO_ID, parentId: null },
    { id: GOAL_ARCHIVE, companyId: COMPANY_ID, title: "Build Reusable Design Archive (100+ Plans)", description: "Catalog completed landscape designs with metadata for rapid reuse in future projects.", level: "company" as const, status: "planned" as const, ownerAgentId: QA_ID, parentId: null },
    { id: GOAL_SATISFACTION, companyId: COMPANY_ID, title: "Achieve 90% Client Satisfaction Score", description: "Measure via post-delivery surveys, response time metrics, and revision request frequency.", level: "company" as const, status: "active" as const, ownerAgentId: CC_ID, parentId: null },
    { id: GOAL_INTAKE, companyId: COMPANY_ID, title: "Streamline Intake-to-Onboarding Under 48 Hours", description: "From lead submission to client onboarding complete in under 48 hours.", level: "team" as const, status: "active" as const, ownerAgentId: PM_ID, parentId: GOAL_Q2 },
  ];
  for (const g of goalRows) {
    await db.insert(goals).values(g);
  }
  console.log("  Goals: 4 created");

  // 4. Projects
  const projectRows = [
    { id: PROJ_OPS, companyId: COMPANY_ID, name: "KAA Operations Pipeline", description: "KAA landscape project lifecycle: intake triage → PRD generation → plan review → client comms.", status: "in_progress" as const, leadAgentId: PM_ID, color: "#6366f1", goalId: GOAL_Q2 },
    { id: PROJ_DEMO, companyId: COMPANY_ID, name: "Demo Garden Redesign — 100 Demo St, Portland OR", description: "Tier 2 (The Builder, $1,499) — Active client project. Backyard garden redesign with native plantings.", status: "in_progress" as const, leadAgentId: PM_ID, targetDate: "2026-05-15", color: "#22c55e", goalId: GOAL_Q2 },
    { id: PROJ_CHEN, companyId: COMPANY_ID, name: "Chen Property Transformation — 789 Pine Rd, San Francisco", description: "Tier 3 (The Concierge, $4,999) — Full property transformation. Budget: $20,000+.", status: "planned" as const, leadAgentId: PM_ID, targetDate: "2026-09-30", color: "#3b82f6", goalId: GOAL_Q2 },
    { id: PROJ_JOHNSON, companyId: COMPANY_ID, name: "Johnson Front Yard — 456 Maple Ave, Seattle", description: "Tier 1 (The Concept, $299) — DIY guidance package.", status: "backlog" as const, leadAgentId: PM_ID, color: "#14b8a6", goalId: GOAL_Q2 },
    { id: PROJ_DOE, companyId: COMPANY_ID, name: "Doe Backyard Redesign — 123 Oak St, Portland", description: "Tier 2 (The Builder, $1,499) — Backyard redesign. Budget: $5,000-$10,000.", status: "backlog" as const, leadAgentId: PM_ID, color: "#22c55e", goalId: GOAL_Q2 },
  ];
  for (const p of projectRows) {
    await db.insert(projects).values(p);
  }
  console.log("  Projects: 5 created");

  // 5. Issues (24 total)
  let issueNum = 0;
  const iss = (title: string, desc: string, status: string, priority: string, agentId: string, projectId: string, goalId: string) => {
    issueNum++;
    return {
      id: randomUUID(),
      companyId: COMPANY_ID,
      projectId,
      goalId,
      title,
      description: desc,
      status: status as any,
      priority: priority as any,
      assigneeAgentId: agentId,
      issueNumber: issueNum,
      identifier: `KAA-${issueNum}`,
    };
  };

  const issueRows = [
    // PM Intake Triage
    iss("Triage Lead: John Doe — Backyard redesign, 123 Oak St, Portland", "NEW lead. Tier 2 recommended. Budget: $5,000-$10,000. Timeline: 3-6 months.", "backlog", "high", PM_ID, PROJ_OPS, GOAL_INTAKE),
    iss("Triage Lead: Flow Test — Standard renovation, 123 Flow St", "NEW lead. Tier 2 recommended. Budget: $10k-$15k.", "backlog", "medium", PM_ID, PROJ_OPS, GOAL_INTAKE),
    iss("Triage Lead: Michael Chen — Full property transformation, SF", "Tier 3 recommended. Budget: $20,000+. RESULT: Approved for Concierge tier.", "done", "high", PM_ID, PROJ_OPS, GOAL_INTAKE),
    iss("Triage Lead: Sarah Johnson — Front yard landscaping, Seattle", "Tier 1 recommended. Budget: $1,000-$3,000. RESULT: Qualified. Concept package proposed.", "done", "medium", PM_ID, PROJ_OPS, GOAL_INTAKE),
    // PM Project Setup
    iss("Create PRD: Demo Garden Redesign — Tier 2 Builder", "Generate PRD for Demo Client's garden redesign at 100 Demo St, Portland.", "done", "high", PM_ID, PROJ_DEMO, GOAL_Q2),
    iss("Create PRD: Chen Property Transformation — Tier 3 Concierge", "Generate comprehensive PRD for Michael Chen's full property transformation.", "in_progress", "high", PM_ID, PROJ_CHEN, GOAL_Q2),
    iss("Onboard Client: Sarah Johnson — Tier 1 Concept Package", "Process Concept tier onboarding: send DIY guidance packet.", "todo", "medium", PM_ID, PROJ_JOHNSON, GOAL_Q2),
    iss("Track Milestone: Design Draft — Demo Garden Redesign", "Current milestone: Design Draft (IN_PROGRESS). Previous: Intake ✓, Consultation ✓.", "in_progress", "high", PM_ID, PROJ_DEMO, GOAL_Q2),
    iss("Assess Capacity: Doe Backyard — Can we take Tier 2 this month?", "Check current Tier 2 workload before accepting.", "backlog", "medium", PM_ID, PROJ_DOE, GOAL_Q2),
    // QA
    iss("QA Review: Demo Garden Design Draft — Code & Zoning Compliance", "Review design draft for Portland zoning, native plant requirements, stormwater.", "in_review", "high", QA_ID, PROJ_DEMO, GOAL_Q2),
    iss("QA Review: Chen Property — Scope vs Budget Alignment", "Verify Concierge tier scope aligns with $20,000+ budget.", "todo", "high", QA_ID, PROJ_CHEN, GOAL_Q2),
    iss("QA Checklist: ADA Pathway Compliance — Demo Garden", "Verified: pathways meet ADA minimum width. PASSED.", "done", "medium", QA_ID, PROJ_DEMO, GOAL_Q2),
    iss("QA Checklist: Irrigation & Drainage — Demo Garden", "Verified: drip irrigation meets Oregon water conservation standards. PASSED.", "done", "medium", QA_ID, PROJ_DEMO, GOAL_Q2),
    iss("QA Review: PRD Conformance — Demo Garden Design vs Requirements", "Compare design draft against PRD specifications.", "in_progress", "medium", QA_ID, PROJ_DEMO, GOAL_Q2),
    iss("Archive: Create Reusable Template — Pacific NW Backyard Garden", "After Demo Garden delivery, catalog design as reusable template.", "backlog", "low", QA_ID, PROJ_DEMO, GOAL_ARCHIVE),
    // Client Comms
    iss("Draft Update: Demo Client — Design Draft milestone in progress", "Draft client-facing email for Design Draft status.", "in_progress", "medium", CC_ID, PROJ_DEMO, GOAL_SATISFACTION),
    iss("Draft: Michael Chen — Concierge Tier Welcome Package", "Draft personalized welcome email for Concierge tier client.", "todo", "high", CC_ID, PROJ_CHEN, GOAL_SATISFACTION),
    iss("Draft: Sarah Johnson — Concept Tier Intro & DIY Guide", "Draft intro email for Concept tier client.", "todo", "medium", CC_ID, PROJ_JOHNSON, GOAL_SATISFACTION),
    iss("Sent: Demo Client — Initial Consultation Summary", "Email sent summarizing consultation outcomes. Client responded positively.", "done", "medium", CC_ID, PROJ_DEMO, GOAL_SATISFACTION),
    iss("Sent: Demo Client — Intake Confirmation & Payment Receipt", "Automated intake confirmation sent with Tier 2 details.", "done", "low", CC_ID, PROJ_DEMO, GOAL_SATISFACTION),
    // CEO
    iss("Weekly Board Summary — Week of March 30, 2026", "COMPLETED. 1 active project, 2 new leads, 1 qualified lead. 30% budget utilization.", "done", "medium", CEO_ID, PROJ_OPS, GOAL_Q2),
    iss("Review: Q2 Pipeline Capacity — Can We Hit 5 Projects?", "Assess capacity against Q2 goal of 5 delivered projects.", "backlog", "high", CEO_ID, PROJ_OPS, GOAL_Q2),
    iss("Approve: Chen Property Transformation — Concierge Tier Scope", "Review and approve scope for Tier 3 Concierge engagement.", "in_review", "critical", CEO_ID, PROJ_CHEN, GOAL_Q2),
    iss("Define: KAA Service Tier Framework in Operations System", "Documented all 4 KAA service tiers in Paperclip.", "done", "medium", CEO_ID, PROJ_OPS, GOAL_Q2),
  ];

  for (const i of issueRows) {
    await db.insert(issues).values(i);
  }
  // Update company issue counter
  await sql`UPDATE companies SET issue_counter = ${issueNum + 1} WHERE id = ${COMPANY_ID}`;
  console.log(`  Issues: ${issueNum} created`);

  // 6. Routines + Triggers
  const routineRows = [
    { id: ROUTINE_WEEKLY, companyId: COMPANY_ID, projectId: PROJ_OPS, title: "Weekly Strategic Review", description: "Review project PRDs, triage intake, check team output, produce board summary.", priority: "high" as const, status: "active" as const, assigneeAgentId: CEO_ID, concurrencyPolicy: "coalesce_if_active" as const, catchUpPolicy: "skip_missed" as const },
    { id: ROUTINE_DAILY, companyId: COMPANY_ID, projectId: PROJ_OPS, title: "Daily Project Check", description: "Check milestones, review QA feedback, update project status.", priority: "medium" as const, status: "active" as const, assigneeAgentId: PM_ID, concurrencyPolicy: "coalesce_if_active" as const, catchUpPolicy: "skip_missed" as const },
    { id: ROUTINE_COMMS, companyId: COMPANY_ID, projectId: PROJ_OPS, title: "Client Communication Drafts", description: "Draft project updates and milestone notifications for active clients.", priority: "medium" as const, status: "active" as const, assigneeAgentId: CC_ID, concurrencyPolicy: "coalesce_if_active" as const, catchUpPolicy: "skip_missed" as const },
  ];
  for (const r of routineRows) {
    await db.insert(routines).values(r);
  }

  const triggerRows = [
    { id: randomUUID(), routineId: ROUTINE_WEEKLY, kind: "schedule" as const, cronExpression: "0 9 * * 1", timezone: "America/Los_Angeles", label: "Every Monday 9am PT", enabled: true },
    { id: randomUUID(), routineId: ROUTINE_DAILY, kind: "schedule" as const, cronExpression: "0 8 * * 1-5", timezone: "America/Los_Angeles", label: "Weekdays 8am PT", enabled: true },
    { id: randomUUID(), routineId: ROUTINE_COMMS, kind: "schedule" as const, cronExpression: "0 14 * * 2,4", timezone: "America/Los_Angeles", label: "Tue & Thu 2pm PT", enabled: true },
  ];
  for (const t of triggerRows) {
    await db.insert(routineTriggers).values(t);
  }
  console.log("  Routines: 3 with triggers");

  // 7. Cost Events (30 events over 2 weeks)
  const costAgents = [
    { id: CEO_ID, model: "claude-opus-4-6", events: 4, avgCost: 200 },
    { id: PM_ID, model: "claude-sonnet-4-6", events: 12, avgCost: 100 },
    { id: QA_ID, model: "claude-sonnet-4-6", events: 8, avgCost: 75 },
    { id: CC_ID, model: "claude-sonnet-4-6", events: 6, avgCost: 65 },
  ];

  let costCount = 0;
  const now = Date.now();
  for (const ca of costAgents) {
    for (let i = 0; i < ca.events; i++) {
      const daysAgo = Math.floor(Math.random() * 14) + 1;
      const hour = 8 + Math.floor(Math.random() * 10);
      const d = new Date(now - daysAgo * 86400000);
      d.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
      const inputTokens = 1500 + Math.floor(Math.random() * 3000);
      const outputTokens = 500 + Math.floor(Math.random() * 1500);
      const costCents = ca.avgCost - 30 + Math.floor(Math.random() * 60);

      await db.insert(costEvents).values({
        id: randomUUID(),
        companyId: COMPANY_ID,
        agentId: ca.id,
        provider: "anthropic",
        biller: "anthropic",
        billingType: "metered_api",
        model: ca.model,
        inputTokens,
        cachedInputTokens: 0,
        outputTokens,
        costCents,
        occurredAt: d,
      });
      costCount++;
    }
  }
  console.log(`  Cost Events: ${costCount} seeded`);

  console.log("\nDone! KAA Landscape is live on Railway.");
  console.log(`Company ID: ${COMPANY_ID}`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
