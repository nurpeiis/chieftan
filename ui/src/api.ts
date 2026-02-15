const API_BASE = "/api";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface ConnectorResult {
  source: string;
  timestamp: number;
  category: string;
  title: string;
  summary: string;
  priority: "high" | "medium" | "low";
  metadata: Record<string, unknown>;
  actionable: boolean;
}

export interface Briefing {
  results: ConnectorResult[];
  stats: { total: number; high: number; medium: number; low: number; actionable: number };
  sources: string[];
  errors: Array<{ connector: string; error: string }>;
  generatedAt: number;
}

export interface ActionProposal {
  id: number;
  userId: string;
  action: string;
  description: string;
  source: string;
  context?: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  createdAt: number;
  resolvedAt?: number;
}

export interface Insight {
  metric: string;
  type: "trend" | "anomaly" | "summary";
  message: string;
  data: Record<string, unknown>;
}

export interface Trend {
  metric: string;
  direction: "up" | "down" | "stable" | "insufficient_data";
  percentChange?: number;
  period?: number;
}

export interface SkillManifest {
  name: string;
  description: string;
  version: string;
  permissions: string[];
  schedule?: string;
}

// API functions
export const getBriefing = () => apiFetch<Briefing>("/briefing");
export const getApprovals = (userId: string) =>
  apiFetch<ActionProposal[]>(`/approvals?userId=${userId}`);
export const approveProposal = (id: number) =>
  apiFetch<ActionProposal>(`/approvals/${id}/approve`, { method: "POST" });
export const rejectProposal = (id: number, reason: string) =>
  apiFetch<ActionProposal>(`/approvals/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
export const getInsights = () => apiFetch<Insight[]>("/analytics/insights");
export const getTrend = (metric: string) =>
  apiFetch<Trend>(`/analytics/trend/${metric}`);
export const getSkills = () => apiFetch<SkillManifest[]>("/skills");
export const getAuditLog = (userId: string, limit = 50) =>
  apiFetch<ActionProposal[]>(`/audit?userId=${userId}&limit=${limit}`);
