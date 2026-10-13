import { redirect } from "next/navigation";
import { z } from "zod";

import { setDriverSessionCookie, verifyDriverAccessToken } from "@/lib/driver-access";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  token: z.string().trim().min(1),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await params);

  if (!parsedParams.success) {
    redirect("/driver?error=invalid_link");
  }

  const driver = await verifyDriverAccessToken(parsedParams.data.token);

  if (!driver) {
    redirect("/driver?error=invalid_link");
  }

  await setDriverSessionCookie(driver.id);
  redirect("/driver/orders");
}
