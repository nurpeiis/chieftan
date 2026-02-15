import * as fs from "node:fs";
import * as path from "node:path";

export interface SkillManifest {
  name: string;
  description: string;
  version: string;
  permissions: string[];
  schedule?: string;
  sources?: string[];
  instructions?: string;
}

export class SkillRegistry {
  private skillsDir: string;
  private disabled: Set<string> = new Set();

  constructor(skillsDir: string) {
    this.skillsDir = skillsDir;
  }

  discover(): SkillManifest[] {
    if (!fs.existsSync(this.skillsDir)) {
      return [];
    }

    const entries = fs.readdirSync(this.skillsDir, { withFileTypes: true });
    const skills: SkillManifest[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const manifestPath = path.join(this.skillsDir, entry.name, "SKILL.md");
      if (!fs.existsSync(manifestPath)) continue;

      const manifest = this.parseSkillMd(manifestPath);
      if (manifest) {
        skills.push(manifest);
      }
    }

    return skills;
  }

  getByName(name: string): SkillManifest | undefined {
    const manifestPath = path.join(this.skillsDir, name, "SKILL.md");
    if (!fs.existsSync(manifestPath)) {
      return undefined;
    }
    return this.parseSkillMd(manifestPath) ?? undefined;
  }

  isEnabled(name: string): boolean {
    return !this.disabled.has(name);
  }

  enable(name: string): void {
    this.disabled.delete(name);
  }

  disable(name: string): void {
    this.disabled.add(name);
  }

  listEnabled(): SkillManifest[] {
    return this.discover().filter((s) => this.isEnabled(s.name));
  }

  validate(name: string): string[] {
    const errors: string[] = [];
    const manifest = this.getByName(name);

    if (!manifest) {
      return [`Skill "${name}" not found or has invalid SKILL.md`];
    }

    if (!manifest.name || manifest.name.trim() === "") {
      errors.push("Skill must have a name");
    }

    if (!manifest.description || manifest.description.trim() === "") {
      errors.push("Skill must have a description");
    }

    if (!manifest.version || manifest.version.trim() === "") {
      errors.push("Skill must have a version");
    }

    return errors;
  }

  private parseSkillMd(filePath: string): SkillManifest | null {
    const raw = fs.readFileSync(filePath, "utf-8");
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

    if (!fmMatch) {
      return null;
    }

    const frontmatter = fmMatch[1];
    const body = fmMatch[2].trim();

    const manifest: SkillManifest = {
      name: "",
      description: "",
      version: "",
      permissions: [],
    };

    // Parse YAML-like frontmatter (simple key: value pairs)
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
