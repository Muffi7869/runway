import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getOwnerStatus } from "@/lib/auth/server";
import { getRouteAction, skipsOwnerCheck } from "@/lib/auth/routing";
import type { Database } from "@/lib/db/database.types";

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
  const pathname = request.nextUrl.pathname;

  if (skipsOwnerCheck(pathname)) {
    return NextResponse.next({ request });
  }

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

  const action = getRouteAction(pathname, ownerStatus.status);

  if (action === "redirect_login") {
    return redirectWithCookies(request, response, "/login");
  }

  if (action === "redirect_root") {
    return redirectWithCookies(request, response, "/");
  }

  if (action === "sign_out_and_redirect_private") {
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
