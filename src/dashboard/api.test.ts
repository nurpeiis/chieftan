import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "./api.js";
import type { FastifyInstance } from "fastify";

describe("Dashboard API", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp({ dbPath: ":memory:" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/health", () => {
    it("returns ok status", async () => {
      const res = await app.inject({ method: "GET", url: "/api/health" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe("ok");
      expect(body.version).toBeDefined();
    });
  });

  describe("GET /api/briefing", () => {
    it("returns a briefing object", async () => {
      const res = await app.inject({ method: "GET", url: "/api/briefing" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty("results");
      expect(body).toHaveProperty("stats");
      expect(body).toHaveProperty("generatedAt");
    });
  });

  describe("GET /api/approvals", () => {
    it("returns pending approvals", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/approvals?userId=user-1",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe("POST /api/approvals", () => {
    it("creates a new proposal", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/approvals",
        payload: {
          userId: "user-1",
          action: "test-action",
          description: "Test proposal",
          source: "test",
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.id).toBeDefined();
      expect(body.status).toBe("pending");
    });
  });

  describe("POST /api/approvals/:id/approve", () => {
    it("approves a pending proposal", async () => {
      // Create a proposal first
      const createRes = await app.inject({
        method: "POST",
        url: "/api/approvals",
        payload: {
          userId: "user-1",
          action: "approve-test",
          description: "To be approved",
          source: "test",
        },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: "POST",
        url: `/api/approvals/${id}/approve`,
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe("approved");
    });
  });

  describe("POST /api/approvals/:id/reject", () => {
    it("rejects a pending proposal with reason", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/api/approvals",
        payload: {
          userId: "user-1",
          action: "reject-test",
          description: "To be rejected",
          source: "test",
        },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: "POST",
        url: `/api/approvals/${id}/reject`,
        payload: { reason: "Not needed" },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe("rejected");
      expect(body.rejectionReason).toBe("Not needed");
    });
  });

  describe("GET /api/analytics/insights", () => {
    it("returns insights array", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/analytics/insights",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe("POST /api/analytics/record", () => {
    it("records a data point", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/analytics/record",
        payload: {
          metric: "test_metric",
          value: 42,
          source: "test",
          date: "2026-02-15",
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.metric).toBe("test_metric");
      expect(body.value).toBe(42);
    });
  });

  describe("GET /api/analytics/trend/:metric", () => {
    it("returns trend data for a metric", async () => {
      // Record enough data
      for (let i = 0; i < 5; i++) {
        await app.inject({
          method: "POST",
          url: "/api/analytics/record",
          payload: {
            metric: "meetings",
            value: 2 + i,
            source: "test",
            date: `2026-02-${String(10 + i).padStart(2, "0")}`,
          },
        });
      }

      const res = await app.inject({
        method: "GET",
        url: "/api/analytics/trend/meetings",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty("direction");
    });
  });

  describe("GET /api/skills", () => {
    it("returns installed skills list", async () => {
      const res = await app.inject({ method: "GET", url: "/api/skills" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe("GET /api/audit", () => {
    it("returns audit log", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/audit?userId=user-1",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body)).toBe(true);
    });
  });
});
