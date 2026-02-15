import type { Connector, ConnectorResult } from "../connectors/types.js";

export interface BriefingStats {
  total: number;
  high: number;
  medium: number;
  low: number;
  actionable: number;
}

export interface BriefingError {
  connector: string;
  error: string;
}

export interface Briefing {
  results: ConnectorResult[];
  stats: BriefingStats;
  sources: string[];
  errors: BriefingError[];
  generatedAt: number;
}

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export class BriefingEngine {
  private connectors: Map<string, Connector> = new Map();

  addConnector(connector: Connector): void {
    if (this.connectors.has(connector.name)) {
      throw new Error(`Connector "${connector.name}" is already registered`);
    }
    this.connectors.set(connector.name, connector);
  }

  removeConnector(name: string): void {
    this.connectors.delete(name);
  }

  listConnectors(): string[] {
    return Array.from(this.connectors.keys());
  }

  async generateBriefing(): Promise<Briefing> {
    const allResults: ConnectorResult[] = [];
    const errors: BriefingError[] = [];
    const sources: string[] = [];

    const fetchPromises = Array.from(this.connectors.entries()).map(
      async ([name, connector]) => {
        try {
          const results = await connector.fetch();
          return { name, results, error: null };
        } catch (err) {
          return {
            name,
            results: [] as ConnectorResult[],
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }
    );

    const outcomes = await Promise.all(fetchPromises);

    for (const outcome of outcomes) {
      if (outcome.error) {
        errors.push({ connector: outcome.name, error: outcome.error });
      } else {
        sources.push(outcome.name);
        allResults.push(...outcome.results);
      }
    }

    // Sort by priority
    allResults.sort(
      (a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
    );

    const stats: BriefingStats = {
      total: allResults.length,
      high: allResults.filter((r) => r.priority === "high").length,
      medium: allResults.filter((r) => r.priority === "medium").length,
      low: allResults.filter((r) => r.priority === "low").length,
      actionable: allResults.filter((r) => r.actionable).length,
    };

    return {
      results: allResults,
      stats,
      sources,
      errors,
      generatedAt: Date.now(),
    };
  }
}
