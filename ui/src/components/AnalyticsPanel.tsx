import { useState, useEffect } from "react";
import { getInsights, type Insight } from "../api";

export function AnalyticsPanel() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInsights()
      .then(setInsights)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state">Analyzing data...</div>;
  if (error) return <div className="empty-state">Failed to load: {error}</div>;

  if (insights.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <p>No insights yet. Data will appear as connectors report metrics.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <span className="section-title">Insights</span>
        <span className="section-count">{insights.length}</span>
      </div>

      {insights.map((insight, i) => (
        <div key={i} className={`card insight-card ${insight.type}`}>
          <div className="card-header">
            <span className="card-title">{insight.metric}</span>
            <span className={`priority priority-${insight.type === "anomaly" ? "high" : "medium"}`}>
              {insight.type}
            </span>
          </div>
          <div className="card-body">{insight.message}</div>
          {insight.type === "trend" && (
            <div style={{ marginTop: 8 }}>
              <Sparkline data={generateSparkData(insight)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="sparkline">
      {data.map((val, i) => (
        <div
          key={i}
          className="spark-bar"
          style={{ height: `${(val / max) * 32}px` }}
        />
      ))}
    </div>
  );
}

function generateSparkData(insight: Insight): number[] {
  const pctChange = (insight.data as Record<string, number>).percentChange ?? 0;
  const base = 10;
  const points = 7;
  const data: number[] = [];
  for (let i = 0; i < points; i++) {
    const factor = 1 + (pctChange / 100) * (i / (points - 1));
    data.push(Math.max(1, base * factor + (Math.random() - 0.5) * 2));
  }
  return data;
}
