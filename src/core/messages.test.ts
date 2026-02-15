import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MessageStore, type Message } from "./messages.js";

describe("MessageStore", () => {
  let store: MessageStore;

  beforeEach(() => {
    // Use in-memory database for tests
    store = new MessageStore(":memory:");
  });

  afterEach(() => {
    store.close();
  });

  describe("save", () => {
    it("saves a message and returns an id", () => {
      const msg: Omit<Message, "id"> = {
        chatId: "chat-1",
        role: "user",
        content: "Hello Chieftan",
        timestamp: Date.now(),
      };

      const saved = store.save(msg);

      expect(saved.id).toBeDefined();
      expect(typeof saved.id).toBe("number");
      expect(saved.content).toBe("Hello Chieftan");
    });

    it("saves messages with metadata", () => {
      const saved = store.save({
        chatId: "chat-1",
        role: "assistant",
        content: "Here is your briefing",
        timestamp: Date.now(),
        metadata: { type: "briefing", sources: ["gmail", "gcal"] },
      });

      const retrieved = store.getById(saved.id!);
      expect(retrieved?.metadata).toEqual({
        type: "briefing",
        sources: ["gmail", "gcal"],
      });
    });
  });

  describe("getById", () => {
    it("retrieves a message by id", () => {
      const saved = store.save({
        chatId: "chat-1",
        role: "user",
        content: "Test message",
        timestamp: Date.now(),
      });

      const found = store.getById(saved.id!);
      expect(found).toBeDefined();
      expect(found!.content).toBe("Test message");
    });

    it("returns undefined for non-existent id", () => {
      const found = store.getById(9999);
      expect(found).toBeUndefined();
    });
  });

  describe("listByChat", () => {
    it("returns messages for a specific chat in chronological order", () => {
      const now = Date.now();
      store.save({ chatId: "chat-1", role: "user", content: "First", timestamp: now });
      store.save({ chatId: "chat-2", role: "user", content: "Other chat", timestamp: now + 1 });
      store.save({ chatId: "chat-1", role: "assistant", content: "Second", timestamp: now + 2 });

      const messages = store.listByChat("chat-1");

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("First");
      expect(messages[1].content).toBe("Second");
    });

    it("supports limit parameter", () => {
      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        store.save({ chatId: "chat-1", role: "user", content: `Msg ${i}`, timestamp: now + i });
      }

      const messages = store.listByChat("chat-1", { limit: 3 });
      expect(messages).toHaveLength(3);
    });

    it("supports offset parameter for pagination", () => {
      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        store.save({ chatId: "chat-1", role: "user", content: `Msg ${i}`, timestamp: now + i });
      }

      const page = store.listByChat("chat-1", { limit: 3, offset: 3 });
      expect(page).toHaveLength(3);
      expect(page[0].content).toBe("Msg 3");
    });

    it("returns empty array for non-existent chat", () => {
      const messages = store.listByChat("does-not-exist");
      expect(messages).toEqual([]);
    });
  });

  describe("getRecentContext", () => {
    it("returns the last N messages for a chat (most recent first, then reversed)", () => {
      const now = Date.now();
      for (let i = 0; i < 20; i++) {
        store.save({ chatId: "chat-1", role: "user", content: `Msg ${i}`, timestamp: now + i });
      }

      const context = store.getRecentContext("chat-1", 5);
      expect(context).toHaveLength(5);
      // Should be in chronological order (oldest first)
      expect(context[0].content).toBe("Msg 15");
      expect(context[4].content).toBe("Msg 19");
    });
  });

  describe("deleteByChat", () => {
    it("deletes all messages for a chat", () => {
      store.save({ chatId: "chat-1", role: "user", content: "Keep", timestamp: Date.now() });
      store.save({ chatId: "chat-2", role: "user", content: "Delete", timestamp: Date.now() });

      const count = store.deleteByChat("chat-2");

      expect(count).toBe(1);
      expect(store.listByChat("chat-2")).toEqual([]);
      expect(store.listByChat("chat-1")).toHaveLength(1);
    });
  });

  describe("countByChat", () => {
    it("returns the message count for a chat", () => {
      store.save({ chatId: "chat-1", role: "user", content: "A", timestamp: Date.now() });
      store.save({ chatId: "chat-1", role: "user", content: "B", timestamp: Date.now() });
      store.save({ chatId: "chat-2", role: "user", content: "C", timestamp: Date.now() });

      expect(store.countByChat("chat-1")).toBe(2);
      expect(store.countByChat("chat-2")).toBe(1);
      expect(store.countByChat("chat-3")).toBe(0);
    });
  });
});
