import type { ConnectorResult } from "../connectors/types.js";
import type { ActionProposal } from "../chief/approval.js";
import type { SkillManifest } from "../skills/registry.js";

export interface TelegramCommand {
  command: string;
  args: string[];
}

export function parseTelegramCommand(text: string): TelegramCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;

  const parts = trimmed.split(/\s+/);
  const command = parts[0].slice(1); // remove leading /
  const args = parts.slice(1);

  return { command, args };
}

export function formatBriefingForTelegram(results: ConnectorResult[]): string {
  if (results.length === 0) {
    return "📋 *Daily Briefing*\n\nNo new updates today. You're all caught up!";
  }

  const grouped = new Map<string, ConnectorResult[]>();
  for (const r of results) {
    const existing = grouped.get(r.source) ?? [];
    existing.push(r);
    grouped.set(r.source, existing);
  }

  const sourceIcons: Record<string, string> = {
    gmail: "📧",
    gcal: "📅",
    github: "💻",
    csv: "📊",
  };

  let text = "📋 *Daily Briefing*\n";

  for (const [source, items] of grouped) {
    const icon = sourceIcons[source] ?? "📌";
    text += `\n${icon} *${source}* (${items.length})\n`;

    for (const item of items) {
      const priority =
        item.priority === "high" ? "🔴" : item.priority === "medium" ? "🟡" : "⚪";
      text += `  ${priority} ${item.title}\n`;
    }
  }

  const actionable = results.filter((r) => r.actionable).length;
  if (actionable > 0) {
    text += `\n⚡ ${actionable} item(s) need your attention`;
  }

  text += "\n\nReply /approve to review pending actions";

  return text;
}

export function formatApprovalForTelegram(proposals: ActionProposal[]): string {
  if (proposals.length === 0) {
    return "✅ No pending approvals. Everything is handled!";
  }

  let text = "🔔 *Pending Approvals*\n\n";

  for (const p of proposals) {
    text += `*#${p.id}* — \`${p.action}\`\n`;
    text += `  ${p.description}\n`;
    text += `  Source: ${p.source}\n`;
    text += `  → /approve ${p.id} | /reject ${p.id} [reason]\n\n`;
  }

  text += `Or reply "approve all" to batch approve.`;

  return text;
}

export function formatSkillListForTelegram(skills: SkillManifest[]): string {
  if (skills.length === 0) {
    return "📦 No skills installed. Use /skills install <name> to add one.";
  }

  let text = "📦 *Installed Skills*\n\n";

  skills.forEach((s, i) => {
    const perms = s.permissions.length > 0 ? s.permissions.join(", ") : "none";
    text += `${i + 1}. *${s.name}* (v${s.version})\n`;
    text += `   ${s.description}\n`;
    text += `   Perms: ${perms}\n\n`;
  });

  return text;
}

export const WELCOME_MESSAGE = `Welcome to *Chieftan* — Your AI Chief of Staff.

Available commands:
/briefing — Get your daily briefing
/analytics — See your latest insights
/skills — Browse & manage skills
/approve — Review pending actions
/dashboard — Open web dashboard
/help — Show this message`;

export const HELP_MESSAGE = WELCOME_MESSAGE;
