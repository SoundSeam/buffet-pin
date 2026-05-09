"use client";

import { motion } from "framer-motion";
import { useTranslation } from "@/components/providers/language-provider";

export default function MenuHero() {
  const { copy } = useTranslation();

  return (
    <section className="pb-16 pt-32 lg:pb-24 lg:pt-40" style={{ background: "#041F18" }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <h1
            className="text-5xl font-bold leading-[0.92] tracking-tight sm:text-6xl lg:text-7xl"
            style={{ color: "#F4E8D2" }}
          >
            {copy.menu.heroTitleTop}
            <br />
            <span style={{ color: "#C9A56A" }}>{copy.menu.heroTitleBottom}</span>
          </h1>

          <p
            className="mt-8 max-w-2xl text-base font-light leading-relaxed lg:text-lg"
            style={{ color: "rgba(244,232,210,0.7)" }}
          >
            {copy.menu.heroDescription}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
