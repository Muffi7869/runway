import { NextResponse } from "next/server";

import { getOwnerStatus } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";

function redirectTo(requestUrl: URL, pathname: string) {
  return NextResponse.redirect(new URL(pathname, requestUrl.origin));
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return redirectTo(requestUrl, "/login?error=1");
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return redirectTo(requestUrl, "/login?error=1");
    }

    const ownerStatus = await getOwnerStatus(supabase);

    if (ownerStatus.status === "owner") {
      return redirectTo(requestUrl, "/");
    }

    if (ownerStatus.status === "not_owner") {
      try {
        await supabase.auth.signOut();
      } catch {
        // The fixed redirect still denies access if cookie clearing fails.
      }

      return redirectTo(requestUrl, "/private");
    }

    return redirectTo(requestUrl, "/login?error=1");
  } catch {
    return redirectTo(requestUrl, "/login?error=1");
  }
}
