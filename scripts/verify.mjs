import { spawnSync } from "node:child_process";
import { DISPOSABLE_TEST_DATABASE_URL } from "./database-guard.mjs";

const commands = [
  ["npm", ["run", "security:audit"]],
  ["npm", ["run", "security:audit:full"]],
  ["npm", ["run", "lint"]],
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "test"]],
  ["npm", ["run", "test:browser"]],
  ["npm", ["run", "test:db"]],
  ["npm", ["run", "prisma:validate"], { DATABASE_URL: DISPOSABLE_TEST_DATABASE_URL, DIRECT_URL: DISPOSABLE_TEST_DATABASE_URL }],
  ["npm", ["run", "build:safe"]],
];

for (const [command, args, environment] of commands) {
  const result = spawnSync(command, args, { stdio: "inherit", env: { ...process.env, ...environment } });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
