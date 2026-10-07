"use client";

import { useRef, useState, type TouchEvent } from "react";

import type { WeekEventLayout } from "@/lib/week/view";
import { eventPlacement } from "@/lib/week/placement";

const ROW_HEIGHT_PX = 64;
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

function formatHour(hour: number): string {
  const normalized = hour % 24;
  const displayHour = normalized % 12 || 12;
  return `${displayHour} ${normalized < 12 ? "AM" : "PM"}`;
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
  const hours = Array.from(
    { length: Math.max(0, endHour - startHour) },
    (_, index) => startHour + index,
  );
  const gridHeight = Math.max(1, endHour - startHour) * ROW_HEIGHT_PX;

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
    <section
      aria-label="Weekly calendar"
      className="w-full min-w-0 overflow-hidden rounded-lg border"
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
    >
      <div className="flex items-center justify-between border-b bg-white px-3 py-3 md:hidden">
        <button
          aria-label="Previous day"
          className="rounded border px-3 py-1 disabled:opacity-40"
          disabled={activeDayIndex === 0}
          onClick={() => moveDay(-1)}
          type="button"
        >
          ←
        </button>
        <p
          className={
            days[activeDayIndex]?.isToday
              ? "rounded bg-blue-100 px-3 py-1 font-semibold"
              : "px-3 py-1 font-semibold"
          }
        >
          {days[activeDayIndex]?.longLabel}
        </p>
        <button
          aria-label="Next day"
          className="rounded border px-3 py-1 disabled:opacity-40"
          disabled={activeDayIndex === days.length - 1}
          onClick={() => moveDay(1)}
          type="button"
        >
          →
        </button>
      </div>

      <div className="hidden grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b bg-white md:grid">
        <div aria-hidden="true" />
        {days.map((day) => (
          <div
            className={
              day.isToday
                ? "border-l bg-blue-100 px-2 py-3 text-center font-semibold"
                : "border-l px-2 py-3 text-center font-semibold"
            }
            key={day.longLabel}
          >
            {day.shortLabel}
          </div>
        ))}
      </div>

      <div className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] bg-white md:grid-cols-[4rem_repeat(7,minmax(0,1fr))]">
        <div
          aria-hidden="true"
          className="border-r bg-white text-xs text-gray-600"
          style={{ height: gridHeight, position: "relative" }}
        >
          {hours.map((hour) => (
            <span
              className="right-2"
              key={hour}
              style={{
                position: "absolute",
                top: (hour - startHour) * ROW_HEIGHT_PX,
              }}
            >
              {formatHour(hour)}
            </span>
          ))}
        </div>

        {days.map((day, dayIndex) => (
          <div
            aria-label={day.longLabel}
            className={`${
              activeDayIndex === dayIndex ? "block" : "hidden"
            } min-w-0 border-r md:block ${day.isToday ? "bg-blue-50/40" : "bg-white"}`}
            key={day.longLabel}
            style={{ height: gridHeight, position: "relative" }}
          >
            {hours.map((hour) => (
              <div
                aria-hidden="true"
                className="pointer-events-none inset-x-0 border-t border-gray-200"
                key={hour}
                style={{
                  position: "absolute",
                  top: (hour - startHour) * ROW_HEIGHT_PX,
                  zIndex: 0,
                }}
              />
            ))}

            {events
              .filter((event) => event.dayIndex === dayIndex)
              .map((event) => {
                const placement = eventPlacement({
                  startMinute: event.startMinute,
                  endMinute: event.endMinute,
                  startHour,
                  rowHeightPx: ROW_HEIGHT_PX,
                  minHeightPx: MIN_EVENT_HEIGHT_PX,
                });

                return (
                  <div
                    className="overflow-hidden px-0.5"
                    key={`${event.id}-${event.dayIndex}-${event.startMinute}-${event.endMinute}`}
                    style={{
                      height: placement.heightPx,
                      left: `${(event.lane / event.laneCount) * 100}%`,
                      position: "absolute",
                      top: placement.topPx,
                      width: `${100 / event.laneCount}%`,
                      zIndex: 10,
                    }}
                  >
                    <div className="h-full overflow-hidden rounded border border-gray-400 bg-gray-200 px-2 py-1 text-gray-900">
                      <p className="truncate text-xs font-semibold" title={event.title}>
                        {event.title}
                      </p>
                      <p className="truncate text-[11px]">{event.timeRange}</p>
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
