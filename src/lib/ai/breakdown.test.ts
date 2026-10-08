import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BREAKDOWN_SYSTEM_PROMPT,
  MAX_SPEC_CHARS_FOR_AI,
  buildBreakdownInput,
  generateBreakdown,
  validateSteps,
  type BreakdownClient,
  type BreakdownInput,
  type DraftStep,
} from "./breakdown";

const input: BreakdownInput = {
  className: "Test Class A",
  title: "Test Assignment A",
  deadlineIso: "2026-11-03T07:30:00.000Z",
  weight: "medium",
  specText: "Read the fictional handout and prepare a short response.",
};

const validSteps: DraftStep[] = [
  { name: "Review the handout", estimatedMinutes: 30 },
  { name: "Draft the response", estimatedMinutes: 60 },
  { name: "Revise the response", estimatedMinutes: 30 },
];

function responseText(steps: DraftStep[] = validSteps): string {
  return JSON.stringify({
    steps: steps.map((step) => ({
      name: step.name,
      estimated_minutes: step.estimatedMinutes,
    })),
  });
}

function mockClient(...outcomes: Array<string | Error>) {
  const pending = [...outcomes];
  const create = vi.fn(async () => {
    const outcome = pending.shift();

    if (outcome instanceof Error) {
      throw outcome;
    }

    return { output_text: outcome ?? "" };
  });
  const client: BreakdownClient = { responses: { create } };

  return { client, create };
}

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-api-key");
  vi.stubEnv("OPENAI_MODEL", "gpt-6.1-sol");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildBreakdownInput", () => {
  it("includes only the assignment fields and formats the deadline in Los Angeles", () => {
    const result = buildBreakdownInput(input);

    expect(result.specWasCut).toBe(false);
    expect(result.userText).toContain("Class: Test Class A");
    expect(result.userText).toContain("Assignment: Test Assignment A");
    expect(result.userText).toContain("Weight: medium");
    expect(result.userText).toContain(
      "Deadline (America/Los_Angeles): Monday, November 2, 2026 at 11:30 PM",
    );
    expect(result.userText).toContain(
      "<assignment_text>\nRead the fictional handout and prepare a short response.\n</assignment_text>",
    );
    expect(result.userText).not.toMatch(/calendar|email|user.?id/i);
    expect(Object.keys(result)).toEqual(["userText", "specWasCut"]);
  });

  it.each([null, "", "   "])(
    "uses the no-text line for a blank spec",
    (specText) => {
      const result = buildBreakdownInput({ ...input, specText });

      expect(result.userText).toContain("No assignment text was provided.");
      expect(result.specWasCut).toBe(false);
    },
  );

  it("keeps exactly 30,000 characters without cutting", () => {
    const specText = "A".repeat(MAX_SPEC_CHARS_FOR_AI);
    const result = buildBreakdownInput({ ...input, specText });

    expect(result.userText).toContain(specText);
    expect(result.specWasCut).toBe(false);
  });

  it("cuts 30,001 characters to the AI limit", () => {
    const specText = `${"A".repeat(MAX_SPEC_CHARS_FOR_AI)}Z`;
    const result = buildBreakdownInput({ ...input, specText });

    expect(result.userText).toContain("A".repeat(MAX_SPEC_CHARS_FOR_AI));
    expect(result.userText).not.toContain(`${"A".repeat(100)}Z`);
    expect(result.specWasCut).toBe(true);
  });
});

describe("validateSteps", () => {
  it.each([3, 10])("accepts %i valid steps", (count) => {
    expect(
      validateSteps(
        Array.from({ length: count }, (_, index) => ({
          name: `Review section ${index + 1}`,
          estimatedMinutes: 30,
        })),
      ).ok,
    ).toBe(true);
  });

  it.each([2, 11])("rejects %i steps", (count) => {
    expect(
      validateSteps(
        Array.from({ length: count }, (_, index) => ({
          name: `Review section ${index + 1}`,
          estimatedMinutes: 30,
        })),
      ).ok,
    ).toBe(false);
  });

  it("accepts a 60-character name and rejects a 61-character name", () => {
    expect(
      validateSteps([
        ...validSteps.slice(0, 2),
        { name: `A${"b".repeat(59)}`, estimatedMinutes: 30 },
      ]).ok,
    ).toBe(true);
    expect(
      validateSteps([
        ...validSteps.slice(0, 2),
        { name: `A${"b".repeat(60)}`, estimatedMinutes: 30 },
      ]).ok,
    ).toBe(false);
  });

  it.each(["1Review the handout", ""])(
    "rejects the invalid step name %j",
    (name) => {
      expect(
        validateSteps([
          ...validSteps.slice(0, 2),
          { name, estimatedMinutes: 30 },
        ]).ok,
      ).toBe(false);
    },
  );

  it.each([15, 600])("accepts %i minutes", (estimatedMinutes) => {
    expect(
      validateSteps([
        ...validSteps.slice(0, 2),
        { name: "Review the result", estimatedMinutes },
      ]).ok,
    ).toBe(true);
  });

  it.each([10, 605, 17, 45.5, "30"])(
    "rejects the invalid minute value %j",
    (estimatedMinutes) => {
      expect(
        validateSteps([
          ...validSteps.slice(0, 2),
          { name: "Review the result", estimatedMinutes },
        ]).ok,
      ).toBe(false);
    },
  );
});

describe("generateBreakdown", () => {
  it("returns steps from a valid first response", async () => {
    const { client, create } = mockClient(responseText());

    await expect(generateBreakdown(input, client)).resolves.toEqual({
      ok: true,
      steps: validSteps,
      specWasCut: false,
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("retries an invalid response once and accepts a valid second response", async () => {
    const { client, create } = mockClient('{"steps":[]}', responseText());

    await expect(generateBreakdown(input, client)).resolves.toMatchObject({
      ok: true,
      steps: validSteps,
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("returns the plain error after two invalid responses", async () => {
    const { client, create } = mockClient("not json", '{"steps":[]}');

    await expect(generateBreakdown(input, client)).resolves.toEqual({
      ok: false,
      error: "Couldn't break this down right now. Try again in a moment.",
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("retries a thrown API error and accepts a valid response", async () => {
    const { client, create } = mockClient(
      new Error("temporary failure"),
      responseText(),
    );

    await expect(generateBreakdown(input, client)).resolves.toMatchObject({
      ok: true,
      steps: validSteps,
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("returns the plain error after two thrown API errors", async () => {
    const { client, create } = mockClient(
      new Error("first failure"),
      new Error("second failure"),
    );

    await expect(generateBreakdown(input, client)).resolves.toEqual({
      ok: false,
      error: "Couldn't break this down right now. Try again in a moment.",
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it.each(["OPENAI_API_KEY", "OPENAI_MODEL"])(
    "returns the setup error without a call when %s is missing",
    async (variable) => {
      vi.stubEnv(variable, "");
      const { client, create } = mockClient(responseText());

      await expect(generateBreakdown(input, client)).resolves.toEqual({
        ok: false,
        error: "AI breakdown isn't set up yet.",
      });
      expect(create).not.toHaveBeenCalled();
    },
  );

  it("uses the configured model, low reasoning, system prompt, and strict schema", async () => {
    const { client, create } = mockClient(responseText());

    await generateBreakdown(input, client);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-6.1-sol",
        instructions: BREAKDOWN_SYSTEM_PROMPT,
        input: expect.stringContaining("Test Assignment A"),
        reasoning: { effort: "low" },
        text: {
          format: expect.objectContaining({
            type: "json_schema",
            strict: true,
          }),
        },
      }),
    );
  });

  it("never returns the spec, key, or undefined in an error", async () => {
    const secretSpec = "Fictional secret spec marker";
    const secretKey = "test-secret-key-marker";
    vi.stubEnv("OPENAI_API_KEY", secretKey);
    const { client } = mockClient(
      new Error(`${secretSpec} ${secretKey} undefined`),
      new Error(`${secretSpec} ${secretKey} undefined`),
    );
    const result = await generateBreakdown(
      { ...input, specText: secretSpec },
      client,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected breakdown generation to fail.");
    }
    expect(result.error).not.toContain(secretSpec);
    expect(result.error).not.toContain(secretKey);
    expect(result.error).not.toContain("undefined");
  });
});
