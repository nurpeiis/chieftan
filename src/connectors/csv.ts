import * as fs from "node:fs";
import type { Connector, ConnectorResult } from "./types.js";

export interface CsvConnectorConfig {
  filePath: string;
  name: string;
  titleColumn?: string;
  delimiter?: string;
}

export class CsvConnector implements Connector {
  private config: CsvConnectorConfig;

  constructor(config: CsvConnectorConfig) {
    this.config = config;
  }

  get name(): string {
    return `csv:${this.config.name}`;
  }

  async fetch(): Promise<ConnectorResult[]> {
    const raw = fs.readFileSync(this.config.filePath, "utf-8");
    const delimiter = this.config.delimiter ?? ",";
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);

    if (lines.length < 2) return [];

    const headers = parseLine(lines[0], delimiter);
    const titleCol = this.config.titleColumn ?? headers[0];
    const results: ConnectorResult[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i], delimiter);
      if (values.length === 0) continue;

      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] ?? "";
      }

      const title = row[titleCol] ?? values[0];

      results.push({
        source: this.name,
        timestamp: Date.now(),
        category: "data",
        title,
        summary: values.join(" | "),
        priority: "low",
        metadata: row,
        actionable: false,
      });
    }

    return results;
  }
}

function parseLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((v) => v.trim());
}
