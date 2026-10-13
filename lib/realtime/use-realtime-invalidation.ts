"use client";

import { useEffect } from "react";

type TokenRequest =
  | { scope: "admin" }
  | { scope: "driver" }
  | { scope: "order"; credential: string };

type TokenResponse = {
  ok: boolean;
  data?: {
    channel: string;
    authorizationToken: string;
    httpUrl: string;
    realtimeUrl: string;
  };
};

function base64Url(value: object) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function useRealtimeInvalidation(input: {
  tokenRequest: TokenRequest;
  onInvalidate: () => void;
  fallbackIntervalMs: number;
  enabled?: boolean;
}) {
  const serializedRequest = JSON.stringify(input.tokenRequest);
  const { enabled = true, fallbackIntervalMs, onInvalidate } = input;

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let pollTimer: number | null = null;
    let watchdogTimer: number | null = null;
    let reconnectAttempt = 0;
    let pollDelay = fallbackIntervalMs;
    const realtimeEnabled = process.env.NEXT_PUBLIC_REALTIME_MODE === "appsync";

    const clearTimer = (timer: number | null) => { if (timer !== null) window.clearTimeout(timer); };
    const scheduleFallbackPoll = () => {
      clearTimer(pollTimer);
      if (disposed) return;
      pollTimer = window.setTimeout(() => {
        if (document.visibilityState === "visible") onInvalidate();
        pollDelay = Math.min(pollDelay * 2, 120_000);
        scheduleFallbackPoll();
      }, pollDelay);
    };

    const connect = async () => {
      if (disposed || !realtimeEnabled) return;
      try {
        const response = await fetch("/api/realtime/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: serializedRequest,
          cache: "no-store",
        });
        const token = (await response.json()) as TokenResponse;
        if (!response.ok || !token.ok || !token.data) throw new Error("Realtime authorization unavailable.");
        const authorization = { Authorization: token.data.authorizationToken };
        const connectionAuthorization = {
          ...authorization,
          host: new URL(token.data.httpUrl).host,
        };
        const ws = new WebSocket(token.data.realtimeUrl, [
          "aws-appsync-event-ws",
          `header-${base64Url(connectionAuthorization)}`,
        ]);
        socket = ws;
        ws.onopen = () => ws.send(JSON.stringify({ type: "connection_init" }));
        ws.onmessage = (message) => {
          const event = JSON.parse(String(message.data)) as { type?: string; connectionTimeoutMs?: number };
          if (event.type === "connection_ack") {
            reconnectAttempt = 0;
            pollDelay = fallbackIntervalMs;
            clearTimer(pollTimer);
            ws.send(JSON.stringify({
              type: "subscribe",
              id: "buffet-pin-updates",
              channel: token.data!.channel,
              authorization,
            }));
          } else if (event.type === "data") {
            onInvalidate();
          }
          clearTimer(watchdogTimer);
          watchdogTimer = window.setTimeout(() => ws.close(4000, "keepalive timeout"), event.connectionTimeoutMs ?? 310_000);
        };
        ws.onerror = () => ws.close();
        ws.onclose = () => {
          if (socket === ws) socket = null;
          clearTimer(watchdogTimer);
          scheduleFallbackPoll();
          if (!disposed) {
            const delay = Math.min(1000 * 2 ** reconnectAttempt, 30_000) * (0.8 + Math.random() * 0.4);
            reconnectAttempt += 1;
            reconnectTimer = window.setTimeout(() => void connect(), delay);
          }
        };
      } catch {
        scheduleFallbackPoll();
        if (!disposed) {
          const delay = Math.min(1000 * 2 ** reconnectAttempt, 30_000);
          reconnectAttempt += 1;
          reconnectTimer = window.setTimeout(() => void connect(), delay);
        }
      }
    };

    const visibility = () => {
      if (document.visibilityState === "visible") {
        onInvalidate();
        if (realtimeEnabled && !socket) void connect();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    if (realtimeEnabled) void connect();
    scheduleFallbackPoll();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", visibility);
      clearTimer(reconnectTimer);
      clearTimer(pollTimer);
      clearTimer(watchdogTimer);
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "unsubscribe", id: "buffet-pin-updates" }));
      socket?.close();
    };
  }, [enabled, fallbackIntervalMs, onInvalidate, serializedRequest]);
}
