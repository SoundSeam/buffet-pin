"use client";

import { useTranslation } from "@/components/providers/language-provider";

export default function ReservationCallMessage() {
  const { copy } = useTranslation();

  return (
    <section className="flex min-h-[80svh] flex-col items-center justify-center gap-6 bg-[#F4E8D2] px-6 pb-20 pt-36 text-center text-[#062F24]">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
        {copy.reservation.callToReserve}
      </h1>
      <a
        href="tel:+14506998088"
        className="rounded-button text-3xl font-semibold underline decoration-[#C9A56A] underline-offset-8 transition-opacity hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-[#062F24] sm:text-5xl"
      >
        (450) 699-8088
      </a>
    </section>
  );
}
