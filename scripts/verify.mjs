import { spawnSync } from "node:child_process";

const steps = ["test", "typecheck", "build"];

for (const step of steps) {
  const result = spawnSync(process.execPath, ["scripts/pnpm-cli.mjs", step], {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
