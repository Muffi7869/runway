import type { FixedEventValue } from "./event-mapper";

export type ExistingFixedEvent = FixedEventValue & {
  id: string;
};

export type FixedEventUpdate = {
  id: string;
  title?: string;
  start?: string;
  end?: string;
};

export type SyncPlan = {
  inserts: FixedEventValue[];
  updates: FixedEventUpdate[];
  deletes: string[];
};

function eventKey(event: {
  source_calendar_id: string;
  google_event_id: string;
}): string {
  return JSON.stringify([event.source_calendar_id, event.google_event_id]);
}

function sameInstant(first: string, second: string): boolean {
  return Date.parse(first) === Date.parse(second);
}

export function planSync({
  existing,
  incoming,
  selectedCalendarIds,
}: {
  existing: ExistingFixedEvent[];
  incoming: FixedEventValue[];
  selectedCalendarIds: string[];
}): SyncPlan {
  const existingByKey = new Map(
    existing.map((event) => [eventKey(event), event]),
  );
  const incomingKeys = new Set(incoming.map(eventKey));
  const selectedIds = new Set(selectedCalendarIds);
  const inserts: FixedEventValue[] = [];
  const updates: FixedEventUpdate[] = [];
  const deletes: string[] = [];

  for (const event of incoming) {
    const current = existingByKey.get(eventKey(event));

    if (!current) {
      inserts.push({ ...event });
      continue;
    }

    const changes: Omit<FixedEventUpdate, "id"> = {};

    if (current.title !== event.title) {
      changes.title = event.title;
    }

    if (!sameInstant(current.start, event.start)) {
      changes.start = event.start;
    }

    if (!sameInstant(current.end, event.end)) {
      changes.end = event.end;
    }

    if (Object.keys(changes).length) {
      updates.push({ id: current.id, ...changes });
    }
  }

  for (const event of existing) {
    if (
      !selectedIds.has(event.source_calendar_id) ||
      !incomingKeys.has(eventKey(event))
    ) {
      deletes.push(event.id);
    }
  }

  return { inserts, updates, deletes };
}
