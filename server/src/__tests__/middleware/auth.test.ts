// @vitest-environment node

import { agentApiKeys, agents, companyMemberships, instanceUserRoles } from "@paperclipai/db";
import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BetterAuthSessionResult } from "../../auth/better-auth.js";

const mockBoardAuthService = vi.hoisted(() => ({
  findBoardApiKeyByToken: vi.fn(),
  resolveBoardAccess: vi.fn(),
  touchBoardApiKey: vi.fn(),
}));

const mockVerifyLocalAgentJwt = vi.hoisted(() => vi.fn());

vi.mock("../../services/board-auth.js", () => ({
  boardAuthService: () => mockBoardAuthService,
}));

vi.mock("../../agent-auth-jwt.js", () => ({
  verifyLocalAgentJwt: mockVerifyLocalAgentJwt,
}));

import { errorHandler } from "../../middleware/error-handler.js";
import { actorMiddleware, requireBoard } from "../../middleware/auth.js";
import { unauthorized } from "../../errors.js";
import { assertCompanyAccess, assertInstanceAdmin } from "../../routes/authz.js";

type FakeDbState = {
  agentKeyRows?: Array<Record<string, unknown>>;
  agentRows?: Array<Record<string, unknown>>;
  companyMembershipRows?: Array<Record<string, unknown>>;
  instanceUserRoleRows?: Array<Record<string, unknown>>;
};

function createFakeDb(state: FakeDbState = {}) {
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];

  function rowsForTable(table: unknown) {
    if (table === agentApiKeys) return state.agentKeyRows ?? [];
    if (table === agents) return state.agentRows ?? [];
    if (table === companyMemberships) return state.companyMembershipRows ?? [];
    if (table === instanceUserRoles) return state.instanceUserRoleRows ?? [];
    throw new Error("Unexpected table access in auth middleware test");
  }

  return {
    updates,
    select: () => ({
      from: (table: unknown) => ({
        where: async () => rowsForTable(table),
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          updates.push({ table, values });
          return [];
        },
      }),
    }),
  };
}

function makeReq(input: {
  method?: string;
  originalUrl?: string;
  headers?: Record<string, string | undefined>;
} = {}): Request {
  const headers = Object.fromEntries(
    Object.entries(input.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    method: input.method ?? "GET",
    originalUrl: input.originalUrl ?? "/test",
    header: (name: string) => headers[name.toLowerCase()],
    actor: { type: "none", source: "none" },
  } as unknown as Request;
}

function makeRes(): Response {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as Response;
  (res.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

async function runActorMiddleware(
  dbState: FakeDbState = {},
  input: {
    deploymentMode?: "authenticated" | "local_trusted";
    resolveSession?: (req: Request) => Promise<BetterAuthSessionResult | null>;
    req?: {
      method?: string;
      originalUrl?: string;
      headers?: Record<string, string | undefined>;
    };
  } = {},
) {
  const db = createFakeDb(dbState);
  const req = makeReq(input.req);
  const res = {} as Response;
  const next = vi.fn() as unknown as NextFunction;

  const middleware = actorMiddleware(db as never, {
    deploymentMode: input.deploymentMode ?? "authenticated",
    resolveSession: input.resolveSession,
  });

  await middleware(req, res, next);

  return { db, req, next };
}

function runGuard(
  req: Request,
  guard: (request: Request) => void,
) {
  const res = makeRes();
  const next = vi.fn() as unknown as NextFunction;

  try {
    guard(req);
  } catch (err) {
    errorHandler(err as Error, req, res, next);
  }

  return { res, next };
}

describe("actorMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBoardAuthService.findBoardApiKeyByToken.mockResolvedValue(null);
    mockBoardAuthService.resolveBoardAccess.mockResolvedValue(null);
    mockBoardAuthService.touchBoardApiKey.mockResolvedValue(undefined);
    mockVerifyLocalAgentJwt.mockReturnValue(null);
  });

  it("authenticates board bearer tokens and carries board access into req.actor", async () => {
    mockBoardAuthService.findBoardApiKeyByToken.mockResolvedValue({
      id: "board-key-1",
      userId: "user-1",
    });
    mockBoardAuthService.resolveBoardAccess.mockResolvedValue({
      user: { id: "user-1" },
      companyIds: ["company-1", "company-2"],
      isInstanceAdmin: true,
    });

    const { req, next } = await runActorMiddleware({}, {
      req: {
        headers: {
          authorization: "Bearer board-token",
          "x-paperclip-run-id": "run-1",
        },
      },
    });

    expect(req.actor).toEqual({
      type: "board",
      userId: "user-1",
      companyIds: ["company-1", "company-2"],
      isInstanceAdmin: true,
      keyId: "board-key-1",
      runId: "run-1",
      source: "board_key",
    });
    expect(next).toHaveBeenCalledOnce();
    expect(mockBoardAuthService.findBoardApiKeyByToken).toHaveBeenCalledWith("board-token");
    expect(mockBoardAuthService.touchBoardApiKey).toHaveBeenCalledWith("board-key-1");
    expect(mockVerifyLocalAgentJwt).not.toHaveBeenCalled();
  });

  it("defaults to an implicit local board actor in local_trusted mode", async () => {
    const { req, next } = await runActorMiddleware({}, {
      deploymentMode: "local_trusted",
      req: {
        headers: {
          "x-paperclip-run-id": "run-local",
        },
      },
    });

    expect(req.actor).toEqual({
      type: "board",
      userId: "local-board",
      isInstanceAdmin: true,
      runId: "run-local",
      source: "local_implicit",
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it("authenticates active agent API keys and updates last-used metadata", async () => {
    const { db, req, next } = await runActorMiddleware(
      {
        agentKeyRows: [
          {
            id: "agent-key-1",
            agentId: "agent-1",
            companyId: "company-1",
          },
        ],
        agentRows: [
          {
            id: "agent-1",
            companyId: "company-1",
            status: "active",
          },
        ],
      },
      {
        req: {
          headers: {
            authorization: "Bearer agent-token",
            "x-paperclip-run-id": "run-2",
          },
        },
      },
    );

    expect(req.actor).toEqual({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-1",
      keyId: "agent-key-1",
      runId: "run-2",
      source: "agent_key",
    });
    expect(next).toHaveBeenCalledOnce();
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0]).toMatchObject({
      table: agentApiKeys,
    });
    expect(db.updates[0]?.values.lastUsedAt).toBeInstanceOf(Date);
    expect(mockVerifyLocalAgentJwt).not.toHaveBeenCalled();
  });

  it("falls back to local agent JWT validation when no stored API key matches", async () => {
    mockVerifyLocalAgentJwt.mockReturnValue({
      sub: "agent-2",
      company_id: "company-2",
      run_id: "run-from-jwt",
    });

    const { req, next } = await runActorMiddleware(
      {
        agentRows: [
          {
            id: "agent-2",
            companyId: "company-2",
            status: "active",
          },
        ],
      },
      {
        req: {
          headers: {
            authorization: "Bearer jwt-token",
          },
        },
      },
    );

    expect(req.actor).toEqual({
      type: "agent",
      agentId: "agent-2",
      companyId: "company-2",
      keyId: undefined,
      runId: "run-from-jwt",
      source: "agent_jwt",
    });
    expect(next).toHaveBeenCalledOnce();
    expect(mockVerifyLocalAgentJwt).toHaveBeenCalledWith("jwt-token");
  });

  it("leaves disabled agent API keys unauthenticated", async () => {
    const { req, next } = await runActorMiddleware(
      {
        agentKeyRows: [
          {
            id: "agent-key-disabled",
            agentId: "agent-disabled",
            companyId: "company-1",
          },
        ],
        agentRows: [
          {
            id: "agent-disabled",
            companyId: "company-1",
            status: "terminated",
          },
        ],
      },
      {
        req: {
          headers: {
            authorization: "Bearer disabled-agent-token",
          },
        },
      },
    );

    expect(req.actor).toEqual({
      type: "none",
      source: "none",
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects JWTs whose company claim does not match the agent record", async () => {
    mockVerifyLocalAgentJwt.mockReturnValue({
      sub: "agent-3",
      company_id: "company-jwt",
      run_id: "run-jwt-mismatch",
    });

    const { req, next } = await runActorMiddleware(
      {
        agentRows: [
          {
            id: "agent-3",
            companyId: "company-db",
            status: "active",
          },
        ],
      },
      {
        req: {
          headers: {
            authorization: "Bearer mismatched-jwt",
          },
        },
      },
    );

    expect(req.actor).toEqual({
      type: "none",
      source: "none",
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it("hydrates board actors from authenticated sessions with memberships and admin role", async () => {
    const resolveSession = vi.fn(async () => ({
      session: { id: "session-1", userId: "user-2" },
      user: { id: "user-2", email: "user-2@example.com", name: "User Two" },
    }));

    const { req, next } = await runActorMiddleware(
      {
        companyMembershipRows: [{ companyId: "company-a" }, { companyId: "company-b" }],
        instanceUserRoleRows: [{ id: "instance-role-1" }],
      },
      {
        resolveSession,
        req: {
          headers: {
            "x-paperclip-run-id": "run-3",
          },
        },
      },
    );

    expect(req.actor).toEqual({
      type: "board",
      userId: "user-2",
      companyIds: ["company-a", "company-b"],
      isInstanceAdmin: true,
      runId: "run-3",
      source: "session",
    });
    expect(next).toHaveBeenCalledOnce();
    expect(resolveSession).toHaveBeenCalledTimes(1);
    expect(mockBoardAuthService.findBoardApiKeyByToken).not.toHaveBeenCalled();
  });

  it("keeps requests anonymous when session resolution throws", async () => {
    const resolveSession = vi.fn(async () => {
      throw new Error("session lookup failed");
    });

    const { req, next } = await runActorMiddleware({}, { resolveSession });

    expect(req.actor).toEqual({
      type: "none",
      source: "none",
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it("leaves the request anonymous when no token or session resolves", async () => {
    const resolveSession = vi.fn(async () => null);
    const { req, next } = await runActorMiddleware({}, { resolveSession });

    expect(req.actor).toEqual({
      type: "none",
      source: "none",
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it("preserves the run id on anonymous requests when no credentials resolve", async () => {
    const resolveSession = vi.fn(async () => null);
    const { req, next } = await runActorMiddleware({}, {
      resolveSession,
      req: {
        headers: {
          "x-paperclip-run-id": "run-anonymous",
        },
      },
    });

    expect(req.actor).toEqual({
      type: "none",
      source: "none",
      runId: "run-anonymous",
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it("ignores empty bearer tokens", async () => {
    const { req, next } = await runActorMiddleware({}, {
      req: {
        headers: {
          authorization: "Bearer   ",
        },
      },
    });

    expect(req.actor).toEqual({
      type: "none",
      source: "none",
    });
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("auth role and access checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBoardAuthService.findBoardApiKeyByToken.mockResolvedValue(null);
    mockBoardAuthService.resolveBoardAccess.mockResolvedValue(null);
    mockBoardAuthService.touchBoardApiKey.mockResolvedValue(undefined);
    mockVerifyLocalAgentJwt.mockReturnValue(null);
  });

  it("treats unauthenticated requests as unauthorized for board-only access", async () => {
    const { req } = await runActorMiddleware();
    const { res } = runGuard(req, (request) => {
      if (!requireBoard(request)) throw unauthorized();
    });

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("rejects non-admin board sessions from instance-admin routes", async () => {
    const resolveSession = vi.fn(async () => ({
      session: { id: "session-2", userId: "user-3" },
      user: { id: "user-3" },
    }));

    const { req } = await runActorMiddleware(
      {
        companyMembershipRows: [{ companyId: "company-1" }],
      },
      { resolveSession },
    );
    const { res } = runGuard(req, assertInstanceAdmin);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Instance admin access required" });
  });

  it("allows instance-admin session actors through role checks", async () => {
    const resolveSession = vi.fn(async () => ({
      session: { id: "session-3", userId: "user-4" },
      user: { id: "user-4" },
    }));

    const { req } = await runActorMiddleware(
      {
        companyMembershipRows: [{ companyId: "company-1" }],
        instanceUserRoleRows: [{ id: "instance-role-2" }],
      },
      { resolveSession },
    );

    expect(() => assertInstanceAdmin(req)).not.toThrow();
  });

  it("rejects board sessions that access a company outside their memberships", async () => {
    const resolveSession = vi.fn(async () => ({
      session: { id: "session-4", userId: "user-5" },
      user: { id: "user-5" },
    }));

    const { req } = await runActorMiddleware(
      {
        companyMembershipRows: [{ companyId: "company-1" }],
      },
      { resolveSession },
    );
    const { res } = runGuard(req, (request) => assertCompanyAccess(request, "company-2"));

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "User does not have access to this company" });
  });

  it("rejects agent tokens that target another company", async () => {
    const { req } = await runActorMiddleware(
      {
        agentKeyRows: [
          {
            id: "agent-key-2",
            agentId: "agent-9",
            companyId: "company-9",
          },
        ],
        agentRows: [
          {
            id: "agent-9",
            companyId: "company-9",
            status: "active",
          },
        ],
      },
      {
        req: {
          headers: {
            authorization: "Bearer agent-token",
          },
        },
      },
    );
    const { res } = runGuard(req, (request) => assertCompanyAccess(request, "company-10"));

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Agent key cannot access another company" });
  });
});
