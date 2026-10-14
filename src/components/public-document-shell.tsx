import Link from "next/link";
import type { ReactNode } from "react";

import { RunwayLogo } from "./runway-logo";
import styles from "./public-document-shell.module.css";

export function PublicDocumentShell({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <header>
        <Link href="/">
          <RunwayLogo size={28} />
          <span>Runway</span>
        </Link>
      </header>
      <article>{children}</article>
    </main>
  );
}
