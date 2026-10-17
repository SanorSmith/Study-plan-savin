/**
 * What the kid sees above a question: the number printed on the worksheet ("Question 3", "Question 4b", "Exercise 2"),
 * or the question's place in the homework when the sheet gave no number.
 */
export function questionTitle(label: string | null | undefined, position: number): string {
  const l = label?.trim();
  if (!l) return `Question ${position}`;
  return /^\d/.test(l) ? `Question ${l}` : l;
}
