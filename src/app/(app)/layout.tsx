import type { ReactNode } from "react";
import Link from "next/link";

import { requireOwner } from "@/lib/auth/server";

import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireOwner();

  return (
    <>
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link className="font-semibold" href="/week">
          Runway
        </Link>
        <div className="flex items-center gap-6">
          <nav aria-label="Main navigation">
            <ul className="flex items-center gap-4">
              <li>
                <Link href="/week">Week</Link>
              </li>
              <li>
                <Link href="/assignments">Assignments</Link>
              </li>
              <li>
                <Link href="/classes">Classes</Link>
              </li>
              <li>
                <Link href="/settings">Settings</Link>
              </li>
            </ul>
          </nav>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </header>
      {children}
    </>
  );
}
