"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import type { Language } from "@/lib/i18n";

const sections = {
  nl: [
    {
      eyebrow: "Alles op één plek",
      title: "Honderden bronnen.\nEén helder overzicht.",
      body: "RentScout doorzoekt tientallen platforms tegelijk — geen tabs meer wisselen.",
    },
    {
      eyebrow: "Opslaan & vergelijken",
      title: "Sla op wat telt.\nVergelijk op jouw tempo.",
      body: "Bewaar woningen, voeg notities toe en volg de status op één plek.",
    },
    {
      eyebrow: "Altijd als eerste",
      title: "Geen woning\nmeer gemist.",
      body: "Stel je criteria in en ontvang een melding zodra een nieuwe match verschijnt.",
    },
  ],
  en: [
    {
      eyebrow: "Everything in one place",
      title: "Hundreds of sources.\nOne clear overview.",
      body: "RentScout scans dozens of platforms at once — no more tab-switching.",
    },
    {
      eyebrow: "Save & compare",
      title: "Save what matters.\nCompare at your pace.",
      body: "Bookmark listings, add notes, and track status all in one place.",
    },
    {
      eyebrow: "Always first",
      title: "Never miss\na listing again.",
      body: "Set your criteria and get notified the moment a new match appears.",
    },
  ],
};

export function ScrollVideoSection({ language }: { language: Language }) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const videoLightRef = useRef<HTMLVideoElement>(null);
  const videoDarkRef  = useRef<HTMLVideoElement>(null);
  const progress      = useMotionValue(0);
  const [isDark, setIsDark] = useState(false);

  // Track theme
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.dataset.theme === "dark");
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  // Force video load on mount (iOS ignores preload="auto")
  useEffect(() => {
    videoLightRef.current?.load();
    videoDarkRef.current?.load();
  }, []);

  // Scroll → video scrub (scroll + touchmove for iOS)
  useEffect(() => {
    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const absTop     = container.getBoundingClientRect().top + window.scrollY;
      const scrolled   = window.scrollY - absTop;
      const scrollable = container.offsetHeight - window.innerHeight;
      const p          = Math.max(0, Math.min(1, scrolled / scrollable));

      progress.set(p);

      const video = isDark ? videoDarkRef.current : videoLightRef.current;
      if (video && video.duration > 0) {
        try { video.currentTime = p * video.duration; } catch { /* iOS may throw */ }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("touchmove", handleScroll, { passive: true });
    setTimeout(handleScroll, 100);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("touchmove", handleScroll);
    };
  }, [progress, isDark]);

  const onMetadata = (ref: React.RefObject<HTMLVideoElement | null>) => () => {
    if (ref.current) ref.current.currentTime = 0.001;
  };

  const copy = sections[language] ?? sections.nl;

  // Text panel transitions
  const op0 = useTransform(progress, [0.00, 0.08, 0.26, 0.36], [0, 1, 1, 0]);
  const y0  = useTransform(progress, [0.00, 0.36], [32, -32]);
  const op1 = useTransform(progress, [0.30, 0.42, 0.58, 0.68], [0, 1, 1, 0]);
  const y1  = useTransform(progress, [0.30, 0.68], [32, -32]);
  const op2 = useTransform(progress, [0.63, 0.76, 0.93, 1.00], [0, 1, 1, 0]);
  const y2  = useTransform(progress, [0.63, 1.00], [32, -32]);
  const panels = [{ op: op0, y: y0 }, { op: op1, y: y1 }, { op: op2, y: y2 }];

  // Progress pills
  const pw0 = useTransform(progress, [0.00, 0.33], [20, 6]);
  const pw1 = useTransform(progress, [0.28, 0.50, 0.67], [6, 20, 6]);
  const pw2 = useTransform(progress, [0.62, 1.00], [6, 20]);

  return (
    <section ref={containerRef} className="relative h-[300vh]">
      {/* h-[100dvh] respects mobile browser chrome (address bar) */}
      <div className="sticky top-0 h-[100dvh] overflow-hidden bg-[var(--color-page)]">

        {/* Videos: cover on mobile (fills screen, no white bars), contain on sm+ */}
        <video
          ref={videoLightRef}
          className="hero-video-light absolute inset-0 h-full w-full object-cover sm:object-contain"
          src="/videos/clouds.white1.scrub.mp4"
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={onMetadata(videoLightRef)}
        />
        <video
          ref={videoDarkRef}
          className="hero-video-dark absolute inset-0 h-full w-full object-cover sm:object-contain"
          src="/videos/clouds.dark.scrub.mp4"
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={onMetadata(videoDarkRef)}
        />

        {/* Edge masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[18%] sm:w-[42%]"  style={{ background: "linear-gradient(to right, var(--color-page) 0%, var(--color-page) 30%, transparent)" }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-[18%] sm:w-[28%]" style={{ background: "linear-gradient(to left,  var(--color-page) 0%, var(--color-page) 20%, transparent)" }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[14%] sm:h-[20%]"   style={{ background: "linear-gradient(to bottom, var(--color-page), transparent)" }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[48%] sm:h-[38%]" style={{ background: "linear-gradient(to top, var(--color-page) 0%, var(--color-page) 16%, transparent)" }} />

        {/* Text panels */}
        {copy.map((section, i) => (
          <motion.div
            key={i}
            style={{ opacity: panels[i].op, y: panels[i].y }}
            className="pointer-events-none absolute bottom-[26%] left-4 right-4 z-10 rounded-2xl bg-[var(--color-page)]/75 px-4 py-4 text-left backdrop-blur-[3px] sm:bottom-[22%] sm:left-[7%] sm:right-auto sm:max-w-xs sm:rounded-none sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-strong)] sm:text-[11px]">
              {section.eyebrow}
            </p>
            <h2 className="mt-2.5 whitespace-pre-line text-[1.6rem] font-semibold leading-[1.1] tracking-[-0.01em] text-[var(--color-text)] sm:mt-3 sm:text-3xl sm:text-4xl">
              {section.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
              {section.body}
            </p>
          </motion.div>
        ))}

        {/* Progress pills */}
        <div className="absolute bottom-8 left-4 z-10 flex items-center gap-1.5 sm:bottom-7 sm:left-[7%]">
          {[pw0, pw1, pw2].map((w, i) => (
            <motion.div key={i} style={{ width: w }} className="h-1 rounded-full bg-[var(--color-accent)]" />
          ))}
        </div>
      </div>
    </section>
  );
}
