import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  ORG_COOKIE,
  REFRESH_COOKIE,
  backendBaseUrl,
  setAccessCookies
} from "@/lib/server/backend";

export const dynamic = "force-dynamic";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "cookie",
  "authorization",
  "x-organization-id"
]);

const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "cache-control",
  "etag",
  "last-modified",
  "x-request-id"
];

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

async function refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string } | null> {
  try {
    const response = await fetch(`${backendBaseUrl()}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store"
    });
    if (!response.ok) return null;
    const envelope = (await response.json()) as {
      success?: boolean;
      data?: { accessToken?: string; refreshToken?: string };
    };
    if (!envelope.success || !envelope.data?.accessToken) return null;
    return { accessToken: envelope.data.accessToken, refreshToken: envelope.data.refreshToken };
  } catch {
    return null;
  }
}

function unavailable(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: {
        code: "BACKEND_UNAVAILABLE",
        message: "Cannot reach the comGpt API. Check that the backend service is running."
      },
      timestamp: new Date().toISOString()
    },
    { status: 502 }
  );
}

async function handle(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const params = await context.params;
  const segments = params.path ?? [];
  const search = request.nextUrl.search;
  const target = `${backendBaseUrl()}/api/v1/${segments.map((segment) => encodeURIComponent(segment)).join("/")}${search}`;

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const organizationId = request.cookies.get(ORG_COOKIE)?.value;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (organizationId) headers.set("X-Organization-Id", organizationId);

  const hasBody = !["GET", "HEAD"].includes(request.method.toUpperCase());
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      redirect: "manual"
    });
  } catch {
    return unavailable();
  }

  let refreshedRefreshToken: string | undefined;
  let rotatedAccessToken: string | undefined;

  if (upstream.status === 401 && refreshToken) {
    const refreshed = await refreshTokens(refreshToken);
    if (refreshed) {
      rotatedAccessToken = refreshed.accessToken;
      refreshedRefreshToken = refreshed.refreshToken;
      const retryHeaders = new Headers(headers);
      retryHeaders.set("Authorization", `Bearer ${refreshed.accessToken}`);
      try {
        upstream = await fetch(target, {
          method: request.method,
          headers: retryHeaders,
          body: body && body.byteLength > 0 ? body : undefined,
          cache: "no-store",
          redirect: "manual"
        });
      } catch {
        return unavailable();
      }
    }
  }

  if (upstream.status === 204 || request.method === "HEAD") {
    const empty = new NextResponse(null, { status: upstream.status });
    if (rotatedAccessToken) {
      setAccessCookies(empty, rotatedAccessToken, refreshedRefreshToken);
    }
    return empty;
  }

  const responseBody = await upstream.arrayBuffer();
  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  const response = new NextResponse(responseBody, { status: upstream.status, headers: responseHeaders });

  if (rotatedAccessToken) {
    setAccessCookies(response, rotatedAccessToken, refreshedRefreshToken);
  }

  return response;
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as HEAD,
  handle as OPTIONS
};
