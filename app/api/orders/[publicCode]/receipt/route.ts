import { NextResponse } from "next/server";
import { getDigitalReceipt } from "@/lib/orders/receipt";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ publicCode: string }> }) {
  const receipt = await getDigitalReceipt((await params).publicCode);
  if (!receipt) return NextResponse.json({ ok: false, error: { code: "RECEIPT_NOT_FOUND" } }, { status: 404 });
  return NextResponse.json({ ok: true, data: { receipt } });
}
