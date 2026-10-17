export type RectLike = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type MenuPosition = {
  top: number;
  left: number;
  placement: "below" | "above";
};

const VIEWPORT_MARGIN = 8;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function computeMenuPosition({
  trigger,
  menu,
  viewport,
  gap = 4,
}: {
  trigger: RectLike;
  menu: { width: number; height: number };
  viewport: { width: number; height: number };
  gap?: number;
}): MenuPosition {
  const roomBelow = viewport.height - VIEWPORT_MARGIN - trigger.bottom - gap;
  const roomAbove = trigger.top - VIEWPORT_MARGIN - gap;
  const placement =
    menu.height > roomBelow && roomAbove > roomBelow ? "above" : "below";
  const desiredTop =
    placement === "above"
      ? trigger.top - gap - menu.height
      : trigger.bottom + gap;

  return {
    top: clamp(
      desiredTop,
      VIEWPORT_MARGIN,
      viewport.height - VIEWPORT_MARGIN - menu.height,
    ),
    left: clamp(
      trigger.right - menu.width,
      VIEWPORT_MARGIN,
      viewport.width - VIEWPORT_MARGIN - menu.width,
    ),
    placement,
  };
}
