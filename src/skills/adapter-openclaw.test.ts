import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OpenClawAdapter } from "./adapter-openclaw.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("OpenClawAdapter", () => {
  let tmpDir: string;
  let adapter: OpenClawAdapter;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-adapter-"));
    adapter = new OpenClawAdapter();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeOpenClawSkill(name: string, content: string): string {
    const skillDir = path.join(tmpDir, name);
    fs.mkdirSync(skillDir, { recursive: true });
    const filePath = path.join(skillDir, "SKILL.md");
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  describe("canAdapt", () => {
    it("returns true for valid OpenClaw SKILL.md", () => {
      const filePath = writeOpenClawSkill(
        "weather",
        `---\nname: "weather"\ndescription: "Get weather"\nversion: "1.0.0"\npermissions: ["network"]\n---\nFetch weather data.`
      );

      expect(adapter.canAdapt(filePath)).toBe(true);
    });

    it("returns false for non-existent file", () => {
      expect(adapter.canAdapt("/tmp/nope/SKILL.md")).toBe(false);
    });

    it("returns false for file without frontmatter", () => {
      const filePath = writeOpenClawSkill("bad", "Just some text without frontmatter");
      expect(adapter.canAdapt(filePath)).toBe(false);
    });
  });

  describe("adapt", () => {
    it("converts OpenClaw SKILL.md to Chieftan SkillManifest", () => {
      const filePath = writeOpenClawSkill(
        "email-digest",
        [
          "---",
          'name: "email-digest"',
          'description: "Summarize unread emails"',
          'version: "2.1.0"',
          'permissions: ["network", "file-read"]',
          "---",
          "",
          "You are an email digest assistant.",
          "Fetch unread emails and summarize them.",
        ].join("\n")
      );

      const manifest = adapter.adapt(filePath);

      expect(manifest.name).toBe("email-digest");
      expect(manifest.description).toBe("Summarize unread emails");
      expect(manifest.version).toBe("2.1.0");
      expect(manifest.permissions).toEqual(["network", "file-read"]);
      expect(manifest.instructions).toContain("email digest assistant");
    });

    it("preserves schedule field if present", () => {
      const filePath = writeOpenClawSkill(
        "daily-report",
        [
          "---",
          'name: "daily-report"',
          'description: "Daily report"',
          'version: "1.0.0"',
          'permissions: []',
          'schedule: "0 9 * * *"',
          "---",
          "Generate daily report.",
        ].join("\n")
      );

      const manifest = adapter.adapt(filePath);
      expect(manifest.schedule).toBe("0 9 * * *");
    });

    it("adds origin metadata marking it as openclaw-adapted", () => {
      const filePath = writeOpenClawSkill(
        "simple",
        `---\nname: "simple"\ndescription: "Simple skill"\nversion: "1.0.0"\npermissions: []\n---\nDo the thing.`
      );

      const manifest = adapter.adapt(filePath);
      expect(manifest.origin).toBe("openclaw");
    });

    it("throws for invalid SKILL.md", () => {
      const filePath = writeOpenClawSkill("broken", "no frontmatter here");
      expect(() => adapter.adapt(filePath)).toThrow(/parse/i);
    });
  });

  describe("adaptDirectory", () => {
    it("adapts all valid skills in a directory", () => {
      writeOpenClawSkill(
        "skill-a",
        `---\nname: "skill-a"\ndescription: "A"\nversion: "1.0.0"\npermissions: []\n---\nA`
      );
      writeOpenClawSkill(
        "skill-b",
        `---\nname: "skill-b"\ndescription: "B"\nversion: "1.0.0"\npermissions: []\n---\nB`
      );
      // Invalid skill (no frontmatter)
      const badDir = path.join(tmpDir, "bad-skill");
      fs.mkdirSync(badDir);
      fs.writeFileSync(path.join(badDir, "SKILL.md"), "no frontmatter");

      const results = adapter.adaptDirectory(tmpDir);

      expect(results.adapted).toHaveLength(2);
      expect(results.failed).toHaveLength(1);
      expect(results.failed[0].name).toBe("bad-skill");
      expect(results.failed[0].error).toBeDefined();
    });

    it("returns empty results for empty directory", () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "empty-"));
      const results = adapter.adaptDirectory(emptyDir);
      expect(results.adapted).toEqual([]);
      expect(results.failed).toEqual([]);
      fs.rmSync(emptyDir, { recursive: true, force: true });
    });
  });
});
