"use client";

import type { MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "@/components/providers/language-provider";

export default function MenuSections() {
  const { copy } = useTranslation();
  const sections = copy.menu.sections;
  const [activeAnchor, setActiveAnchor] = useState<string>(sections[0].anchor);
  const scrollLockRef = useRef<string | null>(null);
  const scrollLockTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const sectionElements = sections
      .map(({ anchor }) => document.getElementById(anchor))
      .filter((element): element is HTMLElement => element !== null);

    const clearScrollLock = () => {
      scrollLockRef.current = null;

      if (scrollLockTimeoutRef.current !== null) {
        window.clearTimeout(scrollLockTimeoutRef.current);
        scrollLockTimeoutRef.current = null;
      }
    };

    const syncFromHash = () => {
      const currentHash = window.location.hash.replace("#", "");

      if (sections.some(({ anchor }) => anchor === currentHash)) {
        setActiveAnchor(currentHash);
      }
    };

    const releaseScrollLockIfSettled = () => {
      const lockedAnchor = scrollLockRef.current;
      if (!lockedAnchor) return;

      const targetElement = document.getElementById(lockedAnchor);
      if (!targetElement) {
        clearScrollLock();
        return;
      }

      const targetTop = targetElement.getBoundingClientRect().top;
      const expectedTop = Number.parseFloat(window.getComputedStyle(targetElement).scrollMarginTop || "0");

      if (Math.abs(targetTop - expectedTop) <= 8) {
        clearScrollLock();
      }
    };

    syncFromHash();

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollLockRef.current) {
          releaseScrollLockIfSettled();
          if (scrollLockRef.current) return;
        }

        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((entryA, entryB) => entryB.intersectionRatio - entryA.intersectionRatio);

        if (visibleEntries[0]) {
          setActiveAnchor(visibleEntries[0].target.id);
        }
      },
      {
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0.2, 0.35, 0.5, 0.7],
      },
    );

    sectionElements.forEach((element) => observer.observe(element));
    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener("scroll", releaseScrollLockIfSettled, { passive: true });

    return () => {
      clearScrollLock();
      observer.disconnect();
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("scroll", releaseScrollLockIfSettled);
    };
  }, [sections]);

  const handleCategoryClick = (event: MouseEvent<HTMLAnchorElement>, anchor: string) => {
    event.preventDefault();

    const targetElement = document.getElementById(anchor);
    if (!targetElement) return;

    scrollLockRef.current = anchor;
    setActiveAnchor(anchor);

    if (scrollLockTimeoutRef.current !== null) {
      window.clearTimeout(scrollLockTimeoutRef.current);
    }

    scrollLockTimeoutRef.current = window.setTimeout(() => {
      scrollLockRef.current = null;
      scrollLockTimeoutRef.current = null;
    }, 1800);

    window.history.pushState(null, "", `#${anchor}`);
    targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="relative pb-14 pt-28 lg:pb-20 lg:pt-32" style={{ background: "#041F18" }}>
      <div className="mx-auto mb-10 max-w-7xl px-6 lg:px-8">
        <h1 className="text-5xl font-bold leading-none tracking-tight sm:text-6xl lg:text-7xl" style={{ color: "#F4E8D2" }}>
          {copy.menu.title}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed sm:text-base" style={{ color: "rgba(244,232,210,0.66)" }}>
          {copy.menu.description}
        </p>
      </div>

      <div
        id="menu-categories"
        className="sticky top-20 z-30 mb-10 w-full lg:top-24"
      >
        <div
          className="h-14 w-full overflow-x-auto"
          style={{
            background: "#031912",
          }}
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex h-14 w-max min-w-full items-stretch gap-6">
              {sections.map((section) => {
                const isActive = activeAnchor === section.anchor;

                return (
                  <a
                    key={section.anchor}
                    href={`#${section.anchor}`}
                    onClick={(event) => handleCategoryClick(event, section.anchor)}
                    aria-current={isActive ? "true" : undefined}
                    className="inline-flex h-full shrink-0 items-center self-stretch border-b-2 px-0 text-xs font-medium transition-colors duration-300 sm:text-sm"
                    style={{
                      color: isActive ? "#F4E8D2" : "rgba(244,232,210,0.66)",
                      borderBottomColor: isActive ? "#C9A56A" : "transparent",
                    }}
                  >
                    <span className="relative top-[2px]">{section.title}</span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="space-y-14">
          {sections.map((section, sectionIndex) => (
            <motion.div
              key={section.anchor}
              id={section.anchor}
              className="scroll-mt-40 lg:scroll-mt-44"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, delay: sectionIndex * 0.04 }}
            >
              <h2
                className="text-2xl font-bold leading-none tracking-tight sm:text-3xl lg:text-4xl"
                style={{ color: "#F4E8D2" }}
              >
                {section.title}
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {section.items.map((item, itemIndex) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.4, delay: itemIndex * 0.04 }}
                    className="overflow-hidden rounded border shadow-[0_20px_48px_rgba(0,0,0,0.35)]"
                    style={{
                      borderColor: "rgba(201,165,106,0.45)",
                      background: "#05140F",
                    }}
                  >
                    <div className="flex min-h-[12rem] items-stretch">
                      <div className="relative w-[42%] shrink-0 self-stretch overflow-hidden border-r border-[#F4E8D2]/10 bg-[#0A0A0A]">
                        <img src={item.img} alt={item.name} className="absolute inset-0 block h-full w-full object-cover" />
                      </div>

                      <div className="flex flex-1 flex-col justify-start px-4 py-6 text-left sm:px-5 sm:py-7">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3
                                  className="text-balance text-[1.05rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[1.2rem] lg:text-[1.3rem]"
                                  style={{ color: "#F4E8D2" }}
                                >
                                  {item.name}
                                </h3>
                              </div>
                            </div>

                            <p
                              className="shrink-0 text-[0.72rem] font-semibold uppercase tracking-[0.18em] sm:text-xs"
                              style={{ color: "#C9A56A" }}
                            >
                              {item.price}
                            </p>
                          </div>

                          <p
                            className="max-w-[18rem] text-[0.8rem] font-light leading-[1.5] sm:text-[0.9rem] sm:leading-[1.55]"
                            style={{
                              color: "rgba(244,232,210,0.68)",
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
