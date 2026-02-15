import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AnalyticsEngine, type DataPoint, type Insight } from "./analytics.js";

describe("AnalyticsEngine", () => {
  let engine: AnalyticsEngine;

  beforeEach(() => {
    engine = new AnalyticsEngine(":memory:");
  });

  afterEach(() => {
    engine.close();
  });

  describe("record", () => {
    it("records a data point", () => {
      const point = engine.record({
        metric: "email_count",
        value: 15,
        source: "gmail",
        date: "2026-02-15",
      });

      expect(point.id).toBeDefined();
      expect(point.metric).toBe("email_count");
      expect(point.value).toBe(15);
    });

    it("records multiple data points for the same metric", () => {
      engine.record({ metric: "meetings", value: 4, source: "gcal", date: "2026-02-14" });
      engine.record({ metric: "meetings", value: 6, source: "gcal", date: "2026-02-15" });

      const points = engine.getHistory("meetings", 7);
      expect(points).toHaveLength(2);
    });
  });

  describe("getHistory", () => {
    it("returns data points for a metric within a date range", () => {
      engine.record({ metric: "commits", value: 5, source: "github", date: "2026-02-10" });
      engine.record({ metric: "commits", value: 8, source: "github", date: "2026-02-11" });
      engine.record({ metric: "commits", value: 3, source: "github", date: "2026-02-12" });

      const history = engine.getHistory("commits", 30);
      expect(history).toHaveLength(3);
      // Oldest first
      expect(history[0].value).toBe(5);
      expect(history[2].value).toBe(3);
    });

    it("returns empty for unknown metric", () => {
      expect(engine.getHistory("unknown", 7)).toEqual([]);
    });
  });

  describe("detectTrend", () => {
    it("detects upward trend", () => {
      engine.record({ metric: "meetings", value: 2, source: "gcal", date: "2026-02-10" });
      engine.record({ metric: "meetings", value: 3, source: "gcal", date: "2026-02-11" });
      engine.record({ metric: "meetings", value: 5, source: "gcal", date: "2026-02-12" });
      engine.record({ metric: "meetings", value: 7, source: "gcal", date: "2026-02-13" });
      engine.record({ metric: "meetings", value: 8, source: "gcal", date: "2026-02-14" });

      const trend = engine.detectTrend("meetings", 7);

      expect(trend).toBeDefined();
      expect(trend!.direction).toBe("up");
      expect(trend!.percentChange).toBeGreaterThan(0);
    });

    it("detects downward trend", () => {
      engine.record({ metric: "bugs", value: 10, source: "github", date: "2026-02-10" });
      engine.record({ metric: "bugs", value: 8, source: "github", date: "2026-02-11" });
      engine.record({ metric: "bugs", value: 5, source: "github", date: "2026-02-12" });
      engine.record({ metric: "bugs", value: 3, source: "github", date: "2026-02-13" });
      engine.record({ metric: "bugs", value: 1, source: "github", date: "2026-02-14" });

      const trend = engine.detectTrend("bugs", 7);

      expect(trend).toBeDefined();
      expect(trend!.direction).toBe("down");
    });

    it("detects stable trend", () => {
      for (let i = 0; i < 5; i++) {
        engine.record({
          metric: "stable",
          value: 5 + (i % 2 === 0 ? 0.1 : -0.1), // tiny fluctuation
          source: "test",
          date: `2026-02-${10 + i}`,
        });
      }

      const trend = engine.detectTrend("stable", 7);
      expect(trend).toBeDefined();
      expect(trend!.direction).toBe("stable");
    });

    it("returns null with insufficient data", () => {
      engine.record({ metric: "sparse", value: 5, source: "test", date: "2026-02-15" });
      expect(engine.detectTrend("sparse", 7)).toBeNull();
    });
  });

  describe("detectAnomalies", () => {
    it("flags values that deviate significantly from the mean", () => {
      // Normal range: ~5
      engine.record({ metric: "errors", value: 5, source: "api", date: "2026-02-10" });
      engine.record({ metric: "errors", value: 4, source: "api", date: "2026-02-11" });
      engine.record({ metric: "errors", value: 6, source: "api", date: "2026-02-12" });
      engine.record({ metric: "errors", value: 5, source: "api", date: "2026-02-13" });
      engine.record({ metric: "errors", value: 5, source: "api", date: "2026-02-14" });
      // Anomaly
      engine.record({ metric: "errors", value: 25, source: "api", date: "2026-02-15" });

      const anomalies = engine.detectAnomalies("errors", 7);

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].value).toBe(25);
      expect(anomalies[0].deviationFactor).toBeGreaterThan(2);
    });

    it("returns empty array with no anomalies", () => {
      for (let i = 0; i < 5; i++) {
        engine.record({
          metric: "steady",
          value: 10,
          source: "test",
          date: `2026-02-${10 + i}`,
        });
      }

      const anomalies = engine.detectAnomalies("steady", 7);
      expect(anomalies).toEqual([]);
    });
  });

  describe("generateInsights", () => {
    it("produces insight cards from recorded data", () => {
      // Record enough data for trends
      for (let i = 0; i < 7; i++) {
        engine.record({
          metric: "meeting_hours",
          value: 2 + i,
          source: "gcal",
          date: `2026-02-${String(8 + i).padStart(2, "0")}`,
        });
      }

      const insights = engine.generateInsights();

      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0]).toHaveProperty("metric");
      expect(insights[0]).toHaveProperty("message");
      expect(insights[0]).toHaveProperty("type");
    });

    it("returns empty insights when no data", () => {
      const insights = engine.generateInsights();
      expect(insights).toEqual([]);
    });
  });
});
