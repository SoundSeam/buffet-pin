import Link from "next/link";
import { FaFacebookF, FaInstagram } from "react-icons/fa";

const LOGO_HORIZONTAL =
  "https://soundseam-origin.s3.us-east-2.amazonaws.com/misc/Buffet+PIN-Logo+Square.png";

export default function Footer() {
  return (
    <footer style={{ background: "#041F18", borderTop: "1px solid rgba(201,165,106,0.15)" }}>
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
            <img src={LOGO_HORIZONTAL} alt="Buffet PIN" className="mb-4 h-28 w-auto lg:h-32" />
          </div>

          <div className="text-center sm:text-left">
            <h4 className="mb-5 text-sm font-semibold" style={{ color: "#C9A56A" }}>
              Socials
            </h4>
            <div className="flex flex-col items-center gap-3 sm:items-start">
              <a
                href="#"
                aria-label="Facebook"
                className="inline-flex items-center gap-3 transition-all duration-300 hover:opacity-80"
                style={{ color: "#C9A56A" }}
              >
                <FaFacebookF size={20} />
                <span className="text-base" style={{ color: "rgba(244,232,210,0.65)" }}>
                  Facebook
                </span>
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="inline-flex items-center gap-3 transition-all duration-300 hover:opacity-80"
                style={{ color: "#C9A56A" }}
              >
                <FaInstagram size={20} />
                <span className="text-base" style={{ color: "rgba(244,232,210,0.65)" }}>
                  Instagram
                </span>
              </a>
            </div>
          </div>

          <div className="text-center sm:text-left">
            <h4 className="mb-5 text-sm font-semibold" style={{ color: "#C9A56A" }}>
              Addresse
            </h4>
            <div
              className="flex flex-col items-center gap-3 text-base sm:items-start"
              style={{ color: "rgba(244,232,210,0.65)" }}
            >
              <p>90 Boul. Saint Jean Baptiste</p>
              <p>Chateauguay, QC J6K 3A6</p>
            </div>
          </div>

          <div className="text-center sm:text-left">
            <h4 className="mb-5 text-sm font-semibold" style={{ color: "#C9A56A" }}>
              Contact
            </h4>
            <div
              className="flex flex-col items-center gap-3 text-base sm:items-start"
              style={{ color: "rgba(244,232,210,0.65)" }}
            >
              <p>contact@buffetpin.ca</p>
              <p>(514) 123-4567</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
