import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  backendBaseUrl,
  parseBackendResponse,
  setOrganizationCookie
} from "@/lib/server/backend";
import type { MeResponse } from "@/lib/types";

export async function POST(request: Request) {
  let organizationId: string | undefined;
  try {
    const body = (await request.json()) as { organizationId?: string };
    organizationId = body.organizationId;
  } catch {
    organizationId = undefined;
  }

  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required." }, { status: 400 });
  }

  const accessToken = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACCESS_COOKIE}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const upstream = await fetch(`${backendBaseUrl()}/api/v1/auth/me`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${decodeURIComponent(accessToken)}` },
      cache: "no-store"
    });
    const envelope = await parseBackendResponse<MeResponse>(upstream);
    const memberships = envelope.data?.organizations ?? [];
    if (!upstream.ok || !envelope.success || !memberships.some((org) => org.id === organizationId)) {
      return NextResponse.json({ error: "You are not a member of that workspace." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Cannot verify workspace membership right now." }, { status: 502 });
  }

  const response = NextResponse.json({ success: true, organizationId });
  setOrganizationCookie(response, organizationId);
  return response;
}
