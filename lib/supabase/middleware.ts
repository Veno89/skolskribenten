import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildPath, sanitizeNextPath } from "@/lib/auth/redirects";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/config";

const PROTECTED_ROUTES = ["/skrivstation", "/installningar", "/konto"] as const;
const AUTH_ROUTES = ["/logga-in", "/registrera"] as const;

function applySecurityHeaders(response: NextResponse): NextResponse {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const scriptSrc = isDevelopment
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval';"
    : "script-src 'self' 'unsafe-inline';";
  const connectSrc = isDevelopment
    ? "connect-src 'self' ws: wss: https://*.supabase.co https://api.anthropic.com https://api.stripe.com;"
    : "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.stripe.com;";

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; ${scriptSrc} style-src 'self' 'unsafe-inline'; ${connectSrc}`,
  );

  return response;
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({
          request,
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
    return applySecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  if (isAuthRoute && user) {
    const redirectUrl = request.nextUrl.clone();
    const next = sanitizeNextPath(request.nextUrl.searchParams.get("next"));
    const normalized = new URL(next, request.url);
    redirectUrl.pathname = normalized.pathname;
    redirectUrl.search = normalized.search;
    return applySecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  return applySecurityHeaders(response);
}
