import { randomBytes } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { requireOwner } from "@/lib/auth/server";
import { buildAuthUrl } from "@/lib/google/oauth";
import {
  getGoogleCredentials,
  getPublicOrigin,
  GOOGLE_CALLBACK_PATH,
  GOOGLE_STATE_COOKIE,
} from "@/lib/google/request";

export async function GET(request: NextRequest) {
  const user = await requireOwner();
  const { clientId } = getGoogleCredentials();
  const state = randomBytes(32).toString("hex");
  const redirectUri = `${getPublicOrigin(request)}${GOOGLE_CALLBACK_PATH}`;
  const authUrl = buildAuthUrl({
    clientId,
    redirectUri,
    state,
    loginHint: user.email,
  });
  const response = NextResponse.redirect(authUrl);

  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/google",
    maxAge: 600,
  });

  return response;
}
