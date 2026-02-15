import { describe, it, expect, vi, beforeEach } from "vitest";
import { BriefingEngine } from "./briefing.js";
import type { Connector, ConnectorResult } from "../connectors/types.js";

function createMockConnector(
  name: string,
  results: ConnectorResult[]
): Connector {
  return {
    name,
    fetch: vi.fn().mockResolvedValue(results),
  };
}

function makeResult(overrides: Partial<ConnectorResult>): ConnectorResult {
  return {
    source: "test",
    timestamp: Date.now(),
    category: "test",
    title: "Test Item",
    summary: "Test summary",
    priority: "low",
    metadata: {},
    actionable: false,
    ...overrides,
  };
}

describe("BriefingEngine", () => {
  let engine: BriefingEngine;

  beforeEach(() => {
    engine = new BriefingEngine();
  });

  describe("addConnector", () => {
    it("registers a connector", () => {
      const connector = createMockConnector("test", []);
      engine.addConnector(connector);

      expect(engine.listConnectors()).toContain("test");
    });

    it("throws on duplicate connector name", () => {
      const c1 = createMockConnector("test", []);
      const c2 = createMockConnector("test", []);
      engine.addConnector(c1);

      expect(() => engine.addConnector(c2)).toThrow(/already registered/i);
    });
  });

  describe("generateBriefing", () => {
    it("aggregates results from all connectors", async () => {
      engine.addConnector(
        createMockConnector("gmail", [
          makeResult({ source: "gmail", title: "Email 1" }),
          makeResult({ source: "gmail", title: "Email 2" }),
        ])
      );
      engine.addConnector(
        createMockConnector("gcal", [
          makeResult({ source: "gcal", title: "Meeting 1" }),
        ])
      );

      const briefing = await engine.generateBriefing();

      expect(briefing.results).toHaveLength(3);
      expect(briefing.generatedAt).toBeDefined();
      expect(briefing.sources).toEqual(["gmail", "gcal"]);
    });

    it("sorts results by priority (high first)", async () => {
      engine.addConnector(
        createMockConnector("mixed", [
          makeResult({ title: "Low", priority: "low" }),
          makeResult({ title: "High", priority: "high" }),
          makeResult({ title: "Medium", priority: "medium" }),
        ])
      );

      const briefing = await engine.generateBriefing();

      expect(briefing.results[0].title).toBe("High");
      expect(briefing.results[1].title).toBe("Medium");
      expect(briefing.results[2].title).toBe("Low");
    });

    it("includes summary stats", async () => {
      engine.addConnector(
        createMockConnector("gmail", [
          makeResult({ source: "gmail", priority: "high", actionable: true }),
          makeResult({ source: "gmail", priority: "low" }),
        ])
      );
      engine.addConnector(
        createMockConnector("gcal", [
          makeResult({ source: "gcal", priority: "medium" }),
        ])
      );

      const briefing = await engine.generateBriefing();

      expect(briefing.stats.total).toBe(3);
      expect(briefing.stats.high).toBe(1);
      expect(briefing.stats.medium).toBe(1);
      expect(briefing.stats.low).toBe(1);
      expect(briefing.stats.actionable).toBe(1);
    });

    it("handles connector errors gracefully", async () => {
      engine.addConnector(
        createMockConnector("working", [makeResult({ source: "working" })])
      );

      const failingConnector: Connector = {
        name: "failing",
        fetch: vi.fn().mockRejectedValue(new Error("API down")),
      };
      engine.addConnector(failingConnector);

      const briefing = await engine.generateBriefing();

      expect(briefing.results).toHaveLength(1);
      expect(briefing.errors).toHaveLength(1);
      expect(briefing.errors[0].connector).toBe("failing");
      expect(briefing.errors[0].error).toContain("API down");
    });

    it("returns empty briefing when no connectors", async () => {
      const briefing = await engine.generateBriefing();

      expect(briefing.results).toEqual([]);
      expect(briefing.stats.total).toBe(0);
    });
  });

  describe("removeConnector", () => {
    it("removes a registered connector", () => {
      engine.addConnector(createMockConnector("temp", []));
      engine.removeConnector("temp");

      expect(engine.listConnectors()).not.toContain("temp");
    });
  });
});
