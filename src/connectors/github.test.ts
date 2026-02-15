import { describe, it, expect, vi } from "vitest";
import { GitHubConnector } from "./github.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("GitHubConnector", () => {
  function mockResponse(data: unknown, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
    };
  }

  describe("fetch", () => {
    it("fetches notifications and returns ConnectorResults", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse([
          {
            id: "1",
            reason: "review_requested",
            subject: {
              title: "Fix auth bug",
              type: "PullRequest",
              url: "https://api.github.com/repos/acme/app/pulls/42",
            },
            repository: { full_name: "acme/app" },
            updated_at: "2026-02-15T10:00:00Z",
            unread: true,
          },
          {
            id: "2",
            reason: "mention",
            subject: {
              title: "Deploy failing",
              type: "Issue",
              url: "https://api.github.com/repos/acme/app/issues/99",
            },
            repository: { full_name: "acme/app" },
            updated_at: "2026-02-15T09:00:00Z",
            unread: true,
          },
        ])
      );

      const connector = new GitHubConnector({ token: "ghp_test123" });
      const results = await connector.fetch();

      expect(results).toHaveLength(2);
      expect(results[0].source).toBe("github");
      expect(results[0].title).toBe("Fix auth bug");
      expect(results[0].category).toBe("PullRequest");
      expect(results[0].metadata).toHaveProperty("repo", "acme/app");
      expect(results[0].metadata).toHaveProperty("reason", "review_requested");
    });

    it("marks review_requested as high priority", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse([
          {
            id: "1",
            reason: "review_requested",
            subject: { title: "PR", type: "PullRequest", url: "" },
            repository: { full_name: "acme/app" },
            updated_at: "2026-02-15T10:00:00Z",
            unread: true,
          },
        ])
      );

      const connector = new GitHubConnector({ token: "ghp_test" });
      const results = await connector.fetch();

      expect(results[0].priority).toBe("high");
      expect(results[0].actionable).toBe(true);
    });

    it("marks mentions as medium priority", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse([
          {
            id: "1",
            reason: "mention",
            subject: { title: "Issue", type: "Issue", url: "" },
            repository: { full_name: "acme/app" },
            updated_at: "2026-02-15T10:00:00Z",
            unread: true,
          },
        ])
      );

      const connector = new GitHubConnector({ token: "ghp_test" });
      const results = await connector.fetch();

      expect(results[0].priority).toBe("medium");
    });

    it("sends auth header with token", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));

      const connector = new GitHubConnector({ token: "ghp_secret" });
      await connector.fetch();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("api.github.com"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer ghp_secret",
          }),
        })
      );
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ message: "Bad credentials" }, 401));

      const connector = new GitHubConnector({ token: "bad" });
      await expect(connector.fetch()).rejects.toThrow(/GitHub API error/i);
    });

    it("returns empty array on no notifications", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));

      const connector = new GitHubConnector({ token: "ghp_test" });
      const results = await connector.fetch();
      expect(results).toEqual([]);
    });
  });

  describe("name", () => {
    it("returns github", () => {
      const connector = new GitHubConnector({ token: "test" });
      expect(connector.name).toBe("github");
    });
  });
});
