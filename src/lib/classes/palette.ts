export const CLASS_COLOR_PALETTE = [
  { key: "blue", label: "Blue", value: "#2563EB" },
  { key: "green", label: "Green", value: "#16A34A" },
  { key: "purple", label: "Purple", value: "#9333EA" },
  { key: "orange", label: "Orange", value: "#EA580C" },
  { key: "red", label: "Red", value: "#DC2626" },
  { key: "teal", label: "Teal", value: "#0D9488" },
  { key: "pink", label: "Pink", value: "#DB2777" },
  { key: "yellow", label: "Yellow", value: "#CA8A04" },
] as const;

export type ClassColor = (typeof CLASS_COLOR_PALETTE)[number]["key"];
