import Link from "next/link";

import type { ClassColor } from "@/lib/classes/palette";

import { Card } from "./ui/card";
import { ProgressBar } from "./ui/progress-bar";
import styles from "./week-today-panel.module.css";

export type TodayBlockItem = {
  id: string;
  label: string;
  detail: string;
  color: ClassColor;
  status: "planned" | "checked_in" | "missed";
};

export type DueSoonItem = {
  id: string;
  label: string;
  dueLabel: string;
  progress: number;
  color: ClassColor;
};

export function WeekTodayPanel({
  dateLabel,
  plannedLabel,
  completionPercent,
  plannedToday,
  upNext,
  checkinTime,
  uncheckedCount,
  dueSoon,
}: {
  dateLabel: string;
  plannedLabel: string;
  completionPercent: number;
  plannedToday: TodayBlockItem[];
  upNext: TodayBlockItem | null;
  checkinTime: string;
  uncheckedCount: number;
  dueSoon: DueSoonItem[];
}) {
  return (
    <aside aria-label="Today" className={styles.panel}>
      <Card className={styles.todayCard}>
        <p className={styles.eyebrow}>Today · {dateLabel}</p>
        <div className={styles.total}>
          <strong className="num">{plannedLabel}</strong>
          <span>planned</span>
        </div>
        <ProgressBar
          label="Today's checked-in study time"
          value={completionPercent}
        />

        <p className={styles.sectionLabel}>Planned today</p>
        {plannedToday.length ? (
          <ul className={styles.blockList}>
            {plannedToday.map((block) => (
              <li data-class-color={block.color} key={block.id}>
                <span aria-hidden="true" className={styles.dot} />
                <div>
                  <strong>{block.label}</strong>
                  <span className="num">{block.detail}</span>
                  {block.status !== "planned" ? (
                    <small>
                      {block.status === "checked_in"
                        ? "Checked in"
                        : "Not checked in"}
                    </small>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>No study blocks planned today.</p>
        )}

        <p className={styles.sectionLabel}>Up next</p>
        {upNext ? (
          <div className={styles.upNext} data-class-color={upNext.color}>
            <span aria-hidden="true" className={styles.dot} />
            <div>
              <strong>{upNext.label}</strong>
              <span className="num">{upNext.detail}</span>
            </div>
          </div>
        ) : (
          <p className={styles.empty}>Nothing else planned today.</p>
        )}
      </Card>

      <Card className={styles.checkinCard}>
        <div className={styles.checkinHeading}>
          <strong>Tonight&apos;s check-in</strong>
          <span className="num">{checkinTime}</span>
        </div>
        <p>
          {uncheckedCount === 0
            ? "Everything is checked in. Review the day before you finish."
            : `${uncheckedCount} ${uncheckedCount === 1 ? "block needs" : "blocks need"} a quick update.`}
        </p>
        <Link className="ui-button ui-button--primary" href="/checkin">
          Check in now
        </Link>
      </Card>

      <Card className={styles.dueCard}>
        <p className={styles.eyebrow}>Due soon</p>
        {dueSoon.length ? (
          <ul className={styles.dueList}>
            {dueSoon.map((assignment) => (
              <li data-class-color={assignment.color} key={assignment.id}>
                <div>
                  <strong>{assignment.label}</strong>
                  <span>{assignment.dueLabel}</span>
                </div>
                <ProgressBar
                  color={assignment.color}
                  label={`${assignment.label} progress`}
                  value={assignment.progress}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>No active assignments.</p>
        )}
      </Card>
    </aside>
  );
}
