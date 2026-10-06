import type { ReactNode } from "react";

import { requireOwner } from "@/lib/auth/server";

import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireOwner();

  return (
    <>
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="font-semibold">Runway</span>
        <form action={signOut}>
          <button type="submit">Sign out</button>
        </form>
      </header>
      {children}
    </>
  );
}
