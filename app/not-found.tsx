"use client";

import Link from "next/link";
import { useTranslation } from "@/components/providers/language-provider";

export default function NotFound() {
  const { copy } = useTranslation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#041F18] px-6 text-center">
      <div>
        <p className="text-sm font-semibold" style={{ color: "#C9A56A" }}>
          404
        </p>
        <h1 className="mt-4 text-5xl font-bold" style={{ color: "#F4E8D2" }}>
          {copy.notFound.title}
        </h1>
        <Link
          href="/"
          className="mt-8 inline-block rounded border px-8 py-3 text-sm font-semibold"
          style={{ borderColor: "rgba(201,165,106,0.5)", color: "#C9A56A" }}
        >
          {copy.notFound.cta}
        </Link>
      </div>
    </main>
  );
}
