import { NextResponse, type NextRequest } from "next/server";

export default async function proxy(request: NextRequest) {
  // The preview is synthetic and has no auth or database session.
  if (request.nextUrl.pathname === "/preview") return NextResponse.next();
  const { updateSession } = await import("@/lib/supabase/proxy");
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
