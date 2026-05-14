import type { Metadata } from "next";

import { PRIVATE_ROBOTS_METADATA } from "@/lib/seo";

export const metadata: Metadata = PRIVATE_ROBOTS_METADATA;

export default function ManageShortLinkLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
