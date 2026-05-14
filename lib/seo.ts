import type { Metadata } from "next";

import { getAppUrl } from "@/lib/env";

export const SITE_NAME = "Buffet Pin";
export const SITE_URL = getAppUrl();
export const DEFAULT_OG_IMAGE = `${SITE_URL}/android-chrome-512x512.png`;

export const RESTAURANT_ADDRESS = {
  streetAddress: "90 Boulevard Saint Jean Baptiste #3",
  addressLocality: "Chateauguay",
  addressRegion: "QC",
  postalCode: "J6K 3A6",
  addressCountry: "CA",
} as const;

export const RESTAURANT_PHONE = "+14506998088";
export const RESTAURANT_EMAIL = "info@buffetpin.com";
export const RESTAURANT_PRICE_RANGE = "$$";
export const RESTAURANT_CUISINES = [
  "Asian Cuisine",
  "Chinese Cuisine",
  "Japanese Cuisine",
  "Sushi",
] as const;

export const RESTAURANT_OPENING_HOURS = [
  {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday"],
    opens: "11:30",
    closes: "14:30",
  },
  {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday"],
    opens: "16:30",
    closes: "21:00",
  },
  {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Friday", "Saturday", "Sunday"],
    opens: "11:30",
    closes: "14:30",
  },
  {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Friday", "Saturday", "Sunday"],
    opens: "16:30",
    closes: "21:00",
  },
] as const;

export function getCanonicalUrl(pathname: string): string {
  return new URL(pathname, SITE_URL).toString();
}

type PageMetadataInput = {
  title: string;
  description: string;
  pathname: string;
  image?: string;
};

export function buildPageMetadata({
  title,
  description,
  pathname,
  image = DEFAULT_OG_IMAGE,
}: PageMetadataInput): Metadata {
  const canonical = getCanonicalUrl(pathname);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      locale: "fr_CA",
      url: canonical,
      siteName: SITE_NAME,
      title,
      description,
      images: [
        {
          url: image,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export const PRIVATE_ROBOTS_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};
