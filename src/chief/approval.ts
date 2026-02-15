import Database from "better-sqlite3";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ActionProposal {
  id?: number;
  userId: string;
  action: string;
  description: string;
  source: string;
  context?: Record<string, unknown>;
  status: ApprovalStatus;
  rejectionReason?: string;
  createdAt: number;
  resolvedAt?: number;
}

export type ProposalInput = Omit<
  ActionProposal,
  "id" | "status" | "createdAt" | "resolvedAt" | "rejectionReason"
>;

export class ApprovalGate {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        description TEXT NOT NULL,
        source TEXT NOT NULL,
        context TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        rejection_reason TEXT,
        created_at INTEGER NOT NULL,
        resolved_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_proposals_user ON proposals(user_id);
      CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(user_id, status);
    `);
  }

  propose(input: ProposalInput): ActionProposal {
    const now = Date.now();
    const stmt = this.db.prepare(
      `INSERT INTO proposals (user_id, action, description, source, context, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`
    );

    const result = stmt.run(
      input.userId,
      input.action,
      input.description,
      input.source,
      input.context ? JSON.stringify(input.context) : null,
      now
    );

    return {
      ...input,
      id: Number(result.lastInsertRowid),
      status: "pending",
      createdAt: now,
    };
  }

  getById(id: number): ActionProposal | undefined {
    const row = this.db
      .prepare("SELECT * FROM proposals WHERE id = ?")
      .get(id) as RawRow | undefined;

    return row ? this.toProposal(row) : undefined;
  }

  approve(id: number): ActionProposal {
    const proposal = this.getById(id);
    if (!proposal) throw new Error(`Proposal ${id} not found`);
    if (proposal.status !== "pending") {
      throw new Error(`Proposal ${id} is already resolved (${proposal.status})`);
    }

    const now = Date.now();
    this.db
      .prepare("UPDATE proposals SET status = 'approved', resolved_at = ? WHERE id = ?")
      .run(now, id);

    return { ...proposal, status: "approved", resolvedAt: now };
  }

  reject(id: number, reason?: string): ActionProposal {
    const proposal = this.getById(id);
    if (!proposal) throw new Error(`Proposal ${id} not found`);
    if (proposal.status !== "pending") {
      throw new Error(`Proposal ${id} is already resolved (${proposal.status})`);
    }

    const now = Date.now();
    this.db
      .prepare(
        "UPDATE proposals SET status = 'rejected', rejection_reason = ?, resolved_at = ? WHERE id = ?"
      )
      .run(reason ?? null, now, id);

    return {
      ...proposal,
      status: "rejected",
      rejectionReason: reason,
      resolvedAt: now,
    };
  }

  listPending(userId: string): ActionProposal[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM proposals WHERE user_id = ? AND status = 'pending' ORDER BY created_at ASC"
      )
      .all(userId) as RawRow[];

    return rows.map((r) => this.toProposal(r));
  }

  getAuditLog(userId: string, limit?: number): ActionProposal[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM proposals WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
      )
      .all(userId, limit ?? 1000) as RawRow[];

    return rows.map((r) => this.toProposal(r));
  }

  approveAll(userId: string): number {
    const now = Date.now();
    const result = this.db
      .prepare(
        "UPDATE proposals SET status = 'approved', resolved_at = ? WHERE user_id = ? AND status = 'pending'"
      )
      .run(now, userId);

    return result.changes;
  }

  close(): void {
    this.db.close();
  }

  private toProposal(row: RawRow): ActionProposal {
    return {
      id: row.id,
      userId: row.user_id,
      action: row.action,
      description: row.description,
      source: row.source,
      context: row.context ? JSON.parse(row.context) : undefined,
      status: row.status as ApprovalStatus,
      rejectionReason: row.rejection_reason ?? undefined,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at ?? undefined,
    };
  }
}

interface RawRow {
  id: number;
  user_id: string;
  action: string;
  description: string;
  source: string;
  context: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: number;
  resolved_at: number | null;
}
