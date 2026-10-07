"use client";

import { useRef, useState, type TouchEvent } from "react";

import { eventPlacement } from "../lib/week/placement";
import type { WeekEventLayout } from "../lib/week/view";

import styles from "./week-grid.module.css";

export const WEEK_GRID_ROW_HEIGHT_PX = 64;
const MIN_EVENT_HEIGHT_PX = 20;
const SWIPE_THRESHOLD = 50;

export type WeekGridDay = {
  shortLabel: string;
  longLabel: string;
  isToday: boolean;
};

export type WeekGridEvent = WeekEventLayout & {
  timeRange: string;
};

type WeekGridPresentationProps = {
  days: WeekGridDay[];
  events: WeekGridEvent[];
  startHour: number;
  endHour: number;
  activeDayIndex: number;
  onPreviousDay?: () => void;
  onNextDay?: () => void;
  onTouchStart?: (event: TouchEvent<HTMLDivElement>) => void;
  onTouchEnd?: (event: TouchEvent<HTMLDivElement>) => void;
};

function formatHour(hour: number): string {
  const normalized = hour % 24;
  const displayHour = normalized % 12 || 12;
  return `${displayHour} ${normalized < 12 ? "AM" : "PM"}`;
}

export function WeekGridPresentation({
  days,
  events,
  startHour,
  endHour,
  activeDayIndex,
  onPreviousDay,
  onNextDay,
  onTouchStart,
  onTouchEnd,
}: WeekGridPresentationProps) {
  const hours = Array.from(
    { length: Math.max(0, endHour - startHour) },
    (_, index) => startHour + index,
  );
  const gridHeight =
    Math.max(1, endHour - startHour) * WEEK_GRID_ROW_HEIGHT_PX;

  return (
    <section
      aria-label="Weekly calendar"
      className={styles.weekGrid}
      onTouchEnd={onTouchEnd}
      onTouchStart={onTouchStart}
    >
      <div className={styles.mobileNavigation}>
        <button
          aria-label="Previous day"
          className={styles.dayButton}
          disabled={activeDayIndex === 0}
          onClick={onPreviousDay}
          type="button"
        >
          ←
        </button>
        <p
          className={`${styles.mobileDayLabel} ${days[activeDayIndex]?.isToday ? styles.todayLabel : ""}`}
        >
          {days[activeDayIndex]?.longLabel}
        </p>
        <button
          aria-label="Next day"
          className={styles.dayButton}
          disabled={activeDayIndex === days.length - 1}
          onClick={onNextDay}
          type="button"
        >
          →
        </button>
      </div>

      <div className={styles.desktopHeaders} data-desktop-headers="true">
        <div aria-hidden="true" />
        {days.map((day) => (
          <div
            className={`${styles.dayHeader} ${day.isToday ? styles.todayHeader : ""}`}
            key={day.longLabel}
          >
            {day.shortLabel}
          </div>
        ))}
      </div>

      <div className={styles.calendarBody}>
        <div
          aria-hidden="true"
          className={styles.hourGutter}
          data-hour-gutter="true"
          style={{ height: gridHeight }}
        >
          {hours.map((hour) => (
            <span
              className={styles.hourLabel}
              key={hour}
              style={{ top: (hour - startHour) * WEEK_GRID_ROW_HEIGHT_PX }}
            >
              {formatHour(hour)}
            </span>
          ))}
        </div>

        {days.map((day, dayIndex) => (
          <div
            aria-label={day.longLabel}
            className={`${styles.dayColumn} ${day.isToday ? styles.todayColumn : ""}`}
            data-active={activeDayIndex === dayIndex ? "true" : "false"}
            data-day-column={dayIndex}
            key={day.longLabel}
            style={{ height: gridHeight }}
          >
            {hours.map((hour) => (
              <div
                aria-hidden="true"
                className={styles.hourLine}
                data-hour-line={hour}
                key={hour}
                style={{ top: (hour - startHour) * WEEK_GRID_ROW_HEIGHT_PX }}
              />
            ))}

            {events
              .filter((event) => event.dayIndex === dayIndex)
              .map((event) => {
                const placement = eventPlacement({
                  startMinute: event.startMinute,
                  endMinute: event.endMinute,
                  startHour,
                  rowHeightPx: WEEK_GRID_ROW_HEIGHT_PX,
                  minHeightPx: MIN_EVENT_HEIGHT_PX,
                });

                return (
                  <div
                    className={styles.eventSlot}
                    data-event-id={event.id}
                    key={`${event.id}-${event.dayIndex}-${event.startMinute}-${event.endMinute}`}
                    style={{
                      height: placement.heightPx,
                      left: `${(event.lane / event.laneCount) * 100}%`,
                      top: placement.topPx,
                      width: `${100 / event.laneCount}%`,
                    }}
                  >
                    <div className={styles.eventBlock}>
                      <p className={styles.eventTitle} title={event.title}>
                        {event.title}
                      </p>
                      <p className={styles.eventTime}>{event.timeRange}</p>
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </section>
  );
}

export function WeekGrid({
  days,
  events,
  startHour,
  endHour,
  initialDayIndex,
}: {
  days: WeekGridDay[];
  events: WeekGridEvent[];
  startHour: number;
  endHour: number;
  initialDayIndex: number;
}) {
  const [activeDayIndex, setActiveDayIndex] = useState(initialDayIndex);
  const touchStartX = useRef<number | undefined>(undefined);

  function moveDay(direction: -1 | 1) {
    setActiveDayIndex((current) =>
      Math.max(0, Math.min(days.length - 1, current + direction)),
    );
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const startingX = touchStartX.current;
    const endingX = event.changedTouches[0]?.clientX;
    touchStartX.current = undefined;

    if (startingX === undefined || endingX === undefined) {
      return;
    }

    const distance = endingX - startingX;

    if (Math.abs(distance) < SWIPE_THRESHOLD) {
      return;
    }

    moveDay(distance < 0 ? 1 : -1);
  }

  return (
    <WeekGridPresentation
      activeDayIndex={activeDayIndex}
      days={days}
      endHour={endHour}
      events={events}
      onNextDay={() => moveDay(1)}
      onPreviousDay={() => moveDay(-1)}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
      startHour={startHour}
    />
  );
}
