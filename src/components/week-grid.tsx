"use client";

import { useEffect, useId, useRef, useState, type TouchEvent } from "react";

import { blockLabel } from "../lib/week/declutter";
import { eventPlacement } from "../lib/week/placement";
import { nowLineOffset } from "../lib/week/presentation";
import type { WeekEventLayout } from "../lib/week/view";

import { PortalPopup, popupContainsTarget } from "./portal-popup";
import styles from "./week-grid.module.css";

export const WEEK_GRID_ROW_HEIGHT_PX = 56;
const MIN_EVENT_HEIGHT_PX = 20;
const SWIPE_THRESHOLD = 50;

export type WeekGridDay = {
  shortLabel: string;
  longLabel: string;
  weekdayLabel: string;
  dayLabel: string;
  isToday: boolean;
  isPast: boolean;
  visibleStart: string;
};

export type WeekGridEvent = WeekEventLayout & {
  kind: "fixed" | "block";
  fullTitle: string;
  className?: string;
  assignmentTitle?: string;
  stepNames?: string[];
  timeRange: string;
  backgroundColor?: string;
  textColor?: string;
  status?: "planned" | "checked_in" | "missed";
};

export type WeekGridOverflow = {
  dayIndex: number;
  startMinute: number;
  endMinute: number;
  hiddenCount: number;
};

type WeekGridPresentationProps = {
  days: WeekGridDay[];
  events: WeekGridEvent[];
  overflows?: WeekGridOverflow[];
  startHour: number;
  endHour: number;
  activeDayIndex: number;
  onPreviousDay?: () => void;
  onNextDay?: () => void;
  onTouchStart?: (event: TouchEvent<HTMLDivElement>) => void;
  onTouchEnd?: (event: TouchEvent<HTMLDivElement>) => void;
  now: Date;
};

function formatHour(hour: number): string {
  const normalized = hour % 24;
  const displayHour = normalized % 12 || 12;
  return `${displayHour} ${normalized < 12 ? "AM" : "PM"}`;
}

function weekEventKey(event: WeekGridEvent): string {
  return `${event.id}-${event.dayIndex}-${event.startMinute}-${event.endMinute}`;
}

export function WeekGridPresentation({
  days,
  events,
  overflows = [],
  startHour,
  endHour,
  activeDayIndex,
  onPreviousDay,
  onNextDay,
  onTouchStart,
  onTouchEnd,
  now,
}: WeekGridPresentationProps) {
  const [activeEvent, setActiveEvent] = useState<string>();
  const activeTriggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const popoverRef = useRef<HTMLDivElement>(null);
  const hours = Array.from(
    { length: Math.max(0, endHour - startHour) },
    (_, index) => startHour + index,
  );
  const gridHeight =
    Math.max(1, endHour - startHour) * WEEK_GRID_ROW_HEIGHT_PX;

  useEffect(() => {
    if (!activeEvent) return;
    const activeKey = activeEvent;

    function close(returnFocus: boolean) {
      setActiveEvent(undefined);
      if (returnFocus) window.setTimeout(() => triggerRefs.current.get(activeKey)?.focus());
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close(true);
      if (event.key === "Tab") close(false);
    }
    function onPointerDown(event: PointerEvent) {
      const trigger = triggerRefs.current.get(activeKey);
      if (
        !popupContainsTarget(event.target as Node, trigger ?? null, popoverRef.current)
      ) close(true);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [activeEvent]);

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
            <span className={styles.weekdayLabel}>{day.weekdayLabel}</span>
            <span className={styles.dayNumber}>{day.dayLabel}</span>
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
            className={`${styles.dayColumn} ${day.isToday ? styles.todayColumn : ""} ${day.isPast ? styles.pastColumn : ""}`}
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

            {(() => {
              const offset = nowLineOffset(
                now,
                new Date(day.visibleStart),
                WEEK_GRID_ROW_HEIGHT_PX,
              );

              return Number.isFinite(offset) && offset >= 0 && offset <= gridHeight ? (
                <div
                  aria-hidden="true"
                  className={styles.nowLine}
                  data-now-line="true"
                  style={{ top: offset }}
                >
                  <span />
                </div>
              ) : null;
            })()}

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

                const eventKey = weekEventKey(event);
                const displayTitle =
                  event.kind === "block" && event.className && event.assignmentTitle && event.stepNames
                    ? blockLabel(
                        {
                          className: event.className,
                          assignmentTitle: event.assignmentTitle,
                          stepNames: event.stepNames,
                        },
                        placement.heightPx,
                      )
                    : event.title;
                const showTime = event.kind === "fixed" ? false : placement.heightPx >= 70;

                return (
                  <div
                    className={styles.eventSlot}
                    data-event-id={event.id}
                    data-status={event.status}
                    key={eventKey}
                    style={{
                      height: placement.heightPx,
                      left: `${(event.lane / event.laneCount) * 100}%`,
                      top: placement.topPx,
                      width: `${100 / event.laneCount}%`,
                    }}
                  >
                    <button
                      aria-controls={activeEvent === eventKey ? popoverId : undefined}
                      aria-expanded={activeEvent === eventKey}
                      aria-haspopup="dialog"
                      aria-label={`${event.fullTitle}, ${event.timeRange}`}
                      className={`${styles.eventBlock} ${event.kind === "fixed" ? styles.fixedEvent : ""}`}
                      onClick={(clickEvent) => {
                        if (activeEvent === eventKey) {
                          setActiveEvent(undefined);
                          activeTriggerRef.current = null;
                        } else {
                          activeTriggerRef.current = clickEvent.currentTarget;
                          setActiveEvent(eventKey);
                        }
                      }}
                      ref={(element) => {
                        if (element) triggerRefs.current.set(eventKey, element);
                        else triggerRefs.current.delete(eventKey);
                      }}
                      style={{
                        backgroundColor: event.backgroundColor,
                        borderColor: event.backgroundColor,
                        color: event.textColor,
                      }}
                      title={event.fullTitle}
                      type="button"
                    >
                      <p className={styles.eventTitle}>
                        {displayTitle}
                      </p>
                      {showTime ? <p className={styles.eventTime}>{event.timeRange}</p> : null}
                      {event.status === "checked_in" ? (
                        <svg aria-label="Checked in" className={styles.statusIcon} role="img" viewBox="0 0 16 16">
                          <title>Checked in</title>
                          <path d="m3 8 3 3 7-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                      ) : event.status === "missed" ? (
                        <span aria-label="Not checked in" className={styles.missedMarker} role="img" />
                      ) : null}
                    </button>
                  </div>
                );
              })}

            {overflows
              .filter((overflow) => overflow.dayIndex === dayIndex)
              .map((overflow) => {
                const placement = eventPlacement({
                  startMinute: overflow.startMinute,
                  endMinute: overflow.endMinute,
                  startHour,
                  rowHeightPx: WEEK_GRID_ROW_HEIGHT_PX,
                  minHeightPx: MIN_EVENT_HEIGHT_PX,
                });
                return (
                  <span
                    aria-label={`${overflow.hiddenCount} more overlapping calendar items`}
                    className={styles.overflowCount}
                    key={`${overflow.dayIndex}-${overflow.startMinute}-${overflow.endMinute}`}
                    style={{ top: placement.topPx }}
                  >
                    +{overflow.hiddenCount}
                  </span>
                );
              })}
          </div>
        ))}
      </div>
      {(() => {
        const event = events.find((candidate) => weekEventKey(candidate) === activeEvent);

        return event ? (
          <PortalPopup
            anchorRef={activeTriggerRef}
            ariaLabel="Calendar item details"
            className={styles.eventPopover}
            id={popoverId}
            open
            popupRef={popoverRef}
            role="dialog"
          >
            <strong>{event.fullTitle}</strong>
            <span className="num">{event.timeRange}</span>
            {event.className ? <span>Class: {event.className}</span> : null}
            {event.stepNames?.length ? <span>Step: {event.stepNames.join(", ")}</span> : null}
            {event.status ? <span>Status: {event.status.replace("_", " ")}</span> : null}
          </PortalPopup>
        ) : null;
      })()}
    </section>
  );
}

export function WeekGrid({
  days,
  events,
  overflows,
  startHour,
  endHour,
  initialDayIndex,
  now,
}: {
  days: WeekGridDay[];
  events: WeekGridEvent[];
  overflows?: WeekGridOverflow[];
  startHour: number;
  endHour: number;
  initialDayIndex: number;
  now: string;
}) {
  const [activeDayIndex, setActiveDayIndex] = useState(initialDayIndex);
  const [currentNow, setCurrentNow] = useState(() => new Date(now));
  const touchStartX = useRef<number | undefined>(undefined);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

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
      overflows={overflows}
      onNextDay={() => moveDay(1)}
      onPreviousDay={() => moveDay(-1)}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
      now={currentNow}
      startHour={startHour}
    />
  );
}
