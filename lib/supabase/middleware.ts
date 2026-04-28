import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildPath, sanitizeNextPath } from "@/lib/auth/redirects";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/config";

const PROTECTED_ROUTES = ["/skrivstation", "/lektionsplanering", "/installningar", "/konto", "/admin"] as const;
const AUTH_ROUTES = ["/logga-in", "/registrera"] as const;
const CSP_NONCE_HEADER = "x-nonce";

function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function buildContentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const scriptSrc = isDevelopment
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' https://challenges.cloudflare.com;`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com;`;
  const connectSrc = isDevelopment
    ? "connect-src 'self' ws: wss: https://*.supabase.co https://api.anthropic.com https://api.stripe.com https://challenges.cloudflare.com;"
    : "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.stripe.com https://challenges.cloudflare.com;";
  const frameSrc = "frame-src 'self' https://challenges.cloudflare.com;";
  const assetSrc = "img-src 'self' data: blob:; font-src 'self' data:;";
  const objectSrc = isDevelopment ? "object-src 'self' data:;" : "object-src 'none';";
  const upgradeInsecureRequests = isDevelopment ? "" : "upgrade-insecure-requests;";

  return `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; ${scriptSrc} style-src 'self' 'unsafe-inline'; ${assetSrc} ${objectSrc} ${connectSrc} ${frameSrc} ${upgradeInsecureRequests}`.trim();
}

function applySecurityHeaders(response: NextResponse, enforcedCsp: string): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Content-Security-Policy", enforcedCsp);
  response.headers.set(
    "Content-Security-Policy-Report-Only",
    `${enforcedCsp} report-uri /api/csp-report;`,
  );

  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  return response;
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const nonce = generateCspNonce();
  const enforcedCsp = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  requestHeaders.set("Content-Security-Policy", enforcedCsp);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });

        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/logga-in";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return applySecurityHeaders(NextResponse.redirect(redirectUrl), enforcedCsp);
  }

  if (isAuthRoute && user) {
    const redirectUrl = request.nextUrl.clone();
    const next = sanitizeNextPath(request.nextUrl.searchParams.get("next"));
    const normalized = new URL(next, request.url);
    redirectUrl.pathname = normalized.pathname;
    redirectUrl.search = normalized.search;
    return applySecurityHeaders(NextResponse.redirect(redirectUrl), enforcedCsp);
  }

  return applySecurityHeaders(response, enforcedCsp);
}
