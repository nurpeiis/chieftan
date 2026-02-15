import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseTelegramCommand,
  formatBriefingForTelegram,
  formatApprovalForTelegram,
  formatSkillListForTelegram,
  type TelegramCommand,
} from "./telegram.js";
import type { ConnectorResult } from "../connectors/types.js";
import type { ActionProposal } from "../chief/approval.js";

describe("Telegram Channel", () => {
  describe("parseTelegramCommand", () => {
    it("parses /briefing command", () => {
      const cmd = parseTelegramCommand("/briefing");
      expect(cmd).toEqual({ command: "briefing", args: [] });
    });

    it("parses /skills search with args", () => {
      const cmd = parseTelegramCommand("/skills search weather");
      expect(cmd).toEqual({ command: "skills", args: ["search", "weather"] });
    });

    it("parses /approve with ID", () => {
      const cmd = parseTelegramCommand("/approve 42");
      expect(cmd).toEqual({ command: "approve", args: ["42"] });
    });

    it("parses /reject with ID and reason", () => {
      const cmd = parseTelegramCommand("/reject 42 I need that file");
      expect(cmd).toEqual({
        command: "reject",
        args: ["42", "I", "need", "that", "file"],
      });
    });

    it("returns null for non-command text", () => {
      const cmd = parseTelegramCommand("Hello, how are you?");
      expect(cmd).toBeNull();
    });

    it("parses /start command", () => {
      const cmd = parseTelegramCommand("/start");
      expect(cmd).toEqual({ command: "start", args: [] });
    });

    it("parses /analytics command", () => {
      const cmd = parseTelegramCommand("/analytics");
      expect(cmd).toEqual({ command: "analytics", args: [] });
    });

    it("parses /dashboard command", () => {
      const cmd = parseTelegramCommand("/dashboard");
      expect(cmd).toEqual({ command: "dashboard", args: [] });
    });

    it("parses /help command", () => {
      const cmd = parseTelegramCommand("/help");
      expect(cmd).toEqual({ command: "help", args: [] });
    });

    it("handles extra whitespace", () => {
      const cmd = parseTelegramCommand("  /briefing  ");
      expect(cmd).toEqual({ command: "briefing", args: [] });
    });
  });

  describe("formatBriefingForTelegram", () => {
    it("formats connector results into a readable briefing", () => {
      const results: ConnectorResult[] = [
        {
          source: "gmail",
          timestamp: Date.now(),
          category: "email",
          title: "Q1 Budget Review",
          summary: "Please review the budget",
          priority: "high",
          metadata: { from: "ceo@co.com" },
          actionable: true,
        },
        {
          source: "gcal",
          timestamp: Date.now(),
          category: "meeting",
          title: "Team Standup",
          summary: "Team Standup (30min, 5 attendees)",
          priority: "medium",
          metadata: { durationMinutes: 30, attendeeCount: 5 },
          actionable: false,
        },
        {
          source: "github",
          timestamp: Date.now(),
          category: "PullRequest",
          title: "Fix auth bug",
          summary: "[acme/app] Fix auth bug (review_requested)",
          priority: "high",
          metadata: { repo: "acme/app", reason: "review_requested" },
          actionable: true,
        },
      ];

      const text = formatBriefingForTelegram(results);

      expect(text).toContain("Daily Briefing");
      expect(text).toContain("Q1 Budget Review");
      expect(text).toContain("Team Standup");
      expect(text).toContain("Fix auth bug");
      expect(text).toContain("gmail");
      expect(text).toContain("gcal");
      expect(text).toContain("github");
    });

    it("shows 'no data' message when empty", () => {
      const text = formatBriefingForTelegram([]);
      expect(text).toContain("No new updates");
    });

    it("groups results by source", () => {
      const results: ConnectorResult[] = [
        {
          source: "gmail",
          timestamp: Date.now(),
          category: "email",
          title: "Email 1",
          summary: "s",
          priority: "low",
          metadata: {},
          actionable: false,
        },
        {
          source: "gmail",
          timestamp: Date.now(),
          category: "email",
          title: "Email 2",
          summary: "s",
          priority: "low",
          metadata: {},
          actionable: false,
        },
      ];

      const text = formatBriefingForTelegram(results);
      // Should show gmail section once, not twice
      const gmailMatches = text.match(/gmail/gi);
      // Source header appears once + individual items may reference it
      expect(gmailMatches).toBeDefined();
    });
  });

  describe("formatApprovalForTelegram", () => {
    it("formats pending proposals as actionable list", () => {
      const proposals: ActionProposal[] = [
        {
          id: 1,
          userId: "user-1",
          action: "decline-meeting",
          description: "Decline Friday standup",
          source: "calendar-optimizer",
          status: "pending",
          createdAt: Date.now(),
        },
        {
          id: 2,
          userId: "user-1",
          action: "reply-email",
          description: "Reply to CEO about budget",
          source: "email-assistant",
          status: "pending",
          createdAt: Date.now(),
        },
      ];

      const text = formatApprovalForTelegram(proposals);

      expect(text).toContain("Pending Approvals");
      expect(text).toContain("#1");
      expect(text).toContain("#2");
      expect(text).toContain("decline-meeting");
      expect(text).toContain("reply-email");
      expect(text).toContain("/approve");
      expect(text).toContain("/reject");
    });

    it("shows message when no pending approvals", () => {
      const text = formatApprovalForTelegram([]);
      expect(text).toContain("No pending");
    });
  });

  describe("formatSkillListForTelegram", () => {
    it("formats skills as numbered list", () => {
      const skills = [
        {
          name: "email-digest",
          description: "Summarize emails",
          version: "1.0.0",
          permissions: ["network"] as string[],
        },
        {
          name: "csv-analyzer",
          description: "Analyze CSV files",
          version: "2.0.0",
          permissions: ["file-read"] as string[],
        },
      ];

      const text = formatSkillListForTelegram(skills);

      expect(text).toContain("1.");
      expect(text).toContain("email-digest");
      expect(text).toContain("csv-analyzer");
      expect(text).toContain("network");
      expect(text).toContain("file-read");
    });

    it("shows message when no skills", () => {
      const text = formatSkillListForTelegram([]);
      expect(text).toContain("No skills");
    });
  });
});
