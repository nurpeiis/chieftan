import type { Connector, ConnectorResult } from "./types.js";

export interface GCalConnectorConfig {
  accessToken: string;
  calendarId?: string;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string; responseStatus: string }>;
  status: string;
}

export class GCalConnector implements Connector {
  private config: GCalConnectorConfig;

  constructor(config: GCalConnectorConfig) {
    this.config = config;
  }

  get name(): string {
    return "gcal";
  }

  async fetch(): Promise<ConnectorResult[]> {
    const calendarId = this.config.calendarId ?? "primary";
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
    });

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.status}`);
    }

    const data = await response.json();
    const events: CalendarEvent[] = data.items ?? [];

    return events.map((evt) => {
      const start = new Date(evt.start.dateTime ?? evt.start.date ?? "");
      const end = new Date(evt.end.dateTime ?? evt.end.date ?? "");
      const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
      const attendeeCount = evt.attendees?.length ?? 0;

      return {
        source: "gcal",
        timestamp: start.getTime(),
        category: "meeting",
        title: evt.summary,
        summary: `${evt.summary} (${durationMinutes}min, ${attendeeCount} attendees)`,
        priority: "medium" as const,
        metadata: {
          eventId: evt.id,
          startTime: evt.start.dateTime ?? evt.start.date,
          endTime: evt.end.dateTime ?? evt.end.date,
          durationMinutes,
          attendeeCount,
          status: evt.status,
        },
        actionable: false,
      };
    });
  }
}
