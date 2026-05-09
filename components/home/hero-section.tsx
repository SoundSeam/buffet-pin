"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslation } from "@/components/providers/language-provider";

export default function HeroSection() {
  const { copy } = useTranslation();

  return (
    <section
      className="relative flex min-h-[100svh] items-center overflow-hidden"
      style={{ background: "radial-gradient(ellipse at center, #0D4B38 0%, #062F24 40%, #041F18 100%)" }}
    >
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        style={{
          filter: "brightness(0.55) saturate(0.82) contrast(1.08)",
          opacity: 0.76,
        }}
      >
        <source
          src="https://soundseam-origin.s3.us-east-2.amazonaws.com/misc/Buffet+Pin+Hero+Background+Final.mp4"
          type="video/mp4"
        />
      </video>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(4,31,24,0.35) 0%, rgba(6,47,36,0.34) 30%, rgba(6,47,36,0.36) 68%, rgba(4,31,24,0.39) 100%), radial-gradient(ellipse at center, rgba(13,75,56,0.17) 0%, rgba(6,47,36,0.31) 42%, rgba(4,31,24,0.38) 100%)",
        }}
      />
      <div className="absolute inset-0 bg-[#062F24]/30" />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl justify-center px-5 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-36 lg:px-8 lg:pb-28 lg:pt-40">
        <div className="w-full">
          <motion.div
            className="mx-auto flex max-w-4xl flex-col items-center text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="mb-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center sm:mb-6 sm:gap-x-3">
              <span
                className="text-sm font-semibold uppercase leading-none sm:text-base"
                style={{ color: "rgba(244,232,210,0.9)" }}
              >
                {copy.home.hero.brand}
              </span>
              <span
                className="text-sm font-medium uppercase leading-none sm:text-base"
                style={{ color: "#C9A56A" }}
              >
                {copy.home.hero.eyebrow}
              </span>
            </div>

            <h1 className="max-w-3xl" style={{ color: "#F4E8D2" }}>
              <span className="block text-[clamp(3.15rem,14vw,4.5rem)] font-bold leading-[0.9] tracking-tight sm:text-6xl lg:text-7xl xl:text-[5.25rem]">
                {copy.home.hero.titleTop}
              </span>
              <span
                className="mt-1 block text-[clamp(3.15rem,14vw,4.5rem)] font-bold leading-[0.9] tracking-tight sm:mt-2 sm:text-6xl lg:text-7xl xl:text-[5.25rem]"
                style={{ color: "#C9A56A" }}
              >
                {copy.home.hero.titleBottom}
              </span>
            </h1>

            <p className="mt-5 max-w-lg px-2 text-sm font-light leading-6 text-[rgba(244,232,210,0.72)] sm:mt-6 sm:px-0 sm:text-[0.95rem] lg:text-base lg:leading-7">
              {copy.home.hero.description}
            </p>

            <div className="mt-8 flex w-full max-w-sm flex-col justify-center gap-3 sm:mt-9 sm:max-w-none sm:flex-row sm:flex-wrap sm:gap-4">
              <Link
                href="#infos"
                className="w-full rounded px-6 py-3.5 text-[0.95rem] font-semibold transition-all duration-300 hover:opacity-90 sm:w-auto sm:px-10 sm:py-4 sm:text-lg"
                style={{ background: "#C9A56A", color: "#062F24" }}
              >
                {copy.home.hero.locationCta}
              </Link>
              <Link
                href="/reservation"
                className="w-full rounded border px-6 py-3.5 text-[0.95rem] font-semibold transition-all duration-300 hover:opacity-90 sm:w-auto sm:px-10 sm:py-4 sm:text-lg"
                style={{
                  background: "#F4E8D2",
                  borderColor: "#F4E8D2",
                  color: "#062F24",
                }}
              >
                {copy.home.hero.reservationCta}
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
