import {
  STEP_LOGGED_WORK_MESSAGE,
  STEP_SCHEDULED_MESSAGE,
} from "./limits";

type SaveStepsError = {
  code?: string;
  details?: string | null;
  message?: string;
};

function detailName(error: SaveStepsError): string | null {
  const details = error.details?.trim();
  return details ? details : null;
}

export function mapSaveStepsError(
  error: SaveStepsError | null | undefined,
): string {
  if (error?.code === "RS001") {
    const name = detailName(error);
    return name ? `This step has logged work: ${name}.` : STEP_LOGGED_WORK_MESSAGE;
  }

  if (error?.code === "RS004") {
    const name = detailName(error);
    return name
      ? `This step is already scheduled: ${name}. It can be removed after the next replan.`
      : STEP_SCHEDULED_MESSAGE;
  }

  if (error?.code === "RS002") {
    return "This assignment can't be edited. Restore it first, or it no longer exists.";
  }

  return "Couldn't save the steps. Check them and try again.";
}
