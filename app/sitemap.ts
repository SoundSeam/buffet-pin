import type { MetadataRoute } from "next";

import { getCanonicalUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: getCanonicalUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: getCanonicalUrl("/reservation"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: getCanonicalUrl("/drinks"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
