/**
 * The look of the kid's app follows the kid's age. Grades give three bands; a parent can force one.
 * The Android app uses the same rule (AgeBand.kt).
 */
export type AgeBand = "little" | "middle" | "teen";
export type UiStyle = "auto" | AgeBand;

export const UI_STYLES: { value: UiStyle; label: string }[] = [
  { value: "auto", label: "Automatic (from the grade)" },
  { value: "little", label: "Young: grades 1 to 3, big and colorful" },
  { value: "middle", label: "Middle: grades 4 to 6, playful with progress" },
  { value: "teen", label: "Teen: grades 7 to 12, clean and compact" },
];

export function ageBand(grade: number, style: string = "auto"): AgeBand {
  if (style === "little" || style === "middle" || style === "teen") return style;
  if (grade <= 3) return "little";
  if (grade <= 6) return "middle";
  return "teen";
}
