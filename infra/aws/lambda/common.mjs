import { createHmac } from "node:crypto";

import { Sha256 } from "@aws-crypto/sha256-js";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";

const secrets = new SecretsManagerClient({});
const secretCache = new Map();

export async function readSecret(secretArn) {
  if (secretCache.has(secretArn)) return secretCache.get(secretArn);
  const response = await secrets.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!response.SecretString) throw new Error(`Secret ${secretArn} has no string value.`);
  secretCache.set(secretArn, response.SecretString);
  return response.SecretString;
}

export function callbackAuthorization(secret, body) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `HMAC-SHA256 ${timestamp}:${digest}`;
}

export async function postSignedCallback(path, payload) {
  const secret = await readSecret(process.env.CALLBACK_SECRET_ARN);
  const body = JSON.stringify(payload);
  const response = await fetch(new URL(path, process.env.APP_URL), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: callbackAuthorization(secret, body),
    },
    body,
    signal: AbortSignal.timeout(50_000),
  });
  if (!response.ok) throw new Error(`Application callback failed with HTTP ${response.status}.`);
  return response.json();
}

function lambdaCredentials() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  if (!accessKeyId || !secretAccessKey) throw new Error("Lambda AWS credentials are unavailable.");
  return { accessKeyId, secretAccessKey, sessionToken };
}

export async function publishInvalidation(channel, event) {
  if (!process.env.APPSYNC_HTTP_URL) return;
  const endpoint = new URL(process.env.APPSYNC_HTTP_URL);
  const body = JSON.stringify({ channel, events: [JSON.stringify(event)] });
  const request = new HttpRequest({
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    path: endpoint.pathname,
    method: "POST",
    headers: { host: endpoint.hostname, "content-type": "application/json" },
    body,
  });
  const signer = new SignatureV4({
    credentials: lambdaCredentials(),
    region: process.env.AWS_REGION,
    service: "appsync",
    sha256: Sha256,
  });
  const signed = await signer.sign(request);
  const response = await fetch(endpoint, { method: "POST", headers: signed.headers, body });
  if (!response.ok) throw new Error(`AppSync publish failed with HTTP ${response.status}.`);
}
