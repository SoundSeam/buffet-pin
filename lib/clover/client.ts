import "server-only";

import { getCloverConfig, type CloverConfig } from "@/lib/env";

export class CloverApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody: unknown,
  ) {
    super(message);
    this.name = "CloverApiError";
  }
}

export type CloverClient = {
  config: CloverConfig;
  post<TResponse>(
    path: string,
    body: unknown,
    options?: { headers?: Record<string, string> },
  ): Promise<TResponse>;
};

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : null;
}

export function createCloverClient(config = getCloverConfig()): CloverClient {
  return {
    config,
    async post<TResponse>(
      path: string,
      body: unknown,
      options?: { headers?: Record<string, string> },
    ): Promise<TResponse> {
      const response = await fetch(joinUrl(config.apiBaseUrl, path), {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${config.privateToken}`,
          "content-type": "application/json",
          "X-Clover-Merchant-Id": config.merchantId,
          ...options?.headers,
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const responseBody = await readResponseBody(response);

      if (!response.ok) {
        throw new CloverApiError(
          `Clover API request failed with status ${response.status}.`,
          response.status,
          responseBody,
        );
      }

      return responseBody as TResponse;
    },
  };
}
