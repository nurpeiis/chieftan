import * as fs from "node:fs";
import * as path from "node:path";
import { validatePermissions, type PermissionWarning } from "../core/container.js";

export interface InstallResult {
  success: boolean;
  name: string;
  error?: string;
}

export interface PermissionReview {
  name: string;
  description: string;
  version: string;
  permissions: string[];
  warnings: PermissionWarning[];
}

export class SkillInstaller {
  private skillsDir: string;

  constructor(skillsDir: string) {
    this.skillsDir = skillsDir;
  }

  installFromLocal(sourcePath: string): InstallResult {
    const skillMdPath = path.join(sourcePath, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) {
      return {
        success: false,
        name: path.basename(sourcePath),
        error: "Source directory has no SKILL.md",
      };
    }

    const name = path.basename(sourcePath);
    const targetDir = path.join(this.skillsDir, name);

    if (fs.existsSync(targetDir)) {
      return {
        success: false,
        name,
        error: `Skill "${name}" is already installed`,
      };
    }

    // Copy directory recursively
    copyDirSync(sourcePath, targetDir);

    return { success: true, name };
  }

  uninstall(name: string): boolean {
    const targetDir = path.join(this.skillsDir, name);
    if (!fs.existsSync(targetDir)) return false;

    fs.rmSync(targetDir, { recursive: true, force: true });
    return true;
  }

  listInstalled(): string[] {
    if (!fs.existsSync(this.skillsDir)) return [];

    return fs
      .readdirSync(this.skillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .filter((e) =>
        fs.existsSync(path.join(this.skillsDir, e.name, "SKILL.md"))
      )
      .map((e) => e.name);
  }

  getPermissionReview(sourcePath: string): PermissionReview | null {
    const skillMdPath = path.join(sourcePath, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) return null;

    const raw = fs.readFileSync(skillMdPath, "utf-8");
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;

    const frontmatter = fmMatch[1];
    let name = "";
    let description = "";
    let version = "";
    let permissions: string[] = [];

    for (const line of frontmatter.split("\n")) {
      const kvMatch = line.match(/^(\w+):\s*(.+)$/);
      if (!kvMatch) continue;

      const key = kvMatch[1];
      const value = kvMatch[2];

      switch (key) {
        case "name":
          name = stripQuotes(value);
          break;
        case "description":
          description = stripQuotes(value);
          break;
        case "version":
          version = stripQuotes(value);
          break;
        case "permissions":
          permissions = parseArray(value);
          break;
      }
    }

    const warnings = validatePermissions(permissions);

    return { name, description, version, permissions, warnings };
  }
}

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
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
