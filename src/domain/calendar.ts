import { Calendar, Term } from "./types";
export const termKey = (t: Term) => `${t.year}-${t.season}`;
export const termLabel = (t: Term) => `${t.season} ${t.year}`;
export function compareTerms(a: Term, b: Term, calendar: Calendar) {
  return (
    a.year - b.year ||
    calendar.seasons.indexOf(a.season) - calendar.seasons.indexOf(b.season)
  );
}
export function nextTerm(
  term: Term,
  calendar: Calendar,
  includeOptional = true,
): Term {
  const i = calendar.seasons.indexOf(term.season);
  if (i < 0) throw Error("Unknown academic term");
  const next = {
    year: term.year + (i === calendar.seasons.length - 1 ? 1 : 0),
    season: calendar.seasons[(i + 1) % calendar.seasons.length],
  };
  return !includeOptional && next.season === calendar.optionalSeason
    ? nextTerm(next, calendar, true)
    : next;
}
export function recordBeforeTerm<T extends { status: string; term?: Term }>(
  courses: T[],
  term: Term,
  calendar: Calendar,
) {
  return courses
    .filter(
      (c) =>
        c.status === "COMPLETED" ||
        (c.status === "IN_PROGRESS" &&
          c.term &&
          compareTerms(c.term, term, calendar) < 0),
    )
    .map((c) => ({ ...c, status: "COMPLETED" as const }));
}
