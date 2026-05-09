"use client";

import { UtensilsCrossed, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/components/providers/language-provider";

const DRAGON_ART =
  "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/592a4d97e_generated_fe5af11c.png";
const LOGO_SQUARE =
  "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/ee5d0e017_BuffetPIN-LogoSquare.png";
const LOGO_HORIZONTAL =
  "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/a673bd7ca_BuffetPIN-LogoHorizontal.png";

export default function ReservationHero() {
  const { copy } = useTranslation();
  const heroCopy = copy.reservation.hero;

  return (
    <section
      className="relative overflow-hidden pb-16 pt-32 lg:pb-24 lg:pt-40"
      style={{ background: "radial-gradient(ellipse at center, #0D4B38 0%, #062F24 40%, #041F18 100%)" }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
        <img
          src={DRAGON_ART}
          alt=""
          className="absolute left-1/4 top-1/2 w-[100%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
            <h1 style={{ color: "#F4E8D2" }}>
              <span className="block text-5xl font-bold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
                {heroCopy.titleTop}
              </span>
              <span
                className="mt-2 block text-5xl font-bold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl"
                style={{ color: "#C9A56A" }}
              >
                {heroCopy.titleBottom}
              </span>
            </h1>

            <p className="mt-8 max-w-md text-base font-light leading-relaxed" style={{ color: "rgba(244,232,210,0.6)" }}>
              {heroCopy.description}
            </p>

            <div className="mt-8 space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border" style={{ borderColor: "rgba(201,165,106,0.3)" }}>
                  <Users size={16} style={{ color: "#C9A56A" }} />
                </div>
                <div>
                  <h3 className="text-base font-semibold" style={{ color: "#C9A56A" }}>
                    {heroCopy.featureOneTitle}
                  </h3>
                  <p className="text-xs font-light" style={{ color: "rgba(244,232,210,0.5)" }}>
                    {heroCopy.featureOneDescription}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border" style={{ borderColor: "rgba(201,165,106,0.3)" }}>
                  <UtensilsCrossed size={16} style={{ color: "#C9A56A" }} />
                </div>
                <div>
                  <h3 className="text-base font-semibold" style={{ color: "#C9A56A" }}>
                    {heroCopy.featureTwoTitle}
                  </h3>
                  <p className="text-xs font-light" style={{ color: "rgba(244,232,210,0.5)" }}>
                    {heroCopy.featureTwoDescription}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden flex-col items-center justify-center gap-6 lg:flex"
          >
            <img src={LOGO_SQUARE} alt="Buffet PIN emblem" className="w-32 opacity-70" />
            <img src={LOGO_HORIZONTAL} alt="Buffet PIN" className="h-12 w-auto opacity-80" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
