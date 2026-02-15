import { useState, useEffect } from "react";
import { getBriefing, type Briefing, type ConnectorResult } from "../api";

const SOURCE_ICONS: Record<string, string> = {
  gmail: "📧",
  gcal: "📅",
  github: "💻",
  csv: "📊",
};

export function BriefingFeed() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBriefing()
      .then(setBriefing)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state">Loading briefing...</div>;
  if (error) return <div className="empty-state">Failed to load: {error}</div>;
  if (!briefing || briefing.results.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">✅</div>
        <p>No new updates. You're all caught up!</p>
      </div>
    );
  }

  const grouped = groupBySource(briefing.results);

  return (
    <div>
      <div className="stats-bar">
        <div className="stat">
          <span className="stat-value">{briefing.stats.total}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat">
          <span className="stat-value">{briefing.stats.high}</span>
          <span className="stat-label">High</span>
        </div>
        <div className="stat">
          <span className="stat-value">{briefing.stats.medium}</span>
          <span className="stat-label">Medium</span>
        </div>
        <div className="stat">
          <span className="stat-value">{briefing.stats.actionable}</span>
          <span className="stat-label">Actionable</span>
        </div>
      </div>

      {briefing.errors.length > 0 && (
        <div className="card" style={{ borderColor: "#f85149" }}>
          <div className="card-title">Connector Errors</div>
          {briefing.errors.map((e, i) => (
            <div key={i} className="card-body">
              {e.connector}: {e.error}
            </div>
          ))}
        </div>
      )}

      {Array.from(grouped.entries()).map(([source, items]) => (
        <div key={source} className="source-group">
          <div className="source-header">
            <span>{SOURCE_ICONS[source] ?? "📌"}</span>
            <span>{source}</span>
            <span className="section-count">{items.length}</span>
          </div>
          {items.map((item, i) => (
            <div key={i} className="card">
              <div className="card-header">
                <span className="card-title">{item.title}</span>
                <span className={`priority priority-${item.priority}`}>
                  {item.priority}
                </span>
              </div>
              <div className="card-body">{item.summary}</div>
              {item.actionable && (
                <div className="card-actions">
                  <button className="btn btn-primary">Review</button>
                  <button className="btn">Dismiss</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function groupBySource(results: ConnectorResult[]) {
  const map = new Map<string, ConnectorResult[]>();
  for (const r of results) {
    const list = map.get(r.source) ?? [];
    list.push(r);
    map.set(r.source, list);
  }
  return map;
}
