import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ApprovalGate,
  type ActionProposal,
  type ApprovalStatus,
} from "./approval.js";

describe("ApprovalGate", () => {
  let gate: ApprovalGate;

  beforeEach(() => {
    gate = new ApprovalGate(":memory:");
  });

  afterEach(() => {
    gate.close();
  });

  describe("propose", () => {
    it("creates a pending action proposal", () => {
      const proposal = gate.propose({
        userId: "user-1",
        action: "decline-meeting",
        description: "Decline recurring standup on Friday — low attendance",
        source: "calendar-optimizer",
        context: { meetingId: "abc-123", attendees: 2 },
      });

      expect(proposal.id).toBeDefined();
      expect(proposal.status).toBe("pending");
      expect(proposal.action).toBe("decline-meeting");
      expect(proposal.createdAt).toBeDefined();
    });

    it("stores context as JSON", () => {
      const proposal = gate.propose({
        userId: "user-1",
        action: "send-reply",
        description: "Reply to CEO email",
        source: "email-assistant",
        context: { emailId: "xyz", draft: "Sounds good." },
      });

      const retrieved = gate.getById(proposal.id!);
      expect(retrieved?.context).toEqual({
        emailId: "xyz",
        draft: "Sounds good.",
      });
    });
  });

  describe("approve", () => {
    it("marks a proposal as approved", () => {
      const proposal = gate.propose({
        userId: "user-1",
        action: "test-action",
        description: "Test",
        source: "test",
      });

      const result = gate.approve(proposal.id!);
      expect(result.status).toBe("approved");
      expect(result.resolvedAt).toBeDefined();
    });

    it("throws for already-resolved proposal", () => {
      const proposal = gate.propose({
        userId: "user-1",
        action: "test",
        description: "Test",
        source: "test",
      });

      gate.approve(proposal.id!);

      expect(() => gate.approve(proposal.id!)).toThrow(/already resolved/i);
    });
  });

  describe("reject", () => {
    it("marks a proposal as rejected with reason", () => {
      const proposal = gate.propose({
        userId: "user-1",
        action: "delete-file",
        description: "Delete temp file",
        source: "cleanup",
      });

      const result = gate.reject(proposal.id!, "I need that file");
      expect(result.status).toBe("rejected");
      expect(result.rejectionReason).toBe("I need that file");
    });
  });

  describe("listPending", () => {
    it("returns only pending proposals for a user", () => {
      gate.propose({ userId: "user-1", action: "a", description: "A", source: "s" });
      gate.propose({ userId: "user-1", action: "b", description: "B", source: "s" });
      const toApprove = gate.propose({
        userId: "user-1",
        action: "c",
        description: "C",
        source: "s",
      });
      gate.approve(toApprove.id!);

      const pending = gate.listPending("user-1");
      expect(pending).toHaveLength(2);
      expect(pending.every((p) => p.status === "pending")).toBe(true);
    });

    it("does not return proposals for other users", () => {
      gate.propose({ userId: "user-1", action: "a", description: "A", source: "s" });
      gate.propose({ userId: "user-2", action: "b", description: "B", source: "s" });

      expect(gate.listPending("user-1")).toHaveLength(1);
      expect(gate.listPending("user-2")).toHaveLength(1);
    });
  });

  describe("getAuditLog", () => {
    it("returns all proposals (resolved and pending) for a user", () => {
      gate.propose({ userId: "user-1", action: "a", description: "A", source: "s" });
      const p2 = gate.propose({
        userId: "user-1",
        action: "b",
        description: "B",
        source: "s",
      });
      gate.approve(p2.id!);

      const log = gate.getAuditLog("user-1");
      expect(log).toHaveLength(2);
    });

    it("supports limit parameter", () => {
      for (let i = 0; i < 10; i++) {
        gate.propose({
          userId: "user-1",
          action: `action-${i}`,
          description: `Desc ${i}`,
          source: "s",
        });
      }

      const log = gate.getAuditLog("user-1", 3);
      expect(log).toHaveLength(3);
    });
  });

  describe("approveAll", () => {
    it("batch approves all pending proposals for a user", () => {
      gate.propose({ userId: "user-1", action: "a", description: "A", source: "s" });
      gate.propose({ userId: "user-1", action: "b", description: "B", source: "s" });

      const count = gate.approveAll("user-1");

      expect(count).toBe(2);
      expect(gate.listPending("user-1")).toEqual([]);
    });
  });
});
