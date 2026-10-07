import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { requireOwner } from "@/lib/auth/server";
import { encryptToken } from "@/lib/crypto/tokens";
import { createClient } from "@/lib/db/server";
import {
  statesMatch,
  verifyGoogleAccount,
} from "@/lib/google/oauth";
import {
  getGoogleCredentials,
  getPublicOrigin,
  GOOGLE_CALLBACK_PATH,
  GOOGLE_STATE_COOKIE,
} from "@/lib/google/request";
import { missingScopes } from "@/lib/google/scopes";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

type CallbackCode =
  | "connected"
  | "denied"
  | "error"
  | "no_refresh_token"
  | "missing_scopes"
  | "wrong_account";

function settingsRedirect(
  request: NextRequest,
  code: CallbackCode,
  missing?: string[],
) {
  const url = new URL("/settings", getPublicOrigin(request));
  url.searchParams.set("google", code);

  if (missing?.length) {
    url.searchParams.set("missing", missing.join(","));
  }

  return NextResponse.redirect(url);
}

async function revokeToken(refreshToken: string) {
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
    });
  } catch {
    // Revocation is best effort; the token is never saved on this path.
  }
}

export async function GET(request: NextRequest) {
  const user = await requireOwner();
  const cookieStore = await cookies();
  const storedState = cookieStore.get(GOOGLE_STATE_COOKIE)?.value;
  cookieStore.delete(GOOGLE_STATE_COOKIE);
  const params = request.nextUrl.searchParams;

  if (params.has("error")) {
    return settingsRedirect(request, "denied");
  }

  const code = params.get("code");
  const returnedState = params.get("state");

  if (!code || !statesMatch(returnedState, storedState)) {
    return settingsRedirect(request, "error");
  }

  const redirectUri = `${getPublicOrigin(request)}${GOOGLE_CALLBACK_PATH}`;
  let tokenResponse: Response;

  try {
    const { clientId, clientSecret } = getGoogleCredentials();
    tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
  } catch {
    return settingsRedirect(request, "error");
  }

  if (!tokenResponse.ok) {
    return settingsRedirect(request, "error");
  }

  let body: unknown;

  try {
    body = await tokenResponse.json();
  } catch {
    return settingsRedirect(request, "error");
  }

  const tokenResult =
    typeof body === "object" && body !== null
      ? (body as {
          access_token?: unknown;
          refresh_token?: unknown;
          scope?: unknown;
        })
      : {};
  const refreshToken = tokenResult.refresh_token;

  if (typeof refreshToken !== "string" || !refreshToken) {
    return settingsRedirect(request, "no_refresh_token");
  }

  const accountResult =
    typeof tokenResult.access_token === "string"
      ? await verifyGoogleAccount({
          accessToken: tokenResult.access_token,
          signedInEmail: user.email,
        })
      : "unverified";

  if (accountResult !== "match") {
    await revokeToken(refreshToken);
    return settingsRedirect(
      request,
      accountResult === "mismatch" ? "wrong_account" : "error",
    );
  }

  const grantedScopes =
    typeof tokenResult.scope === "string" ? tokenResult.scope : "";
  const missing = missingScopes(grantedScopes);
  let encryptedToken: string;

  try {
    encryptedToken = encryptToken(refreshToken);
  } catch {
    return settingsRedirect(request, "error");
  }

  const status = missing.length ? "needs_reconnect" : "connected";
  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("google_connection")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) {
    return settingsRedirect(request, "error");
  }

  const values = {
    refresh_token_encrypted: encryptedToken,
    granted_scopes: grantedScopes,
    status,
  };
  const saveResult = existing
    ? await supabase
        .from("google_connection")
        .update(values)
        .eq("user_id", user.id)
    : await supabase
        .from("google_connection")
        .insert({ ...values, user_id: user.id });

  if (saveResult.error) {
    return settingsRedirect(request, "error");
  }

  if (missing.length) {
    return settingsRedirect(
      request,
      "missing_scopes",
      missing.map((scope) => scope.slice(scope.lastIndexOf("auth/") + 5)),
    );
  }

  return settingsRedirect(request, "connected");
}
