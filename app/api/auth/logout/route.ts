import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isCrossSite } from "@/lib/same-origin";

export async function POST(req: NextRequest) {
  // SameSite=Lax already withholds the cookie from a cross-site POST, so the
  // destroy would be a no-op anyway — rejecting outright keeps the rule uniform
  // across both auth routes.
  if (isCrossSite(req)) {
    return NextResponse.json({ error: "cross-site request" }, { status: 403 });
  }
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
