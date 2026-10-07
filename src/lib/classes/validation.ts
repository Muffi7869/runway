import { CLASS_COLOR_PALETTE, type ClassColor } from "./palette";

type ClassInputResult =
  | { success: true; data: { name: string; color: ClassColor } }
  | { success: false; error: string };

export function validateClassInput(
  name: unknown,
  color: unknown,
): ClassInputResult {
  if (typeof name !== "string" || name.trim() === "") {
    return { success: false, error: "Class name is required." };
  }

  const selectedColor = CLASS_COLOR_PALETTE.find(
    (paletteColor) => paletteColor.key === color,
  );

  if (!selectedColor) {
    return { success: false, error: "Choose a valid class color." };
  }

  return {
    success: true,
    data: { name: name.trim(), color: selectedColor.key },
  };
}
