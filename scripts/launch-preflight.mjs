const VALID_TARGETS = new Set(["sandbox", "production"]);

function isPresent(env, name) {
  return typeof env[name] === "string" && env[name].trim().length > 0;
}

function isDisabled(value) {
  return !isPresent({ value }, "value") ||
    ["0", "false", "no", "off"].includes((value ?? "").trim().toLowerCase());
}

function isPlaceholder(value) {
  return /(replace|change.?me|example|placeholder|your[_-]?secret)/i.test(value ?? "");
}

export function evaluateLaunchEnvironment(env, target) {
  const errors = [];
  const warnings = [];
  const requireValue = (name) => {
    if (!isPresent(env, name)) errors.push(`${name} is missing.`);
  };

  if (!VALID_TARGETS.has(target)) {
    return { errors: [`Unknown target ${target}. Use sandbox or production.`], warnings };
  }

  [
    "APP_URL",
    "ADMIN_EMAILS",
    "CRON_SECRET",
    "DRIVER_SESSION_SECRET",
    "DATABASE_URL",
    "DIRECT_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "GOOGLE_MAPS_API_KEY",
    "CLOVER_MERCHANT_ID",
    "CLOVER_PUBLIC_ACCESS_KEY",
    "CLOVER_WEBHOOK_SECRET",
    "CLOVER_PLATFORM_WEBHOOK_AUTH",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER",
  ].forEach(requireValue);

  if (isPresent(env, "APP_URL")) {
    try {
      const url = new URL(env.APP_URL);
      if (url.protocol !== "https:") errors.push("APP_URL must use HTTPS for external launch testing.");
    } catch {
      errors.push("APP_URL must be an absolute URL.");
    }
  }

  for (const name of ["CRON_SECRET", "DRIVER_SESSION_SECRET"]) {
    if (isPresent(env, name) && (env[name].length < 32 || isPlaceholder(env[name]))) {
      errors.push(`${name} must be at least 32 characters and not a placeholder.`);
    }
  }
  if (
    isPresent(env, "CRON_SECRET") &&
    isPresent(env, "DRIVER_SESSION_SECRET") &&
    env.CRON_SECRET === env.DRIVER_SESSION_SECRET
  ) {
    errors.push("CRON_SECRET and DRIVER_SESSION_SECRET must be distinct.");
  }

  if (env.GEOCODING_PROVIDER !== "google") {
    errors.push("GEOCODING_PROVIDER must be google for launch address validation.");
  }
  if (env.CLOVER_CHECKOUT_MODE !== "iframe") {
    errors.push("CLOVER_CHECKOUT_MODE must be iframe.");
  }
  if (env.CLOVER_ENV !== target) {
    errors.push(`CLOVER_ENV must be ${target} for the ${target} preflight.`);
  }

  const hasPlatformToken =
    isPresent(env, "CLOVER_PLATFORM_TOKEN") || isPresent(env, "CLOVER_PRIVATE_TOKEN");
  const hasEcommerceToken =
    isPresent(env, "CLOVER_ECOMMERCE_PRIVATE_TOKEN") || isPresent(env, "CLOVER_PRIVATE_TOKEN");
  if (!hasPlatformToken) errors.push("CLOVER_PLATFORM_TOKEN is missing.");
  if (!hasEcommerceToken) errors.push("CLOVER_ECOMMERCE_PRIVATE_TOKEN is missing.");

  if (target === "production") {
    requireValue("CLOVER_PLATFORM_TOKEN");
    requireValue("CLOVER_ECOMMERCE_PRIVATE_TOKEN");
    if (isPresent(env, "CLOVER_TEST_CHARGE_CURRENCY")) {
      errors.push("CLOVER_TEST_CHARGE_CURRENCY is forbidden in production.");
    }
  } else if (
    !isPresent(env, "CLOVER_PLATFORM_TOKEN") ||
    !isPresent(env, "CLOVER_ECOMMERCE_PRIVATE_TOKEN")
  ) {
    warnings.push("Sandbox is using the legacy shared CLOVER_PRIVATE_TOKEN fallback; verify its Orders and Ecommerce grants.");
  }

  if (env.PROVIDER_MODE !== "real") errors.push("PROVIDER_MODE must be real.");
  if (!isDisabled(env.ORDERING_TEST_BYPASS)) errors.push("ORDERING_TEST_BYPASS must be false.");
  if (!isDisabled(env.FAILURE_INJECTION_ENABLED)) errors.push("FAILURE_INJECTION_ENABLED must be false.");
  if (isPresent(env, "CLOVER_API_BASE_URL")) errors.push("CLOVER_API_BASE_URL must be empty.");

  if (isPresent(env, "ADMIN_EMAILS") && /@example\.(com|invalid)\b/i.test(env.ADMIN_EMAILS)) {
    errors.push("ADMIN_EMAILS still contains an example address.");
  }

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

async function probeDeployment(appUrl) {
  const errors = [];
  for (const path of ["/api/health", "/api/readiness"]) {
    try {
      const response = await fetch(new URL(path, appUrl), {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        errors.push(`${path} returned HTTP ${response.status}.`);
        continue;
      }
      const body = await response.json();
      if (path === "/api/readiness" && body.intakeEnabled !== false) {
        errors.push("/api/readiness reports intake enabled; preflight requires ordering to remain paused.");
      }
    } catch (error) {
      errors.push(`${path} probe failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}

async function main() {
  const targetArg = process.argv.find((argument) => argument.startsWith("--target="));
  const target = targetArg?.split("=")[1] ?? "";
  const shouldProbe = process.argv.includes("--probe");
  const result = evaluateLaunchEnvironment(process.env, target);

  if (shouldProbe && result.errors.length === 0) {
    result.errors.push(...await probeDeployment(process.env.APP_URL));
  }

  for (const warning of result.warnings) console.warn(`WARN: ${warning}`);
  if (result.errors.length > 0) {
    console.error(`Launch ${target || "unknown"} preflight FAILED (${result.errors.length} issue${result.errors.length === 1 ? "" : "s"}):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Launch ${target} preflight PASS. Required configuration is present and safety flags are closed.`);
  if (shouldProbe) console.log("Health/readiness probes passed and online intake remains paused.");
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  await main();
}
