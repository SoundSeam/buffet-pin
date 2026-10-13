import { spawnSync } from "node:child_process";

const commands = [
  ["npm", ["run", "lint"]],
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "test"]],
  ["npm", ["run", "test:browser"]],
  ["npm", ["run", "test:db"]],
  ["npm", ["run", "prisma:validate"]],
  ["npm", ["run", "build:safe"]],
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
