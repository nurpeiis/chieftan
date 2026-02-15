export interface PermissionManifest {
  fileRead: boolean;
  fileWrite: boolean;
  network: boolean;
  shell: boolean;
  paths: string[];
}

export interface Mount {
  hostPath: string;
  containerPath: string;
  readonly: boolean;
}

export interface ContainerConfig {
  name: string;
  networkMode: "none" | "bridge";
  readonlyRootfs: boolean;
  mounts: Mount[];
  cpuLimit: string;
  memoryLimit: string;
  tmpfsSize: string;
}

export interface PermissionWarning {
  permission: string;
  level: "low" | "medium" | "high";
  message: string;
}

export function parsePermissions(permissions: string[]): PermissionManifest {
  const manifest: PermissionManifest = {
    fileRead: false,
    fileWrite: false,
    network: false,
    shell: false,
    paths: [],
  };

  for (const perm of permissions) {
    const [base, scopePath] = perm.split(":");

    switch (base) {
      case "file-read":
        manifest.fileRead = true;
        if (scopePath) manifest.paths.push(scopePath);
        break;
      case "file-write":
        manifest.fileWrite = true;
        if (scopePath) manifest.paths.push(scopePath);
        break;
      case "network":
        manifest.network = true;
        break;
      case "shell":
        manifest.shell = true;
        break;
    }
  }

  return manifest;
}

export function buildContainerConfig(
  skillName: string,
  manifest: PermissionManifest
): ContainerConfig {
  const mounts: Mount[] = manifest.paths.map((hostPath) => ({
    hostPath,
    containerPath: `/data/${hostPath.replace(/^~\//, "")}`,
    readonly: !manifest.fileWrite,
  }));

  return {
    name: `chieftan-skill-${skillName}`,
    networkMode: manifest.network ? "bridge" : "none",
    readonlyRootfs: true,
    mounts,
    cpuLimit: "0.5",
    memoryLimit: "256m",
    tmpfsSize: "64m",
  };
}

export function validatePermissions(permissions: string[]): PermissionWarning[] {
  const warnings: PermissionWarning[] = [];

  for (const perm of permissions) {
    const base = perm.split(":")[0];

    switch (base) {
      case "shell":
        warnings.push({
          permission: perm,
          level: "high",
          message: "Shell access allows arbitrary command execution",
        });
        break;
      case "network":
        warnings.push({
          permission: perm,
          level: "medium",
          message: "Network access allows outbound connections",
        });
        break;
      case "file-write":
        warnings.push({
          permission: perm,
          level: "medium",
          message: "File write access allows modifying host files",
        });
        break;
    }
  }

  return warnings;
}
