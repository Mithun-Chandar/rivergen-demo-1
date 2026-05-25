import { spawn } from "node:child_process";

const command = process.argv[2];
const extraArgs = process.argv.slice(3);

if (!command) {
  console.error("Usage: node scripts/showcase-runtime.mjs <dev|build|preview> [...args]");
  process.exit(1);
}

const pnpmCommand = "pnpm";
const child = spawn(
  pnpmCommand,
  ["--filter", "web", command, ...extraArgs],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      VITE_RUNTIME_MODE: "emulator",
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});