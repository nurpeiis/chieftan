import { useState, useEffect } from "react";
import {
  getApprovals,
  approveProposal,
  rejectProposal,
  type ActionProposal,
} from "../api";

const USER_ID = "default";

export function ApprovalGate() {
  const [proposals, setProposals] = useState<ActionProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    getApprovals(USER_ID)
      .then(setProposals)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const handleApprove = async (id: number) => {
    await approveProposal(id);
    refresh();
  };

  const handleReject = async (id: number) => {
    const reason = prompt("Rejection reason (optional):");
    await rejectProposal(id, reason ?? "");
    refresh();
  };

  if (loading) return <div className="empty-state">Loading approvals...</div>;
  if (error) return <div className="empty-state">Failed to load: {error}</div>;

  if (proposals.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">✅</div>
        <p>No pending approvals. Everything is handled!</p>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <span className="section-title">Pending Approvals</span>
        <span className="section-count">{proposals.length}</span>
      </div>

      {proposals.map((p) => (
        <div key={p.id} className="card">
          <div className="card-header">
            <span className="card-title">
              #{p.id} — {p.action}
            </span>
            <span className="card-subtitle">{p.source}</span>
          </div>
          <div className="card-body">{p.description}</div>
          {p.context && (
            <div className="card-body" style={{ marginTop: 4, opacity: 0.7 }}>
              Context: {JSON.stringify(p.context)}
            </div>
          )}
          <div className="card-actions">
            <button
              className="btn btn-primary"
              onClick={() => handleApprove(p.id)}
            >
              Approve
            </button>
            <button
              className="btn btn-danger"
              onClick={() => handleReject(p.id)}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
