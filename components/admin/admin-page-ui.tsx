import type { CSSProperties, ReactNode } from "react";

export const adminFieldClass =
  "w-full rounded-button border border-[rgba(6,47,36,0.14)] bg-white px-3 py-2.5 text-sm text-[#062F24] placeholder:text-[#062F24]/40 focus:outline-none focus-visible:outline-none focus-visible:outline-0 disabled:cursor-not-allowed disabled:opacity-50";

export const adminLabelClass =
  "text-xs font-bold uppercase tracking-[0.12em] text-[#062F24]/55";

export const adminButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-4 py-2.5 text-sm font-semibold transition-all duration-300 hover:opacity-90 focus-visible:outline-none focus-visible:outline-0 disabled:cursor-not-allowed disabled:opacity-50";

export const adminCompactButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-3 py-2 text-sm font-semibold transition-all duration-300 hover:opacity-90 focus-visible:outline-none focus-visible:outline-0 disabled:cursor-not-allowed disabled:opacity-50";

export const adminPrimaryButtonStyle: CSSProperties = {
  background: "#062F24",
  border: "1px solid #062F24",
  color: "#FFFFFF",
};

export const adminQuietButtonStyle: CSSProperties = {
  background: "rgba(6,47,36,0.05)",
  border: "1px solid rgba(6,47,36,0.12)",
  color: "#062F24",
};

export const adminDangerButtonStyle: CSSProperties = {
  background: "rgba(153,27,27,0.06)",
  border: "1px solid rgba(153,27,27,0.22)",
  color: "#991B1B",
};

type AdminPageProps = {
  children: ReactNode;
};

export function AdminPage({ children }: AdminPageProps) {
  return (
    <section className="min-h-full bg-white py-10 lg:py-12">
      <div className="w-full px-6 lg:px-8" data-admin-page-content>
        {children}
      </div>
    </section>
  );
}

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function AdminPageHeader({
  title,
  actions,
}: AdminPageHeaderProps) {
  return (
    <div
      className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"
      data-admin-page-header
    >
      <h1 className="text-3xl font-extrabold leading-none text-[#062F24]">
        {title}
      </h1>
      {actions ? (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </div>
  );
}

type AdminNoticeProps = {
  children: ReactNode;
  tone?: "error" | "success" | "warning" | "neutral";
  role?: "alert" | "status";
  className?: string;
};

const noticeClasses: Record<NonNullable<AdminNoticeProps["tone"]>, string> = {
  error: "border-red-900/20 bg-red-900/10 text-red-800",
  success: "border-emerald-900/20 bg-emerald-900/10 text-emerald-800",
  warning: "border-amber-900/20 bg-amber-50 text-amber-950",
  neutral: "border-[#062F24]/10 bg-[rgba(6,47,36,0.04)] text-[#062F24]",
};

export function AdminNotice({
  children,
  tone = "neutral",
  role = "status",
  className = "",
}: AdminNoticeProps) {
  return (
    <div
      className={`rounded-surface border p-4 text-sm leading-relaxed ${noticeClasses[tone]} ${className}`}
      role={role}
      aria-live="polite"
    >
      {children}
    </div>
  );
}

type AdminPanelProps = {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div";
};

export function AdminPanel({
  children,
  className = "",
  as = "section",
}: AdminPanelProps) {
  const Component = as;
  return (
    <Component
      className={`rounded-surface-lg border border-[#062F24]/10 bg-white p-5 text-[#062F24] shadow-sm sm:p-6 ${className}`}
    >
      {children}
    </Component>
  );
}

export function AdminSectionHeading({
  title,
  description,
  aside,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <h2 className="text-lg font-extrabold text-[#062F24]">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#062F24]/65">
            {description}
          </p>
        ) : null}
      </div>
      {aside ? (
        <div className="flex flex-wrap items-center gap-2">{aside}</div>
      ) : null}
    </div>
  );
}

export function AdminEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-surface border border-dashed border-[#062F24]/15 px-4 py-10 text-center text-sm font-semibold text-[#062F24]/45">
      {children}
    </div>
  );
}

export function AdminStatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-full border border-[#062F24]/10 bg-[rgba(6,47,36,0.05)] px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[#062F24]/65">
      {children}
    </span>
  );
}
