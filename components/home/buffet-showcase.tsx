"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslation } from "@/components/providers/language-provider";

export default function BuffetShowcase() {
  const { copy } = useTranslation();
  const dishes = copy.home.buffetShowcase.dishes;
  const [activeIndex, setActiveIndex] = useState(Math.floor(dishes.length / 2));

  const slides = useMemo(
    () =>
      dishes.map((dish, index) => {
        const rawOffset = index - activeIndex;
        const offset =
          rawOffset > dishes.length / 2
            ? rawOffset - dishes.length
            : rawOffset < -dishes.length / 2
              ? rawOffset + dishes.length
              : rawOffset;
        const isActive = offset === 0;

        return {
          ...dish,
          index,
          offset,
          isActive,
        };
      }),
    [activeIndex, dishes],
  );

  const goPrevious = () => {
    setActiveIndex((current) => (current === 0 ? dishes.length - 1 : current - 1));
  };

  const goNext = () => {
    setActiveIndex((current) => (current === dishes.length - 1 ? 0 : current + 1));
  };

  return (
    <section id="buffet" className="relative overflow-hidden py-24 lg:py-32" style={{ background: "#041F18" }}>
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="mt-4 text-[2.15rem] font-bold leading-[1.05] sm:text-6xl lg:text-7xl" style={{ color: "#F4E8D2" }}>
            <span className="block text-balance sm:whitespace-nowrap">{copy.home.buffetShowcase.titleTop}</span>
            <span className="block text-balance sm:whitespace-nowrap" style={{ color: "#C9A56A" }}>
              {copy.home.buffetShowcase.titleBottom}
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-light leading-relaxed" style={{ color: "rgba(244,232,210,0.6)" }}>
            {copy.home.buffetShowcase.description}
          </p>
        </motion.div>

        <div className="mt-14 pb-8">
          <div className="relative mx-auto flex h-[19rem] w-full max-w-[22rem] items-center justify-center overflow-hidden px-0 sm:h-[22rem] sm:max-w-[72rem] sm:overflow-visible sm:px-0 lg:h-[24rem]">
            <button
              type="button"
              onClick={goPrevious}
              className="absolute left-0 top-1/2 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-icon border transition-colors duration-300 hover:bg-[#C9A56A]/10 sm:left-3 sm:h-16 sm:w-16 lg:left-4 lg:h-20 lg:w-20"
              style={{ borderColor: "rgba(201,165,106,0.32)", color: "#C9A56A", background: "rgba(5,20,15,0.88)" }}
              aria-label={copy.home.buffetShowcase.previousDish}
            >
              <ArrowLeft size={24} className="sm:h-9 sm:w-9 lg:h-10 lg:w-10" />
            </button>

            {slides.map((dish) => {
              const distance = Math.abs(dish.offset);
              const translate = `calc(-50% + (${dish.offset} * clamp(4.75rem, 18vw, 14.75rem)))`;
              const scale = dish.isActive ? 1 : distance === 1 ? 0.82 : 0.72;
              const opacity = distance > 2 ? 0 : dish.isActive ? 1 : distance === 1 ? 0.5 : 0.16;
              const zIndex = dish.isActive ? 30 : 20 - Math.abs(dish.offset);

              return (
                <motion.button
                  key={dish.name}
                  type="button"
                  initial={false}
                  animate={{
                    x: translate,
                    scale,
                    opacity,
                  }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => setActiveIndex(dish.index)}
                  className="absolute left-1/2 top-0 h-full w-[min(13.5rem,calc(100vw-7rem))] overflow-hidden rounded-surface border text-left shadow-[0_20px_48px_rgba(0,0,0,0.35)] sm:w-[15.5rem] lg:w-[17.25rem]"
                  style={{
                    zIndex,
                    borderColor: dish.isActive ? "rgba(201,165,106,0.45)" : "rgba(201,165,106,0.14)",
                    background: dish.isActive ? "#05140F" : "rgba(5,20,15,0.88)",
                    pointerEvents: distance > 1 ? "none" : "auto",
                  }}
                  aria-pressed={dish.isActive}
                >
                  <div className="flex h-full flex-col">
                    <div className="h-[56%] w-full overflow-hidden border-b border-[#F4E8D2]/10 bg-[#0A0A0A]">
                      <img src={dish.img} alt={dish.name} className="h-full w-full object-cover" />
                    </div>

                    <div className="flex flex-1 flex-col justify-center space-y-2 px-3 py-4 text-center sm:space-y-3 sm:px-5 sm:py-5">
                      <h3
                        className="mx-auto max-w-[10rem] text-balance text-[0.84rem] font-semibold leading-tight tracking-[-0.02em] sm:max-w-none sm:whitespace-nowrap sm:text-[1.3rem] sm:leading-none lg:text-[1.45rem]"
                        style={{ color: "#F4E8D2" }}
                      >
                        {dish.name}
                      </h3>
                      <p
                        className="mx-auto max-w-[9.1rem] text-[0.72rem] font-light leading-[1.45] sm:max-w-[12.25rem] sm:text-[0.9rem] sm:leading-[1.55]"
                        style={{
                          color: "rgba(244,232,210,0.68)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {dish.description}
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            })}

            <button
              type="button"
              onClick={goNext}
              className="absolute right-0 top-1/2 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-icon border transition-colors duration-300 hover:bg-[#C9A56A]/10 sm:right-3 sm:h-16 sm:w-16 lg:right-4 lg:h-20 lg:w-20"
              style={{ borderColor: "rgba(201,165,106,0.32)", color: "#C9A56A", background: "rgba(5,20,15,0.88)" }}
              aria-label={copy.home.buffetShowcase.nextDish}
            >
              <ArrowRight size={24} className="sm:h-9 sm:w-9 lg:h-10 lg:w-10" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
