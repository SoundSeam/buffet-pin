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

export default function CtaStrip() {
  const { copy } = useTranslation();

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: "#000000",
        borderBottom: "1px solid rgba(6,47,36,0.04)",
      }}
    >
      <motion.video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        initial={{ opacity: 0, scale: 1.03 }}
        whileInView={{ opacity: 0.78, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: smoothEase }}
        style={{
          filter: "brightness(0.58) saturate(0.9) contrast(1.08)",
        }}
      >
        <source
          src="https://soundseam-origin.s3.us-east-2.amazonaws.com/misc/BuffetPinReel.mp4"
          type="video/mp4"
        />
      </motion.video>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.35) 48%, rgba(0,0,0,0.38) 100%), radial-gradient(ellipse at center, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.28) 58%, rgba(0,0,0,0.44) 100%)",
        }}
      />
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerGroupVariants}
          className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-8 text-center"
        >
          <motion.div className="flex flex-col items-center" variants={staggerGroupVariants}>
            <AnimatedWords
              as="h2"
              className="text-4xl font-bold sm:text-5xl lg:text-6xl"
              reveal="view"
              style={{ color: "#F4E8D2" }}
              stagger={0.055}
              text={copy.home.ctaStrip.title}
            />
            <AnimatedWords
              as="p"
              className="mt-2 max-w-2xl text-base font-light"
              reveal="view"
              style={{ color: "rgba(244,232,210,0.78)" }}
              stagger={0.025}
              text={copy.home.ctaStrip.description}
            />
          </motion.div>

          <motion.div variants={blurItemVariants}>
            <Link
              href="/reservation"
              className="inline-flex items-center justify-center rounded-button px-10 py-4 text-base font-semibold transition-all duration-300 hover:opacity-90 sm:text-lg"
              style={{ background: "#C9A56A", color: "#062F24" }}
            >
              <AnimatedWords
                as="span"
                className="inline-flex"
                reveal="view"
                stagger={0.04}
                text={copy.home.ctaStrip.cta}
              />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
