"use client";

import { FaFacebookF, FaInstagram } from "react-icons/fa";
import { useTranslation } from "@/components/providers/language-provider";

const LOGO_HORIZONTAL =
  "https://soundseam-origin.s3.us-east-2.amazonaws.com/misc/Buffet+PIN-Logo+Square.png";

export default function Footer() {
  const { copy } = useTranslation();

  return (
    <footer style={{ background: "#041F18", borderTop: "1px solid rgba(201,165,106,0.15)" }}>
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
            <img src={LOGO_HORIZONTAL} alt="Buffet PIN" className="mb-4 h-28 w-auto lg:h-32" />
          </div>

          <div className="text-center sm:text-left">
            <h4 className="mb-5 text-sm font-semibold" style={{ color: "#C9A56A" }}>
              {copy.footer.socials}
            </h4>
            <div className="flex flex-col items-center gap-3 sm:items-start">
              {copy.footer.socialLinks.map((link) => {
                const Icon = link.label === "Facebook" ? FaFacebookF : FaInstagram;

                return (
                  <a
                    key={link.label}
                    href={link.href}
                    aria-label={link.ariaLabel}
                    className="inline-flex items-center gap-3 transition-all duration-300 hover:opacity-80"
                    style={{ color: "#C9A56A" }}
                  >
                    <Icon size={20} />
                    <span className="text-base" style={{ color: "rgba(244,232,210,0.65)" }}>
                      {link.label}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>

          <div className="text-center sm:text-left">
            <h4 className="mb-5 text-sm font-semibold" style={{ color: "#C9A56A" }}>
              {copy.footer.address}
            </h4>
            <div
              className="flex flex-col items-center gap-3 text-base sm:items-start"
              style={{ color: "rgba(244,232,210,0.65)" }}
            >
              {copy.footer.addressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>

          <div className="text-center sm:text-left">
            <h4 className="mb-5 text-sm font-semibold" style={{ color: "#C9A56A" }}>
              {copy.footer.contact}
            </h4>
            <div
              className="flex flex-col items-center gap-3 text-base sm:items-start"
              style={{ color: "rgba(244,232,210,0.65)" }}
            >
              {copy.footer.contactLinks.map((link) => (
                (() => {
                  const isExternal = "external" in link && link.external;

                  return (
                <a
                  key={link.label}
                  href={link.href}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  className="transition-all duration-300 hover:opacity-80"
                >
                  {link.label}
                </a>
                  );
                })()
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
