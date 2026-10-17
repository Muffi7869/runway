function normalizedOrigin(value: string): string {
  const url = new URL(value.trim());
  return url.origin.replace(/\/+$/, "");
}

export function siteUrl(requestOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return normalizedOrigin(configured);
  if (requestOrigin?.trim()) return normalizedOrigin(requestOrigin);
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("NEXT_PUBLIC_SITE_URL is required.");
}

export function absoluteUrl(path: string, requestOrigin?: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, `${siteUrl(requestOrigin)}/`).toString();
}
