import "server-only";

import { SchedulerClient } from "@aws-sdk/client-scheduler";
import { SQSClient } from "@aws-sdk/client-sqs";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";

import { getEnv } from "@/lib/env";

function credentials() {
  const env = getEnv();
  // In Vercel Functions the token is supplied on the request context/header and
  // consumed by the provider; it is not necessarily a process environment value.
  if (!env.AWS_ASYNC_ROLE_ARN || (process.env.VERCEL !== "1" && !process.env.VERCEL_OIDC_TOKEN)) {
    return undefined;
  }
  return awsCredentialsProvider({
    roleArn: env.AWS_ASYNC_ROLE_ARN,
    roleSessionName: "buffet-pin-vercel",
    clientConfig: { region: env.AWS_REGION },
  });
}

let sqs: SQSClient | null = null;
let scheduler: SchedulerClient | null = null;

export function getSqsClient(): SQSClient {
  const env = getEnv();
  sqs ??= new SQSClient({ region: env.AWS_REGION, credentials: credentials() });
  return sqs;
}

export function getSchedulerClient(): SchedulerClient {
  const env = getEnv();
  scheduler ??= new SchedulerClient({ region: env.AWS_REGION, credentials: credentials() });
  return scheduler;
}
