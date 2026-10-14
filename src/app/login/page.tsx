import { SignedOutShell } from "@/components/signed-out-shell";

import { SignInButton } from "./sign-in-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;

  return (
    <SignedOutShell
      action={<SignInButton />}
      message={error ? <p role="alert">Sign-in failed. Please try again.</p> : null}
    />
  );
}
