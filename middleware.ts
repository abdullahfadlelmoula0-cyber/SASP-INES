import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js middleware — runs on every matched request.
 *
 * Responsibilities:
 * 1. Refresh the Supabase auth session (keeps tokens alive).
 * 2. Redirect unauthenticated users away from protected routes.
 * 3. Redirect authenticated users away from the login page.
 *
 * If Supabase env vars are not configured yet (e.g. during initial
 * setup), the middleware passes all requests through without error.
 */
export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If credentials are not configured yet, pass through all requests.
  // This allows the app to run in dev without a .env.local file set up.
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[]
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh session — do NOT remove this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/courses") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/announcements") ||
    pathname.startsWith("/graduation-project") ||
    pathname.startsWith("/supervision-requests") ||
    pathname.startsWith("/admin");

  // Unauthenticated user trying to access a protected page → redirect to login
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated user visiting login page → redirect to dashboard,
  // UNLESS the URL carries an ?error= param (e.g. missing_profile,
  // server_error). In those cases the user must see the error message —
  // redirecting back to /dashboard would create an infinite loop.
  if (user && isAuthRoute) {
    const hasError = request.nextUrl.searchParams.has("error");
    if (!hasError) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all routes EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
