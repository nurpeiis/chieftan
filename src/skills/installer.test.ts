import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SkillInstaller } from "./installer.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("SkillInstaller", () => {
  let tmpSkillsDir: string;
  let tmpSourceDir: string;
  let installer: SkillInstaller;

  beforeEach(() => {
    tmpSkillsDir = fs.mkdtempSync(path.join(os.tmpdir(), "chieftan-install-"));
    tmpSourceDir = fs.mkdtempSync(path.join(os.tmpdir(), "chieftan-source-"));
    installer = new SkillInstaller(tmpSkillsDir);
  });

  afterEach(() => {
    fs.rmSync(tmpSkillsDir, { recursive: true, force: true });
    fs.rmSync(tmpSourceDir, { recursive: true, force: true });
  });

  function createSourceSkill(name: string, manifest: string): string {
    const dir = path.join(tmpSourceDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), manifest);
    return dir;
  }

  describe("installFromLocal", () => {
    it("copies a skill directory to the skills folder", () => {
      const source = createSourceSkill(
        "my-skill",
        `---\nname: "my-skill"\ndescription: "Test"\nversion: "1.0.0"\npermissions: []\n---\nInstructions`
      );

      const result = installer.installFromLocal(source);

      expect(result.success).toBe(true);
      expect(result.name).toBe("my-skill");
      expect(
        fs.existsSync(path.join(tmpSkillsDir, "my-skill", "SKILL.md"))
      ).toBe(true);
    });

    it("fails if source has no SKILL.md", () => {
      const dir = path.join(tmpSourceDir, "no-manifest");
      fs.mkdirSync(dir);

      const result = installer.installFromLocal(dir);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/SKILL\.md/i);
    });

    it("fails if skill is already installed", () => {
      const source = createSourceSkill(
        "dupe",
        `---\nname: "dupe"\ndescription: "Test"\nversion: "1.0.0"\npermissions: []\n---\nInstructions`
      );

      installer.installFromLocal(source);
      const result = installer.installFromLocal(source);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/already installed/i);
    });

    it("copies additional files alongside SKILL.md", () => {
      const source = createSourceSkill(
        "with-extras",
        `---\nname: "with-extras"\ndescription: "Test"\nversion: "1.0.0"\npermissions: []\n---\nInstructions`
      );
      fs.writeFileSync(path.join(source, "helper.ts"), "export const x = 1;");

      const result = installer.installFromLocal(source);

      expect(result.success).toBe(true);
      expect(
        fs.existsSync(path.join(tmpSkillsDir, "with-extras", "helper.ts"))
      ).toBe(true);
    });
  });

  describe("uninstall", () => {
    it("removes an installed skill", () => {
      const source = createSourceSkill(
        "removable",
        `---\nname: "removable"\ndescription: "Test"\nversion: "1.0.0"\npermissions: []\n---\nInstructions`
      );
      installer.installFromLocal(source);

      const result = installer.uninstall("removable");

      expect(result).toBe(true);
      expect(
        fs.existsSync(path.join(tmpSkillsDir, "removable"))
      ).toBe(false);
    });

    it("returns false for non-existent skill", () => {
      expect(installer.uninstall("ghost")).toBe(false);
    });
  });

  describe("listInstalled", () => {
    it("returns names of installed skills", () => {
      createSourceSkill(
        "a",
        `---\nname: "a"\ndescription: "A"\nversion: "1.0.0"\npermissions: []\n---\nA`
      );
      createSourceSkill(
        "b",
        `---\nname: "b"\ndescription: "B"\nversion: "1.0.0"\npermissions: []\n---\nB`
      );

      installer.installFromLocal(path.join(tmpSourceDir, "a"));
      installer.installFromLocal(path.join(tmpSourceDir, "b"));

      const installed = installer.listInstalled();
      expect(installed.sort()).toEqual(["a", "b"]);
    });

    it("returns empty array when none installed", () => {
      expect(installer.listInstalled()).toEqual([]);
    });
  });

  describe("getPermissionReview", () => {
    it("returns permission details for review before install", () => {
      const source = createSourceSkill(
        "risky",
        `---\nname: "risky"\ndescription: "Risky skill"\nversion: "1.0.0"\npermissions: ["network", "shell", "file-write"]\n---\nDo risky things`
      );

      const review = installer.getPermissionReview(source);

      expect(review).toBeDefined();
      expect(review!.name).toBe("risky");
      expect(review!.permissions).toEqual(["network", "shell", "file-write"]);
      expect(review!.warnings.length).toBeGreaterThan(0);
      expect(review!.warnings.some((w) => w.level === "high")).toBe(true);
    });

    it("returns null for invalid skill path", () => {
      const review = installer.getPermissionReview("/tmp/nope");
      expect(review).toBeNull();
    });

    it("returns no warnings for safe skill", () => {
      const source = createSourceSkill(
        "safe",
        `---\nname: "safe"\ndescription: "Safe skill"\nversion: "1.0.0"\npermissions: ["file-read"]\n---\nRead only`
      );

      const review = installer.getPermissionReview(source);
      expect(review!.warnings).toEqual([]);
    });
  });
});
