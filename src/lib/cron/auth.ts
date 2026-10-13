import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function verifyCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return false;
  }

  return timingSafeEqual(
    digest(authorization),
    digest(`Bearer ${secret}`),
  );
}
