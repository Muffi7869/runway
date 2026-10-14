import Link from "next/link";
import type { ReactNode } from "react";

import { RunwayLogo } from "./runway-logo";
import styles from "./signed-out-shell.module.css";

function ProductPreview() {
  return (
    <section aria-hidden="true" className={styles.preview}>
      <div className={styles.previewStage}>
        <div className={styles.miniWeek}>
          <header>
            <strong>This week</strong>
            <span className="num">Oct 14 – 16</span>
          </header>
          <div className={styles.dayHeaders}>
            <span>Wed 14</span>
            <span>Thu 15</span>
            <span>Fri 16</span>
          </div>
          <div className={styles.dayColumns}>
            <div className={styles.dayColumn}>
              <div className={styles.fixedEvent}>Writing Studio</div>
              <div className={styles.purpleEvent}>
                <strong>Research outline</strong>
                Gather sources
              </div>
              <div className={styles.blueEvent}>
                <strong>Prototype review</strong>
                Revise screens
              </div>
            </div>
            <div className={styles.dayColumn}>
              <div className={styles.fixedEvent}>Statistics Lab</div>
              <div className={styles.greenEvent}>
                <strong>Practice set</strong>
                Solve examples
              </div>
            </div>
            <div className={styles.dayColumn}>
              <div className={styles.fixedEvent}>Design Practice</div>
              <div className={styles.blueEvent}>
                <strong>Prototype review</strong>
                Final polish
              </div>
            </div>
          </div>
        </div>

        <div className={styles.previewCheckin}>
          <span>Tonight&apos;s check-in</span>
          <strong>Prototype review · Revise screens</strong>
          <div className={styles.previewSegments}>
            <span>25%</span>
            <span>50%</span>
            <span className={styles.previewSelected}>75%</span>
            <span>100%</span>
          </div>
          <p>
            <span>Worked</span>
            <strong className="num">2h 15m</strong>
          </p>
        </div>

        <div className={styles.previewToast}>
          <span className={styles.previewCheck}>✓</span>
          <span>
            <strong>Replanned.</strong> Final polish moved to Friday.
          </span>
        </div>
      </div>
    </section>
  );
}

export function SignedOutShell({
  action,
  message,
}: {
  action: ReactNode;
  message?: ReactNode;
}) {
  return (
    <main className={styles.shell}>
      <section className={styles.intro}>
        <div className={styles.logo}>
          <RunwayLogo size={28} />
          <span>Runway</span>
        </div>

        <div className={styles.introBody}>
          <div>
            <h1>Never cram the night before again.</h1>
            <p className={styles.pitch}>
              Runway splits each assignment into steps, fits them around your
              classes, and replans every night from what you actually finished.
            </p>
          </div>

          <div className={styles.actionArea}>
            {action}
            {message}
            <p>Private app. Only the owner&apos;s account can sign in.</p>
          </div>

          <ol className={styles.steps}>
            <li>
              <span className="num">1</span>
              <p>
                <strong>Paste the spec.</strong> AI turns it into timed steps
                you can edit.
              </p>
            </li>
            <li>
              <span className="num">2</span>
              <p>
                <strong>Get a plan.</strong> Study blocks land in your free time
                and your Google Calendar.
              </p>
            </li>
            <li>
              <span className="num">3</span>
              <p>
                <strong>Check in at night.</strong> Fell behind? Tomorrow
                adjusts on its own.
              </p>
            </li>
          </ol>
        </div>

        <footer>
          <span>© 2026 Runway</span>
          <Link href="/privacy">Privacy</Link>
        </footer>
      </section>
      <ProductPreview />
    </main>
  );
}
