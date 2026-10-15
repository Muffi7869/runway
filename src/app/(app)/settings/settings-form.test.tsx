import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  saveSettings: vi.fn(),
}));

import { SettingsForm, type SettingsFormValues } from "./settings-form";

const values: SettingsFormValues = {
  study_window_start: "09:00",
  study_window_end: "22:00",
  max_study_hours: "6",
  max_study_minutes: "0",
  min_block_hours: "0",
  min_block_minutes: "30",
  max_block_hours: "2",
  max_block_minutes: "0",
  buffer_days: "1",
  check_in_time: "23:30",
};

describe("SettingsForm markup", () => {
  it("uses one sentence-case label for each duration and preserves field names", () => {
    const markup = renderToStaticMarkup(<SettingsForm initialValues={values} />);

    expect(markup).toContain("Maximum study time per day");
    expect(markup).toContain("Minimum block length");
    expect(markup).toContain("Maximum block length");
    expect(markup).not.toContain(">Hours<");
    expect(markup).not.toContain(">Minutes<");
    for (const name of [
      "max_study_hours",
      "max_study_minutes",
      "min_block_hours",
      "min_block_minutes",
      "max_block_hours",
      "max_block_minutes",
    ]) {
      expect(markup).toContain(`name="${name}"`);
    }
  });
});
