import { NextResponse } from "next/server";
import type { AuthResponse, OrganizationSummary } from "@/lib/types";

export const ACCESS_COOKIE = "of_access";
export const REFRESH_COOKIE = "of_refresh";
// Org id is a non-secret identifier (membership is validated server-side), so the client
// can read it to render the active workspace. Access/refresh cookies stay HttpOnly.
export const ORG_COOKIE = "of_org";

export function backendBaseUrl(): string {
  const url = process.env.BACKEND_INTERNAL_URL ?? process.env.BACKEND_URL ?? "http://localhost:8080";
  return url.replace(/\/+$/, "");
}

function secureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}

export function applyAuthCookies(response: NextResponse, auth: AuthResponse): void {
  response.cookies.set(ACCESS_COOKIE, auth.accessToken, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60
  });
  response.cookies.set(REFRESH_COOKIE, auth.refreshToken, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  const firstOrganization = auth.organizations?.[0];
  if (firstOrganization) {
    response.cookies.set(ORG_COOKIE, firstOrganization.id, {
      httpOnly: false,
      secure: secureCookies(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
  }
}

export function setAccessCookies(response: NextResponse, accessToken: string, refreshToken?: string): void {
  response.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60
  });
  if (refreshToken) {
    response.cookies.set(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: secureCookies(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
  }
}

export function clearAuthCookies(response: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, ORG_COOKIE]) {
    response.cookies.set(name, "", { httpOnly: true, secure: secureCookies(), sameSite: "lax", path: "/", maxAge: 0 });
  }
}

export function setOrganizationCookie(response: NextResponse, organizationId: string): void {
  response.cookies.set(ORG_COOKIE, organizationId, {
    httpOnly: false,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

interface BackendEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: { code?: string; message?: string; details?: unknown } | null;
}

export async function parseBackendResponse<T>(response: Response): Promise<BackendEnvelope<T>> {
  try {
    return (await response.json()) as BackendEnvelope<T>;
  } catch {
    return { success: false, error: { code: "BAD_GATEWAY", message: `Upstream returned ${response.status}` } };
  }
}

export function upstreamError(response: Response, envelope: BackendEnvelope<unknown>): NextResponse {
  const status = response.status >= 400 && response.status < 600 ? response.status : 502;
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: {
        code: envelope.error?.code ?? "UPSTREAM_ERROR",
        message: envelope.error?.message ?? "The backend could not complete this request."
      },
      timestamp: new Date().toISOString()
    },
    { status }
  );
}

export function organizationIdOf(organization: OrganizationSummary): string {
  return organization.id;
}
