import ManageReservationPage from "@/components/reservation/manage-reservation-page";
import SiteShell from "@/components/site-shell";

export default async function ShortManageReservationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <SiteShell>
      <ManageReservationPage token={token} />
    </SiteShell>
  );
}
