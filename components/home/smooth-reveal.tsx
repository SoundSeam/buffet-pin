"use client";

import { motion, type Variants } from "framer-motion";
import type { CSSProperties } from "react";

export const smoothEase = [0.22, 1, 0.36, 1] as const;

export const staggerGroupVariants: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

export const blurItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    filter: "blur(12px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.8,
      ease: smoothEase,
    },
  },
};

const wordVariants: Variants = {
  hidden: {
    opacity: 0,
    y: "0.55em",
    filter: "blur(10px)",
  },
  visible: {
    opacity: 1,
    y: "0em",
    filter: "blur(0px)",
    transition: {
      duration: 0.75,
      ease: smoothEase,
    },
  },
};

type AnimatedWordsProps = {
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className: string;
  reveal?: "inherit" | "mount" | "view";
  stagger?: number;
  style?: CSSProperties;
  text: string;
};

export function AnimatedWords({
  as = "p",
  className,
  reveal = "inherit",
  stagger = 0.06,
  style,
  text,
}: AnimatedWordsProps) {
  const words = text.trim().split(/\s+/);
  const Component =
    as === "h1"
      ? motion.h1
      : as === "h2"
        ? motion.h2
        : as === "h3"
          ? motion.h3
          : as === "span"
            ? motion.span
            : motion.p;
  const revealProps =
    reveal === "mount"
      ? { initial: "hidden" as const, animate: "visible" as const }
      : reveal === "view"
        ? {
            initial: "hidden" as const,
            whileInView: "visible" as const,
            viewport: { once: true },
          }
        : {};

  return (
    <Component
      className={className}
      style={style}
      {...revealProps}
      variants={{
        hidden: { opacity: 1 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: stagger,
          },
        },
      }}
    >
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          variants={wordVariants}
          className={`${index === words.length - 1 ? "" : "mr-[0.28em]"} inline-block will-change-transform`}
        >
          {word}
        </motion.span>
      ))}
    </Component>
  );
}
