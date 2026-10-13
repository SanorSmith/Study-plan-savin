import { MAX_ATTEMPTS } from "./ledger";

export type QuestionStatus = "not_tried" | "in_progress" | "solved" | "failed";

/** How a question stands given the kid's attempts so far. */
export function questionStatus(list: { correct: boolean }[]): QuestionStatus {
  if (list.some((a) => a.correct)) return "solved";
  if (list.length >= MAX_ATTEMPTS) return "failed";
  return list.length === 0 ? "not_tried" : "in_progress";
}
