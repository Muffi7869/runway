import type { SettingsInput } from "../settings/schema";

export type SchedulerSettings = Pick<
  SettingsInput,
  | "study_window_start"
  | "study_window_end"
  | "max_study_minutes_per_day"
  | "min_block_minutes"
  | "max_block_minutes"
  | "buffer_days"
>;

export type BusyInterval = {
  start: Date;
  end: Date;
};

export type ScheduleStep = {
  id: string;
  name: string;
  order: number;
  estimatedMinutes: number;
  percentDone: number;
};

export type ScheduleAssignment = {
  id: string;
  deadline: Date;
  weight: "low" | "medium" | "high";
  paceRatio: number;
  className: string;
  title: string;
  steps: ScheduleStep[];
};

export type ScheduleInput = {
  now: Date;
  settings: SchedulerSettings;
  fixedEvents: BusyInterval[];
  blockedDays: string[];
  busyBlocks: BusyInterval[];
  assignments: ScheduleAssignment[];
  horizonEnd: Date;
};

export type PlannedBlock = {
  stepId: string;
  assignmentId: string;
  start: Date;
  end: Date;
  minutes: number;
};

export type ScheduleWarning = {
  assignmentId: string;
  minutesShort: number;
  firstOverflowDay: string;
};

export type ScheduleResult = {
  blocks: PlannedBlock[];
  warnings: ScheduleWarning[];
};
