import type { ReactNode } from "react";
import Link from "next/link";

import { requireOwner } from "@/lib/auth/server";

import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireOwner();

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-4 py-4 sm:px-6">
        <Link className="font-semibold" href="/week">
          Runway
        </Link>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <nav aria-label="Main navigation">
            <ul className="flex flex-wrap items-center gap-3 sm:gap-4">
              <li>
                <Link href="/week">Week</Link>
              </li>
              <li>
                <Link href="/checkin">Check in</Link>
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
