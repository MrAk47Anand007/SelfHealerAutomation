import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const npmExecPath = process.env.npm_execpath ?? "";

const usesPnpm = npmExecPath.toLowerCase().includes("pnpm");
const command = usesPnpm ? process.execPath : "corepack";
const commandArgs = usesPnpm ? [npmExecPath, ...args] : ["pnpm", ...args];

const result = spawnSync(command, commandArgs, {
  stdio: "inherit",
  shell: process.platform === "win32" && command === "corepack",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
