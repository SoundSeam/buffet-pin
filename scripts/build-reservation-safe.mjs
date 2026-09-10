import { spawnSync } from "node:child_process";

// Explicit disposable values; never load caller or production credentials.
const result = spawnSync("npm", ["run", "build"], {
  env: {
    PATH: process.env.PATH,
    NODE_ENV: "production",
    APP_URL: "https://build.invalid",
    CRON_SECRET: "reservation-switch-safe-build-secret",
    DATABASE_URL: "postgresql://build:build@127.0.0.1:59999/build?connect_timeout=1",
    DIRECT_URL: "postgresql://build:build@127.0.0.1:59999/build?connect_timeout=1",
    NEXT_PUBLIC_SUPABASE_URL: "https://build.invalid",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "build-only-key",
  },
  stdio: "inherit",
});
process.exit(result.status ?? 1);
