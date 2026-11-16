import { NextResponse } from "next/server";
import { applyAuthCookies, backendBaseUrl, parseBackendResponse } from "@/lib/server/backend";
import type { AuthResponse } from "@/lib/types";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendBaseUrl()}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });
  } catch {
    return NextResponse.json(
      { error: "Cannot reach the comGpt API. Is the backend running?" },
      { status: 502 }
    );
  }

  const envelope = await parseBackendResponse<AuthResponse>(upstream);
  if (!upstream.ok || !envelope.success || !envelope.data) {
    return NextResponse.json(
      { error: envelope.error?.message ?? "Unable to sign in with those credentials." },
      { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 }
    );
  }

  const response = NextResponse.json({
    user: envelope.data.user,
    organizations: envelope.data.organizations ?? []
  });
  applyAuthCookies(response, envelope.data);
  return response;
}
