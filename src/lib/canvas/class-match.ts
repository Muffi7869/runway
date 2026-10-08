export type CourseCode = {
  subject: string;
  number: number;
  suffix: string;
};

export type ClassMatch =
  | { status: "one"; classId: string }
  | { status: "none" }
  | { status: "several" };

export function parseCourseCode(text: string): CourseCode | null {
  const compact = text.replace(/\s+/gu, "");
  const match = /^([A-Za-z]+)(\d+)([A-Za-z]*)$/u.exec(compact);

  if (!match) {
    return null;
  }

  const number = Number(match[2]);

  if (!Number.isSafeInteger(number)) {
    return null;
  }

  return {
    subject: match[1].toUpperCase(),
    number,
    suffix: match[3].toUpperCase(),
  };
}

export function matchClass(
  bracketText: string,
  classes: { id: string; name: string }[],
): ClassMatch {
  const feedCode = parseCourseCode(bracketText.split("_", 1)[0] ?? "");

  if (!feedCode) {
    return { status: "none" };
  }

  const matches = classes.filter((classRow) => {
    const classCode = parseCourseCode(classRow.name);

    return (
      classCode !== null &&
      classCode.subject === feedCode.subject &&
      classCode.number === feedCode.number &&
      classCode.suffix === feedCode.suffix
    );
  });

  if (matches.length === 1) {
    return { status: "one", classId: matches[0].id };
  }

  return matches.length === 0 ? { status: "none" } : { status: "several" };
}
