const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());
process.env.BUFFET_PIN_ENV_ALREADY_LOADED = "true";
process.argv.push("--apply");

import("./provision-clover-machine-test-item.mjs");
