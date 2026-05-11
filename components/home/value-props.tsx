"use client";

import { motion } from "framer-motion";
import { useTranslation } from "@/components/providers/language-provider";

const HOURS = [
  { dayKey: "monday", lunchHours: "11:30am - 2:30pm", lunchPrice: "$24.95", dinnerHours: "4:30pm - 9pm", dinnerPrice: "$33.95" },
  { dayKey: "tuesday", lunchHours: "11:30am - 2:30pm", lunchPrice: "$24.95", dinnerHours: "4:30pm - 9pm", dinnerPrice: "$33.95" },
  { dayKey: "wednesday", lunchHours: "11:30am - 2:30pm", lunchPrice: "$24.95", dinnerHours: "4:30pm - 9pm", dinnerPrice: "$33.95" },
  { dayKey: "thursday", lunchHours: "11:30am - 2:30pm", lunchPrice: "$24.95", dinnerHours: "4:30pm - 9pm", dinnerPrice: "$33.95" },
  { dayKey: "friday", lunchHours: "11:30am - 2:30pm", lunchPrice: "$26.95", dinnerHours: "4:30pm - 9pm", dinnerPrice: "$43.95" },
  { dayKey: "saturday", lunchHours: "11:30am - 2:30pm", lunchPrice: "$26.95", dinnerHours: "4:30pm - 9pm", dinnerPrice: "$43.95" },
  { dayKey: "sunday", lunchHours: "11:30am - 2:30pm", lunchPrice: "$26.95", dinnerHours: "4:30pm - 9pm", dinnerPrice: "$43.95" },
] as const;

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

const GOOGLE_MAPS_URL =
  "https://maps.app.goo.gl/9qoswmW14dh1AJVh7?g_st=ic";
const APPLE_MAPS_URL =
  "https://maps.apple.com/place?address=3-90%20Boul%20St-Jean-Baptiste,%20Ch%C3%A2teauguay%20QC%20J6K%203A6,%20Canada&coordinate=45.360646,-73.713994&name=Buffet%20Pin%20Chateauguay&map=explore";
const GOOGLE_MAPS_ICON =
  "https://soundseam-origin.s3.us-east-2.amazonaws.com/misc/Google_Maps_iOS_26.webp";
const APPLE_MAPS_ICON =
  "https://soundseam-origin.s3.us-east-2.amazonaws.com/misc/Apple_Maps_iOS_26_icon.png";

export default function LocationHours() {
  const { copy } = useTranslation();
  const locationCopy = copy.home.locationHours;
  const todayKey = DAY_KEYS[new Date().getDay()];

  return (
    <section id="infos" className="scroll-mt-24 bg-white py-24 lg:scroll-mt-28 lg:py-28">
      <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.82fr)_1px_minmax(0,1.18fr)] lg:gap-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:flex lg:min-h-full lg:flex-col lg:justify-center lg:pr-12"
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
                  {locationCopy.googleMaps}
                </a>
                <a
                  href={APPLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded border px-6 py-4 text-center text-sm font-semibold transition-all duration-300 hover:opacity-90"
                  style={{ background: "#062F24", borderColor: "#062F24", color: "#FFFFFF" }}
                >
                  <img src={APPLE_MAPS_ICON} alt="" className="h-5 w-5 rounded-sm object-cover" aria-hidden="true" />
                  {locationCopy.appleMaps}
                </a>
              </div>
            </div>
          </motion.div>
          <div
            aria-hidden="true"
            className="hidden lg:block"
            style={{ background: "transparent" }}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-4 border-t pt-6 lg:mt-0 lg:flex lg:min-h-full lg:flex-col lg:justify-center lg:border-t-0 lg:pl-12 lg:pt-0"
            style={{ borderColor: "transparent" }}
          >
            <div>
              <div
                className="mb-2 hidden grid-cols-[minmax(0,1.2fr)_minmax(9rem,0.9fr)_minmax(9rem,0.9fr)] gap-x-6 border-b pb-3 text-xs font-semibold uppercase lg:grid"
                style={{ borderColor: "rgba(6,47,36,0.12)", color: "rgba(6,47,36,0.45)" }}
              >
                <div>{locationCopy.tableHead.day}</div>
                <div>{locationCopy.tableHead.lunch}</div>
                <div>{locationCopy.tableHead.dinner}</div>
              </div>
              {HOURS.map((hours, index) => {
                const isToday = hours.dayKey === todayKey;
                const isLastRow = index === HOURS.length - 1;

                return (
                  <div
                    key={hours.dayKey}
                    className={`grid grid-cols-2 gap-x-6 gap-y-3 py-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(9rem,0.9fr)_minmax(9rem,0.9fr)] lg:gap-y-1 ${isLastRow ? "" : "border-b"} ${isToday ? "font-bold" : ""}`}
                    style={{
                      color: isToday ? "#062F24" : "rgba(6,47,36,0.68)",
                      borderColor: isLastRow ? "transparent" : "rgba(6,47,36,0.072)",
                    }}
                  >
                    <div className="text-base">
                      {locationCopy.days[hours.dayKey]}
                      {isToday ? (
                        <span
                          className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ background: "rgba(201,165,106,0.18)", color: "#C9A56A" }}
                        >
                          {locationCopy.today}
                        </span>
                      ) : null}
                    </div>
                    <div aria-hidden="true" className="lg:hidden" />
                    <div className="text-sm leading-relaxed">
                      <div>{hours.lunchHours}</div>
                      <div style={{ color: "rgba(6,47,36,0.52)" }}>{hours.lunchPrice}</div>
                    </div>
                    <div className="text-sm leading-relaxed">
                      <div>{hours.dinnerHours}</div>
                      <div style={{ color: "rgba(6,47,36,0.52)" }}>{hours.dinnerPrice}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
        <div
          className="mt-10 pt-2 lg:mt-12"
          style={{ color: "rgba(6,47,36,0.62)" }}
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.82fr)_1px_minmax(0,1.18fr)] lg:gap-0">
            <div className="lg:pr-12">
              <p className="text-xs font-semibold uppercase" style={{ color: "rgba(6,47,36,0.45)" }}>
                {locationCopy.notesEyebrow}
              </p>
              <div className="mt-2 space-y-1 text-sm leading-relaxed" style={{ color: "rgba(6,47,36,0.56)" }}>
                {locationCopy.notesDescription.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </div>
            <div
              aria-hidden="true"
              className="hidden lg:block"
              style={{ background: "transparent" }}
            />
            <div className="grid gap-0 lg:pl-12">
              {locationCopy.notes.map((note, index) => {
                const isLast = index === locationCopy.notes.length - 1;

                return (
                  <div
                    key={note.title}
                    className="grid gap-1 py-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(7rem,0.7fr)_minmax(7rem,0.7fr)] lg:gap-x-6"
                    style={{ borderBottom: isLast ? undefined : "1px solid rgba(6,47,36,0.08)" }}
                  >
                    <p className="text-xs font-semibold uppercase" style={{ color: "rgba(6,47,36,0.42)" }}>
                      {note.title}
                    </p>
                    <p className="text-sm leading-relaxed lg:col-span-3">{note.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
