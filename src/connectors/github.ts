import type { Connector, ConnectorResult } from "./types.js";

export interface GitHubConnectorConfig {
  token: string;
  apiBase?: string;
}

interface GitHubNotification {
  id: string;
  reason: string;
  subject: {
    title: string;
    type: string;
    url: string;
  };
  repository: {
    full_name: string;
  };
  updated_at: string;
  unread: boolean;
}

const HIGH_PRIORITY_REASONS = new Set(["review_requested", "assign", "ci_activity"]);
const MEDIUM_PRIORITY_REASONS = new Set(["mention", "team_mention", "security_alert"]);

export class GitHubConnector implements Connector {
  private config: GitHubConnectorConfig;

  constructor(config: GitHubConnectorConfig) {
    this.config = config;
  }

  get name(): string {
    return "github";
  }

  async fetch(): Promise<ConnectorResult[]> {
    const base = this.config.apiBase ?? "https://api.github.com";
    const response = await fetch(`${base}/notifications?all=false`, {
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const notifications: GitHubNotification[] = await response.json();

    return notifications.map((n) => ({
      source: "github",
      timestamp: new Date(n.updated_at).getTime(),
      category: n.subject.type,
      title: n.subject.title,
      summary: `[${n.repository.full_name}] ${n.subject.title} (${n.reason})`,
      priority: getPriority(n.reason),
      metadata: {
        repo: n.repository.full_name,
        reason: n.reason,
        type: n.subject.type,
        url: n.subject.url,
        unread: n.unread,
      },
      actionable: HIGH_PRIORITY_REASONS.has(n.reason),
    }));
  }
}

function getPriority(reason: string): "high" | "medium" | "low" {
  if (HIGH_PRIORITY_REASONS.has(reason)) return "high";
  if (MEDIUM_PRIORITY_REASONS.has(reason)) return "medium";
  return "low";
}
