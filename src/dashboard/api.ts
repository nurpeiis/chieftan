import Fastify, { type FastifyInstance } from "fastify";
import { ApprovalGate } from "../chief/approval.js";
import { AnalyticsEngine } from "../chief/analytics.js";
import { BriefingEngine } from "../chief/briefing.js";
import { SkillRegistry } from "../skills/registry.js";
import { VERSION } from "../index.js";

export interface ApiConfig {
  dbPath: string;
  skillsDir?: string;
}

export function buildApp(config: ApiConfig): FastifyInstance {
  const app = Fastify({ logger: false });

  const approvalGate = new ApprovalGate(config.dbPath);
  const analytics = new AnalyticsEngine(config.dbPath);
  const briefingEngine = new BriefingEngine();
  const skillRegistry = config.skillsDir
    ? new SkillRegistry(config.skillsDir)
    : null;

  // Health
  app.get("/api/health", async () => {
    return { status: "ok", version: VERSION, timestamp: Date.now() };
  });

  // Briefing
  app.get("/api/briefing", async () => {
    return await briefingEngine.generateBriefing();
  });

  // Approvals
  app.get<{ Querystring: { userId: string } }>(
    "/api/approvals",
    async (req) => {
      const userId = req.query.userId ?? "default";
      return approvalGate.listPending(userId);
    }
  );

  app.post<{
    Body: {
      userId: string;
      action: string;
      description: string;
      source: string;
      context?: Record<string, unknown>;
    };
  }>("/api/approvals", async (req, reply) => {
    const proposal = approvalGate.propose(req.body);
    reply.status(201);
    return proposal;
  });

  app.post<{ Params: { id: string } }>(
    "/api/approvals/:id/approve",
    async (req) => {
      return approvalGate.approve(Number(req.params.id));
    }
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    "/api/approvals/:id/reject",
    async (req) => {
      return approvalGate.reject(Number(req.params.id), req.body?.reason);
    }
  );

  // Analytics
  app.get("/api/analytics/insights", async () => {
    return analytics.generateInsights();
  });

  app.post<{
    Body: { metric: string; value: number; source: string; date: string };
  }>("/api/analytics/record", async (req, reply) => {
    const point = analytics.record(req.body);
    reply.status(201);
    return point;
  });

  app.get<{ Params: { metric: string }; Querystring: { days?: string } }>(
    "/api/analytics/trend/:metric",
    async (req) => {
      const days = parseInt(req.query.days ?? "7", 10);
      const trend = analytics.detectTrend(req.params.metric, days);
      return trend ?? { direction: "insufficient_data" };
    }
  );

  // Skills
  app.get("/api/skills", async () => {
    if (!skillRegistry) return [];
    return skillRegistry.listEnabled();
  });

  // Audit
  app.get<{ Querystring: { userId: string; limit?: string } }>(
    "/api/audit",
    async (req) => {
      const userId = req.query.userId ?? "default";
      const limit = parseInt(req.query.limit ?? "50", 10);
      return approvalGate.getAuditLog(userId, limit);
    }
  );

  // Cleanup on close
  app.addHook("onClose", async () => {
    approvalGate.close();
    analytics.close();
  });

  return app;
}
