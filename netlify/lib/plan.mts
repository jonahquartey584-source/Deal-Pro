// Complimentary (referral) plans carry a `planExpiresAt` date. Once it has passed, the account drops back to Free.
// Mutates the stored account state and returns true when it just expired, so callers that own the write can save it.
export function applyPlanExpiry(state: Record<string, unknown> | null | undefined): boolean {
  if (!state?.planExpiresAt) return false;
  const ends = Date.parse(String(state.planExpiresAt));
  if (Number.isFinite(ends) && ends > Date.now()) return false;
  state.plan = "Free";
  delete state.planExpiresAt;
  return true;
}
