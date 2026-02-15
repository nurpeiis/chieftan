import Database from "better-sqlite3";

export interface MemoryEntry {
  id?: number;
  userId: string;
  key: string;
  value: string;
  updatedAt?: number;
}

export class MemoryStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(user_id, key)
      );
      CREATE INDEX IF NOT EXISTS idx_memory_user ON memory(user_id);
      CREATE INDEX IF NOT EXISTS idx_memory_user_key ON memory(user_id, key);
    `);
  }

  store(entry: Omit<MemoryEntry, "id" | "updatedAt">): MemoryEntry {
    const now = Date.now();
    const stmt = this.db.prepare(
      `INSERT INTO memory (user_id, key, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    );

    const result = stmt.run(entry.userId, entry.key, entry.value, now);

    return {
      id: Number(result.lastInsertRowid),
      userId: entry.userId,
      key: entry.key,
      value: entry.value,
      updatedAt: now,
    };
  }

  get(userId: string, key: string): MemoryEntry | undefined {
    const row = this.db
      .prepare("SELECT * FROM memory WHERE user_id = ? AND key = ?")
      .get(userId, key) as RawRow | undefined;

    return row ? this.toEntry(row) : undefined;
  }

  listByUser(userId: string): MemoryEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM memory WHERE user_id = ? ORDER BY key")
      .all(userId) as RawRow[];

    return rows.map((r) => this.toEntry(r));
  }

  search(userId: string, keyPrefix: string): MemoryEntry[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM memory WHERE user_id = ? AND key LIKE ? ORDER BY key"
      )
      .all(userId, `${keyPrefix}%`) as RawRow[];

    return rows.map((r) => this.toEntry(r));
  }

  delete(userId: string, key: string): boolean {
    const result = this.db
      .prepare("DELETE FROM memory WHERE user_id = ? AND key = ?")
      .run(userId, key);
    return result.changes > 0;
  }

  clearUser(userId: string): number {
    const result = this.db
      .prepare("DELETE FROM memory WHERE user_id = ?")
      .run(userId);
    return result.changes;
  }

  getContext(userId: string): string {
    const entries = this.listByUser(userId);
    if (entries.length === 0) return "";

    return entries.map((e) => `${e.key}: ${e.value}`).join("\n");
  }

  close(): void {
    this.db.close();
  }

  private toEntry(row: RawRow): MemoryEntry {
    return {
      id: row.id,
      userId: row.user_id,
      key: row.key,
      value: row.value,
      updatedAt: row.updated_at,
    };
  }
}

interface RawRow {
  id: number;
  user_id: string;
  key: string;
  value: string;
  updated_at: number;
}
