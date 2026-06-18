"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslation } from "@/components/providers/language-provider";
import {
  AnimatedWords,
  blurItemVariants,
  smoothEase,
  staggerGroupVariants,
} from "@/components/home/smooth-reveal";

export default function HeroSection() {
  const { copy } = useTranslation();

  return (
    <motion.section
      className="relative flex min-h-[100svh] items-end overflow-hidden"
      style={{ background: "radial-gradient(ellipse at center, #000000 0%, #000000 40%, #000000 100%)" }}
      initial="hidden"
      animate="visible"
      variants={staggerGroupVariants}
    >
      <motion.video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        variants={{
          hidden: { opacity: 0, scale: 1.03 },
          visible: {
            opacity: 0.76,
            scale: 1,
            transition: { duration: 1.1, ease: smoothEase },
          },
        }}
        style={{
          filter: "brightness(0.55) saturate(0.82) contrast(1.08)",
          opacity: 0.76,
        }}
      >
        <source
          src="https://soundseam-origin.s3.us-east-2.amazonaws.com/misc/Buffet+Pin+Hero+Background+Final.mp4"
          type="video/mp4"
        />
      </motion.video>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.21) 30%, rgba(0,0,0,0.23) 68%, rgba(0,0,0,0.26) 100%), radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.19) 42%, rgba(0,0,0,0.24) 100%)",
        }}
      />
      <div className="absolute inset-0 bg-black/18" />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl justify-start px-6 pb-16 pt-28 sm:pb-24 sm:pt-36 lg:px-8 lg:pb-28 lg:pt-40">
        <div className="w-full max-w-4xl">
          <motion.div
            className="flex w-full flex-col items-start text-left"
            variants={staggerGroupVariants}
          >
            <AnimatedWords
              as="p"
              className="max-w-2xl text-xs font-semibold uppercase leading-5 text-[rgba(244,232,210,0.78)] sm:text-sm"
              reveal="mount"
              stagger={0.06}
              text={`${copy.home.hero.titleTop} ${copy.home.hero.titleBottom}`}
            />

            <AnimatedWords
              as="h1"
              className="mt-4 w-full text-[clamp(4.25rem,17vw,6.5rem)] font-bold leading-[0.86] tracking-tight sm:mt-5 sm:text-8xl lg:text-9xl"
              reveal="mount"
              style={{ color: "#F4E8D2" }}
              stagger={0.08}
              text={copy.home.hero.brand}
            />

            <AnimatedWords
              as="p"
              className="mt-5 max-w-lg px-2 text-sm font-light leading-6 text-[rgba(244,232,210,0.72)] sm:mt-6 sm:px-0 sm:text-[0.95rem] lg:text-base lg:leading-7"
              reveal="mount"
              stagger={0.018}
              text={copy.home.hero.description}
            />

            <motion.div
              className="mt-8 flex w-full max-w-sm flex-col justify-start gap-3 sm:mt-9 sm:max-w-none sm:flex-row sm:flex-wrap sm:gap-4"
              variants={staggerGroupVariants}
            >
              <motion.div variants={blurItemVariants} className="w-full sm:w-auto">
                <Link
                  href="#infos"
                  className="inline-flex w-full items-center justify-center rounded-button px-6 py-3.5 text-[0.95rem] font-semibold transition-all duration-300 hover:opacity-90 sm:w-auto sm:px-10 sm:py-4 sm:text-lg"
                  style={{ background: "#C9A56A", color: "#062F24" }}
                >
                  <AnimatedWords
                    as="span"
                    className="inline-flex"
                    reveal="mount"
                    stagger={0.04}
                    text={copy.home.hero.locationCta}
                  />
                </Link>
              </motion.div>
              <motion.div variants={blurItemVariants} className="w-full sm:w-auto">
                <Link
                  href="/reservation"
                  className="inline-flex w-full items-center justify-center rounded-button border px-6 py-3.5 text-[0.95rem] font-semibold transition-all duration-300 hover:opacity-90 sm:w-auto sm:px-10 sm:py-4 sm:text-lg"
                  style={{
                    background: "#F4E8D2",
                    borderColor: "#F4E8D2",
                    color: "#062F24",
                  }}
                >
                  <AnimatedWords
                    as="span"
                    className="inline-flex"
                    reveal="mount"
                    stagger={0.04}
                    text={copy.home.hero.reservationCta}
                  />
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
