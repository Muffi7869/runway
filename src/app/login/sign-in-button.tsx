"use client";

import { createClient } from "@/lib/db/client";

export function SignInButton() {
  async function signInWithGoogle() {
    const supabase = createClient();

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
      Sign in with Google
    </button>
  );
}
