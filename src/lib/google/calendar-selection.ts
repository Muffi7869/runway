import { z } from "zod";

export const MAX_FIXED_CALENDARS = 50;

export const calendarSelectionSchema = z
  .array(
    z.string({ error: "Calendar selection is invalid." }).min(1, {
      error: "Calendar selection is invalid.",
    }),
  )
  .min(1, { error: "Pick at least one calendar." })
  .max(MAX_FIXED_CALENDARS, {
    error: `Pick no more than ${MAX_FIXED_CALENDARS} calendars.`,
  })
  .superRefine((calendarIds, context) => {
    if (new Set(calendarIds).size !== calendarIds.length) {
      context.addIssue({
        code: "custom",
        message: "Choose each calendar only once.",
      });
    }
  });

export type CalendarSelection = z.infer<typeof calendarSelectionSchema>;
