import { describe, it, expect, vi } from "vitest";
import { GmailConnector } from "./gmail.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("GmailConnector", () => {
  function mockResponse(data: unknown, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
    };
  }

  describe("fetch", () => {
    it("fetches unread emails and returns ConnectorResults", async () => {
      // First call: list messages
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          messages: [{ id: "msg-1" }, { id: "msg-2" }],
          resultSizeEstimate: 2,
        })
      );

      // Second & third calls: get individual messages
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          id: "msg-1",
          snippet: "Please review the Q1 budget proposal",
          payload: {
            headers: [
              { name: "From", value: "ceo@company.com" },
              { name: "Subject", value: "Q1 Budget Review" },
              { name: "Date", value: "Sat, 15 Feb 2026 10:00:00 +0000" },
            ],
          },
          labelIds: ["UNREAD", "IMPORTANT"],
        })
      );
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          id: "msg-2",
          snippet: "Your weekly newsletter",
          payload: {
            headers: [
              { name: "From", value: "news@newsletter.com" },
              { name: "Subject", value: "Weekly Digest" },
              { name: "Date", value: "Sat, 15 Feb 2026 09:00:00 +0000" },
            ],
          },
          labelIds: ["UNREAD"],
        })
      );

      const connector = new GmailConnector({ accessToken: "ya29.test" });
      const results = await connector.fetch();

      expect(results).toHaveLength(2);
      expect(results[0].source).toBe("gmail");
      expect(results[0].title).toBe("Q1 Budget Review");
      expect(results[0].metadata).toHaveProperty("from", "ceo@company.com");
      expect(results[0].priority).toBe("high"); // IMPORTANT label
    });

    it("marks IMPORTANT emails as high priority", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ messages: [{ id: "msg-1" }], resultSizeEstimate: 1 })
      );
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          id: "msg-1",
          snippet: "Urgent",
          payload: {
            headers: [
              { name: "From", value: "boss@co.com" },
              { name: "Subject", value: "Urgent" },
              { name: "Date", value: "Sat, 15 Feb 2026 10:00:00 +0000" },
            ],
          },
          labelIds: ["UNREAD", "IMPORTANT"],
        })
      );

      const connector = new GmailConnector({ accessToken: "ya29.test" });
      const results = await connector.fetch();

      expect(results[0].priority).toBe("high");
      expect(results[0].actionable).toBe(true);
    });

    it("returns empty array when no unread emails", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ messages: [], resultSizeEstimate: 0 })
      );

      const connector = new GmailConnector({ accessToken: "ya29.test" });
      const results = await connector.fetch();
      expect(results).toEqual([]);
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: { message: "Invalid token" } }, 401)
      );

      const connector = new GmailConnector({ accessToken: "bad" });
      await expect(connector.fetch()).rejects.toThrow(/Gmail API error/i);
    });
  });

  describe("name", () => {
    it("returns gmail", () => {
      const connector = new GmailConnector({ accessToken: "test" });
      expect(connector.name).toBe("gmail");
    });
  });
});
