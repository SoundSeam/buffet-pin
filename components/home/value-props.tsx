"use client";

import { motion } from "framer-motion";
import { GiAlarmClock, GiBabyFace, GiFamilyHouse, GiRecycle } from "react-icons/gi";
import { useTranslation } from "@/components/providers/language-provider";
import {
  AnimatedWords,
  blurItemVariants,
  staggerGroupVariants,
} from "@/components/home/smooth-reveal";

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
const NOTE_ICONS = [GiFamilyHouse, GiBabyFace, GiAlarmClock, GiRecycle] as const;

export default function LocationHours() {
  const { copy } = useTranslation();
  const locationCopy = copy.home.locationHours;
  const todayKey = DAY_KEYS[new Date().getDay()];

  return (
    <section id="infos" className="scroll-mt-24 bg-white py-24 lg:scroll-mt-28 lg:py-28">
      <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.82fr)_1px_minmax(0,1.18fr)] lg:gap-0">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerGroupVariants}
            className="lg:flex lg:min-h-full lg:flex-col lg:justify-center lg:pr-12"
          >
            <motion.div className="w-full" variants={staggerGroupVariants}>
              <AnimatedWords
                as="p"
                className="text-3xl font-bold lg:text-4xl"
                reveal="view"
                style={{ color: "#062F24" }}
                stagger={0.08}
                text="Buffet Pin"
              />
              <motion.p
                className="mt-1 text-base leading-relaxed"
                style={{ color: "rgba(6,47,36,0.72)" }}
                variants={blurItemVariants}
              >
                90 Boulevard Saint Jean Baptiste
                <br />
                Châteauguay, QC J6K 3A6
              </motion.p>
              <motion.div className="mt-6 flex flex-col gap-3" variants={staggerGroupVariants}>
                <motion.a
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-button px-6 py-4 text-center text-sm font-semibold transition-all duration-300 hover:opacity-90"
                  style={{ background: "#062F24", border: "1px solid #062F24", color: "#FFFFFF" }}
                  variants={blurItemVariants}
                >
                  <img src={GOOGLE_MAPS_ICON} alt="" className="h-5 w-5 rounded-icon object-cover" aria-hidden="true" />
                  <span>{locationCopy.googleMaps}</span>
                </motion.a>
                <motion.a
                  href={APPLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-button border px-6 py-4 text-center text-sm font-semibold transition-all duration-300 hover:opacity-90"
                  style={{ background: "#062F24", borderColor: "#062F24", color: "#FFFFFF" }}
                  variants={blurItemVariants}
                >
                  <img src={APPLE_MAPS_ICON} alt="" className="h-5 w-5 rounded-icon object-cover" aria-hidden="true" />
                  <span>{locationCopy.appleMaps}</span>
                </motion.a>
              </motion.div>
            </motion.div>
          </motion.div>
          <div
            aria-hidden="true"
            className="hidden lg:block"
            style={{ background: "transparent" }}
          />
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerGroupVariants}
            className="mt-4 border-t pt-6 lg:mt-0 lg:flex lg:min-h-full lg:flex-col lg:justify-center lg:border-t-0 lg:pl-12 lg:pt-0"
            style={{ borderColor: "transparent" }}
          >
            <motion.div variants={staggerGroupVariants}>
              <motion.div
                className="mb-2 hidden grid-cols-[minmax(0,1.2fr)_minmax(9rem,0.9fr)_minmax(9rem,0.9fr)] gap-x-6 border-b pb-3 text-xs font-semibold uppercase lg:grid"
                style={{ borderColor: "rgba(6,47,36,0.10)", color: "rgba(6,47,36,0.48)" }}
                variants={blurItemVariants}
              >
                <div>{locationCopy.tableHead.day}</div>
                <div>{locationCopy.tableHead.lunch}</div>
                <div>{locationCopy.tableHead.dinner}</div>
              </motion.div>
              {HOURS.map((hours, index) => {
                const isToday = hours.dayKey === todayKey;
                const isLastRow = index === HOURS.length - 1;

                return (
                  <motion.div
                    key={hours.dayKey}
                    className={`grid grid-cols-2 gap-x-6 gap-y-3 py-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(9rem,0.9fr)_minmax(9rem,0.9fr)] lg:gap-y-1 ${isLastRow ? "" : "border-b"} ${isToday ? "font-bold" : ""}`}
                    style={{
                      color: isToday ? "#062F24" : "rgba(6,47,36,0.72)",
                      borderColor: isLastRow ? "transparent" : "rgba(6,47,36,0.10)",
                    }}
                    variants={blurItemVariants}
                  >
                    <div className="text-base">
                      {locationCopy.days[hours.dayKey]}
                      {isToday ? (
                        <span
                          className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ background: "rgba(201,165,106,0.22)", color: "#062F24" }}
                        >
                          {locationCopy.today}
                        </span>
                      ) : null}
                    </div>
                    <div aria-hidden="true" className="lg:hidden" />
                    <div className="text-sm leading-relaxed">
                      <div>{hours.lunchHours}</div>
                      <div style={{ color: "rgba(6,47,36,0.56)" }}>{hours.lunchPrice}</div>
                    </div>
                    <div className="text-sm leading-relaxed">
                      <div>{hours.dinnerHours}</div>
                      <div style={{ color: "rgba(6,47,36,0.56)" }}>{hours.dinnerPrice}</div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        </div>
        <div
          className="mt-16 rounded-surface px-6 py-8 text-center lg:mt-24 lg:px-12 lg:py-10"
          style={{ background: "#062F24", color: "rgba(255,255,255,0.72)" }}
        >
          <div className="mx-auto max-w-3xl">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerGroupVariants}
            >
              <AnimatedWords
                as="p"
                className="text-base font-semibold uppercase lg:text-lg"
                reveal="view"
                style={{ color: "#FFFFFF" }}
                stagger={0.06}
                text={locationCopy.notesEyebrow}
              />
              <motion.div className="mt-2 space-y-1 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.56)" }} variants={blurItemVariants}>
                {locationCopy.notesDescription.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </motion.div>
            </motion.div>
          </div>
          <motion.div
            className="mt-8 grid grid-cols-2 gap-6 lg:mt-10 lg:grid-cols-4 lg:gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerGroupVariants}
          >
            {locationCopy.notes.map((note, index) => {
              const Icon = NOTE_ICONS[index % NOTE_ICONS.length];

              return (
                <motion.div
                  key={note.title}
                  className="flex min-h-48 flex-col items-center p-2 lg:min-h-56 lg:p-4"
                  variants={blurItemVariants}
                >
                  <Icon aria-hidden="true" className="h-12 w-12 lg:h-14 lg:w-14" style={{ color: "#C9A56A" }} />
                  <h3 className="mt-5 text-base font-bold leading-tight" style={{ color: "rgba(255,255,255,0.88)" }}>
                    {note.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>
                    {note.body}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
