"use client";

import { motion } from "framer-motion";

const HOURS = [
  { day: "Monday", open: "11:00", close: "21:00" },
  { day: "Tuesday", open: "11:00", close: "21:00" },
  { day: "Wednesday", open: "11:00", close: "21:00" },
  { day: "Thursday", open: "11:00", close: "21:00" },
  { day: "Friday", open: "11:00", close: "22:00" },
  { day: "Saturday", open: "10:00", close: "22:00" },
  { day: "Sunday", open: "10:00", close: "21:00" },
];

const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const GOOGLE_MAPS_URL =
  "https://www.google.com/maps/dir/?api=1&destination=90+Boulevard+Saint+Jean+Baptiste,+Châteauguay,+QC+J6K+3A6";
const APPLE_MAPS_URL =
  "https://maps.apple.com/?daddr=90+Boulevard+Saint+Jean+Baptiste,+Ch%C3%A2teauguay,+QC+J6K+3A6";
const GOOGLE_MAPS_ICON =
  "https://soundseam-origin.s3.us-east-2.amazonaws.com/misc/Google_Maps_iOS_26.webp";
const APPLE_MAPS_ICON =
  "https://soundseam-origin.s3.us-east-2.amazonaws.com/misc/Apple_Maps_iOS_26_icon.png";

export default function LocationHours() {
  return (
    <section id="infos" className="scroll-mt-24 bg-white py-24 lg:scroll-mt-28 lg:py-28">
      <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] lg:gap-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:flex lg:min-h-full lg:flex-col lg:justify-center lg:pr-16"
          >
            <div className="w-full">
              <p className="text-3xl font-bold lg:text-4xl" style={{ color: "#062F24" }}>
                Buffet Pin
              </p>
              <p className="mt-1 text-base leading-relaxed" style={{ color: "rgba(6,47,36,0.62)" }}>
                90 Boulevard Saint Jean Baptiste
                <br />
                Châteauguay, QC J6K 3A6
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <a
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded px-6 py-4 text-center text-sm font-semibold transition-all duration-300 hover:opacity-90"
                  style={{ background: "#062F24", border: "1px solid #062F24", color: "#FFFFFF" }}
                >
                  <img src={GOOGLE_MAPS_ICON} alt="" className="h-5 w-5 rounded-sm object-cover" aria-hidden="true" />
                  Open in Google Maps
                </a>
                <a
                  href={APPLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded border px-6 py-4 text-center text-sm font-semibold transition-all duration-300 hover:opacity-90"
                  style={{ background: "#062F24", borderColor: "#062F24", color: "#FFFFFF" }}
                >
                  <img src={APPLE_MAPS_ICON} alt="" className="h-5 w-5 rounded-sm object-cover" aria-hidden="true" />
                  Open in Apple Maps
                </a>
              </div>
            </div>
          </motion.div>
          <div
            aria-hidden="true"
            className="hidden lg:block"
            style={{ background: "rgba(6,47,36,0.12)" }}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-4 border-t pt-6 lg:mt-0 lg:flex lg:min-h-full lg:flex-col lg:justify-center lg:border-t-0 lg:pl-16 lg:pt-0"
            style={{ borderColor: "rgba(6,47,36,0.12)" }}
          >
            <div>
              {HOURS.map((h) => {
                const isToday = h.day === DAYS_EN[new Date().getDay()];
                return (
                  <div
                    key={h.day}
                    className={`flex items-center justify-between gap-6 ${isToday ? "font-bold" : ""}`}
                    style={{ color: isToday ? "#062F24" : "rgba(6,47,36,0.68)" }}
                  >
                    <div className="py-3 text-base">
                      {h.day}
                      {isToday && (
                        <span
                          className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ background: "rgba(201,165,106,0.18)", color: "#C9A56A" }}
                        >
                          Today
                        </span>
                      )}
                    </div>
                    <div className="py-3 text-base text-right">
                      {h.open} - {h.close}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
