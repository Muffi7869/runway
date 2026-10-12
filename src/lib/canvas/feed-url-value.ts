import { validateCanvasFeedUrl } from "./url";

const SAVE_ERROR = "Couldn't save the link. Try again.";

export type PreparedCanvasFeedUrl =
  | { ok: true; encryptedValue: string }
  | { ok: false; error: string };

export function prepareCanvasFeedUrlForStorage(
  submittedValue: string,
  encrypt: (value: string) => string,
): PreparedCanvasFeedUrl {
  const validated = validateCanvasFeedUrl(submittedValue);

  if (!validated.ok) {
    return validated;
  }

  try {
    return { ok: true, encryptedValue: encrypt(validated.url) };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}
