"use client";

import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";

type ModalShellProps = {
  labelledBy: string;
  children: ReactNode;
  panelClassName?: string;
  onClose: () => void;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function ModalShell({
  labelledBy,
  children,
  panelClassName = "",
  onClose,
}: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.classList.add("modal-scroll-lock");

    const focusable = panelRef.current?.querySelector<HTMLElement>(focusableSelector);
    (focusable ?? panelRef.current)?.focus();

    return () => {
      document.body.classList.remove("modal-scroll-lock");
      previousFocusRef.current?.focus();
    };
  }, []);

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    ).filter((element) => !element.hasAttribute("disabled"));

    if (!focusable.length) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#041F18]/75 px-4 py-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`modal-panel max-h-[92vh] w-full overflow-y-auto rounded-surface-lg bg-[#F8F5EE] p-6 shadow-2xl ${panelClassName}`}
        onKeyDown={trapFocus}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
