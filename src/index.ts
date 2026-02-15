export { VERSION } from "./version.js";
import { VERSION } from "./version.js";

import "dotenv/config";
import { Bot } from "grammy";
import { MessageStore } from "./core/messages.js";
import { MemoryStore } from "./core/memory.js";
import { Scheduler } from "./core/scheduler.js";
import { SkillRegistry } from "./skills/registry.js";
import { SkillInstaller } from "./skills/installer.js";
import { OpenClawAdapter } from "./skills/adapter-openclaw.js";
import { ApprovalGate } from "./chief/approval.js";
import { BriefingEngine } from "./chief/briefing.js";
import { AnalyticsEngine } from "./chief/analytics.js";
import { GmailConnector } from "./connectors/gmail.js";
import { GCalConnector } from "./connectors/gcal.js";
import { GitHubConnector } from "./connectors/github.js";
import { CsvConnector } from "./connectors/csv.js";
import { buildApp } from "./dashboard/api.js";
import {
  parseTelegramCommand,
  formatBriefingForTelegram,
  formatApprovalForTelegram,
  formatSkillListForTelegram,
  WELCOME_MESSAGE,
  HELP_MESSAGE,
} from "./channels/telegram.js";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";

// --- Configuration ---
const DATA_DIR = process.env.CHIEFTAN_DATA_DIR ?? path.join(os.homedir(), ".chieftan");
const DB_PATH = path.join(DATA_DIR, "chieftan.sqlite");
const SKILLS_DIR = path.join(DATA_DIR, "skills");
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT ?? "3141", 10);
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// --- Ensure data directory exists ---
function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(SKILLS_DIR, { recursive: true });
}

// --- Main ---
async function main(): Promise<void> {
  const command = process.argv[2];

  if (command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  if (command === "version") {
    console.log(`Chieftan v${VERSION}`);
    return;
  }

  if (command === "skill") {
    await handleSkillCommand();
    return;
  }

  // Default: start the full server
  await start();
}

function printUsage(): void {
  console.log(`
Chieftan v${VERSION} — Your AI Chief of Staff

Usage:
  chieftan                 Start the server (Telegram bot + dashboard)
  chieftan skill list      List installed skills
  chieftan skill install   Install a skill from a local path
  chieftan version         Show version
  chieftan --help          Show this help

Environment variables:
  TELEGRAM_BOT_TOKEN       Telegram bot token (from @BotFather)
  ANTHROPIC_API_KEY        Anthropic API key for Claude
  GITHUB_TOKEN             GitHub personal access token
  GMAIL_ACCESS_TOKEN       Gmail OAuth access token
  GCAL_ACCESS_TOKEN        Google Calendar OAuth access token
  DASHBOARD_PORT           Dashboard port (default: 3141)
  CHIEFTAN_DATA_DIR        Data directory (default: ~/.chieftan)
`);
}

async function handleSkillCommand(): Promise<void> {
  ensureDataDir();
  const subcommand = process.argv[3];
  const installer = new SkillInstaller(SKILLS_DIR);
  const registry = new SkillRegistry(SKILLS_DIR);

  if (subcommand === "list") {
    const skills = registry.discover();
    if (skills.length === 0) {
      console.log("No skills installed.");
      return;
    }
    for (const s of skills) {
      console.log(`  ${s.name} (v${s.version}) — ${s.description}`);
    }
  } else if (subcommand === "install") {
    const sourcePath = process.argv[4];
    if (!sourcePath) {
      console.error("Usage: chieftan skill install <path>");
      process.exit(1);
    }

    const review = installer.getPermissionReview(path.resolve(sourcePath));
    if (!review) {
      console.error("Invalid skill: no SKILL.md found");
      process.exit(1);
    }

    console.log(`Installing ${review.name} v${review.version}...`);
    if (review.warnings.length > 0) {
      console.log("Warnings:");
      for (const w of review.warnings) {
        console.log(`  [${w.level}] ${w.message}`);
      }
    }

    const result = installer.installFromLocal(path.resolve(sourcePath));
    if (result.success) {
      console.log(`Installed ${result.name} successfully.`);
    } else {
      console.error(`Failed: ${result.error}`);
      process.exit(1);
    }
  } else if (subcommand === "uninstall") {
    const name = process.argv[4];
    if (!name) {
      console.error("Usage: chieftan skill uninstall <name>");
      process.exit(1);
    }
    if (installer.uninstall(name)) {
      console.log(`Uninstalled ${name}.`);
    } else {
      console.error(`Skill "${name}" not found.`);
    }
  } else if (subcommand === "adapt-openclaw") {
    const dirPath = process.argv[4];
    if (!dirPath) {
      console.error("Usage: chieftan skill adapt-openclaw <directory>");
      process.exit(1);
    }
    const adapter = new OpenClawAdapter();
    const result = adapter.adaptDirectory(path.resolve(dirPath));
    console.log(`Adapted ${result.adapted.length} skills, ${result.failed.length} failed.`);
    for (const s of result.adapted) {
      console.log(`  OK: ${s.name}`);
    }
    for (const f of result.failed) {
      console.log(`  FAIL: ${f.name} — ${f.error}`);
    }
  } else {
    console.error(`Unknown skill subcommand: ${subcommand}`);
    console.log("Available: list, install, uninstall, adapt-openclaw");
  }
}

async function start(): Promise<void> {
  ensureDataDir();
  console.log(`Chieftan v${VERSION} starting...`);
  console.log(`Data directory: ${DATA_DIR}`);

  // --- Initialize stores ---
  const messages = new MessageStore(DB_PATH);
  const memory = new MemoryStore(DB_PATH);
  const approvalGate = new ApprovalGate(DB_PATH);
  const analytics = new AnalyticsEngine(DB_PATH);
  const scheduler = new Scheduler();
  const registry = new SkillRegistry(SKILLS_DIR);
  const briefingEngine = new BriefingEngine();

  // --- Register connectors ---
  if (process.env.GITHUB_TOKEN) {
    briefingEngine.addConnector(
      new GitHubConnector({ token: process.env.GITHUB_TOKEN })
    );
    console.log("  + GitHub connector enabled");
  }

  if (process.env.GMAIL_ACCESS_TOKEN) {
    briefingEngine.addConnector(
      new GmailConnector({ accessToken: process.env.GMAIL_ACCESS_TOKEN })
    );
    console.log("  + Gmail connector enabled");
  }

  if (process.env.GCAL_ACCESS_TOKEN) {
    briefingEngine.addConnector(
      new GCalConnector({ accessToken: process.env.GCAL_ACCESS_TOKEN })
    );
    console.log("  + Google Calendar connector enabled");
  }

  // Auto-discover CSV files in data dir
  const csvDir = path.join(DATA_DIR, "data");
  if (fs.existsSync(csvDir)) {
    const csvFiles = fs.readdirSync(csvDir).filter((f) => f.endsWith(".csv"));
    for (const file of csvFiles) {
      const name = path.basename(file, ".csv");
      briefingEngine.addConnector(
        new CsvConnector({ filePath: path.join(csvDir, file), name })
      );
      console.log(`  + CSV connector: ${name}`);
    }
  }

  // --- Schedule daily briefing ---
  scheduler.register({
    name: "daily-briefing",
    cron: "0 9 * * *",
    handler: async () => {
      console.log("[scheduler] Running daily briefing...");
      const briefing = await briefingEngine.generateBriefing();
      // Record analytics
      analytics.record({
        metric: "briefing_items",
        value: briefing.stats.total,
        source: "briefing",
        date: new Date().toISOString().split("T")[0],
      });
      analytics.record({
        metric: "high_priority_items",
        value: briefing.stats.high,
        source: "briefing",
        date: new Date().toISOString().split("T")[0],
      });
      return briefing;
    },
  });

  // --- Start Dashboard API ---
  const dashboardApp = buildApp({ dbPath: DB_PATH, skillsDir: SKILLS_DIR });
  await dashboardApp.listen({ port: DASHBOARD_PORT, host: "0.0.0.0" });
  console.log(`Dashboard: http://localhost:${DASHBOARD_PORT}`);

  // --- Start Telegram Bot ---
  if (TELEGRAM_TOKEN) {
    const bot = new Bot(TELEGRAM_TOKEN);

    bot.command("start", async (ctx) => {
      await ctx.reply(WELCOME_MESSAGE, { parse_mode: "Markdown" });
    });

    bot.command("help", async (ctx) => {
      await ctx.reply(HELP_MESSAGE, { parse_mode: "Markdown" });
    });

    bot.command("briefing", async (ctx) => {
      const briefing = await briefingEngine.generateBriefing();
      const text = formatBriefingForTelegram(briefing.results);
      await ctx.reply(text, { parse_mode: "Markdown" });
    });

    bot.command("approve", async (ctx) => {
      const userId = String(ctx.from?.id ?? "default");
      const args = ctx.message?.text?.split(" ").slice(1) ?? [];

      if (args[0] === "all") {
        const count = approvalGate.approveAll(userId);
        await ctx.reply(`Approved ${count} proposals.`);
        return;
      }

      if (args[0]) {
        const id = parseInt(args[0], 10);
        const result = approvalGate.approve(id);
        await ctx.reply(`Approved #${result.id}: ${result.action}`);
        return;
      }

      const pending = approvalGate.listPending(userId);
      await ctx.reply(formatApprovalForTelegram(pending), {
        parse_mode: "Markdown",
      });
    });

    bot.command("reject", async (ctx) => {
      const args = ctx.message?.text?.split(" ").slice(1) ?? [];
      if (!args[0]) {
        await ctx.reply("Usage: /reject <id> [reason]");
        return;
      }
      const id = parseInt(args[0], 10);
      const reason = args.slice(1).join(" ") || undefined;
      const result = approvalGate.reject(id, reason);
      await ctx.reply(`Rejected #${result.id}: ${result.action}`);
    });

    bot.command("skills", async (ctx) => {
      const skills = registry.listEnabled();
      await ctx.reply(formatSkillListForTelegram(skills), {
        parse_mode: "Markdown",
      });
    });

    bot.command("analytics", async (ctx) => {
      const insights = analytics.generateInsights();
      if (insights.length === 0) {
        await ctx.reply("No insights yet. Data will appear as connectors report metrics.");
        return;
      }
      const text = insights
        .map((i) => `${i.type === "anomaly" ? "⚠️" : "📈"} ${i.message}`)
        .join("\n\n");
      await ctx.reply(text);
    });

    bot.command("dashboard", async (ctx) => {
      await ctx.reply(
        `Open the dashboard at: http://localhost:${DASHBOARD_PORT}`
      );
    });

    // Handle free-text messages (store + echo for now)
    bot.on("message:text", async (ctx) => {
      const chatId = String(ctx.chat.id);
      const text = ctx.message.text;

      // Store the message
      messages.save({
        chatId,
        role: "user",
        content: text,
        timestamp: Date.now(),
      });

      // Check if it's an unrecognized command
      const cmd = parseTelegramCommand(text);
      if (cmd) {
        await ctx.reply(
          `Unknown command: /${cmd.command}. Use /help to see available commands.`
        );
        return;
      }

      // For free-text, store and acknowledge
      await ctx.reply(
        "Message received. Use /briefing, /approve, /analytics, or /skills to interact with Chieftan."
      );
    });

    bot.start();
    console.log("Telegram bot: connected");
  } else {
    console.log("Telegram bot: skipped (no TELEGRAM_BOT_TOKEN set)");
  }

  console.log(`\nChieftan is running. Press Ctrl+C to stop.\n`);

  // Graceful shutdown
  const shutdown = () => {
    console.log("\nShutting down...");
    scheduler.stopAll();
    messages.close();
    memory.close();
    approvalGate.close();
    analytics.close();
    dashboardApp.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
