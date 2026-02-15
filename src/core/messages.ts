import Database from "better-sqlite3";

export interface Message {
  id?: number;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
}

export class MessageStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(chat_id, timestamp);
    `);
  }

  save(msg: Omit<Message, "id">): Message {
    const stmt = this.db.prepare(
      `INSERT INTO messages (chat_id, role, content, timestamp, metadata)
       VALUES (?, ?, ?, ?, ?)`
    );

    const result = stmt.run(
      msg.chatId,
      msg.role,
      msg.content,
      msg.timestamp,
      msg.metadata ? JSON.stringify(msg.metadata) : null
    );

    return { ...msg, id: Number(result.lastInsertRowid) };
  }

  getById(id: number): Message | undefined {
    const row = this.db
      .prepare("SELECT * FROM messages WHERE id = ?")
      .get(id) as RawRow | undefined;

    return row ? this.toMessage(row) : undefined;
  }

  listByChat(chatId: string, options?: ListOptions): Message[] {
    const limit = options?.limit ?? 1000;
    const offset = options?.offset ?? 0;

    const rows = this.db
      .prepare(
        `SELECT * FROM messages WHERE chat_id = ?
         ORDER BY timestamp ASC
         LIMIT ? OFFSET ?`
      )
      .all(chatId, limit, offset) as RawRow[];

    return rows.map((r) => this.toMessage(r));
  }

  getRecentContext(chatId: string, count: number): Message[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM (
           SELECT * FROM messages WHERE chat_id = ?
           ORDER BY timestamp DESC
           LIMIT ?
         ) sub ORDER BY timestamp ASC`
      )
      .all(chatId, count) as RawRow[];

    return rows.map((r) => this.toMessage(r));
  }

  deleteByChat(chatId: string): number {
    const result = this.db
      .prepare("DELETE FROM messages WHERE chat_id = ?")
      .run(chatId);
    return result.changes;
  }

  countByChat(chatId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM messages WHERE chat_id = ?")
      .get(chatId) as { count: number };
    return row.count;
  }

  close(): void {
    this.db.close();
  }

  private toMessage(row: RawRow): Message {
    return {
      id: row.id,
      chatId: row.chat_id,
      role: row.role as Message["role"],
      content: row.content,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}

interface RawRow {
  id: number;
  chat_id: string;
  role: string;
  content: string;
  timestamp: number;
  metadata: string | null;
}
