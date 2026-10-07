const ROOT_PATH = "/";
const PRIVACY_PATH = "/privacy";

export const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/private",
  PRIVACY_PATH,
  ROOT_PATH,
] as const;

export type RouteOwnerStatus = "anonymous" | "not_owner" | "owner";

export type RouteAction =
  | "pass"
  | "redirect_login"
  | "redirect_root"
  | "sign_out_and_redirect_private";

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path);
}

export function skipsOwnerCheck(pathname: string): boolean {
  return pathname === PRIVACY_PATH;
}

export function getRouteAction(
  pathname: string,
  ownerStatus: RouteOwnerStatus,
): RouteAction {
  if (pathname === ROOT_PATH) {
    return ownerStatus === "not_owner"
      ? "sign_out_and_redirect_private"
      : "pass";
  }

  if (pathname === "/login" && ownerStatus === "owner") {
    return "redirect_root";
  }

  if (isPublicPath(pathname)) {
    return "pass";
  }

  if (ownerStatus === "anonymous") {
    return "redirect_login";
  }

  if (ownerStatus === "not_owner") {
    return "sign_out_and_redirect_private";
  }

  return "pass";
}
