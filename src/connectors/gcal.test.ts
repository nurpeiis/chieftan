import { describe, it, expect, vi } from "vitest";
import { GCalConnector } from "./gcal.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("GCalConnector", () => {
  function mockResponse(data: unknown, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
    };
  }

  describe("fetch", () => {
    it("fetches today's events and returns ConnectorResults", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          items: [
            {
              id: "evt-1",
              summary: "Team Standup",
              start: { dateTime: "2026-02-15T10:00:00Z" },
              end: { dateTime: "2026-02-15T10:30:00Z" },
              attendees: [
                { email: "a@co.com", responseStatus: "accepted" },
                { email: "b@co.com", responseStatus: "declined" },
              ],
              status: "confirmed",
            },
            {
              id: "evt-2",
              summary: "1:1 with Manager",
              start: { dateTime: "2026-02-15T14:00:00Z" },
              end: { dateTime: "2026-02-15T14:30:00Z" },
              attendees: [
                { email: "manager@co.com", responseStatus: "accepted" },
              ],
              status: "confirmed",
            },
          ],
        })
      );

      const connector = new GCalConnector({ accessToken: "ya29.test" });
      const results = await connector.fetch();

      expect(results).toHaveLength(2);
      expect(results[0].source).toBe("gcal");
      expect(results[0].title).toBe("Team Standup");
      expect(results[0].category).toBe("meeting");
      expect(results[0].metadata).toHaveProperty("attendeeCount", 2);
      expect(results[0].metadata).toHaveProperty("durationMinutes", 30);
    });

    it("calculates total meeting hours in metadata", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          items: [
            {
              id: "evt-1",
              summary: "Meeting 1",
              start: { dateTime: "2026-02-15T09:00:00Z" },
              end: { dateTime: "2026-02-15T10:00:00Z" },
              attendees: [],
              status: "confirmed",
            },
            {
              id: "evt-2",
              summary: "Meeting 2",
              start: { dateTime: "2026-02-15T14:00:00Z" },
              end: { dateTime: "2026-02-15T15:30:00Z" },
              attendees: [],
              status: "confirmed",
            },
          ],
        })
      );

      const connector = new GCalConnector({ accessToken: "ya29.test" });
      const results = await connector.fetch();

      expect(results[0].metadata).toHaveProperty("durationMinutes", 60);
      expect(results[1].metadata).toHaveProperty("durationMinutes", 90);
    });

    it("returns empty array when no events", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ items: [] }));

      const connector = new GCalConnector({ accessToken: "ya29.test" });
      const results = await connector.fetch();
      expect(results).toEqual([]);
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}, 401));

      const connector = new GCalConnector({ accessToken: "bad" });
      await expect(connector.fetch()).rejects.toThrow(/Calendar API error/i);
    });
  });

  describe("name", () => {
    it("returns gcal", () => {
      const connector = new GCalConnector({ accessToken: "test" });
      expect(connector.name).toBe("gcal");
    });
  });
});
