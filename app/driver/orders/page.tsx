import { getDriverSession } from "@/lib/driver-access";
import { redirect } from "next/navigation";

export default async function DriverOrdersRoutePage() {
  const driverSession = await getDriverSession();

  if (!driverSession) {
    redirect("/driver");
  }

  redirect("/driver/runs");
}
