import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SkillRegistry, type SkillManifest } from "./registry.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("SkillRegistry", () => {
  let tmpDir: string;
  let registry: SkillRegistry;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chieftan-skills-"));
    registry = new SkillRegistry(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeSkill(name: string, manifest: Partial<SkillManifest>): void {
    const skillDir = path.join(tmpDir, name);
    fs.mkdirSync(skillDir, { recursive: true });

    const full: SkillManifest = {
      name: manifest.name ?? name,
      description: manifest.description ?? `A test skill called ${name}`,
      version: manifest.version ?? "1.0.0",
      permissions: manifest.permissions ?? [],
      ...manifest,
    };

    const md = [
      `---`,
      `name: "${full.name}"`,
      `description: "${full.description}"`,
      `version: "${full.version}"`,
      `permissions: [${full.permissions.map((p) => `"${p}"`).join(", ")}]`,
    ];

    if (full.schedule) {
      md.push(`schedule: "${full.schedule}"`);
    }

    if (full.sources) {
      md.push(`sources: [${full.sources.map((s) => `"${s}"`).join(", ")}]`);
    }

    md.push(`---`, "", full.instructions ?? `Instructions for ${name}`);

    fs.writeFileSync(path.join(skillDir, "SKILL.md"), md.join("\n"));
  }

  describe("discover", () => {
    it("discovers skills from the skills directory", () => {
      writeSkill("email-digest", { description: "Summarize emails" });
      writeSkill("github-summary", { description: "Summarize GitHub" });

      const skills = registry.discover();

      expect(skills).toHaveLength(2);
      const names = skills.map((s) => s.name);
      expect(names).toContain("email-digest");
      expect(names).toContain("github-summary");
    });

    it("returns empty array when no skills exist", () => {
      const skills = registry.discover();
      expect(skills).toEqual([]);
    });

    it("skips directories without SKILL.md", () => {
      fs.mkdirSync(path.join(tmpDir, "no-manifest"));
      writeSkill("valid-skill", { description: "I have a manifest" });

      const skills = registry.discover();
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe("valid-skill");
    });
  });

  describe("parseSkillMd", () => {
    it("parses frontmatter and instructions from SKILL.md", () => {
      writeSkill("test-skill", {
        description: "A test skill",
        version: "2.0.0",
        permissions: ["file-read", "network"],
        instructions: "Do the thing with the data.",
      });

      const skill = registry.getByName("test-skill");

      expect(skill).toBeDefined();
      expect(skill!.name).toBe("test-skill");
      expect(skill!.description).toBe("A test skill");
      expect(skill!.version).toBe("2.0.0");
      expect(skill!.permissions).toEqual(["file-read", "network"]);
      expect(skill!.instructions).toBe("Do the thing with the data.");
    });

    it("parses optional schedule field", () => {
      writeSkill("scheduled-skill", {
        schedule: "0 9 * * *",
        description: "Runs at 9am",
      });

      const skill = registry.getByName("scheduled-skill");
      expect(skill!.schedule).toBe("0 9 * * *");
    });

    it("parses optional sources field", () => {
      writeSkill("sourced-skill", {
        sources: ["gmail", "gcal"],
        description: "Needs sources",
      });

      const skill = registry.getByName("sourced-skill");
      expect(skill!.sources).toEqual(["gmail", "gcal"]);
    });
  });

  describe("getByName", () => {
    it("returns undefined for non-existent skill", () => {
      const skill = registry.getByName("does-not-exist");
      expect(skill).toBeUndefined();
    });
  });

  describe("enable / disable", () => {
    it("skills are enabled by default", () => {
      writeSkill("my-skill", {});

      expect(registry.isEnabled("my-skill")).toBe(true);
    });

    it("can disable and re-enable a skill", () => {
      writeSkill("my-skill", {});

      registry.disable("my-skill");
      expect(registry.isEnabled("my-skill")).toBe(false);

      registry.enable("my-skill");
      expect(registry.isEnabled("my-skill")).toBe(true);
    });
  });

  describe("listEnabled", () => {
    it("returns only enabled skills", () => {
      writeSkill("skill-a", {});
      writeSkill("skill-b", {});
      writeSkill("skill-c", {});

      registry.disable("skill-b");

      const enabled = registry.listEnabled();
      const names = enabled.map((s) => s.name);
      expect(names).toContain("skill-a");
      expect(names).not.toContain("skill-b");
      expect(names).toContain("skill-c");
    });
  });

  describe("validate", () => {
    it("rejects skill without name", () => {
      const skillDir = path.join(tmpDir, "bad-skill");
      fs.mkdirSync(skillDir);
      fs.writeFileSync(
        path.join(skillDir, "SKILL.md"),
        `---\ndescription: "no name"\nversion: "1.0.0"\npermissions: []\n---\nInstructions`
      );

      const errors = registry.validate("bad-skill");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toMatch(/name/i);
    });

    it("returns empty array for valid skill", () => {
      writeSkill("valid-skill", {
        name: "valid-skill",
        description: "Valid",
        version: "1.0.0",
      });

      const errors = registry.validate("valid-skill");
      expect(errors).toEqual([]);
    });
  });
});
