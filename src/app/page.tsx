import Link from "next/link";
import { redirect } from "next/navigation";

import { getRouteAction } from "../lib/auth/routing";
import { getOwnerStatus } from "../lib/auth/server";
import { createClient } from "../lib/db/server";

export default async function Home() {
  const supabase = await createClient();
  const ownerStatus = await getOwnerStatus(supabase);
  const action = getRouteAction("/", ownerStatus.status);

  if (ownerStatus.status === "owner") {
    redirect("/week");
  }

  if (action === "sign_out_and_redirect_private") {
    try {
      await supabase.auth.signOut();
    } catch {
      // The redirect still denies access if cookie clearing fails.
    }

    redirect("/private");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold">Runway</h1>
      <p>
        Runway reads a fixed weekly schedule, breaks assignments into steps,
        plans study blocks in free time, and re-plans nightly from a short
        check-in.
      </p>
      <Link
        className="rounded bg-black px-4 py-2 text-white"
        href="/login"
      >
        Sign in
      </Link>
      <Link className="underline" href="/privacy">
        Privacy
      </Link>
    </main>
  );
}
