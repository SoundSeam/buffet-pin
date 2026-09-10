import http from "node:http";
import { spawn } from "node:child_process";

// Local-only Supabase fake. Production credentials are never loaded.
const auth = http.createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/auth/v1/user" && request.headers.authorization?.startsWith("Bearer ")) {
    response.end(JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", email: "reservation-admin@example.test", aud: "authenticated", role: "authenticated", created_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: {} }));
  } else {
    response.statusCode = 401;
    response.end(JSON.stringify({ error: "unauthorized" }));
  }
});
await new Promise((resolve) => auth.listen(55440, "127.0.0.1", resolve));
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", "3111"], {
  env: {
    PATH: process.env.PATH,
    NODE_ENV: "development",
    APP_URL: "http://localhost:3111",
    DATABASE_URL: "postgresql://reservation_test@127.0.0.1:55439/reservation_switch_test",
    DIRECT_URL: "postgresql://reservation_test@127.0.0.1:55439/reservation_switch_test",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55440",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-public-key",
    ADMIN_EMAILS: "reservation-admin@example.test",
  },
  stdio: "inherit",
});
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => { child.kill(signal); auth.close(); });
child.on("exit", (code) => { auth.close(); process.exit(code ?? 1); });
