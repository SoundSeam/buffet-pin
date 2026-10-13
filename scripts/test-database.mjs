import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import {
  DISPOSABLE_TEST_DATABASE_URL,
  assertIsolatedTestDatabaseUrl,
} from "./database-guard.mjs";

const projectName = `buffet-pin-test-${process.pid}`;
const databaseUrl = assertIsolatedTestDatabaseUrl(DISPOSABLE_TEST_DATABASE_URL);
const composeArgs = ["compose", "-f", "docker-compose.test.yml", "-p", projectName];

function run(command, args, environment = process.env) {
  const result = spawnSync(command, args, { env: environment, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}.`);
  }
}

function runWithInput(command, args, input, environment = process.env) {
  const result = spawnSync(command, args, {
    env: environment,
    input,
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}.`);
  }
}

try {
  run("docker", [...composeArgs, "up", "--detach", "--wait"]);

  const testEnvironment = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    TEST_DATABASE_URL: databaseUrl,
  };

  run("docker", [
    ...composeArgs,
    "exec",
    "--no-TTY",
    "postgres",
    "createdb",
    "--username",
    "buffet_pin_test",
    "buffet_pin_legacy_test",
  ]);
  const legacyPsqlArgs = [
    ...composeArgs,
    "exec",
    "--no-TTY",
    "postgres",
    "psql",
    "--username",
    "buffet_pin_test",
    "--dbname",
    "buffet_pin_legacy_test",
    "--set",
    "ON_ERROR_STOP=1",
  ];
  const migrationNames = readdirSync("prisma/migrations")
    .filter((name) => name < "20260722120000_launch_m1_domain_foundation")
    .sort();
  for (const migrationName of migrationNames) {
    runWithInput(
      "docker",
      legacyPsqlArgs,
      readFileSync(`prisma/migrations/${migrationName}/migration.sql`),
    );
  }
  runWithInput(
    "docker",
    legacyPsqlArgs,
    readFileSync("tests/fixtures/m1-historical-order.sql"),
  );
  runWithInput(
    "docker",
    legacyPsqlArgs,
    readFileSync(
      "prisma/migrations/20260722120000_launch_m1_domain_foundation/migration.sql",
    ),
  );
  runWithInput(
    "docker",
    legacyPsqlArgs,
    readFileSync("tests/fixtures/m1-historical-verify.sql"),
  );

  run("npx", ["prisma", "migrate", "deploy"], testEnvironment);
  run("npx", ["prisma", "migrate", "status"], testEnvironment);
  run("npx", ["vitest", "run", "--config", "vitest.database.config.ts"], testEnvironment);
} finally {
  const result = spawnSync("docker", [...composeArgs, "down", "--volumes"], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
}
