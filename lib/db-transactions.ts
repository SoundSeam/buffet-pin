import { Prisma, type PrismaClient } from "@prisma/client";

const MAX_SERIALIZABLE_ATTEMPTS = 3;

export async function withSerializableRetry<T>(
  client: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
    try {
      return await client.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError && (
          error.code === "P2034" ||
          (error.code === "P2010" && ((error.meta as { code?: string } | undefined)?.code === "40001" || error.message.includes("could not serialize access")))
        );
      if (!retryable || attempt === MAX_SERIALIZABLE_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new Error("Serializable transaction retry exhausted.");
}
