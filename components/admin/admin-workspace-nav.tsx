import Link from "next/link";

export type AdminWorkspaceNavItem = {
  href: string;
  label: string;
  selected: boolean;
};

export default function AdminWorkspaceNav({
  label,
  items,
  secondary = false,
}: {
  label: string;
  items: AdminWorkspaceNavItem[];
  secondary?: boolean;
}) {
  return (
    <div
      className={
        secondary
          ? "border-b border-[#062F24]/10 bg-[rgba(6,47,36,0.025)]"
          : "border-b border-[#062F24]/10 bg-white"
      }
    >
      <div className="overflow-x-auto px-6 lg:px-8">
        <nav
          aria-label={label}
          data-admin-workspace-tabs
          className={`flex min-w-max items-end gap-6 ${secondary ? "pt-2" : "pt-4"}`}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.selected ? "page" : undefined}
              data-admin-workspace-tab
              className={`-mb-px inline-flex items-end border-b-[3px] px-1 pt-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062F24] focus-visible:ring-offset-2 ${
                secondary ? "min-h-11 pb-2" : "min-h-12 pb-3"
              } ${
                item.selected
                  ? "border-[#062F24] text-[#062F24]"
                  : "border-transparent text-[#062F24]/55 hover:border-[#062F24]/25 hover:text-[#062F24]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
