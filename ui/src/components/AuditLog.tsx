import { useState, useEffect } from "react";
import { getAuditLog, type ActionProposal } from "../api";

const USER_ID = "default";

export function AuditLog() {
  const [entries, setEntries] = useState<ActionProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAuditLog(USER_ID)
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state">Loading audit log...</div>;
  if (error) return <div className="empty-state">Failed to load: {error}</div>;

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📜</div>
        <p>No audit entries yet. Actions will appear here once proposals are created.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <span className="section-title">Audit Log</span>
        <span className="section-count">{entries.length}</span>
      </div>

      {entries.map((entry) => (
        <div key={entry.id} className="audit-entry">
          <div className={`audit-status ${entry.status}`} />
          <div className="audit-time">
            {new Date(entry.createdAt).toLocaleDateString()}
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, color: "#f0f6fc" }}>
              {entry.action}
            </span>
            <span style={{ color: "#8b949e", marginLeft: 8 }}>
              {entry.description}
            </span>
          </div>
          <span className={`priority priority-${statusToPriority(entry.status)}`}>
            {entry.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function statusToPriority(status: string): string {
  switch (status) {
    case "approved":
      return "low";
    case "rejected":
      return "high";
    case "pending":
      return "medium";
    default:
      return "low";
  }
}
