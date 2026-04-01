/** Minimal row shape for UF / upcoming checks (schedule API). */
export type ScheduleGameRow = {
  startDate: string;
  homeTeam: string;
  awayTeam: string;
};

export const MARCH_MADNESS_KNOCKOUT_MESSAGE =
  "UF has been knocked out of March Madness.";

/** NCAA tournament window (local): Selection Sunday through championship week. */
export function isMarchMadnessSeason(now: Date = new Date()): boolean {
  const y = now.getFullYear();
  const start = new Date(y, 2, 15);
  const end = new Date(y, 3, 10);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return now >= start && now <= end;
}

export function isUfGame(g: ScheduleGameRow): boolean {
  return g.homeTeam === "Florida" || g.awayTeam === "Florida";
}

export function isFutureGame(iso: string): boolean {
  return new Date(iso).getTime() > Date.now();
}

export function shouldShowMarchMadnessKnockout(
  games: ScheduleGameRow[],
  opts: { loading: boolean; error: boolean }
): boolean {
  if (opts.loading || opts.error) return false;
  if (!isMarchMadnessSeason()) return false;
  const upcoming = games.filter((g) => isUfGame(g) && isFutureGame(g.startDate));
  return upcoming.length === 0;
}
