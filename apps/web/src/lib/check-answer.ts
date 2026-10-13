const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Exact check for multiple-choice and numeric questions. */
export function checkExact(
  type: "multiple_choice" | "numeric",
  answer: string,
  key: string,
): boolean {
  if (type === "numeric") {
    const a = Number(answer.replace(",", "."));
    const k = Number(key.replace(",", "."));
    return Number.isFinite(a) && Number.isFinite(k) && Math.abs(a - k) < 1e-9;
  }
  return norm(answer) === norm(key);
}
