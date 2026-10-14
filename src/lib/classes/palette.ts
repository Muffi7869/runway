export const CLASS_COLOR_PALETTE = [
  { key: "blue", label: "Blue", value: "var(--class-blue-dot)", fill: "var(--class-blue-fill)", text: "var(--class-blue-text)" },
  { key: "green", label: "Green", value: "var(--class-green-dot)", fill: "var(--class-green-fill)", text: "var(--class-green-text)" },
  { key: "purple", label: "Purple", value: "var(--class-purple-dot)", fill: "var(--class-purple-fill)", text: "var(--class-purple-text)" },
  { key: "orange", label: "Orange", value: "var(--class-orange-dot)", fill: "var(--class-orange-fill)", text: "var(--class-orange-text)" },
  { key: "red", label: "Red", value: "var(--class-red-dot)", fill: "var(--class-red-fill)", text: "var(--class-red-text)" },
  { key: "teal", label: "Teal", value: "var(--class-teal-dot)", fill: "var(--class-teal-fill)", text: "var(--class-teal-text)" },
  { key: "pink", label: "Pink", value: "var(--class-pink-dot)", fill: "var(--class-pink-fill)", text: "var(--class-pink-text)" },
  { key: "yellow", label: "Yellow", value: "var(--class-yellow-dot)", fill: "var(--class-yellow-fill)", text: "var(--class-yellow-text)" },
] as const;

export type ClassColor = (typeof CLASS_COLOR_PALETTE)[number]["key"];
