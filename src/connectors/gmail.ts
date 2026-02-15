import type { Connector, ConnectorResult } from "./types.js";

export interface GmailConnectorConfig {
  accessToken: string;
  maxResults?: number;
}

interface GmailMessage {
  id: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
  };
  labelIds: string[];
}

export class GmailConnector implements Connector {
  private config: GmailConnectorConfig;

  constructor(config: GmailConnectorConfig) {
    this.config = config;
  }

  get name(): string {
    return "gmail";
  }

  async fetch(): Promise<ConnectorResult[]> {
    const maxResults = this.config.maxResults ?? 20;
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=${maxResults}`;

    const listResponse = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });

    if (!listResponse.ok) {
      throw new Error(`Gmail API error: ${listResponse.status}`);
    }

    const listData = await listResponse.json();
    const messageIds: Array<{ id: string }> = listData.messages ?? [];

    if (messageIds.length === 0) return [];

    const messages = await Promise.all(
      messageIds.map((m) => this.fetchMessage(m.id))
    );

    return messages.map((msg) => {
      const from = getHeader(msg, "From") ?? "Unknown";
      const subject = getHeader(msg, "Subject") ?? "(no subject)";
      const date = getHeader(msg, "Date") ?? "";
      const isImportant = msg.labelIds?.includes("IMPORTANT") ?? false;

      return {
        source: "gmail",
        timestamp: date ? new Date(date).getTime() : Date.now(),
        category: "email",
        title: subject,
        summary: msg.snippet,
        priority: isImportant ? "high" as const : "low" as const,
        metadata: {
          id: msg.id,
          from,
          subject,
          labels: msg.labelIds,
        },
        actionable: isImportant,
      };
    });
  }

  private async fetchMessage(id: string): Promise<GmailMessage> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Gmail API error fetching message ${id}: ${response.status}`);
    }

    return response.json();
  }
}

function getHeader(msg: GmailMessage, name: string): string | undefined {
  return msg.payload.headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  )?.value;
}
