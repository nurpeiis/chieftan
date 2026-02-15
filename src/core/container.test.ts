import { describe, it, expect } from "vitest";
import {
  parsePermissions,
  buildContainerConfig,
  validatePermissions,
  type PermissionManifest,
  type ContainerConfig,
} from "./container.js";

describe("Container Sandbox", () => {
  describe("parsePermissions", () => {
    it("parses simple permission strings", () => {
      const perms = parsePermissions(["file-read", "network"]);

      expect(perms).toEqual({
        fileRead: true,
        fileWrite: false,
        network: true,
        shell: false,
        paths: [],
      });
    });

    it("parses file-write permission", () => {
      const perms = parsePermissions(["file-read", "file-write"]);
      expect(perms.fileRead).toBe(true);
      expect(perms.fileWrite).toBe(true);
    });

    it("parses shell permission", () => {
      const perms = parsePermissions(["shell"]);
      expect(perms.shell).toBe(true);
    });

    it("parses path-scoped permissions", () => {
      const perms = parsePermissions([
        "file-read:~/Documents",
        "file-read:~/Downloads",
      ]);
      expect(perms.fileRead).toBe(true);
      expect(perms.paths).toEqual(["~/Documents", "~/Downloads"]);
    });

    it("returns restrictive defaults for empty permissions", () => {
      const perms = parsePermissions([]);
      expect(perms).toEqual({
        fileRead: false,
        fileWrite: false,
        network: false,
        shell: false,
        paths: [],
      });
    });
  });

  describe("buildContainerConfig", () => {
    it("generates a restrictive container config for no permissions", () => {
      const manifest: PermissionManifest = {
        fileRead: false,
        fileWrite: false,
        network: false,
        shell: false,
        paths: [],
      };

      const config = buildContainerConfig("my-skill", manifest);

      expect(config.name).toBe("chieftan-skill-my-skill");
      expect(config.networkMode).toBe("none");
      expect(config.readonlyRootfs).toBe(true);
      expect(config.mounts).toEqual([]);
      expect(config.cpuLimit).toBeDefined();
      expect(config.memoryLimit).toBeDefined();
    });

    it("enables network when permission granted", () => {
      const manifest: PermissionManifest = {
        fileRead: false,
        fileWrite: false,
        network: true,
        shell: false,
        paths: [],
      };

      const config = buildContainerConfig("net-skill", manifest);
      expect(config.networkMode).toBe("bridge");
    });

    it("adds read-only bind mounts for file-read paths", () => {
      const manifest: PermissionManifest = {
        fileRead: true,
        fileWrite: false,
        network: false,
        shell: false,
        paths: ["~/Documents"],
      };

      const config = buildContainerConfig("reader", manifest);
      expect(config.mounts).toHaveLength(1);
      expect(config.mounts[0].readonly).toBe(true);
      expect(config.mounts[0].hostPath).toBe("~/Documents");
    });

    it("adds read-write bind mounts when file-write is granted", () => {
      const manifest: PermissionManifest = {
        fileRead: true,
        fileWrite: true,
        network: false,
        shell: false,
        paths: ["~/workspace"],
      };

      const config = buildContainerConfig("writer", manifest);
      expect(config.mounts).toHaveLength(1);
      expect(config.mounts[0].readonly).toBe(false);
    });

    it("always includes a writable /tmp for skill workspace", () => {
      const manifest: PermissionManifest = {
        fileRead: false,
        fileWrite: false,
        network: false,
        shell: false,
        paths: [],
      };

      const config = buildContainerConfig("minimal", manifest);
      expect(config.tmpfsSize).toBe("64m");
    });
  });

  describe("validatePermissions", () => {
    it("flags shell as high risk", () => {
      const warnings = validatePermissions(["shell"]);
      expect(warnings.some((w) => w.level === "high")).toBe(true);
    });

    it("flags network as medium risk", () => {
      const warnings = validatePermissions(["network"]);
      expect(warnings.some((w) => w.level === "medium")).toBe(true);
    });

    it("flags file-write as medium risk", () => {
      const warnings = validatePermissions(["file-write"]);
      expect(warnings.some((w) => w.level === "medium")).toBe(true);
    });

    it("returns no warnings for file-read only", () => {
      const warnings = validatePermissions(["file-read"]);
      expect(warnings).toEqual([]);
    });

    it("returns no warnings for empty permissions", () => {
      const warnings = validatePermissions([]);
      expect(warnings).toEqual([]);
    });
  });
});
