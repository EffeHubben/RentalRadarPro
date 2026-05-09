"use client";

import { motion, useReducedMotion } from "framer-motion";

type Direction = "left" | "right" | "up";

interface ScrollFeatureCardProps {
  title: string;
  body: string;
  direction?: Direction;
  index?: number;
}

const OFFSETS: Record<Direction, { x: number; y: number }> = {
  left: { x: -48, y: 0 },
  right: { x: 48, y: 0 },
  up: { x: 0, y: 40 },
};

export function ScrollFeatureCard({
  title,
  body,
  direction = "up",
  index = 0,
}: ScrollFeatureCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const offset = OFFSETS[direction];

  return (
    <motion.article
      initial={shouldReduceMotion ? false : { opacity: 0, x: offset.x, y: offset.y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{
        duration: 0.6,
        delay: index * 0.06,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="flex h-full gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <div
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-teal)]"
        aria-hidden
      />
      <div>
        <h3 className="font-semibold text-[var(--color-text)]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{body}</p>
      </div>
    </motion.article>
  );
}
