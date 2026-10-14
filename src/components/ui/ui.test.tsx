import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ThemeControl } from "../theme-control";
import { CLASS_COLOR_PALETTE } from "../../lib/classes/palette";

import { Banner } from "./banner";
import { Button } from "./button";
import { Card } from "./card";
import { ClassChip } from "./class-chip";
import { InputField, SelectField, TextareaField } from "./field";
import { ProgressBar } from "./progress-bar";
import { SegmentedControl } from "./segmented-control";
import { Stepper } from "./stepper";
import { TabOption, Tabs } from "./tabs";
import { Tag } from "./tag";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("shared UI", () => {
  it("renders button variants and disabled state", () => {
    const markup = renderToStaticMarkup(
      <>
        <Button>Default</Button>
        <Button variant="primary">Primary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="small">Small</Button>
        <Button aria-label="Icon action" disabled variant="icon">+</Button>
      </>,
    );
    expect(markup).toContain("ui-button--primary");
    expect(markup).toContain("ui-button--ghost");
    expect(markup).toContain("ui-button--small");
    expect(markup).toContain("ui-button--icon");
    expect(markup).toContain("disabled");
  });

  it("renders all eight class chip keys", () => {
    const markup = renderToStaticMarkup(
      <>
        {CLASS_COLOR_PALETTE.map((color) => (
          <ClassChip color={color.key} key={color.key}>{color.label}</ClassChip>
        ))}
      </>,
    );
    expect(CLASS_COLOR_PALETTE).toHaveLength(8);
    for (const color of CLASS_COLOR_PALETTE) {
      expect(markup).toContain(`data-class-color="${color.key}"`);
    }
  });

  it("renders cards, tags, banners, progress, and the stepper accessibly", () => {
    const markup = renderToStaticMarkup(
      <Card>
        <Tag>Default</Tag>
        <Tag variant="warn">Short</Tag>
        <Banner variant="ok">Saved</Banner>
        <Banner variant="warn">Needs attention</Banner>
        <ProgressBar color="green" label="Test progress" value={45} />
        <Stepper ariaLabel="Test minutes" onChange={() => undefined} value={30} />
      </Card>,
    );
    expect(markup).toContain('role="status"');
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="45"');
    expect(markup).toContain('aria-label="Decrease Test minutes"');
  });

  it("renders controlled and uncontrolled segmented controls and counted tabs", () => {
    const tabOptions: TabOption<"active" | "done">[] = [
      { value: "active", label: "Active", count: 2 },
      { value: "done", label: "Done", count: 1, disabled: true },
    ];
    const markup = renderToStaticMarkup(
      <>
        <SegmentedControl
          ariaLabel="Controlled"
          onValueChange={() => undefined}
          options={tabOptions}
          value="active"
        />
        <SegmentedControl
          ariaLabel="Uncontrolled"
          defaultValue="done"
          options={tabOptions}
        />
        <Tabs ariaLabel="Assignment status" options={tabOptions} value="active" />
        <ThemeControl />
      </>,
    );
    expect(markup).toContain('role="radiogroup"');
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain("Active 2");
    expect(markup).toContain("Done 1");
    expect(markup).toContain("System");
  });

  it("renders labeled inputs, selects, textareas, hints, and errors", () => {
    const markup = renderToStaticMarkup(
      <>
        <InputField error="Required" id="name" label="Name" />
        <SelectField hint="Choose one" id="choice" label="Choice">
          <option>One</option>
        </SelectField>
        <TextareaField id="notes" label="Notes" />
      </>,
    );
    expect(markup).toContain('for="name"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('id="name-error"');
    expect(markup).toContain("Choose one");
    expect(markup).toContain("textarea");
  });

  it("keeps raw hex colors out of component and app source", () => {
    const roots = [join(process.cwd(), "src/components"), join(process.cwd(), "src/app")];
    const offenders = roots.flatMap(sourceFiles).filter((path) => {
      if (path.endsWith("globals.css")) return false;
      return /#[0-9a-f]{3,8}\b/i.test(readFileSync(path, "utf8"));
    });
    expect(offenders).toEqual([]);
  });
});
