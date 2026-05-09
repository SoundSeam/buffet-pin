"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslation } from "@/components/providers/language-provider";

export default function CtaStrip() {
  const { copy } = useTranslation();

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: "#FFFFFF",
        borderBottom: "1px solid rgba(6,47,36,0.04)",
      }}
    >
      <div
        className="grid grid-cols-2 lg:grid-cols-4"
      >
        {copy.home.ctaStrip.images.map((image, index) => (
          <motion.div
            key={image.src}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, delay: index * 0.08 }}
            className="relative h-28 overflow-hidden sm:h-32 lg:h-40"
            style={{ background: "#FFFFFF" }}
          >
            <img src={image.src} alt={image.alt} className="h-full w-full object-cover" />
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(6,47,36,0.18) 100%)" }}
            />
          </motion.div>
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-8 text-center"
        >
          <div className="flex flex-col items-center">
            <h2 className="text-4xl font-bold sm:text-5xl lg:text-6xl" style={{ color: "#062F24" }}>
              {copy.home.ctaStrip.title}
            </h2>
            <p className="mt-2 max-w-2xl text-base font-light" style={{ color: "rgba(6,47,36,0.62)" }}>
              {copy.home.ctaStrip.description}
            </p>
          </div>

          <Link
            href="/reservation"
            className="rounded px-10 py-4 text-base font-semibold transition-all duration-300 hover:opacity-90 sm:text-lg"
            style={{ background: "#C9A56A", color: "#062F24" }}
          >
            {copy.home.ctaStrip.cta}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
