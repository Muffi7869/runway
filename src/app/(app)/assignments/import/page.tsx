import Link from "next/link";

import { requireSettingsComplete } from "@/lib/settings/server";

import { CanvasImport } from "./canvas-import";
import styles from "./canvas-import.module.css";

export default async function CanvasImportPage() {
  await requireSettingsComplete();

  return (
    <main className={styles.page}>
      <div className={styles.headingRow}>
        <div>
          <p className={styles.eyebrow}>Assignments</p>
          <h1>Import from Canvas</h1>
          <p className={styles.intro}>Review what is new before anything is added.</p>
        </div>
        <Link className="ui-button" href="/assignments">Back to assignments</Link>
      </div>
      <CanvasImport />
    </main>
  );
}
