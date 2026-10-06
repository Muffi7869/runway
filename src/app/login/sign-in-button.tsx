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
      className="rounded-md bg-black px-4 py-2 text-white"
    >
      Sign in with Google
    </button>
  );
}
