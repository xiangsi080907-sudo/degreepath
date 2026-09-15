"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X,
  AlertTriangle,
  Save,
} from "lucide-react";
import {
  AcademicData,
  Course,
  Plan,
  Requirement,
  StudentCourse,
  Term,
} from "@/domain/types";
import { StudentState } from "@/server/validation";
import {
  evaluateRequirement,
  courseCredits,
  remainingCourseIds,
  requirementLeaves,
} from "@/domain/requirements";
import { availability, getEligibleCourses } from "@/domain/eligibility";
import {
  getCoursesUnlockedBy,
  getTransitivePrerequisites,
  shortestPrerequisiteSet,
} from "@/domain/graph";
import {
  evaluatePrerequisite,
  referencedCourses,
  ruleLabel,
} from "@/domain/prerequisites";
import { validatePlan, whatIf, Violation } from "@/domain/planner";
import { termLabel, termKey } from "@/domain/calendar";
import { Brand, Disclaimer } from "./brand";
import { MajorSelector } from "./major-selector";
import { majorForKey, programKey, savedProgramKey } from "@/data/majors";
const navigation = [
  ["dashboard", "Overview", LayoutDashboard],
  ["audit", "Degree audit", GraduationCap],
  ["courses", "My courses", BookOpen],
  ["explorer", "Course explorer", Compass],
  ["next", "What can I take next?", GitBranch],
  ["plan", "Degree plan", CalendarDays],
  ["what-if", "What-if planner", SlidersHorizontal],
] as const;
const titles: Record<string, string> = {
  dashboard: "Your next chapter, mapped out.",
  audit: "Every requirement. In view.",
  courses: "Your academic history.",
  explorer: "Find your next possibility.",
  next: "What can you take next?",
  plan: "A plan with a purpose.",
  "what-if": "Make a change. See the impact.",
  sources: "Clarity starts at the source.",
  settings: "Make the plan yours.",
};
export function Workspace({
  data,
  initialState,
  demo,
  view,
  onboarded,
  name,
  savedPlans = [],
  initialPlans = [],
}: {
  data: AcademicData;
  initialState: StudentState;
  demo: boolean;
  view: string;
  onboarded: boolean;
  name: string;
  savedPlans?: { id: string; name: string; programCatalogId: string }[];
  initialPlans?: Plan[];
}) {
  const router = useRouter();
  const [pendingMajor, setPendingMajor] = useState("");
  const [loadedSnapshot, setLoadedSnapshot] = useState<{
    name: string;
    programCatalogId: string;
    plan: Plan;
  } | null>(null);
  const [state, setState] = useState(initialState),
    [plans, setPlans] = useState<Plan[]>(initialPlans),
    [activePlan, setActivePlan] = useState("balanced"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [detail, setDetail] = useState<Course | null>(null),
    [mobile, setMobile] = useState(false),
    [step, setStep] = useState(onboarded ? 6 : 0),
    [saved, setSaved] = useState(savedPlans),
    [changeIssues, setChangeIssues] = useState<Violation[] | null>(null);
  const base = demo ? "/demo" : "/app";
  const program =
    data.programs.find(
      (p) => `${p.id}:${p.catalogId}` === state.programCatalogId,
    ) ?? data.programs[0];
  useEffect(() => {
    if (demo) {
      try {
        const value = sessionStorage.getItem("degreepath-demo");
        if (value) {
          const parsed = JSON.parse(value);
          setState(parsed.state);
          setPlans(parsed.plans ?? []);
        }
      } catch {
        sessionStorage.removeItem("degreepath-demo");
      }
    }
  }, [demo]);
  const update = (next: StudentState) => {
    setState(next);
    setPlans([]);
    setChangeIssues(null);
    setLoadedSnapshot(null);
    setMessage("Unsaved changes");
    if (demo)
      sessionStorage.setItem(
        "degreepath-demo",
        JSON.stringify({ state: next, plans: [] }),
      );
  };
  async function changeMajor() {
    if (!pendingMajor || pendingMajor === state.programCatalogId) return;
    setBusy(true);
    setError("");
    try {
      if (!demo) {
        await persist();
        const response = await fetch("/api/state", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ programCatalogId: pendingMajor }),
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error);
      }
      update({ ...state, programCatalogId: pendingMajor });
      setActivePlan("balanced");
      setPendingMajor("");
      setMessage(
        `Switched to ${majorForKey(pendingMajor)?.displayName}. Academic history and saved plans are preserved. Generate a new plan when ready.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch major");
    } finally {
      setBusy(false);
    }
  }
  const record = useMemo(
    () => ({ courses: state.courses, programs: state.programs }),
    [state.courses, state.programs],
  );
  const completedCredits = state.courses
    .filter((c) => c.status === "COMPLETED")
    .reduce((s, c) => s + courseCredits(c, data.courses), 0);
  const audit = program
    ? evaluateRequirement(program.requirements, state.courses, data.courses)
    : undefined;
  const remaining = program
    ? remainingCourseIds(program.requirements, state.courses, data.courses)
    : [];
  const eligible = getEligibleCourses(
    record,
    state.preferences.start,
    data.courses,
    data.offerings,
    data.campus.calendar,
    data.offeringCoverage,
  )
    .filter((c) => remaining.includes(c.course.id))
    .sort(
      (a, b) =>
        getCoursesUnlockedBy(b.course.id, data.courses).length -
          getCoursesUnlockedBy(a.course.id, data.courses).length ||
        a.course.id.localeCompare(b.course.id),
    );
  const featuredCourse = data.courses.find(
    (c) => c.id === majorForKey(state.programCatalogId)?.featuredCourseId,
  );
  const plan = plans.find((p) => p.id === activePlan) ?? plans[0];
  async function persist() {
    setError("");
    if (demo) {
      sessionStorage.setItem(
        "degreepath-demo",
        JSON.stringify({ state, plans }),
      );
      setMessage("Demo changes saved in this browser session");
      return;
    }
    const r = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    const result = await r.json();
    if (!r.ok) throw Error(result.error);
    setMessage("Your courses and preferences are saved");
  }
  async function generate() {
    setBusy(true);
    setError("");
    try {
      await persist();
      const r = await fetch(`/api/generate${demo ? "?demo=true" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      setPlans(result);
      setChangeIssues(null);
      setStep(6);
      setMessage("Three planning strategies compared");
      if (demo)
        sessionStorage.setItem(
          "degreepath-demo",
          JSON.stringify({ state, plans: result }),
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate a plan");
    } finally {
      setBusy(false);
    }
  }
  async function savePlan() {
    setBusy(true);
    setError("");
    try {
      await persist();
      if (demo) {
        setMessage("Demo plan saved for this browser session");
        return;
      }
      const r = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${plan?.name ?? "Balanced"} · ${termLabel(state.preferences.start)}`,
          workload: activePlan,
          programCatalogId: state.programCatalogId,
          ...(changeIssues !== null && plan
            ? {
                terms: plan.terms.map((t) => ({
                  term: t.term,
                  courseIds: t.courseIds,
                })),
              }
            : {}),
        }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      setSaved([
        {
          id: result.id,
          name: result.name,
          programCatalogId: savedProgramKey(result.config),
        },
        ...saved,
      ]);
      setMessage("Plan saved to your account");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }
  function courseRow(c: Course, subtitle?: string) {
    return (
      <button className="course-row" key={c.id} onClick={() => setDetail(c)}>
        <span className={"course-icon " + (c.subject === "MATH" ? "math" : "")}>
          <BookOpen size={18} />
        </span>
        <span className="course-row-main">
          <strong>{c.id}</strong>
          <span>{subtitle ?? c.title}</span>
        </span>
        <span className="credits">
          {c.minCredits === c.maxCredits
            ? c.minCredits
            : `${c.minCredits}–${c.maxCredits}`}{" "}
          cr
        </span>
        <ChevronRight size={16} />
      </button>
    );
  }
  const saveButton = (
    <button
      className="button outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await persist();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Save size={16} />
      Save changes
    </button>
  );
  return (
    <div className="workspace">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <Link href="/" className="sidebar-brand">
          <Brand />
        </Link>
        <div className="school-label">
          <span className="school-monogram">UW</span>
          <div>
            <strong>University of Washington</strong>
            <small>Seattle campus</small>
          </div>
        </div>
        <span className="nav-label">YOUR WORKSPACE</span>
        <nav aria-label="Main navigation">
          {navigation.map(([id, label, Icon]) => (
            <Link
              key={id}
              href={`${base}/${id === "dashboard" ? "" : id}`}
              onClick={() => setMobile(false)}
              className={view === id ? "active" : ""}
            >
              <Icon size={19} />
              {label}
              {id === "plan" && <span className="nav-new">PLAN</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link
            href={`${base}/sources`}
            className={view === "sources" ? "active" : ""}
          >
            <ShieldCheck size={18} />
            Data sources & about
          </Link>
          <Link href={`${base}/settings`}>
            <Settings2 size={18} />
            Preferences
          </Link>
          <div className="profile">
            <span className="avatar">{name[0]}</span>
            <div>
              <strong>{demo ? "Alex Morgan" : name}</strong>
              <small>{demo ? "Demo student" : "Personal workspace"}</small>
            </div>
            {!demo && (
              <button
                aria-label="Sign out"
                className="icon-button"
                onClick={async () => {
                  await signOut({ redirect: false });
                  router.push("/");
                  router.refresh();
                }}
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Toggle menu"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            My workspace <ChevronRight size={14} />
            <span>
              {navigation.find((n) => n[0] === view)?.[1] ??
                (view === "sources" ? "Data sources" : "Preferences")}
            </span>
          </div>
          <div className="topbar-right">
            <span className="pill muted">
              {demo ? "DEMO MODE" : "PERSONAL PLAN"}
            </span>
            <span className="avatar small">{name[0]}</span>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>
              <Compass size={16} />
              <strong>A little room to explore.</strong> Fictional student
              history, official UW course data.
            </span>
            <Link href="/register">
              Make it your own <ArrowUpRight size={15} />
            </Link>
          </div>
        )}
        <main id="main" className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {view === "dashboard"
                  ? `WELCOME ${demo ? "BACK, ALEX" : name.toUpperCase()}`
                  : "DEGREEPATH / UW SEATTLE"}
              </span>
              <h1>{titles[view] ?? "Your workspace"}</h1>
              <p>
                {program
                  ? `${program.name}, ${program.degreeType} · ${program.catalogLabel}`
                  : "Academic data has not been imported yet."}
              </p>
            </div>
            {(view === "dashboard" || view === "plan") && (
              <button
                className="button primary"
                disabled={busy || !program}
                onClick={generate}
              >
                {busy ? "Planning…" : "Generate plans"}
                <ArrowRight size={17} />
              </button>
            )}
          </div>
          <div aria-live="polite">
            {message && <p className="toast">{message}</p>}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
          {step >= 6 && program && (
            <details className="panel compact major-switcher">
              <summary>Active major: {program.name} · Change major</summary>
              <MajorSelector
                value={pendingMajor || state.programCatalogId}
                available={data.programs.map(programKey)}
                onChange={setPendingMajor}
                disabled={busy}
              />
              {pendingMajor && pendingMajor !== state.programCatalogId && (
                <div>
                  <p>
                    Your academic history and saved plans will not be deleted.
                    Requirement progress and recommendations will use{" "}
                    {majorForKey(pendingMajor)?.displayName}. Current unsaved
                    plan edits will be cleared; save your plan first if you want
                    to keep them.
                  </p>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={changeMajor}
                  >
                    Switch to {majorForKey(pendingMajor)?.displayName}
                  </button>
                  <button
                    className="button outline"
                    disabled={busy}
                    onClick={() => setPendingMajor("")}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </details>
          )}
          {!program ? (
            <div className="empty">
              <ShieldCheck />
              <h2>Academic data is not ready yet</h2>
              <p>
                Run the documented UW import to enable personal planning. The
                public demo is available now.
              </p>
              <Link className="button primary" href="/demo">
                Explore demo
              </Link>
            </div>
          ) : step < 6 ? (
            <section className="onboarding panel">
              <div className="steps">
                {[
                  "Institution",
                  "Campus",
                  "Program",
                  "Catalog",
                  "Courses",
                  "Preferences",
                ].map((s, i) => (
                  <span
                    key={s}
                    className={i === step ? "current" : i < step ? "done" : ""}
                  >
                    {i < step ? <Check size={15} /> : i + 1}
                    <small>{s}</small>
                  </span>
                ))}
              </div>
              <span className="eyebrow">STEP {step + 1} OF 6</span>
              <h2>
                {
                  [
                    "Where are you studying?",
                    "Choose your campus.",
                    "What are you working toward?",
                    "Select your requirements snapshot.",
                    "Bring your progress with you.",
                    "Find a pace that fits.",
                  ][step]
                }
              </h2>
              {step === 0 && (
                <p>
                  University of Washington · Seattle. Build a course plan around
                  your academic history and the program you choose.
                </p>
              )}
              {step === 1 && (
                <p>
                  Plan in quarters: Autumn, Winter, Spring, and optional Summer.
                  Both supported majors share the UW calendar. More UW programs
                  coming.
                </p>
              )}
              {step === 2 && (
                <MajorSelector
                  value={state.programCatalogId}
                  available={data.programs.map(programKey)}
                  onChange={(key) =>
                    update({ ...state, programCatalogId: key })
                  }
                  disabled={busy}
                />
              )}
              {step === 3 && (
                <>
                  <label>
                    Catalog version
                    <select
                      value={state.programCatalogId}
                      onChange={(e) =>
                        update({ ...state, programCatalogId: e.target.value })
                      }
                    >
                      {data.programs
                        .filter((p) => p.id === program.id)
                        .map((p) => (
                          <option
                            key={programKey(p)}
                            value={`${p.id}:${p.catalogId}`}
                          >
                            {p.catalogLabel}
                          </option>
                        ))}
                    </select>
                  </label>
                  <p className="notice">
                    This snapshot supports course planning. Some degree rules
                    require review; it cannot certify graduation or historical
                    catalog-year applicability.
                  </p>
                </>
              )}
              {step === 4 && (
                <CourseEditor
                  data={data}
                  state={state}
                  update={update}
                  showDetail={setDetail}
                />
              )}{" "}
              {step === 5 && (
                <PreferencesEditor state={state} update={update} />
              )}
              <div className="onboarding-actions">
                {step > 0 && (
                  <button
                    className="button outline"
                    onClick={() => setStep(step - 1)}
                  >
                    Back
                  </button>
                )}
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => (step === 5 ? generate() : setStep(step + 1))}
                >
                  {step === 5
                    ? busy
                      ? "Generating…"
                      : "Generate my plan"
                    : "Continue"}
                  <ArrowRight size={16} />
                </button>
              </div>
            </section>
          ) : (
            <>
              {view === "dashboard" && (
                <>
                  <div className="stats">
                    <div className="stat progress-stat">
                      <div>
                        <span>CREDIT PROGRESS</span>
                        <strong>
                          {Math.min(
                            100,
                            Math.round((completedCredits / 180) * 100),
                          )}
                          <small>%</small>
                        </strong>
                        <p>Credit total, not a verified degree audit</p>
                      </div>
                      <div
                        className="progress-ring"
                        style={
                          {
                            "--progress": `${Math.min(100, (completedCredits / 180) * 100)}%`,
                          } as React.CSSProperties
                        }
                      >
                        <GraduationCap size={26} />
                      </div>
                    </div>
                    <div className="stat">
                      <span>COMPLETED CREDITS</span>
                      <strong>
                        {completedCredits}
                        <small> / 180</small>
                      </strong>
                      <p>From your completed coursework</p>
                    </div>
                    <div className="stat">
                      <span>CREDITS TO 180</span>
                      <strong>{Math.max(0, 180 - completedCredits)}</strong>
                      <p>Requirement allocation still needs review</p>
                    </div>
                    <div className="stat">
                      <span>GRADUATION TARGET</span>
                      <strong className="stat-term">
                        {state.preferences.target
                          ? termLabel(state.preferences.target)
                          : "Not set"}
                      </strong>
                      <p className="amber">
                        <AlertTriangle size={13} />
                        On-track status not verified
                      </p>
                    </div>
                  </div>
                  <div className="dashboard-grid">
                    <section className="panel next-panel">
                      <div className="panel-heading">
                        <div>
                          <span className="eyebrow">YOUR NEXT STEP</span>
                          <h2>{termLabel(state.preferences.start)}</h2>
                        </div>
                        <span className="pill green">
                          {eligible.length} eligible in imported requirements
                        </span>
                      </div>
                      <p className="muted-text">
                        Start with courses that move your requirements forward.
                      </p>
                      {eligible
                        .slice(0, 4)
                        .map(({ course }) => courseRow(course))}
                      {!eligible.length && (
                        <p className="empty-inline">
                          Add your completed courses and any required grades to
                          discover next steps.
                        </p>
                      )}
                      <Link className="panel-link" href={`${base}/next`}>
                        Explore eligible courses <ArrowRight size={17} />
                      </Link>
                    </section>
                    <section className="panel focus-panel">
                      <span className="eyebrow">LOOKING AHEAD</span>
                      <h2>
                        Small steps.
                        <br />
                        More open doors.
                      </h2>
                      <p>
                        Prerequisites shape your path. See what a course makes
                        possible before you decide.
                      </p>
                      {featuredCourse && (
                        <button
                          className="unlock-preview"
                          onClick={() => setDetail(featuredCourse)}
                        >
                          <GitBranch size={22} />
                          <span>
                            <strong>{featuredCourse.id}</strong>
                            <small>
                              Referenced by{" "}
                              {
                                getCoursesUnlockedBy(
                                  featuredCourse.id,
                                  data.courses,
                                ).length
                              }{" "}
                              course rules
                            </small>
                          </span>
                          <ArrowUpRight size={20} />
                        </button>
                      )}
                      <Link href={`${base}/explorer`}>
                        Explore the connections <ArrowRight size={16} />
                      </Link>
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Requirements at a glance</h2>
                        <Link href={`${base}/audit`}>
                          Full audit <ArrowUpRight size={16} />
                        </Link>
                      </div>
                      {program.requirements.children?.slice(0, 4).map((r) => {
                        const a = evaluateRequirement(
                          r,
                          state.courses,
                          data.courses,
                        );
                        return (
                          <div className="requirement-summary" key={r.id}>
                            <span>{r.title}</span>
                            <span
                              className={
                                "pill " +
                                (a.status === "COMPLETE"
                                  ? "green"
                                  : a.status === "REVIEW"
                                    ? "amber-pill"
                                    : "muted")
                              }
                            >
                              {a.status === "COMPLETE"
                                ? "Completed"
                                : a.status === "REVIEW"
                                  ? "Needs review"
                                  : `${a.earned} / ${a.needed}`}
                            </span>
                          </div>
                        );
                      })}
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Before you register</h2>
                        <ShieldCheck size={20} />
                      </div>
                      <div className="notice">
                        <strong>Some degree rules need review</strong>
                        <p>
                          General education, elective allocation, GPA, and
                          catalog applicability are not fully verified.
                        </p>
                      </div>
                      <p className="muted-text">
                        Academic data last updated
                        <br />
                        <strong>
                          {new Date(program.retrievedAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                              timeZone: "UTC",
                            },
                          )}
                        </strong>
                      </p>
                      <Link className="quiet-link" href={`${base}/sources`}>
                        See sources and review items <ArrowUpRight size={15} />
                      </Link>
                    </section>
                  </div>
                </>
              )}
              {view === "courses" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>My courses</h2>
                      <p className="muted-text">
                        Add official course equivalents. Transfer and AP
                        equivalencies need university confirmation.
                      </p>
                    </div>
                    {saveButton}
                  </div>
                  <CourseEditor
                    data={data}
                    state={state}
                    update={update}
                    showDetail={setDetail}
                  />
                </section>
              )}
              {view === "audit" && (
                <>
                  <div className="notice">
                    <strong>
                      Planning audit ·{" "}
                      {audit?.status === "COMPLETE"
                        ? "requirements satisfied"
                        : "verification incomplete"}
                    </strong>
                    <p>
                      Completed coursework is evaluated separately from
                      in-progress and planned coursework. Grade requirements are
                      never inferred.
                    </p>
                  </div>
                  <div className="audit-grid">
                    {program.requirements.children?.map((r) => (
                      <AuditGroup
                        key={r.id}
                        rule={r}
                        state={state}
                        data={data}
                        plan={plan}
                      />
                    ))}
                  </div>
                </>
              )}
              {(view === "explorer" || view === "next") && (
                <Explorer
                  data={data}
                  state={state}
                  remaining={remaining}
                  nextOnly={view === "next"}
                  showDetail={setDetail}
                />
              )}
              {(view === "plan" || view === "what-if") && (
                <>
                  <div className="plan-toolbar">
                    <div className="segmented">
                      {["fastest", "balanced", "light"].map((id) => (
                        <button
                          key={id}
                          aria-pressed={activePlan === id}
                          className={activePlan === id ? "selected" : ""}
                          onClick={() => {
                            setActivePlan(id);
                            setChangeIssues(null);
                          }}
                        >
                          {id === "fastest"
                            ? "Fastest"
                            : id === "balanced"
                              ? "Balanced"
                              : "Light workload"}
                        </button>
                      ))}
                    </div>
                    <div className="inline-actions">
                      {view === "what-if" && (
                        <button
                          className="button outline"
                          disabled={busy}
                          onClick={generate}
                        >
                          Regenerate & repair
                        </button>
                      )}
                      <button
                        className="button outline"
                        disabled={!plan || busy}
                        onClick={savePlan}
                      >
                        <Save size={16} />
                        Save plan
                      </button>
                    </div>
                  </div>
                  {view === "what-if" && (
                    <details className="panel compact">
                      <summary>
                        Change credit limits, summer, unavailable courses or
                        graduation target
                      </summary>
                      <PreferencesEditor
                        state={state}
                        update={(next) => {
                          setState(next);
                          if (plan)
                            setChangeIssues(
                              validatePlan(
                                plan,
                                data,
                                record,
                                next.preferences,
                              ),
                            );
                        }}
                      />
                    </details>
                  )}
                  {plan ? (
                    <>
                      <div className="plan-summary">
                        <CalendarDays size={24} />
                        <div>
                          <strong>
                            {plan.complete && plan.estimatedGraduation
                              ? `Estimated graduation: ${termLabel(plan.estimatedGraduation)}`
                              : "Partial course plan · graduation not established"}
                          </strong>
                          <p>
                            {plan.terms.length} quarters with planned coursework
                            · score {plan.score}
                          </p>
                        </div>
                        <span className="pill">{plan.name}</span>
                      </div>
                      <div className="term-grid">
                        {plan.terms.map((t, index) => (
                          <section className="term-card" key={termKey(t.term)}>
                            <header>
                              <span className="eyebrow">
                                QUARTER {index + 1}
                              </span>
                              <span className="pill muted">
                                {t.credits} credits
                              </span>
                              <h2>{termLabel(t.term)}</h2>
                            </header>
                            {t.courseIds.map((id) => {
                              const c = data.courses.find((c) => c.id === id)!;
                              return (
                                <div className="planned-course" key={id}>
                                  <button onClick={() => setDetail(c)}>
                                    <strong>
                                      {id}
                                      <span>{c.maxCredits} cr</span>
                                    </strong>
                                    <p>{c.title}</p>
                                    <small
                                      className={
                                        availability(
                                          c,
                                          t.term,
                                          data.offerings,
                                          data.offeringCoverage,
                                        ) === "CONFIRMED"
                                          ? "green-text"
                                          : "amber"
                                      }
                                    >
                                      {availability(
                                        c,
                                        t.term,
                                        data.offerings,
                                        data.offeringCoverage,
                                      ) === "CONFIRMED"
                                        ? "✓ Confirmed offering"
                                        : "Offering unknown"}
                                    </small>
                                  </button>
                                  {view === "what-if" ? (
                                    <div className="move-controls">
                                      <label>
                                        Move to
                                        <select
                                          aria-label={`Move ${id}`}
                                          value={index}
                                          onChange={(e) => {
                                            const result = whatIf(
                                              plan,
                                              data,
                                              record,
                                              state.preferences,
                                              {
                                                courseId: id,
                                                from: index,
                                                to: Number(e.target.value),
                                              },
                                            );
                                            setPlans(
                                              plans.map((p) =>
                                                p.id === plan.id
                                                  ? result.plan
                                                  : p,
                                              ),
                                            );
                                            setChangeIssues(result.violations);
                                            setMessage(
                                              `${id} moved. ${result.affected.length} direct dependent course rules may be affected. Revalidate requirements with the audit.`,
                                            );
                                          }}
                                        >
                                          {plan.terms.map((t, i) => (
                                            <option value={i} key={i}>
                                              {termLabel(t.term)}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <button
                                        className="icon-button"
                                        aria-label={`Remove ${id}`}
                                        onClick={() => {
                                          const result = whatIf(
                                            plan,
                                            data,
                                            record,
                                            state.preferences,
                                            { courseId: id, from: index },
                                          );
                                          setPlans(
                                            plans.map((p) =>
                                              p.id === plan.id
                                                ? result.plan
                                                : p,
                                            ),
                                          );
                                          setChangeIssues(result.violations);
                                          setMessage(
                                            `${id} removed. Graduation is no longer established; regenerate to search for repairs.`,
                                          );
                                        }}
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    </div>
                                  ) : (
                                    <details>
                                      <summary>Why this course?</summary>
                                      <ul>
                                        {t.reasons[id]?.map((reason) => (
                                          <li key={reason}>{reason}</li>
                                        ))}
                                      </ul>
                                    </details>
                                  )}
                                </div>
                              );
                            })}
                            {!t.courseIds.length && (
                              <p className="empty-inline">
                                No courses scheduled.
                              </p>
                            )}
                          </section>
                        ))}
                      </div>
                      {!plan.terms.length && (
                        <div className="empty">
                          <CalendarDays />
                          <h2>No feasible course group found</h2>
                          <p>
                            Review missing grades, prerequisites, unavailable
                            courses, and your minimum credit load.
                          </p>
                        </div>
                      )}
                      <section className="panel why-panel">
                        <div>
                          <GitBranch size={22} />
                          <h2>Why this plan?</h2>
                          <p>{plan.explanation}</p>
                        </div>
                        <ul>
                          {plan.warnings.map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      </section>
                      {changeIssues && (
                        <section className="panel">
                          <h2>Impact & repair options</h2>
                          {changeIssues.length ? (
                            changeIssues.map((issue, i) => (
                              <div
                                className={
                                  issue.severity === "ERROR"
                                    ? "error"
                                    : "notice"
                                }
                                key={i}
                              >
                                <strong>
                                  {issue.courseId} · {issue.term}
                                </strong>
                                <p>{issue.message}</p>
                                <small>Repair: {issue.repair}</small>
                              </div>
                            ))
                          ) : (
                            <p>
                              No course-order or credit-bound violations found.
                              Recheck degree requirements in the audit.
                            </p>
                          )}
                        </section>
                      )}
                    </>
                  ) : (
                    <div className="empty">
                      <CalendarDays size={38} />
                      <h2>Your plan starts with your progress</h2>
                      <p>
                        Generate and compare three course planning strategies.
                      </p>
                      {view === "what-if" && (
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={generate}
                        >
                          Generate plans <ArrowRight size={17} />
                        </button>
                      )}
                    </div>
                  )}
                  {saved.length > 0 && (
                    <section className="panel">
                      <h2>Saved plans</h2>
                      {loadedSnapshot && (
                        <section
                          className="panel saved-snapshot"
                          aria-label="Saved plan snapshot"
                        >
                          <h3>
                            {loadedSnapshot.name} ·{" "}
                            {majorForKey(loadedSnapshot.programCatalogId)
                              ?.displayName ?? "Archived program"}
                          </h3>
                          <p>
                            Read-only saved snapshot. Your active major and
                            current academic history have not changed. To edit
                            or regenerate, select this plan’s major and generate
                            from your current history.
                          </p>
                          {loadedSnapshot.programCatalogId !==
                            state.programCatalogId && (
                            <p className="notice">
                              This plan belongs to a different major. Use
                              “Change major” above to switch before generating a
                              new plan.
                            </p>
                          )}
                          {loadedSnapshot.plan.terms.map((t) => (
                            <div key={termKey(t.term)}>
                              <strong>
                                {termLabel(t.term)} · {t.credits} credits
                              </strong>
                              <p>{t.courseIds.join(", ") || "No courses"}</p>
                            </div>
                          ))}
                          {loadedSnapshot.plan.warnings.map((w, i) => (
                            <p className="notice" key={i}>
                              {w}
                            </p>
                          ))}
                          <button
                            className="button outline"
                            onClick={() => setLoadedSnapshot(null)}
                          >
                            Close saved snapshot
                          </button>
                        </section>
                      )}
                      {saved.map((s) => (
                        <button
                          className="saved-row"
                          key={s.id}
                          onClick={async () => {
                            const r = await fetch(
                              `/api/plans?id=${encodeURIComponent(s.id)}`,
                            );
                            if (r.ok) {
                              const p = await r.json();
                              setLoadedSnapshot({
                                name: p.name,
                                programCatalogId: savedProgramKey(p.config),
                                plan: p.result,
                              });
                              setMessage(
                                "Loaded saved snapshot. Current course history may differ.",
                              );
                            } else
                              setError("This saved plan could not be loaded.");
                          }}
                        >
                          {s.name} ·{" "}
                          {majorForKey(s.programCatalogId)?.displayName ??
                            "Archived program"}
                          <ArrowUpRight size={16} />
                        </button>
                      ))}
                    </section>
                  )}
                </>
              )}
              {view === "settings" && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Planning preferences</h2>
                    {saveButton}
                  </div>
                  <PreferencesEditor state={state} update={update} />
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={generate}
                  >
                    Update and generate plans
                  </button>
                </section>
              )}
              {view === "sources" && (
                <>
                  <section className="source-intro panel">
                    <ShieldCheck size={28} />
                    <div>
                      <h2>Official information. Visible limitations.</h2>
                      <p>
                        UW Seattle supports Computer Science and Business with
                        partial coverage. Business includes Foster’s shared BABA
                        core and selected foundations; electives,
                        specializations, writing, GPA, residency, and
                        substitutions require review. Business offerings have
                        not been imported. No complete degree audit or verified
                        historical catalog year is supported.
                      </p>
                    </div>
                  </section>
                  <div className="source-grid">
                    {data.sources.map((s) => (
                      <article className="panel" key={s.url}>
                        <span
                          className={
                            "pill " +
                            (s.status === "NEEDS_REVIEW"
                              ? "amber-pill"
                              : "green")
                          }
                        >
                          {s.status.replaceAll("_", " ")}
                        </span>
                        <h2>{s.name}</h2>
                        <p>{s.notes}</p>
                        <small>
                          Retrieved{" "}
                          {new Date(s.retrievedAt).toLocaleString("en-US", {
                            timeZone: "UTC",
                          })}{" "}
                          UTC
                        </small>
                        <a
                          className="panel-link"
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Official UW source <ArrowUpRight size={16} />
                        </a>
                      </article>
                    ))}
                  </div>
                  <section className="panel">
                    <h2>Recent import runs</h2>
                    {data.importHistory?.length ? (
                      data.importHistory.map((run, i) => (
                        <div className="requirement-summary" key={i}>
                          <span>
                            {run.source}
                            <small className="muted-text">
                              {" "}
                              ·{" "}
                              {new Date(run.startedAt).toLocaleString("en-US", {
                                timeZone: "UTC",
                              })}{" "}
                              UTC
                            </small>
                          </span>
                          <span
                            className={
                              "pill " +
                              (run.status === "SUCCESS"
                                ? "green"
                                : "amber-pill")
                            }
                          >
                            {run.status} · {run.recordsProcessed} records
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="muted-text">
                        Demo uses saved official fixtures. Live import history
                        is available in your personal workspace after database
                        setup.
                      </p>
                    )}
                    <h2 style={{ marginTop: 24 }}>Review queue</h2>
                    <p>
                      {
                        data.courses.filter(
                          (c) => c.parseStatus === "NEEDS_REVIEW",
                        ).length
                      }{" "}
                      course prerequisite rules need review. These rules block
                      automatic scheduling.
                    </p>
                    {data.courses
                      .filter((c) => c.parseStatus === "NEEDS_REVIEW")
                      .map((c) => courseRow(c, c.rawPrerequisite))}
                  </section>
                  <section className="panel">
                    <h2>How DegreePath makes decisions</h2>
                    <p>
                      Nested prerequisite expressions, course dependency graphs,
                      requirement checks and bounded beam search generate
                      deterministic results. Course credits are a workload
                      proxy; no unsupported course-difficulty estimates are
                      used.
                    </p>
                    <p>
                      Offering labels distinguish confirmed official course
                      presence from unknown availability. A published “Offered”
                      pattern is shown as source text, never a guarantee. Major
                      restrictions, section times, transfer credit, exceptions
                      and petitions need university review.
                    </p>
                    <p>
                      Successful imports update academic records
                      transactionally. Failed imports retain prior valid data.
                      Raw snapshots and import history are available through the
                      database diagnostic command in the README.
                    </p>
                  </section>
                </>
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>
              <ShieldCheck size={14} />
              Independent tool · no UW affiliation
            </span>
            <Disclaimer />
          </footer>
        </main>
      </div>
      {detail && (
        <CourseDetail
          course={detail}
          data={data}
          state={state}
          onClose={() => setDetail(null)}
          select={setDetail}
        />
      )}
    </div>
  );
}
function CourseEditor({
  data,
  state,
  update,
  showDetail,
}: {
  data: AcademicData;
  state: StudentState;
  update: (s: StudentState) => void;
  showDetail: (c: Course) => void;
}) {
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState(""),
    [status, setStatus] = useState<"COMPLETED" | "IN_PROGRESS">("COMPLETED"),
    [grade, setGrade] = useState(""),
    [courseTerm, setCourseTerm] = useState(state.preferences.start);
  const matches = data.courses
    .filter(
      (c) =>
        `${c.id} ${c.title}`.toLowerCase().includes(query.toLowerCase()) &&
        !state.courses.some((r) => r.courseId === c.id),
    )
    .slice(0, 15);
  return (
    <>
      <div className="add-course">
        <label className="search-field">
          Find a course
          <div>
            <Search size={17} />
            <input
              placeholder="Search CSE 123, calculus…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected("");
              }}
            />
          </div>
        </label>
        <label>
          Course
          <select
            aria-label="Select course"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a course</option>
            {matches.map((c) => (
              <option key={c.id}>{c.id}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="COMPLETED">Completed</option>
            <option value="IN_PROGRESS">In progress</option>
          </select>
        </label>
        <label>
          Grade (optional)
          <input
            aria-label="Grade (optional)"
            type="number"
            min={0}
            max={4}
            step={0.1}
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="0.0–4.0"
          />
        </label>
        <button
          className="button primary"
          disabled={
            !selected ||
            (grade !== "" && (Number(grade) < 0 || Number(grade) > 4))
          }
          onClick={() => {
            update({
              ...state,
              courses: [
                ...state.courses,
                {
                  courseId: selected,
                  status,
                  ...(grade !== "" ? { grade: Number(grade) } : {}),
                  ...(status === "IN_PROGRESS" ? { term: courseTerm } : {}),
                },
              ],
            });
            setSelected("");
            setQuery("");
            setGrade("");
          }}
        >
          <Plus size={17} />
          Add course
        </button>
      </div>
      {status === "IN_PROGRESS" && (
        <TermEditor
          label="In-progress course term"
          value={courseTerm}
          onChange={setCourseTerm}
        />
      )}
      <div className="record-list">
        {!state.courses.length && (
          <div className="empty-inline">
            Your course history is empty. Search above to add your first course.
          </div>
        )}
        {state.courses.map((row) => {
          const c = data.courses.find((c) => c.id === row.courseId);
          return (
            c && (
              <div className="record-row" key={c.id}>
                <CheckCircle2
                  size={20}
                  className={
                    row.status === "COMPLETED" ? "green-text" : "amber"
                  }
                />
                <button onClick={() => showDetail(c)}>
                  <strong>{c.id}</strong>
                  <span>{c.title}</span>
                </button>
                <span className="pill muted">
                  {row.status === "COMPLETED" ? "Completed" : "In progress"}
                </span>
                <label className="inline-grade">
                  Grade
                  <input
                    aria-label={`Grade for ${c.id}`}
                    type="number"
                    min={0}
                    max={4}
                    step={0.1}
                    value={row.grade ?? ""}
                    onChange={(e) =>
                      update({
                        ...state,
                        courses: state.courses.map((r) =>
                          r.courseId === c.id
                            ? {
                                ...r,
                                grade:
                                  e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value),
                              }
                            : r,
                        ),
                      })
                    }
                  />
                </label>
                <span>{c.minCredits} cr</span>
                <button
                  className="icon-button"
                  aria-label={`Delete ${c.id}`}
                  onClick={() =>
                    update({
                      ...state,
                      courses: state.courses.filter((r) => r.courseId !== c.id),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )
          );
        })}
      </div>
    </>
  );
}
function TermEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Term;
  onChange: (t: Term) => void;
}) {
  return (
    <fieldset className="term-editor">
      <legend>{label}</legend>
      <select
        aria-label={`${label} quarter`}
        value={value.season}
        onChange={(e) => onChange({ ...value, season: e.target.value })}
      >
        {["Winter", "Spring", "Summer", "Autumn"].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <input
        aria-label={`${label} year`}
        type="number"
        min={2000}
        max={2100}
        value={value.year}
        onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
      />
    </fieldset>
  );
}
function PreferencesEditor({
  state,
  update,
}: {
  state: StudentState;
  update: (s: StudentState) => void;
}) {
  const p = state.preferences;
  const [unavailableText, setUnavailableText] = useState(
    p.unavailable.join(", "),
  );
  const change = (value: Partial<typeof p>) =>
    update({ ...state, preferences: { ...p, ...value } });
  return (
    <div className="preferences-grid">
      <TermEditor
        label="Starting term"
        value={p.start}
        onChange={(start) => change({ start })}
      />
      <div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={!!p.target}
            onChange={(e) =>
              change({
                target: e.target.checked
                  ? { year: p.start.year + 2, season: "Spring" }
                  : undefined,
              })
            }
          />
          Set a graduation target
        </label>
        {p.target && (
          <TermEditor
            label="Graduation target"
            value={p.target}
            onChange={(target) => change({ target })}
          />
        )}
      </div>
      <label>
        Minimum credits per quarter
        <input
          type="number"
          min={1}
          max={30}
          value={p.minCredits}
          onChange={(e) => change({ minCredits: Number(e.target.value) })}
        />
      </label>
      <label>
        Maximum credits per quarter
        <input
          type="number"
          min={1}
          max={30}
          value={p.maxCredits}
          onChange={(e) => change({ maxCredits: Number(e.target.value) })}
        />
      </label>
      <label>
        Preferred pace
        <select
          value={p.workload}
          onChange={(e) =>
            change({ workload: e.target.value as typeof p.workload })
          }
        >
          <option value="light">Lighter workload</option>
          <option value="balanced">Balanced</option>
          <option value="fastest">Faster graduation</option>
        </select>
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={p.includeSummer}
          onChange={(e) => change({ includeSummer: e.target.checked })}
        />
        Include summer quarters
      </label>
      <label>
        Unavailable courses (comma separated)
        <input
          value={unavailableText}
          onChange={(e) => {
            setUnavailableText(e.target.value);
            change({
              unavailable: e.target.value
                .split(",")
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean),
            });
          }}
          placeholder="CSE 331, MATH 208"
        />
      </label>
      <p className="muted-text">
        The minimum is a hard limit. A final quarter below this minimum requires
        changing your preferences. Workload uses official credits.
      </p>
    </div>
  );
}
function AuditGroup({
  rule,
  state,
  data,
  plan,
}: {
  rule: Requirement;
  state: StudentState;
  data: AcademicData;
  plan?: Plan;
}) {
  const completed = evaluateRequirement(rule, state.courses, data.courses);
  const inProgress = state.courses.map((c) =>
    c.status === "IN_PROGRESS" ? { ...c, status: "COMPLETED" as const } : c,
  );
  const planned: StudentCourse[] = [
    ...inProgress,
    ...(plan?.terms.flatMap((t) =>
      t.courseIds.map((courseId) => ({
        courseId,
        status: "COMPLETED" as const,
      })),
    ) ?? []),
  ];
  return (
    <section className="panel audit-group">
      <div className="panel-heading">
        <h2>{rule.title}</h2>
        <span
          className={
            "pill " +
            (completed.status === "COMPLETE"
              ? "green"
              : completed.status === "REVIEW"
                ? "amber-pill"
                : "muted")
          }
        >
          {completed.status === "REVIEW"
            ? "Needs review"
            : completed.status.toLowerCase()}
        </span>
      </div>
      <p className="muted-text">
        {completed.earned} / {completed.needed}{" "}
        {rule.minCredits ? "credits" : "conditions"} completed
      </p>
      {requirementLeaves(rule).map((r) => {
        const a = evaluateRequirement(r, state.courses, data.courses);
        const inP = evaluateRequirement(r, inProgress, data.courses);
        const projected = evaluateRequirement(r, planned, data.courses);
        return (
          <div className="audit-item" key={r.id}>
            <span
              className={a.status === "COMPLETE" ? "green-text" : "muted-text"}
            >
              {a.status === "COMPLETE" ? (
                <CheckCircle2 size={18} />
              ) : a.status === "REVIEW" ? (
                <AlertTriangle size={18} />
              ) : (
                <span className="empty-circle" />
              )}
            </span>
            <div>
              <strong>{r.title}</strong>
              <small>
                {a.status === "COMPLETE"
                  ? "Completed"
                  : inP.status === "COMPLETE"
                    ? "In progress · contingent on passing"
                    : projected.status === "COMPLETE"
                      ? "Planned · contingent on passing"
                      : a.status === "REVIEW"
                        ? "Manual review or grade evidence required"
                        : "Remaining"}
                {r.minGrade !== undefined
                  ? ` · minimum grade ${r.minGrade}`
                  : ""}
              </small>
              {r.courseIds && (
                <small>
                  {r.courseIds.join(r.type === "ANY_OF" ? " OR " : " · ")}
                </small>
              )}
            </div>
          </div>
        );
      })}
      <details>
        <summary>Requirement text & source</summary>
        <p>{rule.rawText}</p>
        <a href={rule.sourceUrl} target="_blank" rel="noreferrer">
          Official requirement <ArrowUpRight size={14} />
        </a>
      </details>
    </section>
  );
}
function Explorer({
  data,
  state,
  remaining,
  nextOnly,
  showDetail,
}: {
  data: AcademicData;
  state: StudentState;
  remaining: string[];
  nextOnly: boolean;
  showDetail: (c: Course) => void;
}) {
  const [query, setQuery] = useState(""),
    [subject, setSubject] = useState(""),
    [level, setLevel] = useState(""),
    [credit, setCredit] = useState(""),
    [onlyEligible, setOnlyEligible] = useState(nextOnly),
    [onlyOffered, setOnlyOffered] = useState(false),
    [onlyRequired, setOnlyRequired] = useState(nextOnly),
    [rank, setRank] = useState("unlock"),
    [term, setTerm] = useState(state.preferences.start),
    [limit, setLimit] = useState(24);
  const eligible = getEligibleCourses(
    { courses: state.courses, programs: state.programs },
    term,
    data.courses,
    data.offerings,
    data.campus.calendar,
    data.offeringCoverage,
  );
  const rows = data.courses
    .filter(
      (c) =>
        `${c.id} ${c.title}`.toLowerCase().includes(query.toLowerCase()) &&
        (!subject || c.subject === subject) &&
        (!level || Math.floor(Number(c.number) / 100) === Number(level)) &&
        (!credit || c.minCredits === Number(credit)) &&
        (!onlyEligible || eligible.some((e) => e.course.id === c.id)) &&
        (!onlyOffered ||
          availability(c, term, data.offerings, data.offeringCoverage) ===
            "CONFIRMED") &&
        (!onlyRequired || remaining.includes(c.id)),
    )
    .sort((a, b) =>
      rank === "unlock"
        ? getCoursesUnlockedBy(b.id, data.courses).length -
            getCoursesUnlockedBy(a.id, data.courses).length ||
          a.id.localeCompare(b.id)
        : rank === "light"
          ? a.maxCredits - b.maxCredits || a.id.localeCompare(b.id)
          : a.id.localeCompare(b.id),
    );
  return (
    <>
      <section className="panel explorer-filters">
        <div className="filter-row">
          <label className="search-field">
            <span>Search courses</span>
            <div>
              <Search size={18} />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(24);
                }}
                placeholder="Course code or title"
              />
            </div>
          </label>
          <label>
            Department
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="">All departments</option>
              {[...new Set(data.courses.map((c) => c.subject))].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Level
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">All levels</option>
              {[1, 2, 3, 4].map((n) => (
                <option value={n} key={n}>
                  {n}00 level
                </option>
              ))}
            </select>
          </label>
          <label>
            Credits
            <select value={credit} onChange={(e) => setCredit(e.target.value)}>
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="filter-row secondary">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={onlyEligible}
              onChange={(e) => setOnlyEligible(e.target.checked)}
            />
            Eligible for selected term
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={onlyOffered}
              onChange={(e) => setOnlyOffered(e.target.checked)}
            />
            Confirmed offering
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={onlyRequired}
              onChange={(e) => setOnlyRequired(e.target.checked)}
            />
            Remaining requirement
          </label>
        </div>
        <div className="filter-row">
          <TermEditor label="Selected term" value={term} onChange={setTerm} />
          <label>
            Rank by
            <select value={rank} onChange={(e) => setRank(e.target.value)}>
              <option value="unlock">Prerequisite connections</option>
              <option value="light">Lower credit load</option>
              <option value="code">Course code</option>
            </select>
          </label>
        </div>
      </section>
      <p className="result-count">
        {rows.length} courses{" "}
        <span>
          ·{" "}
          {nextOnly
            ? "Eligible does not guarantee registration access."
            : "Only imported UW courses are shown; department coverage is partial."}
        </span>
      </p>
      <div className="course-grid">
        {rows.slice(0, limit).map((c) => (
          <button
            className="course-card"
            key={c.id}
            onClick={() => showDetail(c)}
          >
            <div>
              <span
                className={
                  "subject-chip " + (c.subject === "MATH" ? "math" : "")
                }
              >
                {c.subject}
              </span>
              <span className="credits">
                {c.minCredits === c.maxCredits
                  ? c.minCredits
                  : `${c.minCredits}–${c.maxCredits}`}{" "}
                credits
              </span>
            </div>
            <h2>
              {c.id}
              <ArrowUpRight size={18} />
            </h2>
            <h3>{c.title}</h3>
            <p>{c.description}</p>
            <div className="course-card-footer">
              <span
                className={
                  "pill " +
                  (eligible.some((e) => e.course.id === c.id)
                    ? "green"
                    : c.parseStatus === "NEEDS_REVIEW"
                      ? "amber-pill"
                      : "muted")
                }
              >
                {eligible.some((e) => e.course.id === c.id)
                  ? "Prerequisites met"
                  : c.parseStatus === "NEEDS_REVIEW"
                    ? "Needs review"
                    : "Check prerequisites"}
              </span>
              <small>
                {availability(
                  c,
                  term,
                  data.offerings,
                  data.offeringCoverage,
                ) === "CONFIRMED"
                  ? "Confirmed offering"
                  : "Offering unknown"}
              </small>
            </div>
            {nextOnly && (
              <p className="recommend-reason">
                Contributes to a remaining requirement; referenced by{" "}
                {getCoursesUnlockedBy(c.id, data.courses).length} later course
                rules.
              </p>
            )}
          </button>
        ))}
      </div>
      {!rows.length && (
        <div className="empty">
          <Search />
          <h2>No matching courses</h2>
          <p>Try fewer filters or add completed courses and required grades.</p>
        </div>
      )}
      {limit < rows.length && (
        <button
          className="button outline load-more"
          onClick={() => setLimit(limit + 24)}
        >
          Show more courses
        </button>
      )}
    </>
  );
}
function CourseDetail({
  course: c,
  data,
  state,
  onClose,
  select,
}: {
  course: Course;
  data: AcademicData;
  state: StudentState;
  onClose: () => void;
  select: (c: Course) => void;
}) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const close = document.getElementById("close-course");
    close?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const focusable = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".course-dialog button,.course-dialog a,.course-dialog summary",
          ),
        );
        const first = focusable[0],
          last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, [onClose]);
  const evaluation = evaluatePrerequisite(
    c.prerequisite,
    { courses: state.courses, programs: state.programs },
    data.courses,
  );
  const chain = shortestPrerequisiteSet(
    c.id,
    new Set(
      state.courses
        .filter((r) => r.status === "COMPLETED")
        .map((r) => r.courseId),
    ),
    data.courses,
  );
  const prerequisites = referencedCourses(c.prerequisite),
    unlocks = getCoursesUnlockedBy(c.id, data.courses);
  const node = (id: string) => {
    const course = data.courses.find((c) => c.id === id);
    const done = state.courses.some(
      (r) => r.courseId === id && r.status === "COMPLETED",
    );
    return (
      <button
        className={"graph-node " + (done ? "done" : "")}
        key={id}
        disabled={!course}
        onClick={() => course && select(course)}
      >
        {done && <Check size={14} />}
        <strong>{id}</strong>
        <small>
          {done ? "Completed" : course ? "View course" : "Not imported"}
        </small>
      </button>
    );
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="course-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          id="close-course"
          className="icon-button modal-close"
          aria-label="Close course detail"
          onClick={onClose}
        >
          <X />
        </button>
        <span className="eyebrow">COURSE EXPLORER / {c.subject}</span>
        <h1 id="course-title">{c.id}</h1>
        <h2>{c.title}</h2>
        <div className="detail-badges">
          <span className="pill">
            {c.minCredits}–{c.maxCredits} credits
          </span>
          {c.attributes.map((a) => (
            <span className="pill muted" key={a}>
              {a}
            </span>
          ))}
          <span className="pill amber-pill">
            {c.parseStatus.replaceAll("_", " ")}
          </span>
        </div>
        <p>{c.description}</p>
        <section>
          <h3>Required prerequisites</h3>
          <p>
            {c.rawPrerequisite ||
              "No required prerequisite is listed in the catalog."}
          </p>
          <code className="rule-code">{ruleLabel(c.prerequisite)}</code>
          <p
            className={
              evaluation.status === "SATISFIED" ? "green-text" : "amber"
            }
          >
            {evaluation.status === "SATISFIED"
              ? "✓ Prerequisite rule satisfied"
              : evaluation.reasons.join(" · ")}
          </p>
          {c.recommended && (
            <>
              <h3>Recommended preparation · not required</h3>
              <p>{c.recommended}</p>
            </>
          )}
        </section>
        <section>
          <h3>Course connections</h3>
          <p className="muted-text">
            Connections show every referenced course, including alternatives.
            Follow the AND/OR rule above.
          </p>
          <div className="graph-tree">
            <span className="eyebrow">PREREQUISITES</span>
            <div className="graph-level">
              {prerequisites.length ? (
                prerequisites.map(node)
              ) : (
                <span>No required course connections</span>
              )}
            </div>
            <div className="graph-connector">↓</div>
            <div className="graph-node selected">
              <strong>{c.id}</strong>
              <small>Selected course</small>
            </div>
            <div className="graph-connector">↓</div>
            <span className="eyebrow">REFERENCED BY</span>
            <div className="graph-level">
              {unlocks.length ? (
                unlocks.map(node)
              ) : (
                <span>No downstream connections in imported data</span>
              )}
            </div>
          </div>
          <p>
            {getTransitivePrerequisites(c.id, data.courses).length} transitive
            prerequisite connections.
          </p>
          <details>
            <summary>Shortest prerequisite course set</summary>
            <p>
              {chain.courses.length
                ? chain.courses.join(" → ")
                : "No additional prerequisite courses in the modeled rule."}
            </p>
            <p>
              {chain.review
                ? "This course set needs grade, permission or rule review. It is not a verified path."
                : "This set preserves required AND branches and chooses a shortest OR alternative."}
            </p>
          </details>
        </section>
        <section>
          <h3>Known offerings</h3>
          {data.offerings
            .filter((o) => o.courseId === c.id)
            .map((o) => (
              <p key={termKey(o.term)}>
                <span className="pill green">{o.status}</span>{" "}
                {termLabel(o.term)}
              </p>
            ))}
          {!data.offerings.some((o) => o.courseId === c.id) && (
            <p>No confirmed offerings imported for this course.</p>
          )}
          {c.offeringPattern && (
            <p>
              Published catalog text: “{c.offeringPattern}” Future offering not
              guaranteed.
            </p>
          )}
        </section>
        <section>
          <h3>Requirements this course may satisfy</h3>
          {data.programs.flatMap((p) =>
            requirementLeaves(p.requirements)
              .filter((r) => r.courseIds?.includes(c.id))
              .map((r) => (
                <p key={r.id}>
                  {r.title} · {p.name}
                </p>
              )),
          )}
          <p className="muted-text">
            Other categories and elective lists may require manual review.
          </p>
        </section>
        <footer>
          <a
            className="button outline"
            href={c.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Official course catalog <ArrowUpRight size={17} />
          </a>
          <small>
            Retrieved{" "}
            {new Date(c.retrievedAt).toLocaleString("en-US", {
              timeZone: "UTC",
            })}{" "}
            UTC
          </small>
        </footer>
      </section>
    </div>
  );
}
