"use client";

import type { MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

type MenuItem = {
  name: string;
  description: string;
  price: string;
  img: string;
  tag?: "Signature" | "Populaire" | "Leger" | "Chef" | "A partager";
};

type MenuSection = {
  title: string;
  anchor: string;
  eyebrow: string;
  description: string;
  items: MenuItem[];
};

const MENU_SECTIONS: MenuSection[] = [
  {
    title: "Sushis & Froids",
    anchor: "sushis-froids",
    eyebrow: "Station fraicheur",
    description: "Rouleaux, nigiri et assiettes legeres pour ouvrir le parcours avec nettete et contraste.",
    items: [
      {
        name: "California rouleau",
        description: "Riz vinaigre, surimi, concombre et avocat dans une coupe simple et genereuse.",
        price: "$ --.--",
        img: "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/f58978fdf_generated_8faba501.png",
        tag: "Signature",
      },
      {
        name: "Saumon epice",
        description: "Pieces relevees, texture fondante et finition cremee pour un depart plus intense.",
        price: "$ --.--",
        img: "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/872a06ea3_generated_c0f1cb51.png",
        tag: "Populaire",
      },
      {
        name: "Nigiri crevette",
        description: "Bouchees classiques au riz presse, pensees pour equilibrer le reste de la table.",
        price: "$ --.--",
        img: "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/58249255b_generated_0f949410.png",
      },
      {
        name: "Salade d'algues",
        description: "Fraiche, saline et legere, avec une touche de sesame pour accompagner les plats chauds.",
        price: "$ --.--",
        img: "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/52f6f9e6a_generated_cb6366c6.png",
        tag: "Leger",
      },
    ],
  },
  {
    title: "Wok & Chauds",
    anchor: "wok-chauds",
    eyebrow: "Station minute",
    description: "Les preparations plus gourmandes du buffet, avec sauces brillantes, nouilles et riz sautes.",
    items: [
      {
        name: "Nouilles sautees",
        description: "Nouilles wok, legumes croquants et assaisonnement umami dans l'esprit des grands classiques maison.",
        price: "$ --.--",
        img: "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/52f6f9e6a_generated_cb6366c6.png",
        tag: "Signature",
      },
      {
        name: "Poulet general tao",
        description: "Poulet croustillant, sauce sucree-salee et finition brillante servie tres chaude.",
        price: "$ --.--",
        img: "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/872a06ea3_generated_c0f1cb51.png",
        tag: "Populaire",
      },
      {
        name: "Legumes croquants",
        description: "Melange de saison saute rapidement pour garder la texture et la couleur.",
        price: "$ --.--",
        img: "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/f58978fdf_generated_8faba501.png",
        tag: "Leger",
      },
      {
        name: "Riz frit maison",
        description: "Riz saute aux oeufs, petits legumes et touches savoureuses qui accompagnent presque tout.",
        price: "$ --.--",
        img: "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/58249255b_generated_0f949410.png",
      },
    ],
  },
  {
    title: "Grillades & Dim Sum",
    anchor: "grillades-dim-sum",
    eyebrow: "Station partage",
    description: "Brochettes, vapeurs et boucheries sauces dans un registre plus riche et convivial.",
    items: [
      {
        name: "Brochettes teriyaki",
        description: "Viandes laquees, cuisson marquee et sauce teriyaki pour une note plus fumee.",
        price: "$ --.--",
        img: "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/58249255b_generated_0f949410.png",
        tag: "Chef",
      },
      {
        name: "Raviolis vapeur",
        description: "Dim sum moelleux, servis chauds et parfaits a multiplier autour de la table.",
        price: "$ --.--",
        img: "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/52f6f9e6a_generated_cb6366c6.png",
        tag: "A partager",
      },
      {
        name: "Ailes croustillantes",
        description: "Peau doree, interieur juteux et assaisonnement franc pour les envies plus genereuses.",
        price: "$ --.--",
        img: "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/872a06ea3_generated_c0f1cb51.png",
      },
      {
        name: "Boeuf poivre noir",
        description: "Boeuf saute, oignons et sauce poivree qui apporte profondeur et chaleur.",
        price: "$ --.--",
        img: "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/58249255b_generated_0f949410.png",
        tag: "Populaire",
      },
    ],
  },
  {
    title: "Desserts & Breuvages",
    anchor: "desserts-breuvages",
    eyebrow: "Station finale",
    description: "Douceurs classiques et options plus legeres pour terminer le repas sans casser l'equilibre.",
    items: [
      {
        name: "Fruits frais",
        description: "Selection simple et nette pour finir sur une sensation plus legere.",
        price: "$ --.--",
        img: "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/f58978fdf_generated_8faba501.png",
        tag: "Leger",
      },
      {
        name: "Gateau mousse",
        description: "Dessert aerien au cacao, texture souple et finale plus gourmande.",
        price: "$ --.--",
        img: "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/872a06ea3_generated_c0f1cb51.png",
        tag: "Chef",
      },
      {
        name: "Perles de coco",
        description: "Bouchees moelleuses, douces et familiere dans l'esprit des comptoirs asiatiques.",
        price: "$ --.--",
        img: "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/52f6f9e6a_generated_cb6366c6.png",
      },
      {
        name: "The, cafe et boissons",
        description: "Breuvages chauds ou froids proposes selon le service et le moment de la journee.",
        price: "$ --.--",
        img: "https://media.base44.com/images/public/69ef9f21768de8fe150ac337/f58978fdf_generated_8faba501.png",
      },
    ],
  },
];

export default function MenuSections() {
  const [activeAnchor, setActiveAnchor] = useState(MENU_SECTIONS[0].anchor);
  const scrollLockRef = useRef<string | null>(null);
  const scrollLockTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const sectionElements = MENU_SECTIONS.map(({ anchor }) => document.getElementById(anchor)).filter(
      (element): element is HTMLElement => element !== null,
    );

    const clearScrollLock = () => {
      scrollLockRef.current = null;

      if (scrollLockTimeoutRef.current !== null) {
        window.clearTimeout(scrollLockTimeoutRef.current);
        scrollLockTimeoutRef.current = null;
      }
    };

    const syncFromHash = () => {
      const currentHash = window.location.hash.replace("#", "");

      if (MENU_SECTIONS.some(({ anchor }) => anchor === currentHash)) {
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
  }, []);

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
          MENU
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed sm:text-base" style={{ color: "rgba(244,232,210,0.66)" }}>
          Un apercu simple de nos principales stations et incontournables du buffet.
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
              {MENU_SECTIONS.map((section) => {
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
          {MENU_SECTIONS.map((section, sectionIndex) => {
            return (
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
            );
          })}
        </div>

      </div>
    </section>
  );
}
