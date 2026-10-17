import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../db/database.types";
import { absoluteUrl } from "../site-url";

export type ReminderMessage = {
  subject: string;
  text: string;
  html: string;
  link: string | null;
};

function checkinLink(): string | null {
  try {
    return absoluteUrl("/checkin", process.env.APP_URL);
  } catch {
    return null;
  }
}

export function buildReminderMessage(blockCount: number): ReminderMessage {
  const noun = blockCount === 1 ? "block" : "blocks";
  const sentence = `You have ${blockCount} ${noun} planned today.`;
  const link = checkinLink();

  return {
    subject: "Check in for today",
    text: link ? `${sentence}\n\n${link}` : sentence,
    html: link
      ? `<p>${sentence}</p><p><a href="${link}">Open check-in</a></p>`
      : `<p>${sentence}</p>`,
    link,
  };
}

export async function countTodayBlocks(
  service: SupabaseClient<Database>,
  ownerId: string,
  start: Date,
  end: Date,
): Promise<number> {
  const { count, error } = await service
    .from("blocks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ownerId)
    .in("status", ["planned", "checked_in"])
    .gte("start", start.toISOString())
    .lt("start", end.toISOString());

  if (error) {
    throw new Error("Reminder lookup failed.");
  }

  return count ?? 0;
}

export async function sendReminderEmail(
  blockCount: number,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.ALLOWED_EMAIL;

  if (!apiKey || !recipient) {
    throw new Error("Reminder delivery configuration is invalid.");
  }

  const message = buildReminderMessage(blockCount);
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM?.trim() || "Runway <onboarding@resend.dev>",
      to: recipient,
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!response.ok) {
    throw new Error("Reminder delivery failed.");
  }
}
