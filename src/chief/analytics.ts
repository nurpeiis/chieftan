import Database from "better-sqlite3";

export interface DataPoint {
  id?: number;
  metric: string;
  value: number;
  source: string;
  date: string;
  recordedAt?: number;
}

export interface Trend {
  metric: string;
  direction: "up" | "down" | "stable";
  percentChange: number;
  period: number;
}

export interface Anomaly {
  metric: string;
  value: number;
  date: string;
  mean: number;
  stdDev: number;
  deviationFactor: number;
}

export interface Insight {
  metric: string;
  type: "trend" | "anomaly" | "summary";
  message: string;
  data: Record<string, unknown>;
}

export class AnalyticsEngine {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS data_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric TEXT NOT NULL,
        value REAL NOT NULL,
        source TEXT NOT NULL,
        date TEXT NOT NULL,
        recorded_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_dp_metric ON data_points(metric);
      CREATE INDEX IF NOT EXISTS idx_dp_date ON data_points(metric, date);
    `);
  }

  record(input: Omit<DataPoint, "id" | "recordedAt">): DataPoint {
    const now = Date.now();
    const result = this.db
      .prepare(
        "INSERT INTO data_points (metric, value, source, date, recorded_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(input.metric, input.value, input.source, input.date, now);

    return { ...input, id: Number(result.lastInsertRowid), recordedAt: now };
  }

  getHistory(metric: string, days: number): DataPoint[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM data_points WHERE metric = ? ORDER BY date ASC"
      )
      .all(metric) as RawRow[];

    return rows.map((r) => this.toDataPoint(r));
  }

  detectTrend(metric: string, days: number): Trend | null {
    const history = this.getHistory(metric, days);
    if (history.length < 3) return null;

    const firstHalf = history.slice(0, Math.floor(history.length / 2));
    const secondHalf = history.slice(Math.floor(history.length / 2));

    const avgFirst = average(firstHalf.map((d) => d.value));
    const avgSecond = average(secondHalf.map((d) => d.value));

    if (avgFirst === 0) {
      return {
        metric,
        direction: avgSecond > 0 ? "up" : "stable",
        percentChange: avgSecond > 0 ? 100 : 0,
        period: days,
      };
    }

    const percentChange = ((avgSecond - avgFirst) / avgFirst) * 100;

    let direction: "up" | "down" | "stable";
    if (percentChange > 10) direction = "up";
    else if (percentChange < -10) direction = "down";
    else direction = "stable";

    return { metric, direction, percentChange, period: days };
  }

  detectAnomalies(metric: string, days: number): Anomaly[] {
    const history = this.getHistory(metric, days);
    if (history.length < 3) return [];

    const values = history.map((d) => d.value);
    const mean = average(values);
    const stdDev = standardDeviation(values);

    if (stdDev === 0) return [];

    const anomalies: Anomaly[] = [];

    for (const point of history) {
      const deviationFactor = Math.abs(point.value - mean) / stdDev;
      if (deviationFactor > 2) {
        anomalies.push({
          metric,
          value: point.value,
          date: point.date,
          mean,
          stdDev,
          deviationFactor,
        });
      }
    }

    return anomalies;
  }

  generateInsights(): Insight[] {
    const metrics = this.listMetrics();
    const insights: Insight[] = [];

    for (const metric of metrics) {
      const trend = this.detectTrend(metric, 7);
      if (trend && trend.direction !== "stable") {
        const arrow = trend.direction === "up" ? "↑" : "↓";
        const pct = Math.abs(trend.percentChange).toFixed(1);
        insights.push({
          metric,
          type: "trend",
          message: `${metric} is trending ${trend.direction} ${arrow} (${pct}% change over ${trend.period} days)`,
          data: trend as unknown as Record<string, unknown>,
        });
      }

      const anomalies = this.detectAnomalies(metric, 7);
      for (const anomaly of anomalies) {
        insights.push({
          metric,
          type: "anomaly",
          message: `${metric} had an unusual value of ${anomaly.value} on ${anomaly.date} (expected ~${anomaly.mean.toFixed(1)})`,
          data: anomaly as unknown as Record<string, unknown>,
        });
      }
    }

    return insights;
  }

  private listMetrics(): string[] {
    const rows = this.db
      .prepare("SELECT DISTINCT metric FROM data_points")
      .all() as Array<{ metric: string }>;
    return rows.map((r) => r.metric);
  }

  close(): void {
    this.db.close();
  }

  private toDataPoint(row: RawRow): DataPoint {
    return {
      id: row.id,
      metric: row.metric,
      value: row.value,
      source: row.source,
      date: row.date,
      recordedAt: row.recorded_at,
    };
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = average(values);
  const squareDiffs = values.map((v) => (v - avg) ** 2);
  return Math.sqrt(average(squareDiffs));
}

interface RawRow {
  id: number;
  metric: string;
  value: number;
  source: string;
  date: string;
  recorded_at: number;
}
