"use client";
import { useTranslation } from "@/components/providers/language-provider";
import SiteShell from "@/components/site-shell";
export default function DrinksError({ reset }: { reset: () => void }) {
  const { language } = useTranslation();
  const fr = language === "fr";
  return <SiteShell theme="drinks"><div className="px-6 py-40 text-center text-white"><h1 className="text-3xl">{fr ? "La carte est momentanément indisponible." : "The menu is temporarily unavailable."}</h1><button onClick={reset} className="mt-6 rounded-full border border-white/40 px-6 py-3">{fr ? "Réessayer" : "Try again"}</button></div></SiteShell>;
}
