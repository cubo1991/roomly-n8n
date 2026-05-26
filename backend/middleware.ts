import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard");
  const isApiProtected = req.nextUrl.pathname.startsWith("/api/v1");

  // Dashboard: redirect unauthenticated users to login
  if (isOnDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // API routes: require either session, X-N8N-Secret header, or _s query param
  if (isApiProtected && !isLoggedIn) {
    const headerSecret = req.headers.get("x-n8n-secret");
    const querySecret  = req.nextUrl.searchParams.get("_s");
    const secret = headerSecret ?? querySecret;
    if (secret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/v1/:path*"],
};
