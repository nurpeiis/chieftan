import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Scheduler, type ScheduledTask } from "./scheduler.js";

describe("Scheduler", () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    scheduler = new Scheduler();
  });

  afterEach(() => {
    scheduler.stopAll();
  });

  describe("register", () => {
    it("registers a task with a cron expression", () => {
      const handler = vi.fn();
      const task = scheduler.register({
        name: "daily-briefing",
        cron: "0 9 * * *",
        handler,
      });

      expect(task.name).toBe("daily-briefing");
      expect(task.cron).toBe("0 9 * * *");
      expect(task.active).toBe(true);
    });

    it("throws on duplicate task name", () => {
      const handler = vi.fn();
      scheduler.register({ name: "task-1", cron: "0 9 * * *", handler });

      expect(() =>
        scheduler.register({ name: "task-1", cron: "0 10 * * *", handler })
      ).toThrow(/already registered/i);
    });
  });

  describe("unregister", () => {
    it("removes a registered task", () => {
      const handler = vi.fn();
      scheduler.register({ name: "temp-task", cron: "0 9 * * *", handler });
      scheduler.unregister("temp-task");

      const tasks = scheduler.listTasks();
      expect(tasks.find((t) => t.name === "temp-task")).toBeUndefined();
    });

    it("is a no-op for non-existent task", () => {
      expect(() => scheduler.unregister("ghost")).not.toThrow();
    });
  });

  describe("listTasks", () => {
    it("returns all registered tasks", () => {
      const handler = vi.fn();
      scheduler.register({ name: "task-a", cron: "0 9 * * *", handler });
      scheduler.register({ name: "task-b", cron: "0 18 * * *", handler });

      const tasks = scheduler.listTasks();
      expect(tasks).toHaveLength(2);
      expect(tasks.map((t) => t.name)).toEqual(["task-a", "task-b"]);
    });

    it("returns empty array when no tasks registered", () => {
      expect(scheduler.listTasks()).toEqual([]);
    });
  });

  describe("pause / resume", () => {
    it("can pause and resume a task", () => {
      const handler = vi.fn();
      scheduler.register({ name: "pausable", cron: "0 9 * * *", handler });

      scheduler.pause("pausable");
      expect(scheduler.getTask("pausable")?.active).toBe(false);

      scheduler.resume("pausable");
      expect(scheduler.getTask("pausable")?.active).toBe(true);
    });
  });

  describe("getTask", () => {
    it("returns task info by name", () => {
      const handler = vi.fn();
      scheduler.register({ name: "info-task", cron: "*/5 * * * *", handler });

      const task = scheduler.getTask("info-task");
      expect(task).toBeDefined();
      expect(task!.name).toBe("info-task");
      expect(task!.nextRun).toBeDefined();
    });

    it("returns undefined for non-existent task", () => {
      expect(scheduler.getTask("nope")).toBeUndefined();
    });
  });

  describe("runNow", () => {
    it("executes a task handler immediately", async () => {
      const handler = vi.fn().mockResolvedValue("done");
      scheduler.register({ name: "immediate", cron: "0 9 * * *", handler });

      const result = await scheduler.runNow("immediate");
      expect(handler).toHaveBeenCalledOnce();
      expect(result).toBe("done");
    });

    it("throws for non-existent task", async () => {
      await expect(scheduler.runNow("ghost")).rejects.toThrow(/not found/i);
    });
  });
});
