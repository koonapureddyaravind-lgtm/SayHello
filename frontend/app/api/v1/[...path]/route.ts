import { NextResponse, type NextRequest } from "next/server";
import { backendBaseUrl } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated pass-through for `/api/v1/*`.
 *
 * Why this exists: Coolify (and most single-domain deployments) terminate TLS at
 * the frontend only. Provider callbacks such as the Meta WhatsApp webhook are
 * served by the Spring Boot API, so `/api/v1/webhooks/...` must reach the
 * backend through the same hostname. The request body is forwarded byte for
 * byte so the `X-Hub-Signature-256` HMAC can still be verified.
 *
 * Authentication is not bypassed: the backend still enforces JWT + tenant
 * guards on every non-public endpoint.
 */

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
  "content-length"
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

async function handle(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const params = await context.params;
  const segments = params.path ?? [];
  const target = `${backendBaseUrl()}/api/v1/${segments
    .map((segment) => encodeURIComponent(segment))
    .join("/")}${request.nextUrl.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });

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

  const responseBody = await upstream.arrayBuffer();
  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  return new NextResponse(responseBody, { status: upstream.status, headers: responseHeaders });
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
