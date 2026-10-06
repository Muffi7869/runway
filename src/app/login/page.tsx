import { SignInButton } from "./sign-in-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <SignInButton />
      {error ? <p>Sign-in failed. Please try again.</p> : null}
    </main>
  );
}
