import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getOwnerStatus } from "@/lib/auth/server";
import type { Database } from "@/lib/db/database.types";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/private"] as const;

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path);
}

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = "";

  const redirectResponse = NextResponse.redirect(redirectUrl);

  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }

  if (!supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable",
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const ownerStatus = await getOwnerStatus(supabase);
  const pathname = request.nextUrl.pathname;

  if (pathname === "/login") {
    if (ownerStatus.status === "owner") {
      return redirectWithCookies(request, response, "/");
    }

    return response;
  }

  if (pathname === "/private") {
    if (ownerStatus.status === "not_owner") {
      try {
        await supabase.auth.signOut();
      } catch {
        // Keep the private notice reachable if cookie clearing fails.
      }
    }

    return response;
  }

  if (isPublicPath(pathname)) {
    return response;
  }

  if (ownerStatus.status === "anonymous") {
    return redirectWithCookies(request, response, "/login");
  }

  if (ownerStatus.status === "not_owner") {
    try {
      await supabase.auth.signOut();
    } catch {
      // The redirect still denies access if cookie clearing fails.
    }

    return redirectWithCookies(request, response, "/private");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
