"use client";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { i18n } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

export default function AboutPage() {
  const { language, changeLanguage } = useLanguagePreference();
  const copy = i18n[language].aboutPage;

  return (
    <div className="min-h-screen bg-[#070a10] text-cream">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />
      <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">{copy.title}</h1>
          <p className="mt-5 text-lg leading-8 text-white/60">{copy.subtitle}</p>
        </section>

        <section className="mt-12 grid gap-5 md:grid-cols-2">
          {[
            [copy.whatTitle, copy.whatBody],
            [copy.audienceTitle, copy.audienceBody],
            [copy.sourcesTitle, copy.sourcesBody],
          ].map(([title, body]) => (
            <article key={title} className="rounded-xl border border-white/10 bg-white/[0.035] p-6">
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-white/58">{body}</p>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-xl border border-white/10 bg-black/18 p-6">
          <h2 className="text-lg font-semibold text-white">{copy.howTitle}</h2>
          <ol className="mt-5 grid gap-4 md:grid-cols-3">
            {copy.how.map((item, index) => (
              <li key={item} className="text-sm leading-6 text-white/58">
                <span className="mb-2 block text-xs font-semibold text-brass">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10 border-t border-white/8 pt-8">
          <h2 className="text-lg font-semibold text-white">{copy.contactTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-white/58">{copy.contactBody}</p>
        </section>
      </main>
      <SiteFooter language={language} />
    </div>
  );
}
