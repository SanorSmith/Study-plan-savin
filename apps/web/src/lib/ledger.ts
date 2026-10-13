export type LedgerEntry = { deltaMinutes: number };

export function balance(entries: LedgerEntry[]): number {
  return entries.reduce((sum, e) => sum + e.deltaMinutes, 0);
}

/** Minutes a correct answer may still earn today, given the daily cap. */
export function earnableToday(
  earnedToday: number,
  minutesPerQuestion: number,
  dailyCap: number,
): number {
  return Math.max(0, Math.min(minutesPerQuestion, dailyCap - earnedToday));
}

/** Spending is only allowed up to the current balance. */
export function canSpend(entries: LedgerEntry[], minutes: number): boolean {
  return minutes > 0 && balance(entries) >= minutes;
}
