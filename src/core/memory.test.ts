import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryStore, type MemoryEntry } from "./memory.js";

describe("MemoryStore", () => {
  let memory: MemoryStore;

  beforeEach(() => {
    memory = new MemoryStore(":memory:");
  });

  afterEach(() => {
    memory.close();
  });

  describe("store", () => {
    it("stores a memory entry and returns an id", () => {
      const entry = memory.store({
        userId: "user-1",
        key: "preference.timezone",
        value: "America/New_York",
      });

      expect(entry.id).toBeDefined();
      expect(entry.key).toBe("preference.timezone");
    });

    it("overwrites existing key for same user", () => {
      memory.store({ userId: "user-1", key: "name", value: "Alice" });
      memory.store({ userId: "user-1", key: "name", value: "Bob" });

      const result = memory.get("user-1", "name");
      expect(result?.value).toBe("Bob");
    });

    it("keeps separate entries for different users", () => {
      memory.store({ userId: "user-1", key: "name", value: "Alice" });
      memory.store({ userId: "user-2", key: "name", value: "Bob" });

      expect(memory.get("user-1", "name")?.value).toBe("Alice");
      expect(memory.get("user-2", "name")?.value).toBe("Bob");
    });
  });

  describe("get", () => {
    it("retrieves a stored entry", () => {
      memory.store({ userId: "user-1", key: "color", value: "blue" });

      const entry = memory.get("user-1", "color");
      expect(entry).toBeDefined();
      expect(entry!.value).toBe("blue");
    });

    it("returns undefined for non-existent key", () => {
      expect(memory.get("user-1", "missing")).toBeUndefined();
    });
  });

  describe("listByUser", () => {
    it("returns all entries for a user", () => {
      memory.store({ userId: "user-1", key: "a", value: "1" });
      memory.store({ userId: "user-1", key: "b", value: "2" });
      memory.store({ userId: "user-2", key: "c", value: "3" });

      const entries = memory.listByUser("user-1");
      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.key).sort()).toEqual(["a", "b"]);
    });
  });

  describe("search", () => {
    it("finds entries matching a key prefix", () => {
      memory.store({ userId: "user-1", key: "preference.timezone", value: "EST" });
      memory.store({ userId: "user-1", key: "preference.language", value: "en" });
      memory.store({ userId: "user-1", key: "fact.birthday", value: "Jan 1" });

      const results = memory.search("user-1", "preference.");
      expect(results).toHaveLength(2);
    });

    it("returns empty for no matches", () => {
      memory.store({ userId: "user-1", key: "abc", value: "1" });
      const results = memory.search("user-1", "xyz");
      expect(results).toEqual([]);
    });
  });

  describe("delete", () => {
    it("deletes a specific entry", () => {
      memory.store({ userId: "user-1", key: "temp", value: "data" });
      const deleted = memory.delete("user-1", "temp");

      expect(deleted).toBe(true);
      expect(memory.get("user-1", "temp")).toBeUndefined();
    });

    it("returns false for non-existent entry", () => {
      expect(memory.delete("user-1", "nope")).toBe(false);
    });
  });

  describe("clearUser", () => {
    it("removes all entries for a user", () => {
      memory.store({ userId: "user-1", key: "a", value: "1" });
      memory.store({ userId: "user-1", key: "b", value: "2" });
      memory.store({ userId: "user-2", key: "c", value: "3" });

      const count = memory.clearUser("user-1");

      expect(count).toBe(2);
      expect(memory.listByUser("user-1")).toEqual([]);
      expect(memory.listByUser("user-2")).toHaveLength(1);
    });
  });

  describe("getContext", () => {
    it("returns formatted context string for agent prompts", () => {
      memory.store({ userId: "user-1", key: "name", value: "Alice" });
      memory.store({ userId: "user-1", key: "timezone", value: "PST" });

      const context = memory.getContext("user-1");
      expect(context).toContain("name: Alice");
      expect(context).toContain("timezone: PST");
    });

    it("returns empty string for user with no memories", () => {
      expect(memory.getContext("nobody")).toBe("");
    });
  });
});
