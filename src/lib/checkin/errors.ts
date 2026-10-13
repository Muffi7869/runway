type DatabaseError = {
  code?: string | null;
  details?: string | null;
  message?: string | null;
} | null;

export function mapCheckinError(error: DatabaseError): string {
  if (error?.code === "RC001") {
    const name = error.details?.trim();
    return name
      ? `That step can't go below its saved progress: ${name}.`
      : "That step can't go below its saved progress.";
  }

  if (error?.code === "RC002") {
    return "Something changed. Refresh the page and try again.";
  }

  return "Couldn't save the check-in. Check the values and try again.";
}
