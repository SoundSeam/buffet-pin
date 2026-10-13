import crypto from "node:crypto";
import http from "node:http";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";

const appPort = 3100;
const databasePort = await freePort();
const authPort = await freePort();
const containerName = `buffet-pin-browser-${process.pid}`;
const databaseUrl = `postgresql://buffet_pin_test:buffet_pin_test@127.0.0.1:${databasePort}/buffet_pin_browser_test`;
const driverToken = "browser-driver-token";
const staff = new Map([
  [
    "manager@example.test",
    { id: "auth-manager", role: "MANAGER", name: "Browser Manager" },
  ],
  [
    "operator@example.test",
    { id: "auth-operator", role: "OPERATOR", name: "Browser Operator" },
  ],
  [
    "dispatcher@example.test",
    { id: "auth-dispatcher", role: "DISPATCHER", name: "Browser Dispatcher" },
  ],
  [
    "reporting@example.test",
    { id: "auth-reporting", role: "REPORTING", name: "Browser Reporting" },
  ],
  [
    "technical@example.test",
    { id: "auth-technical", role: "TECHNICAL", name: "Browser Technical" },
  ],
]);

let app;
let authServer;
let stopping = false;

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with ${result.status}`,
    );
  }
}

function jwtFor(email, id) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    aud: "authenticated",
    email,
    exp: now + 3600,
    iat: now,
    role: "authenticated",
    sub: id,
  })}.browser-signature`;
}

function authUser(email, id) {
  const now = new Date().toISOString();
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: now,
    phone: "",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: now,
    updated_at: now,
  };
}

function cors(response) {
  response.setHeader(
    "Access-Control-Allow-Origin",
    `http://localhost:${appPort}`,
  );
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  );
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, DELETE, OPTIONS",
  );
}

function json(response, status, body) {
  cors(response);
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function decodeEmail(token) {
  try {
    return JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
    ).email;
  } catch {
    return null;
  }
}

function startAuthServer() {
  authServer = http.createServer((request, response) => {
    if (request.method === "OPTIONS") {
      cors(response);
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url, `http://127.0.0.1:${authPort}`);
    if (request.method === "POST" && url.pathname === "/auth/v1/token") {
      let raw = "";
      request.on("data", (chunk) => (raw += chunk));
      request.on("end", () => {
        let email;
        try {
          email = JSON.parse(raw).email?.toLowerCase();
        } catch {
          email = null;
        }
        const record = staff.get(email);
        if (!record) {
          json(response, 400, {
            error: "invalid_grant",
            error_description: "Invalid login credentials",
          });
          return;
        }
        const accessToken = jwtFor(email, record.id);
        json(response, 200, {
          access_token: accessToken,
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: `refresh-${record.id}`,
          user: authUser(email, record.id),
        });
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/auth/v1/user") {
      const token =
        request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
      const email = decodeEmail(token);
      const record = staff.get(email);
      if (!record) {
        json(response, 401, { message: "invalid token" });
        return;
      }
      json(response, 200, authUser(email, record.id));
      return;
    }

    if (request.method === "POST" && url.pathname === "/auth/v1/logout") {
      json(response, 204, {});
      return;
    }

    json(response, 404, { message: "not found" });
  });
  return new Promise((resolve) =>
    authServer.listen(authPort, "127.0.0.1", resolve),
  );
}

async function seedDatabase() {
  process.env.DATABASE_URL = databaseUrl;
  process.env.DIRECT_URL = databaseUrl;
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const now = new Date();
  const hour = 60 * 60 * 1000;
  try {
    await prisma.restaurantOrderSettings.create({
      data: {
        id: 1,
        onlineOrderingEnabled: false,
        deliveryEnabled: true,
        restaurantLatitude: 45.5017,
        restaurantLongitude: -73.5673,
        dispatchMaxWaitMinutes: 10,
        dispatchDeadlineBufferMinutes: 20,
        dispatchLowDemandReleaseCount: 1,
      },
    });
    await prisma.reservation.create({
      data: {
        id: "browser-reservation-sentinel",
        confirmationCode: "BROW-RES-001",
        manageToken: "browser-reservation-sentinel-token",
        status: "CONFIRMED",
        reservationDate: new Date("2030-01-01T00:00:00.000Z"),
        reservationTime: new Date("1970-01-01T18:00:00.000Z"),
        reservationAt: new Date("2030-01-01T23:00:00.000Z"),
        partySize: 4,
        guestName: "Reservation Sentinel",
        guestPhone: "+15145550999",
        guestEmail: "reservation-sentinel@example.test",
        language: "EN",
      },
    });
    await prisma.catalogConfiguration.create({ data: { id: 1 } });

    for (const [email, record] of staff) {
      await prisma.staffMember.create({
        data: {
          id: `staff-${record.role.toLowerCase()}`,
          email,
          displayName: record.name,
          authUserId: record.id,
          role: record.role,
        },
      });
    }

    const category = await prisma.menuCategory.create({
      data: { id: "browser-category", name: "Browser delivery category" },
    });
    const menuItem = await prisma.menuItem.create({
      data: {
        id: "browser-menu-item",
        categoryId: category.id,
        name: "Browser delivery meal",
        priceCents: 1995,
      },
    });
    const zone = await prisma.deliveryZone.create({
      data: {
        id: "browser-zone",
        name: "Browser Zone",
        centerLatitude: 45.5017,
        centerLongitude: -73.5673,
        radiusKm: 8,
      },
    });
    const driver = await prisma.driver.create({
      data: {
        id: "browser-driver",
        email: "driver@example.test",
        name: "Browser Driver",
        phone: "+15145550199",
        shifts: {
          create: {
            startsAt: new Date(now.getTime() - hour),
            endsAt: new Date(now.getTime() + 8 * hour),
          },
        },
        zoneEligibilities: { create: { deliveryZoneId: zone.id } },
        accessTokens: {
          create: {
            label: "Playwright access",
            tokenHash: crypto
              .createHash("sha256")
              .update(driverToken)
              .digest("hex"),
            expiresAt: new Date(now.getTime() + hour),
          },
        },
      },
    });
    await prisma.driver.create({
      data: {
        id: "browser-dispatch-driver",
        email: "dispatch-driver@example.test",
        name: "Browser Dispatch Driver",
        phone: "+15145550200",
        shifts: {
          create: {
            startsAt: new Date(now.getTime() - hour),
            endsAt: new Date(now.getTime() + 8 * hour),
          },
        },
        zoneEligibilities: { create: { deliveryZoneId: zone.id } },
      },
    });
    const customer = await prisma.customer.create({
      data: {
        id: "browser-customer",
        name: "Browser Customer",
        phone: "+15145550101",
        email: "customer@example.test",
      },
    });
    const commonOrder = {
      serviceType: "DELIVERY",
      paymentStatus: "PAID",
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      deliveryAddressLine1: "123 Browser Street",
      deliveryCity: "Montreal",
      deliveryProvince: "QC",
      deliveryPostalCode: "H2X 1Y4",
      deliveryCountry: "CA",
      deliveryLatitude: 45.505,
      deliveryLongitude: -73.57,
      deliveryZoneIdSnapshot: zone.id,
      deliveryZoneNameSnapshot: zone.name,
      itemsSubtotalCents: 1995,
      taxableSubtotalCents: 1995,
      taxCents: 299,
      totalCents: 2294,
    };
    const item = () => ({
      menuItemId: menuItem.id,
      menuItemNameSnapshot: menuItem.name,
      quantity: 1,
      unitPriceCents: 1995,
      lineSubtotalCents: 1995,
    });
    const printedJob = (orderId) => ({
      initialForOrderId: orderId,
      purpose: "INITIAL",
      status: "PRINTED",
      idempotencyKey: `browser-initial-print-${orderId}`,
      requestedByActorType: "SYSTEM",
      resolvedAt: now,
    });

    await prisma.order.create({
      data: {
        ...commonOrder,
        id: "browser-new-order",
        publicCode: "BROW-NEW",
        trackingToken: "browser-new-tracking",
        orderNumber: "BP-260722-9000",
        fulfillmentStatus: "AWAITING_ACCEPTANCE",
        productionStatus: "AWAITING_ACCEPTANCE",
        dispatchStatus: "UNASSIGNED",
        estimatedReadyEndAt: new Date(now.getTime() + 20 * 60 * 1000),
        estimatedDeliveryEndAt: new Date(now.getTime() + 50 * 60 * 1000),
        promisedDeliveryEndAt: new Date(now.getTime() + 60 * 60 * 1000),
        dispatchDeadlineAt: new Date(now.getTime() + 30 * 60 * 1000),
        items: { create: [item()] },
        printJobs: { create: printedJob("browser-new-order") },
      },
    });
    await prisma.order.create({
      data: {
        ...commonOrder,
        id: "browser-cancelled-order",
        publicCode: "BROW-CANCELLED",
        trackingToken: "browser-cancelled-tracking",
        orderNumber: "BP-260722-9001",
        refundStatus: "FAILED",
        fulfillmentStatus: "CANCELLED",
        productionStatus: "CANCELLED",
        dispatchStatus: "CANCELLED",
        cancelledAt: now,
        items: { create: [item()] },
      },
    });
    await prisma.order.create({
      data: {
        ...commonOrder,
        id: "browser-dispatch-order",
        publicCode: "BROW-DISPATCH",
        trackingToken: "browser-dispatch-tracking",
        orderNumber: "BP-260722-9002",
        fulfillmentStatus: "READY_FOR_PICKUP",
        productionStatus: "AT_DISPATCH_DESK",
        dispatchStatus: "UNASSIGNED",
        packedAt: new Date(now.getTime() - 20 * 60 * 1000),
        atDispatchDeskAt: new Date(now.getTime() - 15 * 60 * 1000),
        dispatchDeadlineAt: new Date(now.getTime() + 5 * 60 * 1000),
        items: { create: [item()] },
        printJobs: { create: printedJob("browser-dispatch-order") },
      },
    });
    const driverOrder = await prisma.order.create({
      data: {
        ...commonOrder,
        id: "browser-driver-order",
        publicCode: "BROW-DRIVER",
        trackingToken: "browser-driver-tracking",
        orderNumber: "BP-260722-9003",
        fulfillmentStatus: "ON_THE_WAY",
        productionStatus: "AT_DISPATCH_DESK",
        dispatchStatus: "EN_ROUTE",
        packedAt: new Date(now.getTime() - 20 * 60 * 1000),
        atDispatchDeskAt: new Date(now.getTime() - 15 * 60 * 1000),
        items: { create: [item()] },
        printJobs: { create: printedJob("browser-driver-order") },
      },
    });
    await prisma.deliveryRun.create({
      data: {
        id: "browser-driver-run",
        runNumber: "RUN-BROWSER-001",
        requestKey: "browser-driver-ready-run",
        status: "EN_ROUTE",
        zoneIdSnapshot: zone.id,
        zoneNameSnapshot: zone.name,
        driverId: driver.id,
        approvedByActorId: "staff-dispatcher",
        approvedByActorLabel: "Browser Dispatcher",
        approvedAt: now,
        handedOffAt: now,
        handedOffByActorId: "staff-operator",
        handedOffByActorLabel: "Browser Operator",
        dispatchedAt: now,
        pickedUpAt: now,
        routingStatus: "MANUAL_FALLBACK",
        routeExplanation:
          "Deterministic browser fixture with manual route fallback.",
        stops: {
          create: {
            orderId: driverOrder.id,
            position: 1,
            status: "EN_ROUTE",
            bagVerifiedAt: now,
            bagVerifiedBy: "staff-dispatcher",
            pickedUpAt: now,
          },
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  if (app && !app.killed) app.kill("SIGTERM");
  if (authServer) await new Promise((resolve) => authServer.close(resolve));
  spawnSync("docker", ["rm", "-f", containerName], { stdio: "ignore" });
  process.exit(exitCode);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => void stop(0));
}
process.on("uncaughtException", (error) => {
  console.error(error);
  void stop(1);
});

try {
  run("docker", [
    "run",
    "--detach",
    "--rm",
    "--name",
    containerName,
    "-e",
    "POSTGRES_USER=buffet_pin_test",
    "-e",
    "POSTGRES_PASSWORD=buffet_pin_test",
    "-e",
    "POSTGRES_DB=buffet_pin_browser_test",
    "-p",
    `127.0.0.1:${databasePort}:5432`,
    "postgres:16-alpine",
  ]);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const ready = spawnSync(
      "docker",
      ["exec", containerName, "pg_isready", "-U", "buffet_pin_test"],
      { stdio: "ignore" },
    );
    if (ready.status === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (attempt === 39)
      throw new Error("Disposable browser database did not become ready.");
  }
  run("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
  });
  await seedDatabase();
  await startAuthServer();

  app = spawn("npx", ["next", "dev", "-p", String(appPort)], {
    env: {
      ...process.env,
      NODE_ENV: "development",
      APP_URL: `http://localhost:${appPort}`,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${authPort}`,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "browser-test-publishable-key",
      ADMIN_EMAILS: [...staff.keys()].join(","),
      DRIVER_SESSION_SECRET: "browser-test-driver-session-secret",
      PROVIDER_MODE: "fake",
      FAILURE_INJECTION_ENABLED: "true",
      ORDERING_TEST_BYPASS: "false",
      GEOCODING_PROVIDER: "none",
      CLOVER_TEST_CHARGE_CURRENCY: "",
    },
    stdio: "inherit",
  });
  app.on("exit", (code) => void stop(code ?? 1));
} catch (error) {
  console.error(error);
  await stop(1);
}
