"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslation } from "@/components/providers/language-provider";

export default function HeroSection() {
  const { copy } = useTranslation();

  return (
    <section
      className="relative flex min-h-[100svh] items-center overflow-hidden"
      style={{ background: "radial-gradient(ellipse at center, #000000 0%, #000000 40%, #000000 100%)" }}
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
            "linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.21) 30%, rgba(0,0,0,0.23) 68%, rgba(0,0,0,0.26) 100%), radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.19) 42%, rgba(0,0,0,0.24) 100%)",
        }}
      />
      <div className="absolute inset-0 bg-black/18" />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl justify-center px-6 pb-16 pt-28 sm:pb-24 sm:pt-36 lg:px-8 lg:pb-28 lg:pt-40">
        <div className="w-full">
          <motion.div
            className="flex w-full flex-col items-center text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1
              className="w-full text-[clamp(3.15rem,14vw,4.5rem)] font-bold leading-[0.9] tracking-tight sm:text-6xl lg:text-7xl xl:text-[5.25rem]"
              style={{ color: "#F4E8D2" }}
            >
              {copy.home.hero.titleTop} {copy.home.hero.titleBottom}
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
