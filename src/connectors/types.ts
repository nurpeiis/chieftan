/**
 * Standardized output format for all data connectors.
 * Every connector produces ConnectorResult[] so analyzers
 * can consume data source-agnostically.
 */
export interface ConnectorResult {
  source: string;
  timestamp: number;
  category: string;
  title: string;
  summary: string;
  priority: "high" | "medium" | "low";
  metadata: Record<string, unknown>;
  actionable: boolean;
}

export interface ConnectorConfig {
  enabled: boolean;
  [key: string]: unknown;
}

export interface Connector {
  readonly name: string;
  fetch(): Promise<ConnectorResult[]>;
}
