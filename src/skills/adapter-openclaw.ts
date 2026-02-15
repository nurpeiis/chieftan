import * as fs from "node:fs";
import * as path from "node:path";
import type { SkillManifest } from "./registry.js";

export interface AdaptedSkillManifest extends SkillManifest {
  origin: "openclaw" | "nanoclaw" | "chieftan";
}

export interface AdaptResult {
  adapted: AdaptedSkillManifest[];
  failed: Array<{ name: string; error: string }>;
}

export class OpenClawAdapter {
  canAdapt(skillMdPath: string): boolean {
    if (!fs.existsSync(skillMdPath)) return false;
    const content = fs.readFileSync(skillMdPath, "utf-8");
    return /^---\n[\s\S]*?\n---/.test(content);
  }

  adapt(skillMdPath: string): AdaptedSkillManifest {
    const content = fs.readFileSync(skillMdPath, "utf-8");
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

    if (!fmMatch) {
      throw new Error(`Failed to parse SKILL.md frontmatter at ${skillMdPath}`);
    }

    const frontmatter = fmMatch[1];
    const body = fmMatch[2].trim();

    const manifest: AdaptedSkillManifest = {
      name: "",
      description: "",
      version: "",
      permissions: [],
      origin: "openclaw",
    };

    for (const line of frontmatter.split("\n")) {
      const kvMatch = line.match(/^(\w+):\s*(.+)$/);
      if (!kvMatch) continue;

      const key = kvMatch[1];
      const value = kvMatch[2];

      switch (key) {
        case "name":
          manifest.name = stripQuotes(value);
          break;
        case "description":
          manifest.description = stripQuotes(value);
          break;
        case "version":
          manifest.version = stripQuotes(value);
          break;
        case "permissions":
          manifest.permissions = parseArray(value);
          break;
        case "schedule":
          manifest.schedule = stripQuotes(value);
          break;
        case "sources":
          manifest.sources = parseArray(value);
          break;
      }
    }

    if (body) {
      manifest.instructions = body;
    }

    return manifest;
  }

  adaptDirectory(dirPath: string): AdaptResult {
    const result: AdaptResult = { adapted: [], failed: [] };

    if (!fs.existsSync(dirPath)) return result;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillMdPath = path.join(dirPath, entry.name, "SKILL.md");
      if (!fs.existsSync(skillMdPath)) continue;

      try {
        const manifest = this.adapt(skillMdPath);
        result.adapted.push(manifest);
      } catch (err) {
        result.failed.push({
          name: entry.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  }
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, "").trim();
}

function parseArray(s: string): string[] {
  const match = s.match(/\[(.*)\]/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((item) => stripQuotes(item.trim()))
    .filter((item) => item.length > 0);
}
