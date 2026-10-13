import { postSignedCallback, publishInvalidation } from "./common.mjs";

export async function handler(event) {
  const failures = [];
  for (const record of event.Records ?? []) {
    try {
      const message = JSON.parse(record.body);
      if (!message.jobId || typeof message.jobId !== "string") throw new Error("Queue message has no jobId.");
      const response = await postSignedCallback("/api/internal/async-jobs/process", { jobId: message.jobId });
      for (const invalidation of response?.data?.invalidations ?? []) {
        await publishInvalidation(invalidation.channel, invalidation.event);
      }
    } catch (error) {
      console.error("Async relay failed", { messageId: record.messageId, error });
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures };
}
