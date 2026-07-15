import { spawn, spawnSync } from "node:child_process";

export function spawnPnpm(args, options = {}) {
  if (process.platform === "win32") {
    return spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm", ...args], {
      shell: false,
      ...options,
    });
  }

  return spawn("pnpm", args, { shell: false, ...options });
}

export function spawnPnpmSync(args, options = {}) {
  if (process.platform === "win32") {
    return spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm", ...args], {
      shell: false,
      ...options,
    });
  }

  return spawnSync("pnpm", args, { shell: false, ...options });
}
