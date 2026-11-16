import { NextResponse } from "next/server";
import { backendBaseUrl, clearAuthCookies, REFRESH_COOKIE } from "@/lib/server/backend";

export async function POST(request: Request) {
  const refreshToken = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REFRESH_COOKIE}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  if (refreshToken) {
    try {
      await fetch(`${backendBaseUrl()}/api/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refreshToken: decodeURIComponent(refreshToken) }),
        cache: "no-store"
      });
    } catch {
      // Best-effort revocation; local cookies are cleared regardless.
    }
  }

  const response = NextResponse.json({ success: true });
  clearAuthCookies(response);
  return response;
}
