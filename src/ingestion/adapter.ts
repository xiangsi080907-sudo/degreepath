import robotsParser from "robots-parser";
import { Course, Offering, Program, Term } from "../domain/types";
import {
  parseCourseCatalog,
  parseCSProgram,
  parseOfferings,
  UW_URLS,
} from "./uw";
export interface InstitutionSourceAdapter {
  fetchCourseCatalog(): Promise<Course[]>;
  fetchCourseOfferings(term: Term): Promise<Offering[]>;
  fetchPrograms(): Promise<Program[]>;
  fetchProgramRequirements(
    program: string,
    catalogYear: string,
  ): Promise<Program>;
}
export class PoliteFetcher {
  private lastRequest = 0;
  private policies = new Map<string, ReturnType<typeof robotsParser>>();
  private readonly agent =
    "DegreePath/0.1 (public academic data importer; manual refresh)";
  private async request(url: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise((r) =>
        setTimeout(r, Math.max(0, 1500 - (Date.now() - this.lastRequest))),
      );
      this.lastRequest = Date.now();
      const response = await fetch(url, {
        headers: { "User-Agent": this.agent },
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
      });
      if (response.status === 429 || response.status >= 500) {
        await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
        continue;
      }
      if (!response.ok)
        throw Error(`Source unavailable (${response.status}): ${url}`);
      return response.text();
    }
    throw Error(`Retry limit: ${url}`);
  }
  async fetch(url: string) {
    const u = new URL(url);
    if (
      u.protocol !== "https:" ||
      !["www.washington.edu", "www.cs.washington.edu"].includes(u.hostname)
    )
      throw Error("Unapproved source host");
    if (
      u.pathname.includes("/timeschd/") &&
      !u.pathname.includes("/timeschd/pub/")
    )
      throw Error("Only public Course Offerings paths allowed");
    let policy = this.policies.get(u.origin);
    if (!policy) {
      policy = robotsParser(
        `${u.origin}/robots.txt`,
        await this.request(`${u.origin}/robots.txt`),
      );
      this.policies.set(u.origin, policy);
    }
    if (policy.isAllowed(url, this.agent) !== true)
      throw Error("Robots policy does not allow this source");
    return this.request(url);
  }
}
export class UWAdapter implements InstitutionSourceAdapter {
  constructor(private fetcher = new PoliteFetcher()) {}
  async fetchCourseCatalog() {
    const date = new Date().toISOString();
    const cse = await this.fetcher.fetch(UW_URLS.cse);
    const math = await this.fetcher.fetch(UW_URLS.math);
    return [
      ...parseCourseCatalog(cse, "CSE", UW_URLS.cse, date),
      ...parseCourseCatalog(math, "MATH", UW_URLS.math, date),
    ];
  }
  async fetchCourseOfferings(term: Term) {
    const codes: Record<string, string> = {
      Autumn: "AUT",
      Winter: "WIN",
      Spring: "SPR",
      Summer: "SUM",
    };
    if (!codes[term.season]) throw Error("Unsupported quarter");
    const url = `https://www.washington.edu/students/timeschd/pub/${codes[term.season]}${term.year}/cse.html`;
    return parseOfferings(await this.fetcher.fetch(url), term, url);
  }
  async fetchPrograms() {
    return [
      parseCSProgram(
        await this.fetcher.fetch(UW_URLS.program),
        new Date().toISOString(),
      ),
    ];
  }
  async fetchProgramRequirements(program: string, catalogYear: string) {
    if (
      program !== "uw-seattle-cs" ||
      catalogYear !== "uw-seattle-current-2026-09"
    )
      throw Error("Unsupported program/catalog");
    return (await this.fetchPrograms())[0];
  }
}
