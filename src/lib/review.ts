/** Ask for a store review only after a good moment, and rarely. */
export const REVIEW_MIN_OPENS = 3;
export const REVIEW_GAP_DAYS = 120;

export function shouldAskForReview(opens: number, lastAsked: string | undefined, now: Date, goodMoment: boolean): boolean {
  if (!goodMoment || opens < REVIEW_MIN_OPENS) return false;
  if (!lastAsked) return true;
  return now.getTime() - Date.parse(lastAsked) > REVIEW_GAP_DAYS * 86_400_000;
}
