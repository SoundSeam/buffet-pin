"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslation } from "@/components/providers/language-provider";

const BUFFET_SPREAD =
  "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/f58978fdf_generated_8faba501.png";

export default function BuffetPreview() {
  const { copy } = useTranslation();
  const previewCopy = copy.reservation.preview;

  return (
    <section className="relative overflow-hidden py-20 lg:py-28" style={{ background: "#041F18" }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <img src={BUFFET_SPREAD} alt={previewCopy.imageAlt} className="w-full rounded" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <span className="text-sm font-semibold" style={{ color: "#C9A56A" }}>
              {previewCopy.eyebrow}
            </span>
            <h2 className="mt-4 text-5xl font-bold leading-[1.05] sm:text-6xl" style={{ color: "#F4E8D2" }}>
              {previewCopy.titleTop}
              <br />
              <span style={{ color: "#C9A56A" }}>{previewCopy.titleBottom}</span>
            </h2>
            <p className="mt-6 max-w-md text-lg font-light leading-relaxed" style={{ color: "rgba(244,232,210,0.6)" }}>
              {previewCopy.description}
            </p>
            <Link
              href="/menu"
              className="mt-8 inline-block rounded border px-8 py-3 text-sm font-semibold transition-all duration-300 hover:opacity-80"
              style={{ borderColor: "rgba(201,165,106,0.5)", color: "#C9A56A" }}
            >
              {previewCopy.cta}
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
