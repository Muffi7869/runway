-- The app produces the encrypted value with AES-256-GCM. The old plaintext
-- value is intentionally discarded, and the user re-enters the Canvas link.

alter table public.settings
  add column canvas_feed_url_encrypted text;

alter table public.settings
  drop column canvas_feed_url;
