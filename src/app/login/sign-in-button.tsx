"use client";

import { createClient } from "@/lib/db/client";
import { absoluteUrl } from "@/lib/site-url";

export function SignInButton() {
  async function signInWithGoogle() {
    const supabase = createClient();

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: absoluteUrl("/auth/callback", window.location.origin),
        queryParams: {
          prompt: "select_account",
        },
      },
    });
  }

  return (
    <button
      type="button"
      onClick={signInWithGoogle}
      className="ui-button ui-button--primary"
    >
      Continue with Google
    </button>
  );
}
