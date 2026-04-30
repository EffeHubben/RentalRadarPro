"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

type CinematicBackgroundProps = {
  className?: string;
  fixed?: boolean;
  intensity?: "hero" | "dashboard";
};

const heroParticles = [
  { left: "8%", top: "18%", size: 2, delay: 0, duration: 15 },
  { left: "11%", top: "88%", size: 1, delay: 2.6, duration: 23 },
  { left: "18%", top: "72%", size: 1, delay: 1.4, duration: 18 },
  { left: "28%", top: "12%", size: 1, delay: 2.8, duration: 16 },
  { left: "31%", top: "47%", size: 2, delay: 4.4, duration: 24 },
  { left: "38%", top: "84%", size: 2, delay: 0.8, duration: 20 },
  { left: "48%", top: "28%", size: 1, delay: 3.2, duration: 17 },
  { left: "57%", top: "64%", size: 1, delay: 1.9, duration: 19 },
  { left: "61%", top: "8%", size: 1, delay: 5.1, duration: 26 },
  { left: "66%", top: "16%", size: 2, delay: 0.5, duration: 21 },
  { left: "76%", top: "78%", size: 1, delay: 2.2, duration: 18 },
  { left: "84%", top: "34%", size: 1, delay: 3.8, duration: 16 },
  { left: "92%", top: "58%", size: 2, delay: 1.1, duration: 22 },
  { left: "14%", top: "42%", size: 1, delay: 4.1, duration: 20 },
  { left: "72%", top: "48%", size: 1, delay: 2.7, duration: 17 },
];

export function CinematicBackground({
  className = "",
  fixed = false,
  intensity = "hero",
}: CinematicBackgroundProps) {
  const shouldReduceMotion = useReducedMotion();
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const particles = useMemo(() => heroParticles, []);
  const isHero = intensity === "hero";
  const auroraOpacity = isHero ? "opacity-100" : "opacity-90";
  const overlayStrength = isHero
    ? "bg-[linear-gradient(180deg,rgba(2,6,23,0.08)_0%,rgba(2,6,23,0.30)_50%,rgba(2,6,23,0.72)_100%)]"
    : "bg-[linear-gradient(180deg,rgba(2,6,23,0.04)_0%,rgba(2,6,23,0.20)_48%,rgba(2,6,23,0.62)_100%)]";

  useEffect(() => {
    if (shouldReduceMotion || typeof window === "undefined") {
      return undefined;
    }

    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (!canHover) {
      return undefined;
    }

    function handlePointerMove(event: PointerEvent) {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;

      setPointer({ x, y });
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [shouldReduceMotion]);

  const parallax = shouldReduceMotion
    ? { x: 0, y: 0 }
    : { x: pointer.x * (isHero ? 18 : 10), y: pointer.y * (isHero ? 14 : 8) };

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none ${fixed ? "fixed" : "absolute"} inset-0 -z-10 overflow-hidden bg-ink ${className}`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#05070d_0%,#08111b_46%,#07080d_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-12%,rgba(56,189,248,0.26),transparent_34rem),radial-gradient(circle_at_10%_12%,rgba(20,184,166,0.22),transparent_28rem),radial-gradient(circle_at_84%_18%,rgba(244,63,94,0.16),transparent_24rem),radial-gradient(circle_at_52%_90%,rgba(14,165,233,0.18),transparent_30rem)]" />

      <motion.div
        className={`cinematic-aurora absolute left-1/2 top-[18vh] h-[22rem] w-[120vw] -translate-x-1/2 rotate-[-8deg] rounded-[999px] bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.20),rgba(45,212,191,0.17),rgba(244,63,94,0.09),transparent)] blur-3xl ${auroraOpacity}`}
        animate={
          shouldReduceMotion
            ? undefined
            : {
                x: ["-6%", "5%", "-2%", "-6%"],
                y: [0, 22, -12, 0],
                opacity: [0.58, 0.88, 0.68, 0.58],
              }
        }
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={`cinematic-aurora absolute left-[-18vw] top-[42vh] h-[20rem] w-[96vw] rotate-[12deg] rounded-[999px] bg-[linear-gradient(90deg,transparent,rgba(20,184,166,0.16),rgba(125,211,252,0.18),transparent)] blur-3xl ${auroraOpacity}`}
        animate={
          shouldReduceMotion
            ? undefined
            : {
                x: [0, 46, -18, 0],
                y: [0, -18, 18, 0],
                opacity: [0.46, 0.78, 0.52, 0.46],
              }
        }
        transition={{ duration: 31, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="cinematic-aurora absolute -left-[18vw] top-[6vh] h-[34rem] w-[58rem] rounded-full bg-cyan-400/24 blur-3xl"
        animate={
          shouldReduceMotion
            ? undefined
            : {
                x: [0, 58, 16, 0],
                y: [0, 34, -18, 0],
                rotate: [0, 8, -6, 0],
                scale: [1, 1.08, 0.98, 1],
              }
        }
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="cinematic-aurora absolute right-[-18vw] top-[10vh] h-[30rem] w-[48rem] rounded-full bg-teal-300/20 blur-3xl"
        animate={
          shouldReduceMotion
            ? undefined
            : {
                x: [0, -42, -10, 0],
                y: [0, -24, 28, 0],
                rotate: [0, -10, 6, 0],
                scale: [1, 0.96, 1.08, 1],
              }
        }
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="cinematic-aurora absolute bottom-[-22rem] left-[24vw] h-[34rem] w-[42rem] rounded-full bg-rose-500/16 blur-3xl"
        animate={
          shouldReduceMotion
            ? undefined
            : {
                x: [0, 24, -34, 0],
                y: [0, -28, -8, 0],
                scale: [1, 1.08, 1.02, 1],
              }
        }
        transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="absolute inset-[-10%] opacity-80"
        animate={parallax}
        transition={{ type: "spring", damping: 40, stiffness: 70, mass: 0.8 }}
      >
        <div className="absolute left-[9%] top-[22%] h-28 w-28 rounded-full border border-cyan-200/14 bg-cyan-200/10 blur-sm" />
        <div className="absolute right-[16%] top-[34%] h-44 w-44 rounded-full border border-teal-200/14 bg-teal-200/10 blur-md" />
        <div className="absolute bottom-[17%] left-[58%] h-24 w-24 rounded-full border border-rose-200/14 bg-rose-300/10 blur-sm" />
        <div className="absolute left-[42%] top-[12%] h-40 w-40 rounded-full border border-white/8 bg-white/[0.035] blur-md" />
      </motion.div>

      <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:84px_84px]" />
      <div className="absolute inset-0 opacity-[0.28] [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.18)_0_1px,transparent_1px)] [background-size:118px_118px]" />

      <div className="absolute inset-0">
        {particles.map((particle, index) => (
          <motion.span
            key={`${particle.left}-${particle.top}`}
            className="absolute rounded-full bg-white shadow-[0_0_18px_rgba(125,211,252,0.75)]"
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
            }}
            animate={
              shouldReduceMotion
                ? { opacity: 0.35 }
                : {
                    opacity: [0.18, 0.75, 0.24],
                    y: [0, -18, 0],
                    scale: [1, index % 3 === 0 ? 1.7 : 1.25, 1],
                  }
            }
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-[-9rem] h-80 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.22),rgba(13,148,136,0.10)_38%,transparent_68%)] blur-2xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,transparent_0%,rgba(2,6,23,0.10)_40%,rgba(2,6,23,0.62)_100%)]" />
      <div className={`absolute inset-0 ${overlayStrength}`} />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-ink to-transparent" />
    </div>
  );
}
