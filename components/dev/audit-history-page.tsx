import {
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
} from "@/components/admin/admin-page-ui";
import { db } from "@/lib/db";

export default async function AuditHistoryPage() {
  const events = await db.operationalAuditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <AdminPage>
      <AdminPageHeader
        title="Audit history"
        description="Who changed what, when, and why?"
      />
      <div className="mt-8 grid gap-3">
        {events.map((event) => (
          <AdminPanel key={event.id}>
            <div className="flex flex-col justify-between gap-2 sm:flex-row">
              <div>
                <h2 className="font-extrabold">
                  {event.eventType.replaceAll("_", " ").toLowerCase()}
                </h2>
                <p className="mt-1 text-sm text-[#062F24]/65">
                  {event.entityType} · {event.entityId}
                </p>
              </div>
              <time className="text-xs font-semibold text-[#062F24]/55">
                {event.createdAt.toLocaleString("en-CA")}
              </time>
            </div>
            <p className="mt-3 text-sm">
              {event.actorLabel ?? event.actorType}
              {event.reason ? ` — ${event.reason}` : ""}
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold">
                Technical details
              </summary>
              <pre className="mt-2 overflow-auto rounded-surface bg-[#062F24]/5 p-3 text-xs">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </details>
          </AdminPanel>
        ))}
      </div>
      {events.length === 0 ? (
        <div className="mt-8">
          <AdminEmptyState>No audit events have been recorded.</AdminEmptyState>
        </div>
      ) : null}
    </AdminPage>
  );
}
