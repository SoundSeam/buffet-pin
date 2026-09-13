import { spawn } from "node:child_process";

// Run the safe production build without loading caller or production credentials.
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3117"], {
  env: {
    PATH: process.env.PATH,
    NODE_ENV: "production",
    APP_URL: "http://localhost:3117",
    CRON_SECRET: "drinks-local-verification-only",
    DATABASE_URL: "postgresql://build:build@127.0.0.1:59999/build?connect_timeout=1",
    DIRECT_URL: "postgresql://build:build@127.0.0.1:59999/build?connect_timeout=1",
    NEXT_PUBLIC_SUPABASE_URL: "https://build.invalid",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "build-only-key",
  },
  stdio: "inherit",
});
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
