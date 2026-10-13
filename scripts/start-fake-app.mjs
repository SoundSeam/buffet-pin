import { spawn } from "node:child_process";

const child = spawn("npx", ["next", "dev", "-p", "3100"], {
  env: {
    ...process.env,
    NODE_ENV: "development",
    APP_URL: "http://localhost:3100",
    DATABASE_URL: "postgresql://fake:fake@127.0.0.1:55432/buffet_pin_fake?connect_timeout=1",
    DIRECT_URL: "postgresql://fake:fake@127.0.0.1:55432/buffet_pin_fake?connect_timeout=1",
    NEXT_PUBLIC_SUPABASE_URL: "https://fake.invalid",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fake-publishable-key",
    PROVIDER_MODE: "fake",
    FAILURE_INJECTION_ENABLED: "true",
    ORDERING_TEST_BYPASS: "false",
    CLOVER_TEST_CHARGE_CURRENCY: "",
  },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code) => process.exit(code ?? 1));
