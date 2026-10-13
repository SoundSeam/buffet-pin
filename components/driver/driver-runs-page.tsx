"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPinned,
  Navigation,
  RefreshCw,
  Store,
} from "lucide-react";

import { useRealtimeInvalidation } from "@/lib/realtime/use-realtime-invalidation";

type Stop = {
  id: string;
  orderId: string;
  position: number;
  status: string;
  arrivedAt: string | null;
  pickedUpAt: string | null;
  proof: null | {
    id: string;
    status: string;
    mimeType: string;
    byteSize: number;
    capturedAt: string;
    storedAt: string;
  };
  order: {
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    deliveryAddressLine1: string | null;
    deliveryAddressLine2: string | null;
    deliveryCity: string | null;
    deliveryPostalCode: string | null;
    deliveryInstructions: string | null;
    estimatedDeliveryEndAt: string | null;
  };
};

type Run = {
  id: string;
  runNumber: string;
  status: string;
  handedOffAt: string | null;
  pickedUpAt: string | null;
  stops: Stop[];
};

type Restaurant = {
  name: string;
  latitude: number | null;
  longitude: number | null;
};

function currentStop(run: Run) {
  return [...run.stops]
    .sort((a, b) => a.position - b.position)
    .find((stop) => ["PICKED_UP", "EN_ROUTE", "ARRIVED"].includes(stop.status));
}

function directionsUrl(stop: Stop) {
  const destination = [
    stop.order.deliveryAddressLine1,
    stop.order.deliveryAddressLine2,
    stop.order.deliveryCity,
    stop.order.deliveryPostalCode,
  ]
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

function returnUrl(restaurant: Restaurant | null) {
  if (!restaurant || restaurant.latitude === null || restaurant.longitude === null)
    return "https://www.google.com/maps/search/?api=1&query=Buffet+PIN";
  return `https://www.google.com/maps/dir/?api=1&destination=${restaurant.latitude},${restaurant.longitude}&travelmode=driving`;
}

function elapsed(from: string | null, now: number) {
  if (!from) return "0 min";
  const minutes = Math.max(0, Math.floor((now - new Date(from).getTime()) / 60_000));
  return `${minutes} min`;
}

async function compressedDataUrl(file: File) {
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The photo could not be read."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("The photo format is not supported."));
    element.src = original;
  });
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  const output = canvas.toDataURL("image/jpeg", 0.8);
  if (output.length > 7_000_000)
    throw new Error("The photo remains too large. Retake it at a lower resolution.");
  return output;
}

async function post(url: string, payload: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok || !body.ok)
    throw new Error(body.error?.message ?? body.error?.code ?? "Action failed.");
  return body.data;
}

export default function DriverRunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [driverName, setDriverName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoCapturedAt, setPhotoCapturedAt] = useState<string | null>(null);
  const [proofStored, setProofStored] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const response = await fetch("/api/driver/runs", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error("Driver access required.");
    setRuns(body.data.runs);
    setRestaurant(body.data.restaurant);
    setDriverName(body.data.driver.name);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load().catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Unable to load the run.");
      setLoading(false);
    });
  }, [load]);
  useRealtimeInvalidation({
    tokenRequest: { scope: "driver" },
    onInvalidate: () => void load(),
    fallbackIntervalMs: 7000,
  });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const run = runs[0] ?? null;
  const stop = useMemo(() => (run ? currentStop(run) : undefined), [run]);
  useEffect(() => {
    setPhoto(null);
    setPhotoCapturedAt(null);
    setProofStored(Boolean(stop?.proof?.status === "STORED"));
  }, [stop?.id, stop?.proof?.status]);

  const action = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4">
        <p className="flex items-center gap-3 font-semibold text-[#062F24]/65">
          <Loader2 className="animate-spin" size={20} /> Loading your run
        </p>
      </main>
    );

  if (!run || !stop)
    return (
      <main className="mx-auto min-h-[70vh] max-w-xl px-4 py-10">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#062F24]/50">
          {driverName || "Driver"}
        </p>
        <div className="mt-6 rounded-3xl border border-[#062F24]/10 bg-white p-7 shadow-sm">
          <Store className="h-10 w-10 text-[#062F24]" />
          <h1 className="mt-5 text-3xl font-black text-[#062F24]">
            Return to Buffet PIN
          </h1>
          <p className="mt-2 text-[#062F24]/65">
            There are no remaining delivery stops in your queue.
          </p>
          <a
            href={returnUrl(restaurant)}
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#062F24] px-5 text-lg font-extrabold text-white"
          >
            <Navigation size={20} /> Directions to restaurant
          </a>
        </div>
      </main>
    );

  const completeCount = run.stops.filter((entry) => entry.status === "DELIVERED").length;
  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:py-10">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#062F24]/50">
            {driverName} · {run.runNumber}
          </p>
          <h1 className="mt-1 text-3xl font-black text-[#062F24]">Current stop</h1>
        </div>
        <button
          type="button"
          aria-label="Refresh run"
          className="grid h-11 w-11 place-items-center rounded-full border border-[#062F24]/15 text-[#062F24]"
          onClick={() => void load()}
        >
          <RefreshCw size={18} />
        </button>
      </header>

      {error ? (
        <p className="mt-5 rounded-xl bg-red-50 p-4 font-semibold text-red-900" role="alert">
          {error}
        </p>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-3xl border border-[#062F24]/10 bg-white shadow-sm">
        <div className="bg-[#062F24] px-6 py-5 text-white">
          <p className="text-sm font-bold uppercase tracking-[0.1em] text-white/65">
            Stop {stop.position} of {run.stops.length} · {completeCount} complete
          </p>
          <h2 className="mt-2 text-3xl font-black">{stop.order.orderNumber}</h2>
          <p className="mt-2 text-lg font-semibold text-white/80">
            {stop.order.customerName}
          </p>
        </div>
        <div className="p-6">
          <p className="flex items-center gap-2 text-sm font-bold text-[#062F24]/65">
            <Clock3 size={17} /> {elapsed(run.handedOffAt ?? run.pickedUpAt, now)} since dispatch
          </p>
          <p className="mt-5 text-xl font-extrabold leading-snug text-[#062F24]">
            {[stop.order.deliveryAddressLine1, stop.order.deliveryAddressLine2, stop.order.deliveryCity, stop.order.deliveryPostalCode]
              .filter(Boolean)
              .join(", ")}
          </p>
          {stop.order.deliveryInstructions ? (
            <p className="mt-4 rounded-xl bg-amber-50 p-4 font-semibold text-amber-950">
              {stop.order.deliveryInstructions}
            </p>
          ) : null}
          <a
            href={directionsUrl(stop)}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#062F24] px-5 text-lg font-extrabold text-[#062F24]"
          >
            <Navigation size={20} /> Open directions
          </a>

          {stop.status !== "ARRIVED" ? (
            <button
              type="button"
              disabled={busy}
              className="mt-3 inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-xl bg-[#062F24] px-5 text-xl font-black text-white disabled:opacity-50"
              onClick={() =>
                void action(() =>
                  post(`/api/driver/runs/${run.id}/stops/${stop.orderId}`, {
                    action: "ARRIVED",
                  }),
                )
              }
            >
              {busy ? <Loader2 className="animate-spin" size={22} /> : <MapPinned size={22} />}
              I have arrived
            </button>
          ) : (
            <div className="mt-6 border-t border-[#062F24]/10 pt-6">
              <h3 className="text-xl font-black text-[#062F24]">Delivery photo</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#062F24]/60">
                Photograph the order at the drop-off location. Do not include people, faces, payment information, or the inside of a home.
              </p>
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="Delivery proof preview" className="mt-4 aspect-[4/3] w-full rounded-2xl object-cover" />
              ) : proofStored ? (
                <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 font-bold text-emerald-900">
                  <CheckCircle2 size={20} /> Delivery photo stored privately.
                </p>
              ) : null}
              <label className="mt-4 inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-[#062F24] px-5 text-lg font-extrabold text-[#062F24]">
                <Camera size={20} /> {photo ? "Retake photo" : "Take delivery photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setError("");
                    void compressedDataUrl(file)
                      .then((value) => {
                        setPhoto(value);
                        setPhotoCapturedAt(new Date().toISOString());
                        setProofStored(false);
                      })
                      .catch((caught) =>
                        setError(caught instanceof Error ? caught.message : "Photo failed."),
                      );
                  }}
                />
              </label>
              {photo && !proofStored ? (
                <button
                  type="button"
                  disabled={busy}
                  className="mt-3 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#062F24] px-5 text-lg font-extrabold text-white disabled:opacity-50"
                  onClick={() =>
                    void action(async () => {
                      await post(
                        `/api/driver/runs/${run.id}/stops/${stop.orderId}/proof`,
                        {
                          mimeType: "image/jpeg",
                          base64: photo,
                          capturedAt: photoCapturedAt,
                        },
                      );
                      setProofStored(true);
                    })
                  }
                >
                  {busy ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                  Store this photo
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy || !proofStored}
                className="mt-3 inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-xl font-black text-white disabled:opacity-40"
                onClick={() =>
                  void action(() =>
                    post(`/api/driver/runs/${run.id}/stops/${stop.orderId}`, {
                      action: "FINALIZE",
                    }),
                  )
                }
              >
                <CheckCircle2 size={23} /> Finalize delivery
              </button>
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-red-800 underline-offset-4 hover:underline disabled:opacity-50"
            onClick={() => {
              const reason = window.prompt("What prevents delivery?");
              if (!reason?.trim()) return;
              void action(() =>
                post(`/api/driver/runs/${run.id}/stops/${stop.orderId}`, {
                  action: "FAILED",
                  reason,
                }),
              );
            }}
          >
            <AlertTriangle size={17} /> Delivery exception
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#062F24]/10 bg-white p-5">
        <h2 className="text-sm font-black uppercase tracking-[0.1em] text-[#062F24]/50">
          Run queue
        </h2>
        <ol className="mt-3 space-y-2">
          {run.stops.map((entry) => (
            <li key={entry.id} className={`flex items-center justify-between rounded-xl px-3 py-3 text-sm font-bold ${entry.id === stop.id ? "bg-[#062F24] text-white" : "bg-[#062F24]/5 text-[#062F24]/65"}`}>
              <span>{entry.position}. {entry.order.orderNumber}</span>
              <span>{entry.status.toLowerCase().replaceAll("_", " ")}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
