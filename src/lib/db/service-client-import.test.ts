import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(fullPath)
      : /\.[cm]?[jt]sx?$/.test(entry.name)
        ? [fullPath]
        : [];
  });
}

describe("service-role client import boundary", () => {
  it("allows imports only from cron route files", () => {
    const sourceRoot = path.join(process.cwd(), "src");
    const offenders = sourceFiles(sourceRoot)
      .filter((file) => readFileSync(file, "utf8").includes("db/service-client"))
      .map((file) => path.relative(process.cwd(), file))
      .filter(
        (file) =>
          !file.startsWith("src/app/api/cron/") &&
          file !== "src/lib/db/service-client-import.test.ts",
      );

    expect(offenders).toEqual([]);
  });
});
