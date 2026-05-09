"use client";

import { CheckCircle, MapPin, Phone, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/components/providers/language-provider";

const CARD_ICONS = [CheckCircle, XCircle, MapPin, Phone];

export default function ReservationInfoCards() {
  const { copy } = useTranslation();

  return (
    <section
      className="py-16 lg:py-20"
      style={{
        background: "#062F24",
        borderTop: "1px solid rgba(201,165,106,0.1)",
        borderBottom: "1px solid rgba(201,165,106,0.1)",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-4">
          {copy.reservation.infoCards.map((card, i) => {
            const Icon = CARD_ICONS[i];

            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="px-4 text-center lg:border-r lg:last:border-r-0"
                style={{ borderColor: "rgba(201,165,106,0.1)" }}
              >
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border" style={{ borderColor: "rgba(201,165,106,0.3)" }}>
                  <Icon size={16} strokeWidth={1.5} style={{ color: "#C9A56A" }} />
                </div>
                <h3 className="mb-1 text-base font-semibold lg:text-lg" style={{ color: "#C9A56A" }}>
                  {card.title}
                </h3>
                <p className="text-xs font-light leading-relaxed lg:text-sm" style={{ color: "rgba(244,232,210,0.5)" }}>
                  {card.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
