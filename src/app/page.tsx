import Link from "next/link";
import { redirect } from "next/navigation";

import { SignedOutShell } from "@/components/signed-out-shell";

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
    <SignedOutShell
      action={
        <Link className="ui-button ui-button--primary" href="/login">
          Continue with Google
        </Link>
      }
    />
  );
}
