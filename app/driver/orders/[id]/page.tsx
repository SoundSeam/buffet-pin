import { redirect } from "next/navigation";

import { getDriverSession } from "@/lib/driver-access";

export default async function DriverOrderDetailRoutePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const driverSession = await getDriverSession();

  if (!driverSession) {
    redirect("/driver");
  }

  void params;
  redirect("/driver/runs");
}
